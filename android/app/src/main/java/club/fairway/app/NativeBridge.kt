package club.fairway.app

import android.content.Intent
import android.webkit.JavascriptInterface
import androidx.activity.ComponentActivity

/**
 * Available to the web app as `window.FairwayNative`. Only our own site is
 * ever loaded in the WebView: links to other sites open outside the app.
 */
class NativeBridge(private val activity: ComponentActivity) {

    /** The Android share sheet, for the live link of a round. */
    @JavascriptInterface
    fun share(text: String, url: String) {
        val send = Intent(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, if (text.isBlank()) url else "$text\n$url")
        activity.runOnUiThread {
            activity.startActivity(Intent.createChooser(send, null))
        }
    }

    @JavascriptInterface
    fun version(): String = BuildConfig.VERSION_NAME

    companion object {
        const val NAME = "FairwayNative"
    }
}
