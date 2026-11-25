package com.maglev.engine.youtube

import android.content.Context
import android.util.Log
import android.webkit.WebSettings
import com.maglev.engine.EngineHost
import com.maglev.engine.browser.YouTubeUrl
import com.maglev.engine.service.BackgroundStart
import com.maglev.engine.service.MaglevTorrentService
import com.maglev.engine.share.QuickShareAdd
import com.maglev.engine.util.Json
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import com.yausername.youtubedl_android.mapper.VideoFormat
import com.yausername.youtubedl_android.mapper.VideoInfo
import kotlin.math.abs

/**
 * YouTube extraction adapter. It tries clients that can expose formats without an app-managed PO token,
 * then hands direct files or HLS/DASH playlists to Maglev's own transfer/stream engine.
 */
object YoutubeDownload {
    private const val TAG = "MaglevYouTube"
    private const val UPDATE_PREFS = "maglev_ytdlp_update"
    private const val KEY_LAST_ATTEMPT = "stable_last_attempt_ms"
    private const val KEY_LAST_SUCCESS = "stable_last_success"
    private const val UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000L
    private const val RETRY_INTERVAL_MS = 6 * 60 * 60 * 1000L
    private val formatIdPattern = Regex("^[A-Za-z0-9._-]{1,64}$")
    private val PLAYER_CLIENTS = listOf("web_safari", "android_vr", "web_embedded")

