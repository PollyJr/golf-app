package club.fairway.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.getSystemService
import androidx.core.net.toUri
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

/**
 * Fairway for Android: the web app at [BuildConfig.BASE_URL] in a WebView,
 * plus what a browser tab cannot do on its own — open QR-code links straight
 * in the app, give the QR scanner the camera, share through the Android share
 * sheet and keep the session between launches.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var offline: View

    private val home: Uri by lazy { BuildConfig.BASE_URL.toUri() }

    /** Set once the page's renderer has died; the WebView must not be touched after that. */
    private var rendererGone = false

    /** A camera request from the page that waits for the user's answer to Android's dialog. */
    private var pendingCameraRequest: PermissionRequest? = null

    private val cameraPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val request = pendingCameraRequest ?: return@registerForActivityResult
        pendingCameraRequest = null
        if (granted) request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) else request.deny()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        progress = findViewById(R.id.progress)
        offline = findViewById(R.id.offline)
        findViewById<Button>(R.id.retry).setOnClickListener { retry() }

        // Draw edge to edge, but keep the page clear of the status bar, the
        // navigation bar, a display cutout and the keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime(),
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        configureWebView()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(startUrl(intent))
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        CookieManager.getInstance().setAcceptCookie(true)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            // The scanner's camera preview starts without a tap on the video.
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
            // The web app recognises the app by this, e.g. to hide its download link.
            userAgentString = "$userAgentString FairwayAndroid/${BuildConfig.VERSION_NAME}"
        }
        // The site has its own dark theme; Android must not invert its colours.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.settings, false)
        }

        webView.addJavascriptInterface(NativeBridge(this), NativeBridge.NAME)
        webView.webViewClient = FairwayWebViewClient()
        webView.webChromeClient = FairwayChromeClient()
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            download(url.toUri(), userAgent, contentDisposition, mimeType)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // A QR code scanned with the phone's camera while the app is open.
        if (isOwnLink(intent.data)) webView.loadUrl(intent.data.toString())
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (!rendererGone) webView.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        // Keep the session when Android stops the app in the background.
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        if (!rendererGone) webView.destroy()
        super.onDestroy()
    }

    private fun startUrl(intent: Intent?): String {
        val link = intent?.data
        return if (isOwnLink(link)) link.toString() else home.toString()
    }

    private fun isOwnLink(uri: Uri?): Boolean =
        uri != null && uri.scheme == "https" && uri.host.equals(home.host, ignoreCase = true)

    private fun retry() {
        offline.isVisible = false
        val current = webView.url
        if (current.isNullOrBlank() || current == "about:blank") webView.loadUrl(home.toString()) else webView.reload()
    }

    private fun openExternally(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show()
        }
    }

    /** CSV exports and calendar files: downloaded with the session cookie, like in a browser. */
    private fun download(uri: Uri, userAgent: String, contentDisposition: String?, mimeType: String?) {
        if (!isOwnLink(uri)) {
            openExternally(uri)
            return
        }
        val name = URLUtil.guessFileName(uri.toString(), contentDisposition, mimeType)
        val request = DownloadManager.Request(uri)
            .setMimeType(mimeType)
            .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(uri.toString()) ?: "")
            .addRequestHeader("User-Agent", userAgent)
            .setTitle(name)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
        }
        getSystemService<DownloadManager>()?.enqueue(request)
        Toast.makeText(this, getString(R.string.download_started, name), Toast.LENGTH_SHORT).show()
    }

    private inner class FairwayWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            // Our own pages stay in the app; everything else (maps, mail,
            // phone numbers, websites) goes to the app made for it.
            if (isOwnLink(uri)) return false
            openExternally(uri)
            return true
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            offline.isVisible = false
        }

        override fun onPageFinished(view: WebView, url: String?) {
            CookieManager.getInstance().flush()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) offline.isVisible = true
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // The page's renderer crashed or Android stopped it to free memory.
            // Start afresh with a new WebView instead of crashing the app with it.
            rendererGone = true
            (view.parent as? ViewGroup)?.removeView(view)
            view.destroy()
            recreate()
            return true
        }
    }

    private inner class FairwayChromeClient : WebChromeClient() {
        override fun onProgressChanged(view: WebView, newProgress: Int) {
            progress.progress = newProgress
            progress.isVisible = newProgress < 100
        }

        override fun onPermissionRequest(request: PermissionRequest) {
            runOnUiThread {
                val fromOwnSite = request.origin.host.equals(home.host, ignoreCase = true)
                val wantsCamera = PermissionRequest.RESOURCE_VIDEO_CAPTURE in request.resources
                when {
                    !fromOwnSite || !wantsCamera -> request.deny()
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) ==
                        PackageManager.PERMISSION_GRANTED -> request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                    else -> {
                        pendingCameraRequest?.deny()
                        pendingCameraRequest = request
                        cameraPermission.launch(Manifest.permission.CAMERA)
                    }
                }
            }
        }

        override fun onPermissionRequestCanceled(request: PermissionRequest) {
            if (pendingCameraRequest == request) pendingCameraRequest = null
        }
    }
}
