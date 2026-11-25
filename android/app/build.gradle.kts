import java.net.URI

plugins {
    id("com.android.application")
}

val baseUrl = (findProperty("fairwayBaseUrl") as String?)?.trimEnd('/')
    ?: error("Set fairwayBaseUrl in gradle.properties")

android {
    namespace = "club.fairway.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "club.fairway.app"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "2.1.0"

        buildConfigField("String", "BASE_URL", "\"$baseUrl\"")
        // Links to this host open in the app (see the intent filter).
        manifestPlaceholders["appHost"] = URI(baseUrl).host
    }

    signingConfigs {
        // A debug key that lives in the repository, so every build is signed
        // the same way: an update installs over the previous one, and the
        // web app's assetlinks.json can name its fingerprint. Not for release.
        getByName("debug") {
            storeFile = rootProject.file("keystore/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            versionNameSuffix = "-debug"
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("androidx.activity:activity-ktx:1.13.0")
    implementation("androidx.webkit:webkit:1.18.0")
}