    @Synchronized
    private fun prepareYtDlp(context: Context) {
        val app = context.applicationContext
        val ytdlp = YoutubeDL.getInstance()
        ytdlp.init(app)
        val prefs = app.getSharedPreferences(UPDATE_PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val lastAttempt = prefs.getLong(KEY_LAST_ATTEMPT, 0L)
        val interval = if (prefs.getBoolean(KEY_LAST_SUCCESS, false)) UPDATE_INTERVAL_MS else RETRY_INTERVAL_MS
        if (now - lastAttempt < interval) return

        prefs.edit().putLong(KEY_LAST_ATTEMPT, now).apply()
        try {
            val status = ytdlp.updateYoutubeDL(app, YoutubeDL.UpdateChannel.STABLE)
            val version = ytdlp.versionName(app) ?: "unknown"
            prefs.edit().putBoolean(KEY_LAST_SUCCESS, true).apply()
            Log.i(TAG, "yt-dlp stable update check: " + status + "; version=" + version)
        } catch (e: Exception) {
            prefs.edit().putBoolean(KEY_LAST_SUCCESS, false).apply()
            Log.w(TAG, "yt-dlp stable update failed; using installed binary: " + safeDiagnostic(e))
        }
    }

    private fun currentYtDlpVersion(context: Context): String =
        runCatching { YoutubeDL.getInstance().versionName(context.applicationContext) }
            .getOrNull()
            ?.take(48)
            ?: "unknown"

    private fun safeDiagnostic(error: Throwable): String =
        (error.message ?: error.javaClass.simpleName)
            .replace(Regex("https?://[^\\s]+", RegexOption.IGNORE_CASE), "[URL]")
            .take(240)

    private fun requestFor(url: String, playerClient: String): YoutubeDLRequest =
        YoutubeDLRequest(url)
            .addOption("--no-playlist")
            .addOption("--extractor-args", "youtube:player_client=" + playerClient)

    fun info(context: Context, rawUrl: String): Map<String, Any?> {
        val link = YouTubeUrl.parse(rawUrl)
            ?: return Json.failure("INVALID_SOURCE", "지원하지 않는 YouTube 동영상 링크입니다.")
        return try {
            val app = context.applicationContext
            prepareYtDlp(app)
            var metadata: VideoInfo? = null
            var lastError: Exception? = null
            val allFormats = mutableListOf<Map<String, Any?>>()

            for (client in PLAYER_CLIENTS) {
                try {
                    val current = YoutubeDL.getInstance().getInfo(requestFor(link.canonicalUrl, client))
                    if (metadata == null || metadata?.title.isNullOrBlank()) metadata = current
                    val found = (current.formats ?: arrayListOf()).mapNotNull { format -> toFormat(format, client) }
                    allFormats.addAll(found)
                    val hasVideo = found.any { it["kind"] == "video" }
                    val hasAudio = found.any { it["kind"] == "audio" }
                    if (hasVideo && hasAudio) break
                } catch (e: Exception) {
                    lastError = e
                    Log.w(TAG, "yt-dlp client " + client + " failed: " + safeDiagnostic(e))
                }
            }

            val video = metadata ?: throw (lastError ?: IllegalStateException("No YouTube metadata"))
            val unique = allFormats.distinctBy { it["playerClient"].toString() + ":" + it["formatId"].toString() }
            val grouped = unique.groupBy { it["kind"] as String }
            val videoFormats = grouped["video"].orEmpty()
                .sortedWith(compareByDescending<Map<String, Any?>> { (it["height"] as? Number)?.toInt() ?: 0 }
                    .thenByDescending { (it["tbr"] as? Number)?.toInt() ?: 0 })
                .take(8)
            val audioFormats = grouped["audio"].orEmpty()
                .sortedByDescending { (it["abr"] as? Number)?.toInt() ?: 0 }
                .take(5)
            val choices = videoFormats + audioFormats
            if (choices.isEmpty()) {
                return Json.failure(
                    "YOUTUBE_NO_FORMAT",
                    "지원 가능한 형식을 찾지 못했습니다. YouTube PO Token, 영상 제한 또는 지역 제한으로 형식이 제공되지 않을 수 있습니다.",
                )
            }
            linkedMapOf(
                "ok" to true,
                "videoId" to link.videoId,
                "title" to (video.title ?: "YouTube video"),
                "uploader" to video.uploader,
                "duration" to video.duration,
                "thumbnail" to video.thumbnail,
                "formats" to choices,
            )
        } catch (e: Exception) {
            val diagnostic = safeDiagnostic(e)
            val version = currentYtDlpVersion(context)
            Log.e(TAG, "YouTube metadata extraction failed (yt-dlp=" + version + "): " + diagnostic)
            Json.failure("YOUTUBE_EXTRACT_FAILED", "YouTube 영상 정보를 가져오지 못했습니다. yt-dlp " + version + " · " + diagnostic)
        }
    }

    fun add(context: Context, rawUrl: String, formatId: String, playerClient: String): Map<String, Any?> {
        val link = YouTubeUrl.parse(rawUrl)
            ?: return Json.failure("INVALID_SOURCE", "지원하지 않는 YouTube 동영상 링크입니다.")
        if (!formatIdPattern.matches(formatId) || playerClient !in PLAYER_CLIENTS) {
            return Json.failure("INVALID_ARGUMENT", "선택한 형식이 올바르지 않습니다.")
        }
        return try {
            val app = context.applicationContext
            prepareYtDlp(app)
            val selected = YoutubeDL.getInstance().getInfo(requestFor(link.canonicalUrl, playerClient).addOption("-f", formatId))
            val requested = selected.requestedFormats?.firstOrNull()
            val directUrl = requested?.url ?: selected.url ?: requested?.manifestUrl ?: selected.manifestUrl
                ?: return Json.failure("YOUTUBE_NO_FORMAT", "선택한 형식의 다운로드 주소를 가져오지 못했습니다.")
            val manifestUrl = requested?.manifestUrl?.takeIf { it.isNotBlank() }
                ?: selected.manifestUrl?.takeIf { it.isNotBlank() }
            val streamUrl = manifestUrl ?: directUrl.takeIf { isPlaylistUrl(it) }
            val mediaUrl = streamUrl ?: directUrl

            val rawHeaders = requested?.httpHeaders ?: selected.httpHeaders.orEmpty()
            val headers = linkedMapOf<String, String>()
            rawHeaders.entries.firstOrNull { it.key.equals("User-Agent", true) }?.value?.let { headers["User-Agent"] = it }
            rawHeaders.entries.firstOrNull { it.key.equals("Referer", true) }?.value?.let { headers["Referer"] = it }
            rawHeaders.entries.firstOrNull { it.key.equals("Origin", true) }?.value?.let { headers["Origin"] = it }
            if (headers["User-Agent"].isNullOrBlank()) headers["User-Agent"] = WebSettings.getDefaultUserAgent(app)
            if (headers["Referer"].isNullOrBlank()) headers["Referer"] = "https://www.youtube.com/"
            if (headers["Origin"].isNullOrBlank()) headers["Origin"] = "https://www.youtube.com"

            if (!QuickShareAdd.startEngine(app)) {
                return Json.failure("ENGINE_UNAVAILABLE", "다운로드 엔진을 시작하지 못했습니다.")
            }
            BackgroundStart.start(app, MaglevTorrentService.ACTION_START)
            val ext = (requested?.ext ?: selected.ext ?: "mp4").lowercase().filter { it.isLetterOrDigit() }.ifEmpty { "mp4" }
            val name = safeName(selected.title ?: "YouTube video") + "." + ext
            val options = linkedMapOf<String, Any?>(
                "name" to name,
                "headers" to headers,
                "pageUrl" to link.canonicalUrl,
            )

            if (streamUrl != null) {
                val probe = EngineHost.probeStream(streamUrl, mapOf("headers" to headers), 25_000L)
                if ((probe["ok"] as? Boolean) != true) {
                    val detail = safeDiagnostic(Exception(probe["message"] as? String ?: "unsupported playlist"))
                    return Json.failure("YOUTUBE_STREAM_PROBE_FAILED", "YouTube 스트림을 읽지 못했습니다. " + detail)
                }
                val kind = probe["kind"] as? String
                    ?: return Json.failure("YOUTUBE_STREAM_UNSUPPORTED", "스트림 유형을 확인하지 못했습니다.")
                val variants = (probe["variants"] as? List<*>)?.mapNotNull { it as? Map<*, *> }.orEmpty()
                val usable = variants.filter { (it["audio"] as? String) != "none" }
                val targetHeight = (requested?.height ?: selected.height).takeIf { it > 0 }
                val variant = if (targetHeight != null) {
                    usable.minByOrNull { abs(((it["height"] as? Number)?.toInt() ?: 0) - targetHeight) }
                } else {
                    usable.maxByOrNull { (it["height"] as? Number)?.toInt() ?: 0 }
                } ?: return Json.failure("YOUTUBE_STREAM_UNSUPPORTED", "오디오가 포함된 스트림 형식을 찾지 못했습니다.")
                val variantId = variant["id"] as? String
                    ?: return Json.failure("YOUTUBE_STREAM_UNSUPPORTED", "스트림 품질 ID가 없습니다.")
                options["stream"] = mapOf("kind" to kind, "variantId" to variantId)
            }

            EngineHost.addDownload(mediaUrl, options)
        } catch (e: Exception) {
            val diagnostic = safeDiagnostic(e)
            val version = currentYtDlpVersion(context)
            Log.e(TAG, "YouTube download extraction failed (yt-dlp=" + version + "): " + diagnostic)
            Json.failure("YOUTUBE_DOWNLOAD_FAILED", "YouTube 다운로드를 시작하지 못했습니다. yt-dlp " + version + " · " + diagnostic)
        }
    }

    private fun isPlaylistUrl(raw: String): Boolean {
        val path = raw.substringBefore('?').substringBefore('#').lowercase()
        return path.endsWith(".m3u8") || path.endsWith(".mpd") || raw.contains("manifest.m3u8", ignoreCase = true)
    }

    private fun toFormat(f: VideoFormat, playerClient: String): Map<String, Any?>? {
        val id = f.formatId?.takeIf { formatIdPattern.matches(it) } ?: return null
        val url = f.url?.takeIf { it.isNotBlank() }
        val manifest = f.manifestUrl?.takeIf { it.isNotBlank() }
        if (url == null && manifest == null) return null
        val hasVideo = !f.vcodec.isNullOrBlank() && f.vcodec != "none"
        val hasAudio = !f.acodec.isNullOrBlank() && f.acodec != "none"
        val isStream = manifest != null || url?.let { isPlaylistUrl(it) } == true
        val kind = when {
            hasVideo && hasAudio -> "video"
            hasVideo && isStream -> "video"
            !hasVideo && hasAudio && manifest == null -> "audio"
            else -> return null
        }
        val bytes = f.fileSize.takeIf { it > 0 } ?: f.fileSizeApproximate.takeIf { it > 0 }
        return linkedMapOf(
            "formatId" to id,
            "playerClient" to playerClient,
            "kind" to kind,
            "ext" to (f.ext ?: "mp4"),
            "height" to f.height,
            "width" to f.width,
            "fps" to f.fps,
            "tbr" to f.tbr,
            "abr" to f.abr,
            "size" to bytes,
            "format" to f.formatNote,
        )
    }

    private fun safeName(raw: String): String = raw
        .replace(Regex("[\\\\/:*?\"<>|]"), "_")
        .replace(Regex("\\s+"), " ")
        .trim(' ', '.')
        .take(150)
        .ifEmpty { "YouTube video" }
}
