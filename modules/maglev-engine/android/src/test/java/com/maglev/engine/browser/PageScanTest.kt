package com.maglev.engine.browser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class PageScanTest {
    private fun report(mime: String): ScanEntry {
        val json = """{"n":"test-nonce","items":[{"u":"https://cdn.example.com/playback?id=7","t":"video","w":1920,"h":1080,"m":"$mime"}]}"""
        return PageScan.parse(json, "test-nonce")!!.entries.single()
    }

    @Test fun acceptsHlsMimeForAnExtensionlessManifest() {
        val entry = report("application/vnd.apple.mpegurl; charset=utf-8")
        assertEquals("application/vnd.apple.mpegurl", entry.mime)
        val item = PageScan.toItem(entry, "https://site.example/watch", "Video")!!
        assertEquals("video", item.kind)
        assertEquals("hls", item.stream)
        assertEquals(1920, item.width)
        assertEquals(1080, item.height)
    }

    @Test fun acceptsDashMimeForAnExtensionlessManifest() {
        val entry = report("application/dash+xml")
        val item = PageScan.toItem(entry, "https://site.example/watch", "Video")!!
        assertEquals("dash", item.stream)
    }

    @Test fun acceptsDirectVideoMimeWithoutAnExtension() {
        val entry = report("video/mp4")
        val item = PageScan.toItem(entry, "https://site.example/watch", "Video")!!
        assertEquals("video", item.kind)
        assertNull(item.stream)
        assertEquals("video/mp4", item.mime)
    }

    @Test fun rejectsMalformedMimeButStillUsesVideoElementHint() {
        val entry = report("video/mp4\\nContent-Length: 5")
        assertNull(entry.mime)
        val item = PageScan.toItem(entry, "https://site.example/watch", "Video")
        assertNotNull(item)
        assertEquals("video", item!!.kind)
    }

    @Test fun ignoresWrongNonceAndOversizedReports() {
        val json = """{"n":"wrong","items":[{"u":"https://cdn.example.com/a.mp4","t":"video"}]}"""
        assertNull(PageScan.parse(json, "test-nonce"))
        assertNull(PageScan.parse(" ".repeat(PageScan.MAX_REPORT_CHARS + 1), "test-nonce"))
    }
}
