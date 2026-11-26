package com.maglev.engine.wireguard

import android.content.Context
import android.net.Uri
import android.util.Base64
import com.maglev.engine.EngineHost
import com.maglev.engine.util.Json
import java.security.SecureRandom

/** App-local HTTP(S) download tunnel; no VpnService and no device route changes. */
object WireGuardController {
    private const val PREFS = "maglev_app_wireguard"
    private const val ENABLED = "enabled"
    private const val USER = "maglev"
    private const val CLOSED_PROXY = "http://maglev:blocked@127.0.0.1:9"
    private val lock = Any()
    @Volatile private var running = false
    @Volatile private var localProxy: String? = null

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
            }
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, true).apply()
            // Start the userspace tunnel and authenticated loopback proxy immediately when the
            // app-local switch is enabled; it is not deferred until the first download.
            val started = prepareDownload(context)
            if (started["ok"] != true) {
                val savedProxy = if (WireGuardProfileStore.hasOriginalProxy(context)) {
                    WireGuardProfileStore.loadOriginalProxy(context)
                } else null
                if (EngineHost.isEngineInitialized()) EngineHost.setAppWireGuardProxy(savedProxy)
                runCatching { NativeTunnel.stop() }
                running = false
                localProxy = null
                WireGuardProfileStore.clearOriginalProxy(context)
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, false).apply()
                return@synchronized started
            }
            return@synchronized mapOf(
                "ok" to true, "enabled" to true, "running" to true,
                "message" to "앱 내부 WireGuard userspace 터널과 로컬 프록시를 실행했습니다.")
        }

        val hasSaved = WireGuardProfileStore.hasOriginalProxy(context)
        if (running || hasSaved) {
            val restore = if (hasSaved) WireGuardProfileStore.loadOriginalProxy(context) else null
            val applied = EngineHost.setAppWireGuardProxy(restore)
            if (applied["ok"] != true && EngineHost.isEngineInitialized()) {
                return@synchronized Json.failure(
                    "APP_WIREGUARD_RESTORE_FAILED",
                    "기존 다운로드 프록시를 복원하지 못했습니다. 다운로드를 시작하지 마세요.")
            }
        }
        runCatching { NativeTunnel.stop() }
        running = false
        localProxy = null
        WireGuardProfileStore.clearOriginalProxy(context)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, false).apply()
        mapOf("ok" to true, "enabled" to false)
    }

    /** Returns an authenticated loopback proxy or an error; a closed proxy is installed first. */
    fun prepareDownload(context: Context): Map<String, Any?> = synchronized(lock) {
        if (!isEnabled(context)) return@synchronized mapOf("ok" to true)
        localProxy?.let { return@synchronized mapOf("ok" to true, "proxy_url" to it) }
        if (!hasProfile(context)) return@synchronized Json.failure(
            "APP_WIREGUARD_PROFILE_MISSING", "저장된 WireGuard 프로필이 없습니다. 직접 연결로 우회하지 않았습니다.")

        val hasSaved = WireGuardProfileStore.hasOriginalProxy(context)
        if (!hasSaved) {
            val current = EngineHost.getAppWireGuardProxy()
            if (current["ok"] != true) return@synchronized Json.failure(
                "APP_WIREGUARD_ENGINE_UNAVAILABLE", "다운로드 엔진 설정을 읽지 못했습니다.")
            WireGuardProfileStore.saveOriginalProxy(context, current["proxy_url"] as? String)
        }

        // Fail closed before starting the native engine: failed startup cannot fall back to direct HTTP.
        val blocked = EngineHost.setAppWireGuardProxy(CLOSED_PROXY)
        if (blocked["ok"] != true) return@synchronized Json.failure(
            "APP_WIREGUARD_PROXY_FAILED", "다운로드 엔진에 차단 프록시를 설정하지 못했습니다.")

        val random = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val password = Base64.encodeToString(random, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        random.fill(0)
        val config = try { WireGuardProfileStore.loadProfile(context) }
        catch (_: Exception) { return@synchronized Json.failure(
            "APP_WIREGUARD_PROFILE_INVALID", "WireGuard 프로필을 복호화하거나 검증하지 못했습니다.") }

        val port = try { NativeTunnel.start(config, USER, password, 0) }
        catch (_: Throwable) { return@synchronized Json.failure(
            "APP_WIREGUARD_START_FAILED", "앱 내부 WireGuard를 시작하지 못했습니다. 직접 연결로 우회하지 않았습니다.") }
        if (port !in 1..65535) {
            runCatching { NativeTunnel.stop() }
            return@synchronized Json.failure(
                "APP_WIREGUARD_START_FAILED", "WireGuard 로컬 프록시 포트가 올바르지 않습니다.")
        }
        val url = "http://$USER:$password@127.0.0.1:$port"
        localProxy = url
        running = true
        mapOf("ok" to true, "proxy_url" to url)
    }

    fun isRunning(): Boolean = running
}
