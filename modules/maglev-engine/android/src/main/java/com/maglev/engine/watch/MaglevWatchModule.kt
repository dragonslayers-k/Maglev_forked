package com.maglev.engine.watch

import android.content.Context
import android.content.Intent
import com.maglev.engine.player.MaglevMediaPlayerActivity
import com.maglev.engine.browser.MaglevBrowserView
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

        AsyncFunction("playInAppMedia") { url: String, mime: String, title: String, headers: Map<String, Any?>?, promise: Promise ->
            val activity = appContext.currentActivity
            val c = context
            if (activity == null || c == null) {
                promise.resolve(mapOf("ok" to false, "code" to "NOT_READY", "message" to "앱 화면을 사용할 수 없습니다."))
            } else if (url.isBlank() || !(url.startsWith("https://", true) || url.startsWith("http://", true) || url.startsWith("content://", true) || url.startsWith("file://", true))) {
                promise.resolve(mapOf("ok" to false, "code" to "INVALID_URL", "message" to "재생할 수 없는 미디어 주소입니다."))
            } else {
                val safeHeaders = HashMap<String, String>()
                headers?.forEach { (key, value) ->
                    if (key.length <= 128 && value is String && value.length <= 8192 && !key.contains("\r") && !key.contains("\n") && !value.contains("\r") && !value.contains("\n")) safeHeaders[key] = value
                }
                activity.runOnUiThread {
                    try {
                        val intent = Intent(activity, MaglevMediaPlayerActivity::class.java)
                            .putExtra(MaglevMediaPlayerActivity.EXTRA_URI, url)
                            .putExtra(MaglevMediaPlayerActivity.EXTRA_MIME, mime.take(128))
                            .putExtra(MaglevMediaPlayerActivity.EXTRA_TITLE, title.take(200))
                            .putExtra(MaglevMediaPlayerActivity.EXTRA_HEADERS, safeHeaders)
                        activity.startActivity(intent)
                        promise.resolve(mapOf("ok" to true))
                    } catch (_: Throwable) {
                        promise.resolve(mapOf("ok" to false, "code" to "PLAYER_START_FAILED", "message" to "앱 내 미디어 플레이어를 열지 못했습니다."))
                    }
                }
            }
        }

        AsyncFunction("enterBrowserPictureInPicture") { requestedAspectRatio: Double, promise: Promise ->
            val activity = appContext.currentActivity
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                promise.resolve(mapOf("ok" to false, "code" to "UNSUPPORTED", "message" to "Picture-in-picture requires Android 8.0 or later."))
            } else if (activity == null) {
                promise.resolve(mapOf("ok" to false, "code" to "NOT_READY", "message" to "The app screen is not available."))
            } else if (!MaglevBrowserView.fullscreenVideoActive) {
                // Inline players (including YouTube mobile Web) do not expose a native custom video
                // surface until their fullscreen control is invoked. Request that transition from
                // the active WebView; showFullscreen will enter PiP after measuring the video ratio.
                activity.runOnUiThread {
                    MaglevBrowserView.requestFullscreenVideoForPip(requestedAspectRatio) { accepted ->
                        if (accepted) {
                            promise.resolve(mapOf("ok" to true, "pending" to true))
                        } else {
                            promise.resolve(mapOf(
                                "ok" to false,
                                "code" to "VIDEO_NOT_FOUND",
                                "message" to "현재 페이지에서 재생 가능한 동영상을 찾지 못했습니다. 먼저 영상 재생을 시작하세요."
                            ))
                        }
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
                        promise.resolve(mapOf("ok" to entered))
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
