package com.maglev.engine.youtube

import android.content.Context
import android.util.Log
import android.webkit.CookieManager
import com.maglev.engine.EngineHost
import com.maglev.engine.storage.StorageManager
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.services.youtube.extractors.YoutubeStreamExtractor
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.stream.StreamInfo
import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.math.abs

/**
 * Fast YouTube format extraction through NewPipe, following YTDLnis's NewPipe data path.
 * Adaptive DASH tracks are handed to Maglev's existing stream downloader and MediaMuxer.
 */
object NewPipeYoutube {
    private const val CACHE_MS = 180_000L
    const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0"
    private val lock = Any()
    @Volatile private var initialized = false
    private val cache = ConcurrentHashMap<String, Pair<Long, StreamInfo>>()

    private class HttpDownloader : Downloader() {
        private val client = OkHttpClient.Builder().readTimeout(30, TimeUnit.SECONDS).build()

        override fun execute(request: Request): Response {
            val data = request.dataToSend()?.toRequestBody()
            val builder = okhttp3.Request.Builder()
                .url(request.url())
                .method(request.httpMethod(), data)
                .header("User-Agent", USER_AGENT)
            request.headers().forEach { (name, values) ->
                when (values.size) {
                    0 -> Unit
                    1 -> builder.header(name, values[0])
                    else -> {
                        builder.removeHeader(name)
                        values.forEach { builder.addHeader(name, it) }
                    }
                }
            }
            if (request.headers().keys.none { it.equals("Cookie", true) }) {
                val cookies = runCatching { CookieManager.getInstance().getCookie(request.url()) }.getOrNull()
                if (!cookies.isNullOrBlank()) builder.header("Cookie", cookies)
            }
            client.newCall(builder.build()).execute().use { response ->
                if (response.code == 429) throw ReCaptchaException("YouTube requested a reCAPTCHA challenge", request.url())
                val body = response.body?.string().orEmpty()
                return Response(response.code, response.message, response.headers.toMultimap(), body, response.request.url.toString())
            }
        }
    }

    private fun init(context: Context) {
        if (initialized) return
        synchronized(lock) {
            if (initialized) return
            NewPipe.init(HttpDownloader())
            YoutubeStreamExtractor.setPoTokenProvider(com.maglev.engine.youtube.potoken.NewPipePoTokenGenerator(context))
            initialized = true
        }
    }

    fun get(context: Context, url: String): StreamInfo {
        init(context)
        val now = System.currentTimeMillis()
        cache[url]?.takeIf { now - it.first < CACHE_MS }?.let { return it.second }
        val info = StreamInfo.getInfo(url)
        cache[url] = now to info
        return info
    }

    /** Signed googlevideo URLs can expire while a user is choosing formats. Always refresh at add time. */
    private fun getFresh(context: Context, url: String): StreamInfo {
        init(context)
        val info = StreamInfo.getInfo(url)
        cache[url] = System.currentTimeMillis() to info
        return info
    }

    fun formats(info: StreamInfo): List<Map<String, Any?>> {
        val duration = info.duration.toDouble().takeIf { it > 0 && it.isFinite() }
        val audio = info.audioStreams
            .filter { it.content.isNotBlank() && it.bitrate > 0 && it.itagItem != null }
            .filterNot { it.itagItem!!.id == 599 || it.itagItem!!.id == 600 }
            .sortedByDescending { it.bitrate }
        val bestAudioKbps = audio.firstOrNull()?.bitrate?.div(1000.0) ?: 128.0
        val videos = (info.videoStreams + if (info.dashMpdUrl.isNotBlank()) info.videoOnlyStreams else emptyList())
            .filter { it.content.isNotBlank() && it.height > 0 && it.width > 0 && it.bitrate > 0 && it.itagItem != null }
        val out = mutableListOf<Map<String, Any?>>()
        for ((height, candidates) in videos.groupBy { it.height }.toSortedMap(compareByDescending { it })) {
            val selected = candidates.maxByOrNull { it.bitrate } ?: continue
            val videoKbps = selected.bitrate / 1000.0
            val audioLength = audio.firstOrNull()?.itagItem?.contentLength ?: 0L
            val selectedLength = selected.itagItem!!.contentLength
            val exactBytes = when {
                !selected.isVideoOnly && selectedLength > 0 -> selectedLength
                selected.isVideoOnly && selectedLength > 0 && audioLength > 0 -> selectedLength + audioLength
                else -> null
            }
            val combinedKbps = videoKbps + if (selected.isVideoOnly) bestAudioKbps else 0.0
            val bytes = exactBytes ?: duration?.let { (combinedKbps * 1000.0 / 8.0 * it).toLong().takeIf { size -> size > 0 } }
            out += linkedMapOf(
                "formatId" to ("npv" + height),
                "playerClient" to "newpipe",
                "kind" to "video",
                "ext" to "mp4",
                "height" to height,
                "width" to selected.width,
                "fps" to selected.fps,
                "tbr" to combinedKbps,
                "abr" to 0,
                "size" to bytes,
                "sizeEstimated" to (exactBytes == null),
                "hasAudio" to !selected.isVideoOnly,
                "format" to ("DASH · " + selected.codec),
            )
        }
        for (stream in audio) {
            val itag = stream.itagItem!!.id
            val kbps = stream.bitrate / 1000.0
            val bytes = stream.itagItem!!.contentLength.takeIf { it > 0 }
                ?: duration?.let { (stream.bitrate.toDouble() / 8.0 * it).toLong().takeIf { size -> size > 0 } }
            val mediaName = stream.format?.name.orEmpty().uppercase()
            val ext = if (mediaName.contains("WEBM")) "webm" else "m4a"
            val trackName = stream.audioTrackName?.takeIf { it.isNotBlank() }
                ?: stream.audioLocale?.displayName?.takeIf { it.isNotBlank() }
                ?: "원본 오디오"
            out += linkedMapOf(
                "formatId" to ("npa" + itag),
                "playerClient" to "newpipe",
                "kind" to "audio",
                "ext" to ext,
                "height" to 0,
                "width" to 0,
                "fps" to 0,
                "tbr" to kbps,
                "abr" to kbps,
                "size" to bytes,
                "sizeEstimated" to (stream.itagItem!!.contentLength <= 0),
                "format" to (trackName + " · " + stream.codec),
            )
        }
        return out
    }

