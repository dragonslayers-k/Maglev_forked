package com.maglev.engine.watch

import android.content.Context
import android.app.PictureInPictureParams
import android.app.Activity
import android.os.Build
import android.util.Rational
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.maglev.engine.EngineHost
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The small native surface the watch background task needs (docs/contracts-0.19/watch.md section 7):
 * the network the job is running on, and the notification. Register it in modules/maglev-engine/expo-module.config.json.
 */
class MaglevWatchModule : Module() {
    private val context: Context?
        get() = appContext.reactContext?.applicationContext

    override fun definition() = ModuleDefinition {
        Name("MaglevWatch")

        AsyncFunction("enterBrowserPictureInPicture") { promise: Promise ->
            val activity = appContext.currentActivity
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                promise.resolve(mapOf("ok" to false, "code" to "PIP_UNSUPPORTED", "message" to "Picture-in-picture requires Android 8.0 or later."))
            } else if (activity == null) {
                promise.resolve(mapOf("ok" to false, "code" to "ACTIVITY_UNAVAILABLE", "message" to "The app screen is not available."))
            } else {
                try {
                    val params = PictureInPictureParams.Builder()
                        .setAspectRatio(Rational(16, 9))
                        .build()
                    promise.resolve(mapOf("ok" to activity.enterPictureInPictureMode(params)))
                } catch (_: Throwable) {
                    promise.resolve(mapOf("ok" to false, "code" to "PIP_FAILED", "message" to "Android could not start picture-in-picture."))
                }
            }
        }

        Function("getNetwork") {
            val c = context
            if (c == null) {
                linkedMapOf("connected" to false, "unmetered" to false, "globalWifiOnly" to false)
            } else {
                networkOf(c)
            }
        }

        Function("notify") { n: Map<String, Any?> ->
            val c = context
            c != null && WatchNotifier.notify(c, n)
        }

        Function("cancel") { watchId: String ->
            context?.let { WatchNotifier.cancel(it, watchId) }
        }
    }

    private fun networkOf(c: Context): Map<String, Any?> {
        val wifiOnly = c.getSharedPreferences(EngineHost.GOV_PREFS, Context.MODE_PRIVATE).getBoolean("wifiOnly", false)
        val cm = c.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val caps = try {
            cm?.getNetworkCapabilities(cm.activeNetwork)
        } catch (_: Exception) {
            null
        }
        val connected = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        val unmetered = connected && caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED) == true
        return linkedMapOf("connected" to connected, "unmetered" to unmetered, "globalWifiOnly" to wifiOnly)
    }
}
