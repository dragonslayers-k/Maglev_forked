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

    @Test fun convertsLongPressVideoHitIntoFoundItem() {
        val json = """{"n":"test-nonce","mediaHit":{"type":"maglev-media-hit","kind":"video","src":"https://cdn.example.com/watch?id=9","pageUrl":"https://site.example/watch"}}"""
        val report = PageScan.parse(json, "test-nonce")!!
        assertEquals(1, report.entries.size)
        val item = PageScan.toItem(report.entries.single(), "https://site.example/watch", "Video")!!
        assertEquals("video", item.kind)
    }

    @Test fun convertsUserSelectedLongPressImageWithoutBackgroundSizeThreshold() {
        val json = """{"n":"test-nonce","mediaHit":{"type":"maglev-media-hit","kind":"image","src":"https://cdn.example.com/photo.jpg","pageUrl":"https://site.example/watch"}}"""
        val report = PageScan.parse(json, "test-nonce")!!
        val item = PageScan.toItem(report.entries.single(), "https://site.example/watch", "Page")!!
        assertEquals("image", item.kind)
    }

    @Test fun blobLongPressHitIsReportedAsBlobInsteadOfSilentlyDropped() {
        val json = """{"n":"test-nonce","mediaHit":{"type":"maglev-media-hit","kind":"video","src":"blob:https://site.example/abc","pageUrl":"https://site.example/watch"}}"""
        val report = PageScan.parse(json, "test-nonce")!!
        assertEquals(true, report.blob)
        assertEquals(0, report.entries.size)
    }

    @Test fun ignoresWrongNonceAndOversizedReports() {
        val json = """{"n":"wrong","items":[{"u":"https://cdn.example.com/a.mp4","t":"video"}]}"""
        assertNull(PageScan.parse(json, "test-nonce"))
        assertNull(PageScan.parse(" ".repeat(PageScan.MAX_REPORT_CHARS + 1), "test-nonce"))
    }
}
