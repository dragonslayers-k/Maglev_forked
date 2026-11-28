package com.maglev.engine.wireguard

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.net.Uri
import android.util.Base64
import android.webkit.WebView
import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import androidx.webkit.WebViewFeature
import com.maglev.engine.EngineHost
import com.maglev.engine.util.Json
import java.security.SecureRandom
import java.net.InetSocketAddress
import java.net.Proxy
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import okhttp3.Credentials
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

/** App-local HTTP(S) download tunnel; no VpnService and no device route changes. */
object WireGuardController {
    private const val PREFS = "maglev_app_wireguard"
    private const val ENABLED = "enabled"
    private const val USER = "maglev"
    internal const val CLOSED_PROXY = "http://maglev:blocked@127.0.0.1:9"
    private val lock = Any()
    @Volatile private var running = false
    @Volatile private var localProxy: String? = null
    @Volatile private var proxyPort: Int = 0
    @Volatile private var proxyUsername: String? = null
    @Volatile private var proxyPassword: String? = null
    @Volatile private var browserProxyApplied: Boolean = false
    /** True after any process-wide WebView proxy override, including the temporary closed proxy. */
    @Volatile private var browserProxyInstalled: Boolean = false
    @Volatile private var lastBrowserProxyError: String? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var pausedDownloadsForEnable: List<String> = emptyList()

    fun isEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(ENABLED, false)

    fun hasProfile(context: Context): Boolean = WireGuardProfileStore.hasProfile(context)

    fun importProfile(context: Context, uri: Uri) {
        val text = WireGuardProfileStore.readUri(context, uri)
        WireGuardProfileStore.saveProfile(context, text)
    }

