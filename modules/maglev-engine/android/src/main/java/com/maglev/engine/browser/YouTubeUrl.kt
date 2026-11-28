package com.maglev.engine.browser

import java.net.URI

/** Recognizes YouTube video URLs and normalizes variants without fetching the page. */
object YouTubeUrl {
    data class VideoLink(
        val videoId: String,
        val playlistId: String? = null,
        val startSeconds: Int? = null,
    ) {
        val canonicalUrl: String
            get() = buildString {
                append("https://www.youtube.com/watch?v=")
                append(videoId)
                playlistId?.let { append("&list=").append(it) }
                startSeconds?.takeIf { it > 0 }?.let { append("&t=").append(it).append("s") }
            }
    }

    private val videoIdPattern = Regex("^[A-Za-z0-9_-]{11}$")
    private val playlistPattern = Regex("^[A-Za-z0-9_-]{10,80}$")
    private val hosts = setOf(
        "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
        "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be",
    )

    private fun normalize(raw: String): String {
        val value = raw.trim()
        val hostOnly = Regex("^(?:(?:www|m|music)\\.)?(?:youtube\\.com|youtu\\.be|youtube-nocookie\\.com)/", RegexOption.IGNORE_CASE)
        return if (!value.contains("://") && hostOnly.containsMatchIn(value)) "https://$value" else value
    }

    /** Parse known URL forms; null for non-YouTube URLs, malformed URLs, or playlist-only URLs. */
    fun parse(raw: String?): VideoLink? {
        if (raw.isNullOrBlank() || raw.length > 4096) return null
        val uri = try { URI(normalize(raw)) } catch (_: Exception) { return null }
        if (!uri.scheme.equals("https", true) && !uri.scheme.equals("http", true)) return null
        val host = uri.host?.lowercase()?.removePrefix("www.") ?: return null
        if (host !in hosts.map { it.removePrefix("www.") }.toSet()) return null
        val path = uri.path.orEmpty().split('/').filter { it.isNotEmpty() }
        val query = parseQuery(uri.rawQuery)
        val id = when {
            host == "youtu.be" -> path.firstOrNull()
            path.firstOrNull() in setOf("shorts", "live", "embed", "v") -> path.getOrNull(1)
            path.firstOrNull() == "watch" || path.isEmpty() -> query["v"]
            else -> null
        }?.takeIf { videoIdPattern.matches(it) } ?: return null
        val list = query["list"]?.takeIf { playlistPattern.matches(it) }
        val start = parseTime(query["t"] ?: query["start"])
        return VideoLink(id, list, start)
    }

    fun isYouTubeHost(raw: String?): Boolean {
        if (raw.isNullOrBlank()) return false
        val uri = try { URI(normalize(raw)) } catch (_: Exception) { return false }
        if (!uri.scheme.equals("https", true) && !uri.scheme.equals("http", true)) return false
        val host = uri.host?.lowercase() ?: return false
        return host in hosts
    }

    private fun parseQuery(raw: String?): Map<String, String> {
        if (raw.isNullOrEmpty()) return emptyMap()
        return raw.split('&').take(100).mapNotNull { pair ->
            val parts = pair.split('=', limit = 2)
            val key = decode(parts[0])
            val value = decode(parts.getOrElse(1) { "" })
            key.takeIf { it.isNotEmpty() }?.let { it to value }
        }.toMap()
    }

    private fun decode(value: String): String = try {
        java.net.URLDecoder.decode(value, "UTF-8")
    } catch (_: Exception) { value }

    private fun parseTime(raw: String?): Int? {
        if (raw.isNullOrBlank() || raw.length > 32) return null
        val seconds = raw.toIntOrNull()?.takeIf { it in 1..86400 }
        if (seconds != null) return seconds
        val match = Regex("^(?:(\\d+)h)?(?:(\\d+)m)?(?:(\\d+)s)?$").matchEntire(raw) ?: return null
        val h = match.groupValues[1].toIntOrNull() ?: 0
        val m = match.groupValues[2].toIntOrNull() ?: 0
        val s = match.groupValues[3].toIntOrNull() ?: 0
        val total = h * 3600 + m * 60 + s
        return total.takeIf { it in 1..86400 }
    }
}
