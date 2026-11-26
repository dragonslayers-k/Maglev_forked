package com.maglev.engine.youtube

import android.content.Context
import android.net.Uri
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
    private val formatIdPattern = Regex("^[A-Za-z0-9._-]{1,64}$")
    private val PLAYER_CLIENTS = listOf("newpipe", "android_vr", "web_safari")

    /**
     * Initialize the bundled extractor only. Never check/download an yt-dlp update on the
     * interactive metadata or download path: that network update made first-run analysis block.
     * Runtime updates belong to an explicit background maintenance flow, not a user tap.
     */
    @Synchronized
    private fun prepareYtDlp(context: Context) {
        YoutubeDL.getInstance().init(context.applicationContext)
    }

    private fun currentYtDlpVersion(context: Context): String =
        runCatching { YoutubeDL.getInstance().versionName(context.applicationContext) }
            .getOrNull()
            ?.take(48)
            ?: "unknown"

    private fun safeDiagnostic(error: Throwable): String {
        // Include nested causes and a short stack excerpt: initializer/linkage errors otherwise
        // escape the old Exception-only catches and are impossible to diagnose from the UI.
        val parts = mutableListOf<String>()
        var current: Throwable? = error
        var depth = 0
        while (current != null && depth < 4) {
            val message = (current.message ?: current.javaClass.simpleName)
                .replace(Regex("https?://[^\\s]+", RegexOption.IGNORE_CASE), "[URL]")
                .replace(Regex("(?i)(cookie|authorization|token|key)=([^&\\s]+)"), "\\$1=[REDACTED]")
                .take(180)
            parts += current.javaClass.simpleName + ": " + message
            current = current.cause
            depth++
        }
        val frames = error.stackTrace.take(5).map { frame ->
            frame.className.take(120) + "." + frame.methodName.take(80) + ":" + frame.lineNumber
        }
        return (parts + frames.map { "at " + it }).joinToString(" <- ").take(900)
    }

    private fun rethrowFatal(error: Throwable) {
        if (error is ThreadDeath) throw error
        if (error is VirtualMachineError) throw error
    }

    /**
     * YouTube needs an explicit player client. Other yt-dlp-supported HTTP(S) pages use the site's
     * registered extractor. Generic extraction is only invoked by an explicit user action.
     */
    private fun requestFor(url: String, playerClient: String, ffmpegDirectory: String? = null): YoutubeDLRequest {
        val request = YoutubeDLRequest(url).addOption("--no-playlist")
        if (playerClient != "generic") {
            request.addOption("--extractor-args", "youtube:player_client=" + playerClient)
        }
        // The wrapper appends a stale nativeLibraryDir/libffmpeg.so path even when FFmpeg is excluded.
        // Override it with an existing directory to avoid the missing-path warning on metadata/audio.
        if (!ffmpegDirectory.isNullOrBlank()) request.addOption("--ffmpeg-location", ffmpegDirectory)
        return request
    }

    /** Accept only normal web pages; reject custom schemes and credential-bearing URLs. */
    private fun httpMediaUrl(raw: String): String? {
        val value = raw.trim()
        if (value.isEmpty() || value.length > 4096) return null
        val uri = runCatching { Uri.parse(value) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase()
        if (scheme != "http" && scheme != "https") return null
        if (uri.host.isNullOrBlank() || uri.userInfo != null) return null
        return value
    }

    fun info(context: Context, rawUrl: String): Map<String, Any?> {
        val link = YouTubeUrl.parse(rawUrl)
        val sourceUrl = link?.canonicalUrl ?: httpMediaUrl(rawUrl)
            ?: return Json.failure("INVALID_SOURCE", "HTTP(S) 웹페이지 주소를 입력하세요.")
        val clients = if (link != null) PLAYER_CLIENTS else listOf("generic")
        return try {
            val app = context.applicationContext
            if (link != null) {
                val fastInfo = runCatching { NewPipeYoutube.get(sourceUrl) }.getOrNull()
                if (fastInfo != null) {
                    val fastFormats = NewPipeYoutube.formats(fastInfo)
                    if (fastFormats.any { it["kind"] == "video" }) {
                        return linkedMapOf(
                            "ok" to true,
                            "videoId" to link.videoId,
                            "title" to fastInfo.name,
                            "uploader" to fastInfo.uploaderName,
                            "extractor" to "NewPipe",
                            "duration" to fastInfo.duration,
                            "thumbnail" to ("https://i.ytimg.com/vi/" + link.videoId + "/hqdefault.jpg"),
                            "formats" to fastFormats,
                        )
                    }
                }
            }
            prepareYtDlp(app)
            var metadata: VideoInfo? = null
            var lastError: Exception? = null
            val allFormats = mutableListOf<Map<String, Any?>>()

            for (client in clients) {
                try {
                    val current = YoutubeDL.getInstance().getInfo(requestFor(sourceUrl, client, app.applicationInfo.nativeLibraryDir))
                    if (metadata == null || metadata?.title.isNullOrBlank()) metadata = current
                    val found = (current.formats ?: arrayListOf()).mapNotNull { format -> toFormat(format, client, current.duration) }
                    allFormats.addAll(found)
                    val hasVideo = found.any { it["kind"] == "video" }
                    val hasAudio = found.any { it["kind"] == "audio" }
                    if (hasVideo) break
                } catch (e: Throwable) {
                    rethrowFatal(e)
                    // A broken runtime/class initializer is not an extractor-client failure.
                    // Do not continue into another client and overwrite the useful root cause.
                    if (e is LinkageError) throw e
                    lastError = e as? Exception ?: RuntimeException(e)
                    Log.w(TAG, "yt-dlp client " + client + " failed: " + safeDiagnostic(e))
                }
            }

            val video = metadata ?: throw (lastError ?: IllegalStateException("No YouTube metadata"))
            // Different player clients often expose the same format ID. Keep one row per
            // format and prefer the client result that includes a known file-size estimate.
            val unique = allFormats.groupBy { it["formatId"].toString() }.values.mapNotNull { candidates ->
                candidates.maxWithOrNull(
                    compareBy<Map<String, Any?>> { (it["size"] as? Number)?.toLong() ?: 0L }
                        .thenBy { (it["tbr"] as? Number)?.toDouble() ?: 0.0 },
                )
            }
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
                    "YTDLP_NO_FORMAT",
                    "지원 가능한 형식을 찾지 못했습니다. 로그인·세션·사이트 추출기·보호 상태 또는 런타임 요구를 확인하세요.",
                )
            }
            linkedMapOf(
                "ok" to true,
                "videoId" to (link?.videoId ?: (video.id ?: "")),
                "title" to (video.title ?: if (link != null) "YouTube video" else "웹 동영상"),
                "uploader" to video.uploader,
                "extractor" to video.extractor,
                "duration" to video.duration,
                "thumbnail" to video.thumbnail,
                "formats" to choices,
            )
        } catch (e: Throwable) {
            rethrowFatal(e)
            val diagnostic = safeDiagnostic(e)
            val version = currentYtDlpVersion(context)
            Log.e(TAG, "yt-dlp metadata extraction failed (yt-dlp=" + version + "): " + diagnostic, e)
            val subject = if (link != null) "YouTube 영상" else "웹페이지 영상"
            Json.failure("YOUTUBE_EXTRACT_FAILED", subject + " 정보를 가져오지 못했습니다. yt-dlp " + version + " · " + diagnostic)
        }
    }

    fun add(context: Context, rawUrl: String, formatId: String, playerClient: String): Map<String, Any?> {
        val link = YouTubeUrl.parse(rawUrl)
        val sourceUrl = link?.canonicalUrl ?: httpMediaUrl(rawUrl)
            ?: return Json.failure("INVALID_SOURCE", "HTTP(S) 웹페이지 주소를 입력하세요.")
        val validClient = if (link != null) playerClient in PLAYER_CLIENTS else playerClient == "generic"
        if (!formatIdPattern.matches(formatId) || !validClient) {
            return Json.failure("INVALID_ARGUMENT", "선택한 형식이 올바르지 않습니다.")
        }
        if (link != null && playerClient == "newpipe") {
            return try {
                val app = context.applicationContext
                if (!QuickShareAdd.startEngine(app)) return Json.failure("ENGINE_UNAVAILABLE", "다운로드 엔진을 시작하지 못했습니다.")
                BackgroundStart.start(app, MaglevTorrentService.ACTION_START)
                NewPipeYoutube.add(app, sourceUrl, formatId)
                    ?: Json.failure("INVALID_ARGUMENT", "선택한 NewPipe 형식을 처리하지 못했습니다.")
            } catch (e: Exception) {
                Json.failure("YOUTUBE_DOWNLOAD_FAILED", "YouTube 다운로드를 시작하지 못했습니다. " + safeDiagnostic(e))
            }
        }
        return try {
            val app = context.applicationContext
            prepareYtDlp(app)
            val selected = YoutubeDL.getInstance().getInfo(requestFor(sourceUrl, playerClient, app.applicationInfo.nativeLibraryDir))
            val audioOnly = formatId == "bestaudio"
            val availableFormats = selected.formats.orEmpty()
            val requested = if (audioOnly) {
                availableFormats.filter { format ->
                    !format.acodec.isNullOrBlank() && format.acodec != "none" &&
                        (format.vcodec.isNullOrBlank() || format.vcodec == "none")
                }.maxByOrNull { it.abr }
            } else availableFormats.firstOrNull { it.formatId == formatId }
            if (audioOnly && requested == null) {
                return Json.failure(
                    "YOUTUBE_AUDIO_FORMAT_UNRESOLVED",
                    "오디오 전용 형식을 확인하지 못했습니다. 이 영상은 오디오만 저장할 수 있는 형식이 제공되지 않았습니다.",
                )
            }
            // bestaudio must resolve to the requested audio-only format. Never fall back to
            // VideoInfo.url, which can point at a video and violate the user's selection.
            val directUrl = if (audioOnly) {
                requested?.url?.takeIf { it.isNotBlank() }
                    ?: return Json.failure("YOUTUBE_AUDIO_URL_MISSING", "오디오 전용 다운로드 주소를 가져오지 못했습니다.")
            } else {
                requested?.url ?: selected.url ?: requested?.manifestUrl ?: selected.manifestUrl
                    ?: return Json.failure("YOUTUBE_NO_FORMAT", "선택한 형식의 다운로드 주소를 가져오지 못했습니다.")
            }
            if (!audioOnly && requested != null &&
                !requested.vcodec.isNullOrBlank() && requested.vcodec != "none" &&
                (requested.acodec.isNullOrBlank() || requested.acodec == "none") &&
                requested.manifestUrl.isNullOrBlank() && selected.manifestUrl.isNullOrBlank()) {
                return Json.failure("YOUTUBE_VIDEO_AUDIO_UNAVAILABLE", "이 형식은 분리 영상 트랙입니다. 오디오와 병합할 수 있는 DASH 형식이 없습니다.")
            }
            val manifestUrl = requested?.manifestUrl?.takeIf { it.isNotBlank() }
                ?: selected.manifestUrl?.takeIf { it.isNotBlank() }
            val streamUrl = if (audioOnly) null else manifestUrl ?: directUrl.takeIf { isPlaylistUrl(it) }
            val mediaUrl = streamUrl ?: directUrl

            val rawHeaders = requested?.httpHeaders ?: selected.httpHeaders.orEmpty()
            val headers = linkedMapOf<String, String>()
            rawHeaders.entries.firstOrNull { it.key.equals("User-Agent", true) }?.value?.let { headers["User-Agent"] = it }
            rawHeaders.entries.firstOrNull { it.key.equals("Referer", true) }?.value?.let { headers["Referer"] = it }
            rawHeaders.entries.firstOrNull { it.key.equals("Origin", true) }?.value?.let { headers["Origin"] = it }
            if (headers["User-Agent"].isNullOrBlank()) headers["User-Agent"] = WebSettings.getDefaultUserAgent(app)
            val pageUri = Uri.parse(sourceUrl)
            if (headers["Referer"].isNullOrBlank()) headers["Referer"] = sourceUrl
            val pageOrigin = pageUri.scheme + "://" + pageUri.authority
            if (headers["Origin"].isNullOrBlank()) headers["Origin"] = pageOrigin

            if (!QuickShareAdd.startEngine(app)) {
                return Json.failure("ENGINE_UNAVAILABLE", "다운로드 엔진을 시작하지 못했습니다.")
            }
            BackgroundStart.start(app, MaglevTorrentService.ACTION_START)
            val ext = (requested?.ext ?: if (audioOnly) "m4a" else selected.ext ?: "mp4")
                .lowercase().filter { it.isLetterOrDigit() }.ifEmpty { if (audioOnly) "m4a" else "mp4" }
            val name = safeName(selected.title ?: if (link != null) "YouTube video" else "Web video") + "." + ext
            val options = linkedMapOf<String, Any?>(
                "name" to name,
                "headers" to headers,
                "pageUrl" to sourceUrl,
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
                val audioTracks = (probe["audioTracks"] as? List<*>)?.mapNotNull { it as? Map<*, *> }.orEmpty()
                val audioId = audioTracks.firstOrNull()?.get("id") as? String
                val selection = linkedMapOf<String, Any?>("kind" to kind, "variantId" to variantId)
                if ((variant["audio"] as? String) == "separate") {
                    if (audioId.isNullOrBlank()) {
                        return Json.failure("YOUTUBE_STREAM_UNSUPPORTED", "분리 오디오 트랙을 확인하지 못했습니다.")
                    }
                    selection["audioId"] = audioId
                }
                options["stream"] = selection
            }

            EngineHost.addDownload(mediaUrl, options)
        } catch (e: Exception) {
            val diagnostic = safeDiagnostic(e)
            val version = currentYtDlpVersion(context)
            Log.e(TAG, "yt-dlp download extraction failed (yt-dlp=" + version + "): " + diagnostic)
            val subject = if (link != null) "YouTube 다운로드" else "웹페이지 다운로드"
            Json.failure("YOUTUBE_DOWNLOAD_FAILED", subject + "를 시작하지 못했습니다. yt-dlp " + version + " · " + diagnostic)
        }
    }

    private fun isPlaylistUrl(raw: String): Boolean {
        val path = raw.substringBefore('?').substringBefore('#').lowercase()
        return path.endsWith(".m3u8") || path.endsWith(".mpd") || raw.contains("manifest.m3u8", ignoreCase = true)
    }

    private fun toFormat(f: VideoFormat, playerClient: String, durationSeconds: Number?): Map<String, Any?>? {
        val id = f.formatId?.takeIf { formatIdPattern.matches(it) } ?: return null
        val url = f.url?.takeIf { it.isNotBlank() }
        val manifest = f.manifestUrl?.takeIf { it.isNotBlank() }
        if (url == null && manifest == null) return null
        val hasVideo = !f.vcodec.isNullOrBlank() && f.vcodec != "none"
        val hasAudio = !f.acodec.isNullOrBlank() && f.acodec != "none"
        val isStream = manifest != null || url?.let { isPlaylistUrl(it) } == true
        val kind = when {
            hasVideo -> "video"
            !hasVideo && hasAudio -> "audio"
            else -> return null
        }
        val exactBytes = f.fileSize.takeIf { it > 0 } ?: f.fileSizeApproximate.takeIf { it > 0 }
        // YouTube often omits filesize for adaptive/progressive formats. Use the extractor bitrate
        // when available; otherwise estimate a conservative bitrate by resolution and frame rate.
        // These values are explicitly surfaced as approximate in the UI, never as exact sizes.
        val height = f.height
        val fps = f.fps
        val fallbackKbps = when {
            !hasVideo && hasAudio -> f.abr.takeIf { it > 0 }?.toDouble() ?: 128.0
            height == null -> null
            height <= 144 -> 180.0
            height <= 240 -> 350.0
            height <= 360 -> 750.0
            height <= 480 -> 1_400.0
            height <= 720 -> 3_000.0
            height <= 1080 -> 5_500.0
            height <= 1440 -> 10_000.0
            else -> 16_000.0
        }
        val reportedKbps = f.tbr.takeIf { it > 0 } ?: f.abr.takeIf { it > 0 }
        val estimateKbps = reportedKbps?.toDouble() ?: fallbackKbps?.times(if (fps > 30) 1.5 else 1.0)
        val seconds = durationSeconds?.toDouble()?.takeIf { it > 0 && it.isFinite() }
        val estimatedBytes = if (exactBytes == null && estimateKbps != null && estimateKbps > 0 && seconds != null) {
            (estimateKbps * 1000.0 / 8.0 * seconds).takeIf { it.isFinite() && it > 0 && it < Long.MAX_VALUE.toDouble() }?.toLong()
        } else null
        val bytes = exactBytes ?: estimatedBytes
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
            "sizeEstimated" to (exactBytes == null && estimatedBytes != null),
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