    fun setEnabled(context: Context, enabled: Boolean): Map<String, Any?> = synchronized(lock) {
        if (enabled) {
            if (!hasProfile(context)) return@synchronized Json.failure(
                "APP_WIREGUARD_PROFILE_MISSING", "먼저 WireGuard .conf 프로필을 가져오세요.")
            if (EngineHost.isEngineInitialized()) {
                val paused = EngineHost.pauseTorrentsForAppWireGuard()
                if (paused["ok"] != true) return@synchronized Json.failure(
                    "APP_WIREGUARD_TORRENT_PAUSE_FAILED", "기존 토렌트 전송을 안전하게 멈추지 못해 WireGuard를 켜지 않았습니다.")
                val pausedDownloads = EngineHost.pauseDownloadsForAppWireGuard()
                if (pausedDownloads["ok"] != true) return@synchronized Json.failure(
                    "APP_WIREGUARD_DOWNLOAD_PAUSE_FAILED", "기존 다운로드를 안전하게 멈추지 못해 WireGuard를 켜지 않았습니다.")
                pausedDownloadsForEnable = (pausedDownloads["paused_ids"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
            }
            if (EngineHost.isEngineInitialized()) {
                val saved = saveOriginalProxyIfNeeded(context)
                if (saved["ok"] != true) {
                    if (pausedDownloadsForEnable.isNotEmpty()) EngineHost.resumeDownloadsAfterAppWireGuard(pausedDownloadsForEnable)
                    pausedDownloadsForEnable = emptyList()
                    return@synchronized saved
                }
            }
            // Block app WebView requests during startup; never leave them on direct networking.
            if (!installBrowserProxy(9, active = false)) {
                if (pausedDownloadsForEnable.isNotEmpty()) EngineHost.resumeDownloadsAfterAppWireGuard(pausedDownloadsForEnable)
                pausedDownloadsForEnable = emptyList()
                return@synchronized Json.failure(
                    "APP_WIREGUARD_BROWSER_PROXY_FAILED", "앱 브라우저를 연결 전 차단 상태로 전환하지 못했습니다. " + browserProxyFailureSuffix())
            }
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, true).apply()
            // Start the userspace tunnel and authenticated loopback proxy immediately when the
            // app-local switch is enabled; it is not deferred until the first download.
            val started = startTunnel(context)
            if (started["ok"] != true) {
                val savedProxy = if (WireGuardProfileStore.hasOriginalProxy(context)) {
                    WireGuardProfileStore.loadOriginalProxy(context)
                } else null
                val restored = if (EngineHost.isEngineInitialized()) {
                    EngineHost.setAppWireGuardProxy(savedProxy)["ok"] == true
                } else true
                clearBrowserProxy()
                runCatching { NativeTunnel.stop() }
                running = false
                localProxy = null
                proxyPort = 0
                proxyUsername = null
                proxyPassword = null
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, false).apply()
                if (restored) {
                    WireGuardProfileStore.clearOriginalProxy(context)
                    if (pausedDownloadsForEnable.isNotEmpty()) EngineHost.resumeDownloadsAfterAppWireGuard(pausedDownloadsForEnable)
                    pausedDownloadsForEnable = emptyList()
                }
                return@synchronized if (restored) started else Json.failure(
                    "APP_WIREGUARD_ROLLBACK_FAILED",
                    "WireGuard 시작은 실패했고 기존 다운로드 프록시 복원도 실패했습니다. 다운로드는 안전을 위해 일시 중지된 상태입니다.")
            }
            if (EngineHost.isEngineInitialized()) {
                val applied = applyTunnelToEngine()
                if (applied["ok"] != true) return@synchronized Json.failure(
                    "APP_WIREGUARD_ENGINE_APPLY_FAILED",
                    "WireGuard 터널은 실행 중이지만 다운로드 엔진 프록시 적용에 실패했습니다. 다운로드는 재개하지 않았습니다. " + (applied["message"]?.toString() ?: ""))
                val pausedIds = pausedDownloadsForEnable
                pausedDownloadsForEnable = emptyList()
                val resumed = if (pausedIds.isNotEmpty()) EngineHost.resumeDownloadsAfterAppWireGuard(pausedIds) else mapOf("ok" to true)
                return@synchronized mapOf(
                    "ok" to true, "enabled" to true, "running" to true,
                    "resumed_downloads" to (resumed["resumed"] ?: 0),
                    "message" to "앱 브라우저와 HTTP/HTTPS 다운로드에 WireGuard 프록시를 적용했습니다.")
            }
            pausedDownloadsForEnable = emptyList()
            return@synchronized mapOf(
                "ok" to true, "enabled" to true, "running" to true,
                "download_engine_ready" to false,
                "message" to "앱 브라우저 WireGuard 터널을 시작했습니다. 다운로드 엔진이 준비되면 HTTP/HTTPS 다운로드에도 터널을 적용합니다.")
        }

        val hasSaved = WireGuardProfileStore.hasOriginalProxy(context)
        if (hasSaved && !EngineHost.isEngineInitialized()) {
            val engineStarted = EngineHost.ensureStarted()
            if (engineStarted["ok"] != true) {
                val code = engineStarted["code"]?.toString()?.take(80) ?: "UNKNOWN"
                val message = engineStarted["message"]?.toString()?.take(500) ?: "다운로드 엔진을 시작하지 못했습니다."
                return@synchronized Json.failure(
                    "APP_WIREGUARD_RESTORE_ENGINE_START_FAILED",
                    "기존 프록시 복원 엔진이 시작되지 않아 WireGuard를 계속 유지합니다. [$code] $message")
            }
        }
        // Remove the WebView route before restoring the downloader's original proxy. If restore
        // fails, put the browser route back so the still-enabled tunnel cannot silently go direct.
        if (!clearBrowserProxy()) return@synchronized Json.failure(
            "APP_WIREGUARD_BROWSER_PROXY_CLEAR_FAILED",
            "앱 브라우저 프록시를 안전하게 해제하지 못했습니다. 연결 상태를 유지했습니다.")
        if (running || hasSaved) {
            val restore = if (hasSaved) WireGuardProfileStore.loadOriginalProxy(context) else null
            val applied = EngineHost.setAppWireGuardProxy(restore)
            if (applied["ok"] != true && EngineHost.isEngineInitialized()) {
                if (proxyPort in 1..65535) installBrowserProxy(proxyPort)
                return@synchronized Json.failure(
                    "APP_WIREGUARD_RESTORE_FAILED",
                    "기존 다운로드 프록시를 복원하지 못했습니다. 다운로드를 시작하지 마세요.")
            }
            if (hasSaved && EngineHost.isEngineInitialized()) {
                val released = EngineHost.releaseAppWireGuardStartupHold()
                if (released["ok"] != true) {
                    localProxy?.let { EngineHost.setAppWireGuardProxy(it) }
                    if (proxyPort in 1..65535) installBrowserProxy(proxyPort)
                    return@synchronized Json.failure(
                        "APP_WIREGUARD_STARTUP_HOLD_RELEASE_FAILED",
                        "기존 프록시는 복원됐지만 다운로드 시작 게이트를 해제하지 못했습니다. WireGuard 터널을 계속 유지합니다.")
                }
            }
        }
        runCatching { NativeTunnel.stop() }
        running = false
        localProxy = null
        proxyPort = 0
        proxyUsername = null
        proxyPassword = null
        WireGuardProfileStore.clearOriginalProxy(context)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, false).apply()
        val pausedIds = pausedDownloadsForEnable
        pausedDownloadsForEnable = emptyList()
        val resumed = if (pausedIds.isNotEmpty() && EngineHost.isEngineInitialized()) {
            EngineHost.resumeDownloadsAfterAppWireGuard(pausedIds)
        } else mapOf("ok" to true)
        mapOf("ok" to true, "enabled" to false, "resumed_downloads" to (resumed["resumed"] ?: 0))
    }

    private fun saveOriginalProxyIfNeeded(context: Context): Map<String, Any?> {
        if (!EngineHost.isEngineInitialized() || WireGuardProfileStore.hasOriginalProxy(context)) return mapOf("ok" to true)
        val current = EngineHost.getAppWireGuardProxy()
        if (current["ok"] != true) return current
        return try {
            WireGuardProfileStore.saveOriginalProxy(context, current["proxy_url"] as? String)
            mapOf("ok" to true)
        } catch (t: Throwable) {
            Log.e("MaglevWireGuard", "Could not preserve original downloader proxy", t)
            Json.failure("APP_WIREGUARD_PROXY_SAVE_FAILED", "기존 다운로드 프록시를 암호화 저장하지 못해 WireGuard를 켜지 않았습니다.")
        }
    }

    /** Starts the userspace tunnel and browser route without requiring the downloader engine. */
    private fun startTunnel(context: Context): Map<String, Any?> {
        if (!hasProfile(context)) return Json.failure(
            "APP_WIREGUARD_PROFILE_MISSING", "저장된 WireGuard 프로필이 없습니다. 직접 연결로 우회하지 않았습니다.")
        if (running && proxyPort in 1..65535 && !localProxy.isNullOrBlank()) {
            if (!browserProxyApplied && !installBrowserProxy(proxyPort)) return Json.failure(
                "APP_WIREGUARD_BROWSER_PROXY_FAILED", "앱 브라우저의 WireGuard 프록시를 적용하지 못했습니다. " + browserProxyFailureSuffix())
            return mapOf("ok" to true, "proxy_url" to localProxy, "browser_proxy" to true)
        }
        if (!browserProxyInstalled && !installBrowserProxy(9, active = false)) return Json.failure(
            "APP_WIREGUARD_BROWSER_PROXY_FAILED", "WireGuard 시작 전 앱 브라우저를 차단 상태로 전환하지 못했습니다. " + browserProxyFailureSuffix())
        val random = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val password = Base64.encodeToString(random, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        random.fill(0)
        val config = try { WireGuardProfileStore.loadProfile(context) }
        catch (_: Exception) { return Json.failure(
            "APP_WIREGUARD_PROFILE_INVALID", "WireGuard 프로필을 복호화하거나 검증하지 못했습니다.") }
        val port = try { NativeTunnel.start(config, USER, password, 0) }
        catch (t: Throwable) {
            val errorType = t.javaClass.simpleName.ifBlank { "Throwable" }.take(80)
            Log.e("MaglevWireGuard", "NativeTunnel.start failed: $errorType", t)
            return Json.failure(
                "APP_WIREGUARD_START_FAILED",
                "앱 내부 WireGuard 시작 실패 ($errorType). 직접 연결로 우회하지 않았습니다. 진단 로그를 확인하세요.")
        }
        if (port == -4) return Json.failure(
            "APP_WIREGUARD_ENDPOINT_DNS_FAILED",
            "WireGuard Endpoint 도메인 DNS 조회에 실패했습니다. 네트워크 또는 DNS를 확인하세요. 직접 연결로 우회하지 않았습니다.")
        if (port == -1) return Json.failure("APP_WIREGUARD_PROFILE_INVALID", "WireGuard 프로필 설정이 올바르지 않습니다.")
        if (port == -2) return Json.failure("APP_WIREGUARD_ALREADY_RUNNING", "WireGuard userspace 엔진이 이미 실행 중입니다.")
        if (port !in 1..65535) return Json.failure(
            "APP_WIREGUARD_START_FAILED", "WireGuard 로컬 프록시를 시작하지 못했습니다. 직접 연결로 우회하지 않았습니다.")
        val url = "http://$USER:$password@127.0.0.1:$port"
        localProxy = url
        proxyPort = port
        proxyUsername = USER
        proxyPassword = password
        running = true
        if (!installBrowserProxy(port)) {
            runCatching { NativeTunnel.stop() }
            running = false
            localProxy = null
            proxyPort = 0
            proxyUsername = null
            proxyPassword = null
            installBrowserProxy(9, active = false)
            return Json.failure(
                "APP_WIREGUARD_BROWSER_PROXY_FAILED",
                "앱 브라우저의 WireGuard 프록시를 적용하지 못했습니다. " + browserProxyFailureSuffix())
        }
        return mapOf("ok" to true, "proxy_url" to url, "browser_proxy" to true)
    }

    private fun applyTunnelToEngine(): Map<String, Any?> {
        if (!EngineHost.isEngineInitialized()) return mapOf("ok" to true, "deferred" to true)
        val url = localProxy ?: return Json.failure(
            "APP_WIREGUARD_PROXY_NOT_READY", "앱 WireGuard 로컬 프록시가 준비되지 않았습니다.")
        val applied = EngineHost.setAppWireGuardProxy(url)
        if (applied["ok"] != true) return Json.failure(
            "APP_WIREGUARD_ENGINE_APPLY_FAILED",
            applied["message"]?.toString() ?: "다운로드 엔진에 WireGuard 프록시를 적용하지 못했습니다.")
        if (!installBrowserProxy(proxyPort)) return Json.failure(
            "APP_WIREGUARD_BROWSER_PROXY_FAILED", "앱 브라우저의 WireGuard 프록시를 적용하지 못했습니다. " + browserProxyFailureSuffix())
        val released = EngineHost.releaseAppWireGuardStartupHold()
        if (released["ok"] != true) return Json.failure(
            "APP_WIREGUARD_STARTUP_HOLD_RELEASE_FAILED",
            "WireGuard 프록시는 적용됐지만 다운로드 시작 게이트를 해제하지 못했습니다.")
        return mapOf("ok" to true)
    }

    /** Returns an authenticated loopback proxy or an error; a closed proxy is installed first. */
    fun prepareDownload(context: Context): Map<String, Any?> = synchronized(lock) {
        if (!isEnabled(context)) return@synchronized mapOf("ok" to true)
        if (!hasProfile(context)) return@synchronized Json.failure(
            "APP_WIREGUARD_PROFILE_MISSING", "저장된 WireGuard 프로필이 없습니다. 직접 연결로 우회하지 않았습니다.")

        // Downloads can be started from a share intent or after process recreation, before the foreground
        // engine has been initialized. Never read/apply its proxy config until the engine is ready.
        if (!EngineHost.isEngineInitialized()) {
            val engineStarted = EngineHost.ensureStarted()
            if (engineStarted["ok"] != true) {
                val code = engineStarted["code"]?.toString()?.take(80) ?: "UNKNOWN"
                val message = engineStarted["message"]?.toString()?.take(500) ?: "다운로드 엔진을 시작하지 못했습니다."
                return@synchronized Json.failure(
                    "APP_WIREGUARD_ENGINE_START_FAILED",
                    "WireGuard 터널은 유지 중이지만 다운로드 엔진 초기화에 실패했습니다. [$code] $message. 직접 연결로 우회하지 않았습니다.")
            }
        }

        // EngineHost may have restarted independently while the native tunnel stayed alive.
        // A cached proxy URL is not enough: re-apply it to the newly initialized download engine
        // on every prepare call, otherwise requests can run without the intended tunnel proxy.
        localProxy?.let { cachedProxy ->
            val applied = EngineHost.setAppWireGuardProxy(cachedProxy)
            if (applied["ok"] != true) return@synchronized Json.failure(
                "APP_WIREGUARD_PROXY_REAPPLY_FAILED",
                "WireGuard 프록시를 다운로드 엔진에 다시 적용하지 못했습니다. 연결을 껐다가 다시 켜세요.")
            if (!installBrowserProxy(proxyPort)) return@synchronized Json.failure(
                "APP_WIREGUARD_BROWSER_PROXY_FAILED",
                "앱 브라우저의 WireGuard 프록시를 적용하지 못했습니다. " + browserProxyFailureSuffix())
            val released = EngineHost.releaseAppWireGuardStartupHold()
            if (released["ok"] != true) return@synchronized Json.failure(
                "APP_WIREGUARD_STARTUP_HOLD_RELEASE_FAILED",
                "WireGuard 프록시는 적용됐지만 다운로드 시작 게이트를 해제하지 못했습니다.")
            return@synchronized mapOf("ok" to true, "proxy_url" to cachedProxy, "browser_proxy" to true)
        }

        val saved = saveOriginalProxyIfNeeded(context)
        if (saved["ok"] != true) return@synchronized saved

        val random = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val password = Base64.encodeToString(random, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        random.fill(0)
        val config = try { WireGuardProfileStore.loadProfile(context) }
        catch (_: Exception) { return@synchronized Json.failure(
            "APP_WIREGUARD_PROFILE_INVALID", "WireGuard 프로필을 복호화하거나 검증하지 못했습니다.") }

        val port = try { NativeTunnel.start(config, USER, password, 0) }
        catch (t: Throwable) {
            // Keep the native load/JNI exception class visible to diagnostics. The previous
            // catch discarded it and made every distinct startup failure look identical.
            val errorType = t.javaClass.simpleName.ifBlank { "Throwable" }.take(80)
            Log.e("MaglevWireGuard", "NativeTunnel.start failed: $errorType", t)
            return@synchronized Json.failure(
                "APP_WIREGUARD_START_FAILED",
                "앱 내부 WireGuard 시작 실패 ($errorType). 직접 연결로 우회하지 않았습니다. 진단 로그를 확인하세요.")
        }
        if (port == -4) return@synchronized Json.failure(
            "APP_WIREGUARD_ENDPOINT_DNS_FAILED",
            "WireGuard Endpoint 도메인 DNS 조회에 실패했습니다. 네트워크 또는 DNS를 확인하세요. 직접 연결로 우회하지 않았습니다.")
        if (port == -1) return@synchronized Json.failure(
            "APP_WIREGUARD_PROFILE_INVALID", "WireGuard 프로필 설정이 올바르지 않습니다.")
        if (port == -2) return@synchronized Json.failure(
            "APP_WIREGUARD_ALREADY_RUNNING", "WireGuard userspace 엔진이 이미 실행 중입니다.")
        if (port !in 1..65535) return@synchronized Json.failure(
            "APP_WIREGUARD_START_FAILED", "WireGuard 로컬 프록시를 시작하지 못했습니다. 직접 연결로 우회하지 않았습니다.")
        val url = "http://$USER:$password@127.0.0.1:$port"
        localProxy = url
        proxyPort = port
        proxyUsername = USER
        proxyPassword = password
        running = true
        val engineProxy = EngineHost.setAppWireGuardProxy(url)
        if (engineProxy["ok"] != true) {
            runCatching { NativeTunnel.stop() }
            running = false
            localProxy = null
            proxyPort = 0
            proxyUsername = null
            proxyPassword = null
            return@synchronized Json.failure(
                "APP_WIREGUARD_ENGINE_APPLY_FAILED",
                engineProxy["message"]?.toString() ?: "다운로드 엔진에 실제 WireGuard 프록시를 적용하지 못했습니다.")
        }
        if (!installBrowserProxy(port)) {
            runCatching { NativeTunnel.stop() }
            running = false
            localProxy = null
            proxyPort = 0
            proxyUsername = null
            proxyPassword = null
            return@synchronized Json.failure(
                "APP_WIREGUARD_BROWSER_PROXY_FAILED",
                "앱 브라우저의 WireGuard 프록시를 적용하지 못했습니다. WebView 프록시 기능을 확인하세요.")
        }
        val released = EngineHost.releaseAppWireGuardStartupHold()
        if (released["ok"] != true) return@synchronized Json.failure(
            "APP_WIREGUARD_STARTUP_HOLD_RELEASE_FAILED",
            "WireGuard 프록시는 적용됐지만 다운로드 시작 게이트를 해제하지 못했습니다.")
        mapOf("ok" to true, "proxy_url" to url, "browser_proxy" to true)
    }

    /**
     * WebView ProxyController is scoped to this app's WebView process, not Android's device
     * routing table. Submit the override on WebView's main thread and marshal its completion
     * callback back to that thread. This method is called from IO only; never block the main
     * thread while waiting for the callback that must run there.
     */
    private fun installBrowserProxy(port: Int, active: Boolean = true): Boolean {
        if (port !in 1..65535) {
            lastBrowserProxyError = "code=INVALID_PROXY_PORT"
            return false
        }
        val provider = webViewProviderSummary()
        val supported = try {
            WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)
        } catch (t: Throwable) {
            lastBrowserProxyError = "code=FEATURE_CHECK_FAILED, provider=$provider, cause=${t.javaClass.simpleName}"
            Log.e("MaglevWireGuard", "WebView proxy feature check failed: $lastBrowserProxyError", t)
            return false
        }
        if (!supported) {
            lastBrowserProxyError = "code=PROXY_OVERRIDE_UNSUPPORTED, provider=$provider"
            Log.e("MaglevWireGuard", "WebView proxy override is not supported: $lastBrowserProxyError")
            return false
        }
        if (Looper.myLooper() == Looper.getMainLooper()) {
            lastBrowserProxyError = "code=MAIN_THREAD_BLOCKING_CALL, provider=$provider"
            Log.e("MaglevWireGuard", "Refusing to wait for WebView proxy callback on the main thread")
            return false
        }
        return try {
            val latch = CountDownLatch(1)
            val applied = AtomicReference(false)
            val failure = AtomicReference<String?>(null)
            val callbackExecutor = Executor { command ->
                if (!mainHandler.post(command)) {
                    failure.compareAndSet(null, "MAIN_EXECUTOR_REJECTED")
                    latch.countDown()
                }
            }
            val config = ProxyConfig.Builder().addProxyRule("127.0.0.1:$port").build()
            val submitted = mainHandler.post {
                try {
                    ProxyController.getInstance().setProxyOverride(
                        config,
                        callbackExecutor,
                        Runnable { applied.set(true); latch.countDown() },
                    )
                } catch (t: Throwable) {
                    failure.set("SET_PROXY_THROWN:${t.javaClass.simpleName}")
                    Log.e("MaglevWireGuard", "WebView setProxyOverride threw: ${t.javaClass.simpleName}", t)
                    latch.countDown()
                }
            }
            if (!submitted) {
                lastBrowserProxyError = "code=MAIN_HANDLER_REJECTED, provider=$provider"
                return false
            }
            val completed = latch.await(12, TimeUnit.SECONDS)
            if (!completed) failure.compareAndSet(null, "SET_PROXY_CALLBACK_TIMEOUT")
            val result = completed && applied.get()
            if (result) {
                browserProxyInstalled = true
                browserProxyApplied = active
                lastBrowserProxyError = null
            } else {
                browserProxyApplied = false
                lastBrowserProxyError = "code=${failure.get() ?: "SET_PROXY_NOT_CONFIRMED"}, provider=$provider"
                Log.e("MaglevWireGuard", "WebView proxy apply was not confirmed: $lastBrowserProxyError")
            }
            result
        } catch (t: InterruptedException) {
            Thread.currentThread().interrupt()
            browserProxyApplied = false
            lastBrowserProxyError = "code=INTERRUPTED, provider=$provider"
            Log.e("MaglevWireGuard", "Interrupted while applying WebView proxy", t)
            false
        } catch (t: Throwable) {
            browserProxyApplied = false
            lastBrowserProxyError = "code=PROXY_APPLY_FAILED:${t.javaClass.simpleName}, provider=$provider"
            Log.e("MaglevWireGuard", "WebView proxy apply failed", t)
            false
        }
    }

    private fun clearBrowserProxy(): Boolean {
        val provider = webViewProviderSummary()
        val supported = try {
            WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)
        } catch (t: Throwable) {
            lastBrowserProxyError = "code=FEATURE_CHECK_FAILED, provider=$provider, cause=${t.javaClass.simpleName}"
            Log.e("MaglevWireGuard", "WebView proxy feature check failed during clear", t)
            return false
        }
        if (!supported) {
            if (browserProxyInstalled || browserProxyApplied) {
                lastBrowserProxyError = "code=PROXY_OVERRIDE_UNSUPPORTED_DURING_CLEAR, provider=$provider"
                return false
            }
            return true
        }
        if (Looper.myLooper() == Looper.getMainLooper()) {
            lastBrowserProxyError = "code=MAIN_THREAD_BLOCKING_CALL, provider=$provider"
            return false
        }
        return try {
            val latch = CountDownLatch(1)
            val cleared = AtomicReference(false)
            val failure = AtomicReference<String?>(null)
            val callbackExecutor = Executor { command ->
                if (!mainHandler.post(command)) {
                    failure.compareAndSet(null, "MAIN_EXECUTOR_REJECTED")
                    latch.countDown()
                }
            }
            val submitted = mainHandler.post {
                try {
                    ProxyController.getInstance().clearProxyOverride(
                        callbackExecutor,
                        Runnable { cleared.set(true); latch.countDown() },
                    )
                } catch (t: Throwable) {
                    failure.set("CLEAR_PROXY_THROWN:${t.javaClass.simpleName}")
                    Log.e("MaglevWireGuard", "WebView clearProxyOverride threw: ${t.javaClass.simpleName}", t)
                    latch.countDown()
                }
            }
            if (!submitted) {
                lastBrowserProxyError = "code=MAIN_HANDLER_REJECTED_DURING_CLEAR, provider=$provider"
                return false
            }
            val completed = latch.await(12, TimeUnit.SECONDS)
            if (!completed) failure.compareAndSet(null, "CLEAR_PROXY_CALLBACK_TIMEOUT")
            val result = completed && cleared.get()
            if (result) {
                browserProxyInstalled = false
                browserProxyApplied = false
                lastBrowserProxyError = null
            } else {
                lastBrowserProxyError = "code=${failure.get() ?: "CLEAR_PROXY_NOT_CONFIRMED"}, provider=$provider"
                Log.e("MaglevWireGuard", "WebView proxy clear was not confirmed: $lastBrowserProxyError")
            }
            result
        } catch (t: InterruptedException) {
            Thread.currentThread().interrupt()
            lastBrowserProxyError = "code=INTERRUPTED_DURING_CLEAR, provider=$provider"
            Log.e("MaglevWireGuard", "Interrupted while clearing WebView proxy", t)
            false
        } catch (t: Throwable) {
            lastBrowserProxyError = "code=PROXY_CLEAR_FAILED:${t.javaClass.simpleName}, provider=$provider"
            Log.e("MaglevWireGuard", "WebView proxy clear failed", t)
            false
        }
    }

    private fun webViewProviderSummary(): String = runCatching {
        val info = WebView.getCurrentWebViewPackage()
        if (info == null) "unknown" else "${info.packageName}@${info.versionName}"
    }.getOrDefault("unknown")

    private fun browserProxyFailureSuffix(): String =
        lastBrowserProxyError?.let { "[$it]" } ?: "[WebView proxy callback was not confirmed]"

    /** Credentials are returned only for this app's loopback proxy challenge. */
    fun browserProxyCredentials(host: String, realm: String): Pair<String, String>? {
        if (!running || !browserProxyApplied || realm != "App WireGuard") return null
        if (host != "127.0.0.1" && host != "localhost") return null
        val user = proxyUsername ?: return null
        val pass = proxyPassword ?: return null
        return user to pass
    }

    /** Rehydrates the process-local tunnel/proxy after process death when the saved switch is on. */
    fun ensureBrowserProxy(context: Context): Map<String, Any?> {
        if (!isEnabled(context)) return mapOf("ok" to true, "browser_proxy" to false)
        if (!browserProxyInstalled && !installBrowserProxy(9, active = false)) return Json.failure(
            "APP_WIREGUARD_BROWSER_PROXY_FAILED", "앱 브라우저를 WireGuard 복구 전 차단 상태로 전환하지 못했습니다. " + browserProxyFailureSuffix())
        val started = startTunnel(context)
        if (started["ok"] != true) return started
        if (EngineHost.isEngineInitialized()) {
            val saved = saveOriginalProxyIfNeeded(context)
            if (saved["ok"] != true) return saved
            val applied = applyTunnelToEngine()
            if (applied["ok"] != true) return applied
        }
        return mapOf("ok" to true, "browser_proxy" to true, "running" to true)
    }

    /** Forces traffic through the userspace tunnel and reports the observed exit country/IP. */
    /** Verifies the actual authenticated HTTP CONNECT proxy used by app downloads. */
    fun testConnection(context: Context): Map<String, Any?> {
        if (!isEnabled(context)) return Json.failure("APP_WIREGUARD_NOT_ENABLED", "WireGuard를 먼저 켜세요.")
        val prepared = ensureBrowserProxy(context)
        if (prepared["ok"] != true) return prepared
        val port = proxyPort
        val password = proxyPassword
        if (port !in 1..65535 || password.isNullOrEmpty()) return Json.failure(
            "APP_WIREGUARD_PROXY_NOT_READY", "앱 WireGuard 프록시가 준비되지 않았습니다.")
        return try {
            val proxy = Proxy(Proxy.Type.HTTP, InetSocketAddress("127.0.0.1", port))
            val client = OkHttpClient.Builder()
                .proxy(proxy)
                .proxyAuthenticator { _, response ->
                    if (response.request.header("Proxy-Authorization") != null) null
                    else response.request.newBuilder()
                        .header("Proxy-Authorization", Credentials.basic(USER, password))
                        .build()
                }
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .callTimeout(25, TimeUnit.SECONDS)
                .build()
            val request = Request.Builder()
                .url("https://ipwho.is/")
                .header("Accept", "application/json")
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return Json.failure(
                    "APP_WIREGUARD_PROXY_EGRESS_FAILED",
                    "WireGuard 다운로드 프록시 HTTPS 요청이 HTTP ${response.code}로 실패했습니다.")
                val body = response.body?.string().orEmpty()
                val result = JSONObject(body)
                val ip = result.optString("ip")
                val country = result.optString("country")
                val countryCode = result.optString("country_code")
                if (!result.optBoolean("success") || ip.isBlank() || countryCode.isBlank()) return Json.failure(
                    "APP_WIREGUARD_PROXY_EGRESS_FAILED",
                    "WireGuard 프록시 응답에서 출구 IP와 국가를 확인하지 못했습니다.")
                mapOf(
                    "ok" to true,
                    "ip" to ip,
                    "country" to country,
                    "country_code" to countryCode,
                    "message" to "인증된 로컬 HTTP CONNECT 프록시를 통한 HTTPS 요청이 성공했습니다."
                )
            }
        } catch (_: Throwable) {
            Json.failure(
                "APP_WIREGUARD_PROXY_EGRESS_FAILED",
                "실제 앱 다운로드 프록시를 통한 HTTPS 요청에 실패했습니다. peer handshake, Endpoint, AllowedIPs와 DNS를 확인하세요.")
        }
    }

    fun status(context: Context): Map<String, Any?> {
        if (isEnabled(context) && (!running || proxyPort == 0 || !browserProxyApplied)) {
            val restored = ensureBrowserProxy(context)
            if (restored["ok"] != true) return restored
        }
        val result = linkedMapOf<String, Any?>(
            "ok" to true,
            "enabled" to isEnabled(context),
            "has_profile" to hasProfile(context),
            "running" to running,
            "browser_proxy_applied" to browserProxyApplied,
            "peer_handshake" to false,
            "peer_rx_bytes" to 0L,
            "peer_tx_bytes" to 0L,
            "last_handshake_unix" to 0L
        )
        if (!running) return result
        return try {
            val peer = JSONObject(NativeTunnel.peerStatus())
            result["peer_handshake"] = peer.optBoolean("handshake", false)
            result["peer_rx_bytes"] = peer.optLong("rx_bytes", 0L)
            result["peer_tx_bytes"] = peer.optLong("tx_bytes", 0L)
            result["last_handshake_unix"] = peer.optLong("last_handshake_unix", 0L)
            result["handshake_age_seconds"] = peer.optLong("handshake_age_seconds", -1L)
            result
        } catch (_: Throwable) {
            result["status_error"] = true
            result
        }
    }

    fun isRunning(): Boolean = running
}
