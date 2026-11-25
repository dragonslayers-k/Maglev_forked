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

/**
 * YouTube extraction adapter. yt-dlp extracts metadata and a single progressive format URL;
 * the existing Maglev transfer engine owns pause/resume, progress, storage and notifications.
 *
 * The first implementation intentionally offers muxed video+audio formats and audio-only formats.
 * Separate DASH tracks need a verified mux path before being exposed.
 */
object YoutubeDownload {
    private const val TAG = "MaglevYouTube"
    private const val UPDATE_PREFS = "maglev_ytdlp_update"
    private const val KEY_LAST_ATTEMPT = "stable_last_attempt_ms"
    private const val KEY_LAST_SUCCESS = "stable_last_success"
    private const val UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000L
    private const val RETRY_INTERVAL_MS = 6 * 60 * 60 * 1000L
    private val formatIdPattern = Regex("^[A-Za-z0-9._-]{1,64}$")

    /**
     * Keep the embedded yt-dlp extractor current like YTDLnis does, without checking on every request.
     * The wrapper bundled binary is the offline fallback; failed update checks are retried in 6 hours.
     */
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
            Log.i(TAG, "yt-dlp stable update check: $status; version=$version")
        } catch (e: Exception) {
            prefs.edit().putBoolean(KEY_LAST_SUCCESS, false).apply()
            Log.w(TAG, "yt-dlp stable update failed; using installed binary: ${safeDiagnostic(e)}")
        }
    }

    private fun currentYtDlpVersion(context: Context): String =
        runCatching { YoutubeDL.getInstance().versionName(context.applicationContext) }
            .getOrNull()
            ?.take(48)
            ?: "unknown"

    /** Keep logs and UI diagnostics useful without writing signed media URLs or query tokens. */
    private fun safeDiagnostic(error: Throwable): String =
        (error.message ?: error.javaClass.simpleName)
            .replace(Regex("https?://[^\\s]+", RegexOption.IGNORE_CASE), "[URL]")
            .take(240)

    fun info(context: Context, rawUrl: String): Map<String, Any?> {
        val link = YouTubeUrl.parse(rawUrl)
            ?: return Json.failure("INVALID_SOURCE", "지원하지 않는 YouTube 동영상 링크입니다.")
        return try {
            val app = context.applicationContext
            prepareYtDlp(app)
            val request = YoutubeDLRequest(link.canonicalUrl).addOption("--no-playlist")
            val video = YoutubeDL.getInstance().getInfo(request)
            val formats = (video.formats ?: arrayListOf())
                .mapNotNull { format -> toFormat(format) }
                .groupBy { it["kind"] as String }
            val videoFormats = formats["video"].orEmpty()
                .sortedWith(compareByDescending<Map<String, Any?>> { (it["height"] as? Number)?.toInt() ?: 0 }
                    .thenByDescending { (it["tbr"] as? Number)?.toInt() ?: 0 })
                .take(8)
            val audioFormats = formats["audio"].orEmpty()
                .sortedByDescending { (it["abr"] as? Number)?.toInt() ?: 0 }
                .take(5)
            val choices = videoFormats + audioFormats
            if (choices.isEmpty()) {
                return Json.failure("YOUTUBE_NO_FORMAT", "다운로드할 수 있는 합본 동영상 또는 오디오 형식을 찾지 못했습니다.")
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
            Log.e(TAG, "YouTube metadata extraction failed (yt-dlp=$version): $diagnostic")
            Json.failure("YOUTUBE_EXTRACT_FAILED", "YouTube 영상 정보를 가져오지 못했습니다. yt-dlp $version · $diagnostic")
        }
    }

    fun add(context: Context, rawUrl: String, formatId: String): Map<String, Any?> {
        val link = YouTubeUrl.parse(rawUrl)
            ?: return Json.failure("INVALID_SOURCE", "지원하지 않는 YouTube 동영상 링크입니다.")
        if (!formatIdPattern.matches(formatId)) {
            return Json.failure("INVALID_ARGUMENT", "선택한 형식이 올바르지 않습니다.")
        }
        return try {
            val app = context.applicationContext
            prepareYtDlp(app)
            val request = YoutubeDLRequest(link.canonicalUrl)
                .addOption("--no-playlist")
                .addOption("-f", formatId)
            val selected = YoutubeDL.getInstance().getInfo(request)
            val requested = selected.requestedFormats?.firstOrNull()
            val mediaUrl = requested?.url ?: selected.url
                ?: return Json.failure("YOUTUBE_NO_FORMAT", "선택한 형식의 다운로드 주소를 가져오지 못했습니다.")
            val rawHeaders = requested?.httpHeaders ?: selected.httpHeaders.orEmpty()
            val headers = linkedMapOf<String, String>()
            rawHeaders.entries.firstOrNull { it.key.equals("User-Agent", true) }?.value?.let { headers["User-Agent"] = it }
            rawHeaders.entries.firstOrNull { it.key.equals("Referer", true) }?.value?.let { headers["Referer"] = it }
            rawHeaders.entries.firstOrNull { it.key.equals("Origin", true) }?.value?.let { headers["Origin"] = it }
            if (headers["User-Agent"].isNullOrBlank()) {
                headers["User-Agent"] = WebSettings.getDefaultUserAgent(app)
            }
            if (headers["Referer"].isNullOrBlank()) headers["Referer"] = "https://www.youtube.com/"
            if (headers["Origin"].isNullOrBlank()) headers["Origin"] = "https://www.youtube.com"

            if (!QuickShareAdd.startEngine(app)) {
                return Json.failure("ENGINE_UNAVAILABLE", "다운로드 엔진을 시작하지 못했습니다.")
            }
            BackgroundStart.start(app, MaglevTorrentService.ACTION_START)
            val ext = (requested?.ext ?: selected.ext ?: "mp4").lowercase().filter { it.isLetterOrDigit() }.ifEmpty { "mp4" }
            val name = safeName(selected.title ?: "YouTube video") + "." + ext
            EngineHost.addDownload(
                mediaUrl,
                mapOf(
                    "name" to name,
                    "headers" to headers,
                    "pageUrl" to link.canonicalUrl,
                ),
            )
        } catch (e: Exception) {
            val diagnostic = safeDiagnostic(e)
            val version = currentYtDlpVersion(context)
            Log.e(TAG, "YouTube download extraction failed (yt-dlp=$version): $diagnostic")
            Json.failure("YOUTUBE_DOWNLOAD_FAILED", "YouTube 다운로드를 시작하지 못했습니다. yt-dlp $version · $diagnostic")
        }
    }

    private fun toFormat(f: VideoFormat): Map<String, Any?>? {
        val id = f.formatId?.takeIf { formatIdPattern.matches(it) } ?: return null
        if (f.url.isNullOrBlank() || f.ext.isNullOrBlank()) return null
        val hasVideo = !f.vcodec.isNullOrBlank() && f.vcodec != "none"
        val hasAudio = !f.acodec.isNullOrBlank() && f.acodec != "none"
        val kind = when {
            hasVideo && hasAudio -> "video"
            !hasVideo && hasAudio -> "audio"
            else -> return null
        }
        val bytes = f.fileSize.takeIf { it > 0 } ?: f.fileSizeApproximate.takeIf { it > 0 }
        return linkedMapOf(
            "formatId" to id,
            "kind" to kind,
            "ext" to f.ext,
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
