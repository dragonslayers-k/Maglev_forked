package com.maglev.ytdlp

import android.content.Context
import android.util.Log
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import com.yausername.youtubedl_android.mapper.VideoFormat
import com.yausername.youtubedl_android.mapper.VideoInfo
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/** Standalone yt-dlp runtime bridge. It deliberately does not call Maglev EngineHost. */
class YtdlpEngineModule : Module() {
    companion object { private const val TAG = "YtdlpEngine" }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val active = ConcurrentHashMap<String, Boolean>()
    private val formatSelector = Regex("^[A-Za-z0-9._+/-]{1,160}$")
    private val transferId = Regex("^[A-Za-z0-9_-]{1,80}$")
    private val androidContext: Context? get() = this.appContext.reactContext?.applicationContext

    private fun sanitize(message: String?): String = (message ?: "Unknown error")
        .replace(Regex("https?://[^\\s]+", RegexOption.IGNORE_CASE), "[URL]")
        .replace(Regex("(?i)(token|cookie|authorization|sig|signature|key)=([^&\\s]+)"), "$1=[REDACTED]")
        .take(220)

    private fun ensureInitialized(context: Context) {
        YoutubeDL.getInstance().init(context.applicationContext)
    }

    private fun format(f: VideoFormat): Map<String, Any?> {
        val video = !f.vcodec.isNullOrBlank() && f.vcodec != "none"
        val audio = !f.acodec.isNullOrBlank() && f.acodec != "none"
        return linkedMapOf(
            "formatId" to f.formatId, "ext" to f.ext, "format" to f.formatNote,
            "width" to f.width, "height" to f.height, "fps" to f.fps,
            "videoCodec" to f.vcodec, "audioCodec" to f.acodec,
            "hasVideo" to video, "hasAudio" to audio,
            "size" to (f.fileSize.takeIf { it > 0 } ?: f.fileSizeApproximate.takeIf { it > 0 }),
            "bitrate" to f.tbr, "audioBitrate" to f.abr
        )
    }

    private fun info(context: Context, url: String): Map<String, Any?> {
        ensureInitialized(context)
        val parsed = YoutubeDL.getInstance().getInfo(url)
        return linkedMapOf(
            "ok" to true, "id" to parsed.id, "title" to parsed.title,
            "extractor" to parsed.extractor, "uploader" to parsed.uploader,
            "durationSeconds" to parsed.duration, "thumbnail" to parsed.thumbnail,
            "formats" to (parsed.formats ?: emptyList<VideoFormat>()).map(::format)
        )
    }

    override fun definition() = ModuleDefinition {
        Name("YtdlpEngine")
        Events("onProgress", "onCompleted", "onFailed", "onEngineState")

        AsyncFunction("init") {
            val context = androidContext ?: throw IllegalStateException("Module not attached")
            try {
                ensureInitialized(context)
                val version = YoutubeDL.getInstance().versionName(context) ?: "unknown"
                mapOf("ok" to true, "version" to version, "runtime" to "youtubedl-android/0.18.1")
            } catch (t: Throwable) {
                sendEvent("onEngineState", mapOf("ready" to false, "error" to sanitize(t.message)))
                throw t
            }
        }

        AsyncFunction("getInfo") { url: String ->
            val context = appContext ?: throw IllegalStateException("Module not attached")
            try { info(context, url) } catch (t: Throwable) {
                mapOf("ok" to false, "code" to "EXTRACT_FAILED", "message" to sanitize(t.message), "errorType" to t.javaClass.simpleName)
            }
        }

        AsyncFunction("download") { id: String, url: String, selector: String ->
            if (!transferId.matches(id) || !formatSelector.matches(selector)) throw IllegalArgumentException("Invalid transfer id or format")
            if (active.putIfAbsent(id, true) != null) throw IllegalStateException("Transfer already active")
            val context = androidContext ?: run { active.remove(id); throw IllegalStateException("Module not attached") }
            val directory = File(context.filesDir, "ytdlp/staging/$id")
            if (!directory.exists() && !directory.mkdirs()) { active.remove(id); throw IllegalStateException("Cannot create staging folder") }
            scope.launch {
                try {
                    ensureInitialized(context)
                    val request = YoutubeDLRequest(url)
                        .addOption("--no-playlist")
                        .addOption("-f", selector)
                        .addOption("-o", File(directory, "%(title).160B [%(id)s].%(ext)s").absolutePath)
                        .addOption("--newline")
                    val response = YoutubeDL.getInstance().execute(request, id) { progress, eta, line ->
                        val speed = Regex("(?i)at\\s+([^\\s]+/s)").find(line)?.groupValues?.getOrNull(1)
                        sendEvent("onProgress", mapOf("id" to id, "percent" to progress.coerceIn(0f, 100f), "etaSeconds" to eta, "speed" to speed, "line" to sanitize(line)))
                    }
                    val files = directory.listFiles()?.filter { it.isFile }?.map { mapOf("name" to it.name, "bytes" to it.length()) } ?: emptyList()
                    sendEvent("onCompleted", mapOf("id" to id, "outputDirectory" to directory.absolutePath, "files" to files, "stdout" to sanitize(response.out)))
                } catch (t: Throwable) {
                    val canceled = t.javaClass.simpleName.contains("Canceled", ignoreCase = true)
                    sendEvent(if (canceled) "onFailed" else "onFailed", mapOf("id" to id, "code" to if (canceled) "CANCELED" else "DOWNLOAD_FAILED", "message" to sanitize(t.message), "errorType" to t.javaClass.simpleName))
                } finally { active.remove(id) }
            }
            mapOf("ok" to true, "started" to true, "id" to id, "outputDirectory" to directory.absolutePath)
        }

        Function("cancel") { id: String ->
            if (!transferId.matches(id)) return@Function false
            YoutubeDL.getInstance().destroyProcessById(id)
        }

        AsyncFunction("update") { channel: String ->
            val context = appContext ?: throw IllegalStateException("Module not attached")
            ensureInitialized(context)
            val selected = if (channel.equals("nightly", true)) YoutubeDL.UpdateChannel.NIGHTLY else YoutubeDL.UpdateChannel.STABLE
            val status = YoutubeDL.getInstance().updateYoutubeDL(context, selected)
            mapOf("ok" to true, "status" to status?.name, "version" to YoutubeDL.getInstance().versionName(context))
        }

        OnDestroy { scope.coroutineContext[ kotlinx.coroutines.Job ]?.cancel() }
    }
}
