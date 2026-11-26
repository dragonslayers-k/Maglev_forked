package com.maglev.engine.youtube

import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.ReturnCode
import java.io.File

/**
 * Real output-container conversion for YouTube downloads.
 *
 * Remux is attempted first for video containers to preserve the source codecs and avoid quality loss.
 * Only incompatible containers fall back to an explicit encode. Audio extraction/conversion uses the
 * selected encoder. All work runs on EngineHost's IO dispatcher, never the UI thread.
 */
internal object MediaContainerConverter {
    val VIDEO_CONTAINERS = setOf("mp4", "webm", "mkv", "mov", "avi", "flv", "gif")
    val AUDIO_CONTAINERS = setOf("mp3", "m4a", "aac", "alac", "flac", "opus", "wav", "vorbis")

    fun outputExtension(kind: String, selected: String): String = when {
        kind == "audio" && selected == "alac" -> "m4a"
        kind == "audio" && selected == "vorbis" -> "ogg"
        else -> selected.lowercase()
    }

    fun convert(source: File, output: File, kind: String, targetExt: String): String? {
        val ext = targetExt.lowercase()
        if (!source.isFile || source.length() <= 0L) return "원본 다운로드 파일이 없습니다."
        if (output.absolutePath == source.absolutePath) return "원본 파일과 출력 파일 경로가 같습니다."
        if (kind == "audio" && ext !in AUDIO_CONTAINERS) return "지원하지 않는 오디오 컨테이너입니다: $ext"
        if (kind == "video" && ext !in VIDEO_CONTAINERS) return "지원하지 않는 비디오 컨테이너입니다: $ext"
        val parent = output.parentFile ?: return "출력 폴더를 확인할 수 없습니다."
        if (!parent.exists() && !parent.mkdirs()) return "출력 폴더를 만들 수 없습니다."
        val temp = File(parent, output.name + ".maglev-convert.tmp")
        if (temp.exists() && !temp.delete()) return "이전 변환 임시 파일을 정리할 수 없습니다."

        val commands = if (kind == "audio") audioCommands(source, temp, ext) else videoCommands(source, temp, ext)
        var lastError = "FFmpeg 변환에 실패했습니다."
        for (command in commands) {
            val session = try {
                FFmpegKit.execute(command)
            } catch (t: Throwable) {
                lastError = t.message ?: t.javaClass.simpleName
                temp.delete()
                continue
            }
            if (ReturnCode.isSuccess(session.returnCode) && temp.isFile && temp.length() > 0L) {
                if (output.exists() && !output.delete()) {
                    temp.delete()
                    return "기존 출력 파일을 교체할 수 없습니다."
                }
                if (!temp.renameTo(output)) {
                    temp.delete()
                    return "변환 파일을 최종 위치로 이동할 수 없습니다."
                }
                return null
            }
            lastError = session.failStackTrace?.take(240) ?: "FFmpeg 종료 코드: ${session.returnCode}"
            temp.delete()
        }
        return lastError
    }

    private fun audioCommands(input: File, output: File, ext: String): List<String> {
        val (codec, format, extra) = when (ext) {
            "mp3" -> Triple("libmp3lame", "mp3", "-q:a 2")
            "m4a" -> Triple("aac", "ipod", "-b:a 192k")
            "aac" -> Triple("aac", "adts", "-b:a 192k")
            "alac" -> Triple("alac", "ipod", "")
            "flac" -> Triple("flac", "flac", "")
            "opus" -> Triple("libopus", "opus", "-b:a 160k")
            "wav" -> Triple("pcm_s16le", "wav", "")
            "vorbis" -> Triple("libvorbis", "ogg", "-q:a 5")
            else -> return emptyList()
        }
        return listOf(command(input, output, "-map 0:a:0 -vn -c:a $codec $extra -f $format"))
    }

    private fun videoCommands(input: File, output: File, ext: String): List<String> {
        if (ext == "gif") {
            return listOf(command(input, output, "-map 0:v:0 -vf 'fps=15,scale=480:-1:flags=lanczos' -an -loop 0 -f gif"))
        }
        val muxer = when (ext) {
            "mp4" -> "mp4"
            "webm" -> "webm"
            "mkv" -> "matroska"
            "mov" -> "mov"
            "avi" -> "avi"
            "flv" -> "flv"
            else -> return emptyList()
        }
        val remux = command(input, output, "-map 0:v:0 -map 0:a:0? -c copy -f $muxer")
        val encode = when (ext) {
            "mp4", "mov", "mkv" -> command(input, output, "-map 0:v:0 -map 0:a:0? -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 160k -f $muxer")
            "webm" -> command(input, output, "-map 0:v:0 -map 0:a:0? -c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus -b:a 128k -f webm")
            "avi" -> command(input, output, "-map 0:v:0 -map 0:a:0? -c:v mpeg4 -q:v 4 -c:a libmp3lame -q:a 3 -f avi")
            "flv" -> command(input, output, "-map 0:v:0 -map 0:a:0? -c:v flv -c:a libmp3lame -q:a 4 -f flv")
            else -> remux
        }
        return listOf(remux, encode)
    }

    private fun command(input: File, output: File, options: String): String =
        "-y -hide_banner -loglevel error -i ${quote(input.absolutePath)} $options ${quote(output.absolutePath)}"

    private fun quote(value: String): String = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
}
