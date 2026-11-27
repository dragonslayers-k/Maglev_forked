package com.maglev.engine.wireguard

import android.content.Context
import android.util.Log
import android.net.Uri
import android.util.Base64
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
            // The settings screen can be opened before the native engine/service has started.
            // Start it from the saved config before reading or replacing its proxy settings.
            if (!EngineHost.isEngineInitialized()) {
                val engineStarted = EngineHost.ensureStarted()
                if (engineStarted["ok"] != true) return@synchronized Json.failure(
                    "APP_WIREGUARD_ENGINE_START_FAILED",
                    engineStarted["message"]?.toString() ?: "다운로드 엔진을 시작하지 못했습니다.")
            }
            if (EngineHost.isEngineInitialized()) {
                val paused = EngineHost.pauseTorrentsForAppWireGuard()
                if (paused["ok"] != true) return@synchronized Json.failure(
                    "APP_WIREGUARD_TORRENT_PAUSE_FAILED", "기존 토렌트 전송을 안전하게 멈추지 못해 WireGuard를 켜지 않았습니다.")
                val pausedDownloads = EngineHost.pauseDownloadsForAppWireGuard()
                if (pausedDownloads["ok"] != true) return@synchronized Json.failure(
                    "APP_WIREGUARD_DOWNLOAD_PAUSE_FAILED", "기존 다운로드를 안전하게 멈추지 못해 WireGuard를 켜지 않았습니다.")
                pausedDownloadsForEnable = (pausedDownloads["paused_ids"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
            }
            // Block app WebView requests during startup; never leave them on direct networking.
            if (!installBrowserProxy(9, active = false)) {
                if (pausedDownloadsForEnable.isNotEmpty()) EngineHost.resumeDownloadsAfterAppWireGuard(pausedDownloadsForEnable)
                pausedDownloadsForEnable = emptyList()
                return@synchronized Json.failure(
                    "APP_WIREGUARD_BROWSER_PROXY_FAILED", "앱 브라우저를 연결 전 차단 상태로 전환하지 못했습니다.")
            }
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, true).apply()
            // Start the userspace tunnel and authenticated loopback proxy immediately when the
            // app-local switch is enabled; it is not deferred until the first download.
            val started = prepareDownload(context)
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
            val pausedIds = pausedDownloadsForEnable
            pausedDownloadsForEnable = emptyList()
            val resumed = if (pausedIds.isNotEmpty()) EngineHost.resumeDownloadsAfterAppWireGuard(pausedIds) else mapOf("ok" to true)
            return@synchronized mapOf(
                "ok" to true, "enabled" to true, "running" to true,
                "resumed_downloads" to (resumed["resumed"] ?: 0),
                "message" to "앱 브라우저와 HTTP/HTTPS 다운로드에 WireGuard 프록시를 적용했습니다.")
        }

        val hasSaved = WireGuardProfileStore.hasOriginalProxy(context)
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
        }
        runCatching { NativeTunnel.stop() }
        running = false
        localProxy = null
        proxyPort = 0
        proxyUsername = null
        proxyPassword = null
        WireGuardProfileStore.clearOriginalProxy(context)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, false).apply()
        mapOf("ok" to true, "enabled" to false)
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
            if (engineStarted["ok"] != true) return@synchronized Json.failure(
                "APP_WIREGUARD_ENGINE_START_FAILED",
                "다운로드 엔진을 시작하지 못했습니다. 앱을 다시 열고 WireGuard 상태를 확인하세요.")
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
                "앱 브라우저의 WireGuard 프록시를 적용하지 못했습니다. WebView 프록시 기능을 확인하세요.")
            val released = EngineHost.releaseAppWireGuardStartupHold()
            if (released["ok"] != true) return@synchronized Json.failure(
                "APP_WIREGUARD_STARTUP_HOLD_RELEASE_FAILED",
                "WireGuard 프록시는 적용됐지만 다운로드 시작 게이트를 해제하지 못했습니다.")
            return@synchronized mapOf("ok" to true, "proxy_url" to cachedProxy, "browser_proxy" to true)
        }

        val hasSaved = WireGuardProfileStore.hasOriginalProxy(context)
        if (!hasSaved) {
            val current = EngineHost.getAppWireGuardProxy()
            if (current["ok"] != true) return@synchronized Json.failure(
                "APP_WIREGUARD_ENGINE_UNAVAILABLE", "다운로드 엔진 설정을 읽지 못했습니다.")
            WireGuardProfileStore.saveOriginalProxy(context, current["proxy_url"] as? String)
        }

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
     * routing table. It routes browser HTTP/HTTPS requests through the same authenticated
     * loopback WireGuard proxy used by the downloader. No VpnService, APN, or other-app route.
     */
    private fun installBrowserProxy(port: Int, active: Boolean = true): Boolean {
        if (port !in 1..65535 || !WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)) return false
        return try {
            val latch = CountDownLatch(1)
            var applied = false
            ProxyController.getInstance().setProxyOverride(
                ProxyConfig.Builder().addProxyRule("127.0.0.1:$port").build(),
                Executor { command -> command.run() },
                Runnable { applied = true; latch.countDown() },
            )
            val result = latch.await(5, TimeUnit.SECONDS) && applied
            browserProxyApplied = result && active
            result
        } catch (_: Throwable) {
            false
        }
    }

    private fun clearBrowserProxy(): Boolean {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)) return true
        return try {
            val latch = CountDownLatch(1)
            var cleared = false
            ProxyController.getInstance().clearProxyOverride(
                Executor { command -> command.run() },
                Runnable { cleared = true; latch.countDown() },
            )
            val result = latch.await(5, TimeUnit.SECONDS) && cleared
            if (result) browserProxyApplied = false
            result
        } catch (_: Throwable) {
            false
        }
    }

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
        if (!browserProxyApplied && !installBrowserProxy(9, active = false)) return Json.failure(
            "APP_WIREGUARD_BROWSER_PROXY_FAILED", "앱 브라우저를 WireGuard 복구 전 차단 상태로 전환하지 못했습니다.")
        return prepareDownload(context)
    }

    /** Forces traffic through the userspace tunnel and reports the observed exit country/IP. */
    /** Verifies the actual authenticated HTTP CONNECT proxy used by app downloads. */
    fun testConnection(context: Context): Map<String, Any?> {
        if (!isEnabled(context)) return Json.failure("APP_WIREGUARD_NOT_ENABLED", "WireGuard를 먼저 켜세요.")
        val prepared = prepareDownload(context)
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
