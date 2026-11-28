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
                // Inline players (including YouTube mobile Web) do not expose a native custom video
                // surface until their fullscreen control is invoked. Request that transition from
                // the active WebView; showFullscreen will enter PiP after measuring the video ratio.
                activity.runOnUiThread {
                    MaglevBrowserView.requestFullscreenVideoForPip(requestedAspectRatio) { accepted, reason ->
                        if (accepted) {
                            promise.resolve(mapOf("ok" to true, "pending" to true))
                        } else {
                            val code = when (reason) {
                                "TAB_NOT_ACTIVE", "NO_ACTIVE_TAB" -> "TAB_NOT_ACTIVE"
                                "NO_VIDEO", "NO_RESPONSE" -> "VIDEO_NOT_FOUND"
                                "BAD_RATIO" -> "BAD_VIDEO_RATIO"
                                "FULLSCREEN_UNAVAILABLE" -> "FULLSCREEN_UNAVAILABLE"
                                "FULLSCREEN_TIMEOUT" -> "FULLSCREEN_TIMEOUT"
                                else -> "FULLSCREEN_HANDOFF_FAILED"
                            }
                            val message = when (code) {
                                "TAB_NOT_ACTIVE" -> "현재 탭이 활성 상태가 아닙니다. 영상이 재생 중인 탭으로 돌아와 다시 시도하세요."
                                "VIDEO_NOT_FOUND" -> "현재 페이지에서 재생 중인 동영상을 찾지 못했습니다. 먼저 영상 재생을 시작하세요."
                                "BAD_VIDEO_RATIO" -> "영상 화면 비율을 확인할 수 없습니다. 영상 플레이어의 전체 화면 버튼을 눌러 다시 시도하세요."
                                "FULLSCREEN_UNAVAILABLE" -> "이 플레이어는 전체 화면 전환을 지원하지 않습니다. 플레이어의 전체 화면 버튼을 먼저 사용하세요."
                                "FULLSCREEN_TIMEOUT" -> "전체 화면 전환 응답이 없습니다. 플레이어의 전체 화면 버튼을 누른 뒤 앱의 PiP 버튼을 다시 누르세요."
                                else -> "브라우저에서 전체 화면 전환을 완료하지 못했습니다. 플레이어의 전체 화면 버튼을 누른 뒤 앱의 PiP 버튼을 다시 누르세요."
                            }
                            promise.resolve(mapOf("ok" to false, "code" to code, "message" to message))
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
