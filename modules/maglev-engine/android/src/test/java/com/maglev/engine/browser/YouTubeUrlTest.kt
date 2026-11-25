package com.maglev.engine.browser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class YouTubeUrlTest {
    @Test fun shortLink() {
        val parsed = YouTubeUrl.parse("https://youtu.be/AbCdEf12345?t=1m20s")!!
        assertEquals("AbCdEf12345", parsed.videoId)
        assertEquals(80, parsed.startSeconds)
        assertEquals("https://www.youtube.com/watch?v=AbCdEf12345&t=80s", parsed.canonicalUrl)
    }

    @Test fun watchAndPlaylist() {
        val parsed = YouTubeUrl.parse("https://www.youtube.com/watch?v=AbCdEf12345&list=PLabcdefghij&index=4")!!
        assertEquals("PLabcdefghij", parsed.playlistId)
        assertEquals("https://www.youtube.com/watch?v=AbCdEf12345&list=PLabcdefghij", parsed.canonicalUrl)
    }

    @Test fun shortsLiveEmbedAndMobile() {
        for (url in listOf(
            "https://youtube.com/shorts/AbCdEf12345",
            "https://youtube.com/live/AbCdEf12345",
            "https://youtube.com/embed/AbCdEf12345",
            "https://m.youtube.com/watch?v=AbCdEf12345",
            "https://music.youtube.com/watch?v=AbCdEf12345",
        )) assertEquals(url, "AbCdEf12345", YouTubeUrl.parse(url)?.videoId)
    }

    @Test fun schemeLessShortAndWatchLinks() {
        assertEquals("AbCdEf12345", YouTubeUrl.parse("youtu.be/AbCdEf12345")?.videoId)
        assertEquals("AbCdEf12345", YouTubeUrl.parse("youtu.be/AbCdEf12345/")?.videoId)
        assertEquals("AbCdEf12345", YouTubeUrl.parse("www.youtube.com/watch?v=AbCdEf12345")?.videoId)
    }

    @Test fun invalidAndPlaylistOnly() {
        assertNull(YouTubeUrl.parse("https://youtube.com/playlist?list=PLabcdefghij"))
        assertNull(YouTubeUrl.parse("https://youtu.be/not-a-valid-id"))
        assertNull(YouTubeUrl.parse("https://youtube.com/watch?v=short"))
        assertNull(YouTubeUrl.parse("https://youtube.com.evil.test/watch?v=AbCdEf12345"))
        assertNull(YouTubeUrl.parse("javascript:alert(1)"))
        assertNull(YouTubeUrl.parse("https://example.com/watch?v=AbCdEf12345"))
        assertNull(YouTubeUrl.parse("https://youtube.com/watch?v=AbCdEf12345".repeat(100)))
    }

    @Test fun hostRecognition() {
        assertTrue(YouTubeUrl.isYouTubeHost("https://youtu.be/AbCdEf12345"))
        assertTrue(YouTubeUrl.isYouTubeHost("youtu.be/AbCdEf12345"))
        assertTrue(YouTubeUrl.isYouTubeHost("https://m.youtube.com/"))
        assertFalse(YouTubeUrl.isYouTubeHost("https://youtube.com.evil.test/"))
        assertFalse(YouTubeUrl.isYouTubeHost("ftp://youtube.com/"))
    }

    @Test fun timeFormatsAndBounds() {
        assertEquals(3661, YouTubeUrl.parse("https://youtube.com/watch?v=AbCdEf12345&t=1h1m1s")?.startSeconds)
        assertNull(YouTubeUrl.parse("https://youtube.com/watch?v=AbCdEf12345&t=999999")?.startSeconds)
        assertNull(YouTubeUrl.parse("https://youtube.com/watch?v=AbCdEf12345&t=notatime")?.startSeconds)
    }
}
