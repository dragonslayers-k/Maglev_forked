package com.maglev.engine.watch

import android.content.Context
import android.app.PictureInPictureParams
import android.app.Activity
import android.os.Build
import android.util.Rational
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.maglev.engine.EngineHost
import com.maglev.engine.browser.MaglevBrowserView
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

        AsyncFunction("enterBrowserPictureInPicture") { requestedAspectRatio: Double, promise: Promise ->
            val activity = appContext.currentActivity
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                promise.resolve(mapOf("ok" to false, "code" to "UNSUPPORTED", "message" to "Picture-in-picture requires Android 8.0 or later."))
            } else if (activity == null) {
                promise.resolve(mapOf("ok" to false, "code" to "NOT_READY", "message" to "The app screen is not available."))
            } else if (!MaglevBrowserView.fullscreenVideoActive) {
                // Do not synthesize a WebView fullscreen click from evaluateJavascript:
                // that call has no transient user activation, so Chromium may reject
                // requestFullscreen() and leave the browser-menu PiP request stuck.
                // Android PiP is an Activity operation and can start directly while the
                // inline HTML video keeps playing in its WebView Surface.
                val ratio = if (requestedAspectRatio.isFinite()) {
                    requestedAspectRatio.coerceIn(0.42, 2.39)
                } else {
                    (16.0 / 9.0)
                }
                val numerator = (ratio * 1000.0).toInt().coerceAtLeast(1)
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(numerator, 1000))
                    .build()
                activity.runOnUiThread {
                    try {
                        val entered = activity.enterPictureInPictureMode(params)
                        promise.resolve(
                            if (entered) mapOf("ok" to true)
                            else mapOf("ok" to false, "code" to "PIP_DENIED", "message" to "Android에서 PiP 전환을 거부했습니다. 영상이 재생 중인지 확인하고 다시 시도하세요.")
                        )
                    } catch (_: Throwable) {
                        promise.resolve(mapOf("ok" to false, "code" to "INTERNAL", "message" to "Android에서 PiP를 시작하지 못했습니다."))
                    }
                }
            } else {
                // Prefer the intrinsic dimensions measured from the active HTML video element.
                // Fall back to the discovered media ratio only until the WebView measurement arrives.
                val activeRatio = MaglevBrowserView.activeVideoAspectRatio
                val ratio = if (MaglevBrowserView.activeVideoAspectRatioKnown && activeRatio.isFinite()) {
                    activeRatio.coerceIn(0.42, 2.39)
                } else if (requestedAspectRatio.isFinite()) {
                    requestedAspectRatio.coerceIn(0.42, 2.39)
                } else {
                    (16.0 / 9.0)
                }
                val numerator = (ratio * 1000.0).toInt().coerceAtLeast(1)
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(numerator, 1000))
                    .build()
                // PiP is a Window/Activity operation. Run it on the UI thread and report the
                // actual platform return value instead of resolving before the transition.
                activity.runOnUiThread {
                    try {
                        val entered = activity.enterPictureInPictureMode(params)
                        promise.resolve(if (entered) mapOf("ok" to true) else mapOf("ok" to false, "code" to "PIP_DENIED", "message" to "Android에서 PiP 전환을 거부했습니다. 재생 중인 영상인지 확인하고 다시 시도하세요."))
                    } catch (_: Throwable) {
                        promise.resolve(mapOf("ok" to false, "code" to "INTERNAL", "message" to "Android could not start picture-in-picture."))
                    }
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