    fun add(context: Context, url: String, formatId: String, audioBitrateKbps: Double? = null, outputContainer: String = "original"): Map<String, Any?>? {
        if (!formatId.startsWith("npv") && !formatId.startsWith("npa")) return null
        val kind = if (formatId.startsWith("npa")) "audio" else "video"
        val allowed = if (kind == "audio") MediaContainerConverter.AUDIO_CONTAINERS else MediaContainerConverter.VIDEO_CONTAINERS
        if (outputContainer != "original" && outputContainer !in allowed) return failure("INVALID_ARGUMENT", "출력 컨테이너가 올바르지 않습니다.")
        // Metadata cache is useful for fast UI, but its signed media URLs may expire.
        // Refresh the stream URL immediately before adding the transfer.
        val info = getFresh(context, url)
        if (formatId.startsWith("npa")) {
            val itag = formatId.removePrefix("npa").toIntOrNull()
                ?: return failure("INVALID_ARGUMENT", "오디오 형식 ID가 올바르지 않습니다.")
            val stream = info.audioStreams.firstOrNull { it.itagItem?.id == itag && it.content.isNotBlank() }
                ?: return failure("YOUTUBE_AUDIO_URL_MISSING", "선택한 오디오 형식의 주소를 갱신하지 못했습니다.")
            val sourceExt = if (stream.format?.name.orEmpty().contains("WEBM", true)) "webm" else "m4a"
            val targetExt = if (outputContainer == "original") sourceExt else outputContainer
            val outputExt = MediaContainerConverter.outputExtension("audio", targetExt)
            val baseName = safeName(info.name)
            val sourceName = "$baseName.$sourceExt"
            val needsPostProcess = outputContainer != "original" && (outputExt != sourceExt || targetExt in setOf("alac", "vorbis"))
            val outputName = if (needsPostProcess) uniqueOutputName(context, baseName, outputExt, sourceName) else sourceName
            // Log stable format metadata only; never log signed URLs, cookies or headers.
            Log.i("MaglevAudioDiag", "provider=newpipe itag=$itag bitrateBps=${stream.bitrate} contentLength=${stream.itagItem!!.contentLength} ext=$sourceExt requestedSegments=8")
            val options = linkedMapOf<String, Any?>(
                "name" to sourceName,
                "headers" to mapOf("User-Agent" to USER_AGENT, "Referer" to url),
                "pageUrl" to url,
                // Native Range transfer uses up to eight bounded parts after a 206/validator probe.
                "segments" to 8,
            )
            addPostProcess(options, "audio", sourceExt, targetExt, outputName, needsPostProcess, audioBitrateKbps)
            return EngineHost.addDownload(stream.content, options)
        }

        val height = formatId.removePrefix("npv").toIntOrNull()
            ?: return failure("INVALID_ARGUMENT", "동영상 화질 ID가 올바르지 않습니다.")
        val dash = info.dashMpdUrl.takeIf { it.isNotBlank() }
        if (dash != null) {
            val headers = mapOf("User-Agent" to USER_AGENT, "Referer" to url)
            val probe = EngineHost.probeStream(dash, mapOf("headers" to headers), 25_000L)
            if ((probe["ok"] as? Boolean) != true) {
                return failure("YOUTUBE_STREAM_PROBE_FAILED", "YouTube DASH 화질 정보를 읽지 못했습니다.")
            }
            val kind = probe["kind"] as? String
                ?: return failure("YOUTUBE_STREAM_UNSUPPORTED", "DASH 스트림 유형을 확인하지 못했습니다.")
            val variants = (probe["variants"] as? List<*>)?.mapNotNull { it as? Map<*, *> }.orEmpty()
            val variant = variants.filter { (it["audio"] as? String) != "none" }
                .minByOrNull { abs(((it["height"] as? Number)?.toInt() ?: 0) - height) }
                ?: return failure("YOUTUBE_STREAM_UNSUPPORTED", "선택한 화질의 영상 트랙을 찾지 못했습니다.")
            val variantId = variant["id"] as? String
                ?: return failure("YOUTUBE_STREAM_UNSUPPORTED", "영상 트랙 ID가 없습니다.")
            val audioTracks = (probe["audioTracks"] as? List<*>)?.mapNotNull { it as? Map<*, *> }.orEmpty()
            val targetAudioBps = audioBitrateKbps?.takeIf { it.isFinite() && it > 0 }?.times(1000.0)
            val audioCandidates = if (targetAudioBps != null) {
                audioTracks.filter { ((it["bandwidth"] as? Number)?.toDouble() ?: 0.0) <= targetAudioBps }
            } else audioTracks
            val chosenAudio = audioCandidates.maxByOrNull { (it["bandwidth"] as? Number)?.toDouble() ?: 0.0 }
            val audioId = chosenAudio?.get("id") as? String
            val selection = linkedMapOf<String, Any?>("kind" to kind, "variantId" to variantId)
            if ((variant["audio"] as? String) == "separate") {
                if (audioId.isNullOrBlank()) {
                    return failure(
                        if (targetAudioBps != null) "YOUTUBE_AUDIO_BITRATE_UNAVAILABLE" else "YOUTUBE_STREAM_UNSUPPORTED",
                        if (targetAudioBps != null) "선택한 음질 이하의 DASH 오디오 트랙이 없습니다." else "오디오 트랙을 찾지 못했습니다.",
                    )
                }
                selection["audioId"] = audioId
            }
            val sourceExt = "mp4"
            val targetExt = if (outputContainer == "original") sourceExt else outputContainer
            val outputExt = MediaContainerConverter.outputExtension("video", targetExt)
            val baseName = safeName(info.name) + "_" + height + "p"
            val sourceName = "$baseName.$sourceExt"
            val needsPostProcess = outputContainer != "original" && outputExt != sourceExt
            val outputName = if (needsPostProcess) uniqueOutputName(context, baseName, outputExt, sourceName) else sourceName
            val options = linkedMapOf<String, Any?>("name" to sourceName, "headers" to headers, "pageUrl" to url, "stream" to selection)
            addPostProcess(options, "video", sourceExt, targetExt, outputName, needsPostProcess, audioBitrateKbps)
            return EngineHost.addDownload(dash, options)
        }

        val progressive = info.videoStreams
            .filter { it.height == height && it.content.isNotBlank() && !it.isVideoOnly }
            .maxByOrNull { it.bitrate }
            ?: return failure("YOUTUBE_STREAM_UNSUPPORTED", "이 영상은 " + height + "p 화질의 오디오 포함 스트림을 제공하지 않습니다.")
        val sourceExt = "mp4"
        val targetExt = if (outputContainer == "original") sourceExt else outputContainer
        val outputExt = MediaContainerConverter.outputExtension("video", targetExt)
        val baseName = safeName(info.name) + "_" + height + "p"
        val sourceName = "$baseName.$sourceExt"
        val needsPostProcess = outputContainer != "original" && outputExt != sourceExt
        val outputName = if (needsPostProcess) uniqueOutputName(context, baseName, outputExt, sourceName) else sourceName
        val options = linkedMapOf<String, Any?>("name" to sourceName, "headers" to mapOf("User-Agent" to USER_AGENT, "Referer" to url), "pageUrl" to url)
        addPostProcess(options, "video", sourceExt, targetExt, outputName, needsPostProcess, audioBitrateKbps)
        return EngineHost.addDownload(progressive.content, options)
    }

    private fun addPostProcess(options: MutableMap<String, Any?>, kind: String, sourceExt: String, targetExt: String, outputName: String, enabled: Boolean, audioBitrateKbps: Double? = null) {
        if (enabled) options["postprocess"] = linkedMapOf(
            "kind" to kind, "sourceExt" to sourceExt, "targetExt" to targetExt,
            "outputName" to outputName,
            "audioBitrateKbps" to audioBitrateKbps?.takeIf { it.isFinite() && it > 0 }?.toInt(),
        )
    }

    private fun uniqueOutputName(context: Context, baseName: String, extension: String, sourceName: String): String {
        val folder = StorageManager.activeTarget(context).path
        var candidate = "$baseName.$extension"
        var index = 1
        while (candidate == sourceName || File(folder, candidate).exists()) {
            candidate = "$baseName ($index).$extension"
            index++
        }
        return candidate
    }

    private fun failure(code: String, message: String) = mapOf("ok" to false, "code" to code, "message" to message)

    private fun safeName(raw: String): String = raw
        .replace(Regex("[/\\\\:*?\"<>|]"), "_")
        .replace(Regex("\\s+"), " ")
        .trim(' ', '.')
        .take(150)
        .ifEmpty { "YouTube video" }
}
