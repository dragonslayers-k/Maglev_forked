package com.maglev.ytdlp

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import com.yausername.youtubedl_android.mapper.VideoFormat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.io.File
import java.util.concurrent.ConcurrentHashMap

class YtdlpEngineModule : Module() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val active = ConcurrentHashMap<String, Boolean>()
    private val selectorPattern = Regex("^[A-Za-z0-9._+/-]{1,160}$")
    private val idPattern = Regex("^[A-Za-z0-9_-]{1,80}$")
    private val context: Context? get() = appContext.reactContext?.applicationContext

    private fun safe(message: String?) = (message ?: "Unknown error")
        .replace(Regex("https?://[^\\s]+", RegexOption.IGNORE_CASE), "[URL]")
        .replace(Regex("(?i)(token|cookie|authorization|sig|signature|key)=([^&\\s]+)"), "$1=[REDACTED]")
        .take(220)
    private fun init(c: Context) { YoutubeDL.getInstance().init(c.applicationContext) }
    private fun mapFormat(f: VideoFormat): Map<String, Any?> {
        val video = !f.vcodec.isNullOrBlank() && f.vcodec != "none"
        val audio = !f.acodec.isNullOrBlank() && f.acodec != "none"
        return mapOf("formatId" to f.formatId, "ext" to f.ext, "format" to f.formatNote, "width" to f.width, "height" to f.height, "fps" to f.fps, "videoCodec" to f.vcodec, "audioCodec" to f.acodec, "hasVideo" to video, "hasAudio" to audio, "size" to (f.fileSize.takeIf { it > 0 } ?: f.fileSizeApproximate.takeIf { it > 0 }), "bitrate" to f.tbr, "audioBitrate" to f.abr)
    }
    private fun publishFile(c: Context, file: File): Uri {
        val mime = android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension.lowercase()) ?: "application/octet-stream"
        val resolver = c.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, file.name)
            put(MediaStore.MediaColumns.MIME_TYPE, mime)
            if (Build.VERSION.SDK_INT >= 29) put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/Maglev+")
        }
        val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val uri = resolver.insert(collection, values) ?: error("MediaStore insert failed")
        try {
            resolver.openOutputStream(uri, "w")?.use { out -> file.inputStream().use { it.copyTo(out) } } ?: error("Cannot open output stream")
            return uri
        } catch (t: Throwable) {
            resolver.delete(uri, null, null)
            throw t
        }
    }
    override fun definition() = ModuleDefinition {
        Name("YtdlpEngine")
        Events("onProgress", "onCompleted", "onFailed", "onEngineState")
        AsyncFunction("init") { c=context ?: error("Module not attached"); init(c); mapOf("ok" to true, "version" to (YoutubeDL.getInstance().versionName(c) ?: "unknown"), "runtime" to "youtubedl-android/0.18.1") }
        AsyncFunction("getInfo") { url: String ->
            try { val c=context ?: error("Module not attached"); init(c); val v=YoutubeDL.getInstance().getInfo(url); mapOf("ok" to true,"id" to v.id,"title" to v.title,"extractor" to v.extractor,"uploader" to v.uploader,"durationSeconds" to v.duration,"thumbnail" to v.thumbnail,"formats" to (v.formats ?: emptyList<VideoFormat>()).map(::mapFormat)) }
            catch(t:Throwable){ mapOf("ok" to false,"code" to "EXTRACT_FAILED","message" to safe(t.message),"errorType" to t.javaClass.simpleName) }
        }
        AsyncFunction("download") { id: String, url: String, selector: String ->
            require(idPattern.matches(id) && selectorPattern.matches(selector)) { "Invalid id or selector" }
            check(active.putIfAbsent(id,true)==null) { "Transfer already active" }
            val c=context ?: run { active.remove(id); error("Module not attached") }
            val folder=File(c.filesDir,"ytdlp/staging/$id")
            check(folder.exists() || folder.mkdirs()) { "Cannot create staging directory" }
            scope.launch {
                try {
                    init(c)
                    val req=YoutubeDLRequest(url).addOption("--no-playlist").addOption("-f",selector).addOption("-o",File(folder,"%(title).160B [%(id)s].%(ext)s").absolutePath).addOption("--newline")
                    YoutubeDL.getInstance().execute(req,id) { pct, eta, line ->
                        val speed=Regex("(?i)at\\s+([^\\s]+/s)").find(line)?.groupValues?.getOrNull(1)
                        sendEvent("onProgress",mapOf("id" to id,"percent" to pct.coerceIn(0f,100f),"etaSeconds" to eta,"speed" to speed))
                    }
                    val files=folder.listFiles()?.filter{it.isFile} ?: emptyList()
                    val published=files.map { f -> mapOf("name" to f.name,"bytes" to f.length(),"uri" to publishFile(c,f).toString()) }
                    sendEvent("onCompleted",mapOf("id" to id,"files" to published))
                } catch(t:Throwable) {
                    sendEvent("onFailed",mapOf("id" to id,"code" to if(t.javaClass.simpleName.contains("cancel",true)) "CANCELED" else "DOWNLOAD_FAILED","message" to safe(t.message),"errorType" to t.javaClass.simpleName))
                } finally { active.remove(id) }
            }
            mapOf("ok" to true,"started" to true,"id" to id)
        }
        Function("cancel") { id: String -> if(idPattern.matches(id)) YoutubeDL.getInstance().destroyProcessById(id) else false }
        AsyncFunction("update") { channel: String -> val c=context ?: error("Module not attached"); init(c); val selected=if(channel.equals("nightly",true)) YoutubeDL.UpdateChannel.NIGHTLY else YoutubeDL.UpdateChannel.STABLE; val result=YoutubeDL.getInstance().updateYoutubeDL(c,selected); mapOf("ok" to true,"status" to result?.name,"version" to YoutubeDL.getInstance().versionName(c)) }
        OnDestroy { scope.coroutineContext[kotlinx.coroutines.Job]?.cancel() }
    }
}
