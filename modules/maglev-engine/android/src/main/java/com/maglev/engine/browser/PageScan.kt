package com.maglev.engine.browser

import android.webkit.JavascriptInterface
import org.json.JSONObject

/** One thing the injected page script found. [type] is `video`, `audio`, `image`, `meta-image`, `meta-video` or `link`. */
data class ScanEntry(val url: String, val type: String, val width: Int, val height: Int, val mime: String?)

/** What one report from the page holds. */
data class ScanReport(val entries: List<ScanEntry>, val eme: Boolean, val blob: Boolean, val mse: Boolean)

/**
 * The page scan (docs/NATIVE_CONTRACT.md section 24.3 rule 2): the script we inject and the parser for what it sends back.
 * Everything the page sends is untrusted: [parse] checks the nonce, the size and every field.
 */
object PageScan {
    /** The only name the page sees. The bridge has one method. */
    const val BRIDGE_NAME = "MaglevScan"
    const val MAX_REPORT_CHARS = 256 * 1024
    const val MAX_ENTRIES = 300
    const val MAX_URL_CHARS = 2048
    const val MAX_MIME_CHARS = 128
    private val mimeTypePattern = Regex("^[a-z0-9!#&^_.+-]+/[a-z0-9!#&^_.+-]+$")
    private val types = setOf("video", "audio", "image", "meta-image", "meta-video", "link")

    /**
     * Installs the scan: finds media, large images, og tags and file links; reports on DOM changes at most once a
     * second; wraps `navigator.requestMediaKeySystemAccess` to report DRM once. Placeholder `%NONCE%` is replaced per
     * page load. Running it again with the same nonce only triggers a rescan. Injected into the main frame only
     * (`evaluateJavascript` runs there).
     */
    private val SCAN_JS = """
(function(){
  var B = window.MaglevScan, N = "%NONCE%";
  if (!B) return;
  if (window.__maglevN === N) { if (window.__maglevScanNow) window.__maglevScanNow(false); return; }
  window.__maglevN = N;
  var sent = {}, count = 0, MAX = 500, timer = 0, last = 0, emeSent = false, blobSeen = false, blobSent = false, streamSeen = false, mseSeen = false, mseSent = false;
  var FILE = /\.(pdf|epub|mobi|djvu|docx?|xlsx?|pptx?|od[tsp]|txt|rtf|csv|md|zip|rar|7z|tar|gz|bz2|xz|iso|apk|exe|msi|dmg|bat|cmd|scr|torrent|srt|vtt|ass|mp4|m4v|webm|mkv|mov|avi|mp3|m4a|aac|flac|ogg|opus|wav|m3u8|mpd)([?#]|${'$'})/i;
  function post(o){ try { o.n = N; B.report(JSON.stringify(o)); } catch (e) {} }
  function abs(u){ try { return new URL(u, document.baseURI).href; } catch (e) { return ''; } }
  function cleanMime(m){ return String(m || '').split(';')[0].trim().toLowerCase().slice(0, 128); }
  function kindFromMime(m){
    var v = cleanMime(m);
    if (v === 'application/vnd.apple.mpegurl' || v === 'application/x-mpegurl' ||
        v === 'audio/mpegurl' || v === 'audio/x-mpegurl' || v === 'application/dash+xml') return 'video';
    if (v.indexOf('video/') === 0) return 'video';
    if (v.indexOf('audio/') === 0) return 'audio';
    return '';
  }
  function push(list, u, t, w, h, mime){
    if (!u || typeof u !== 'string') return;
    if (/^blob:/i.test(u)) { if (t === 'video' || t === 'audio') blobSeen = true; return; }
    if (/^data:/i.test(u)) return;
    u = abs(u);
    if (!/^https?:/i.test(u)) return;
    var path = u.split(/[?#]/)[0].toLowerCase();
    if (/\.(m3u8|mpd)$/i.test(path)) streamSeen = true;
    if (streamSeen && /\.(ts|m4s|cmfv|cmfa)$/i.test(path)) return;
    var k = t + ' ' + u;
    var mt = cleanMime(mime);
    var entry = { u: u, t: t, w: w | 0, h: h | 0, m: mt };
    var previous = sent[k];
    if (previous) {
      // A later fetch/XHR response can reveal the MIME type of a URL first seen in a video tag.
      if ((mt && previous.m !== mt) || ((w | 0) && previous.w !== (w | 0)) || ((h | 0) && previous.h !== (h | 0))) {
        sent[k] = entry;
        list.push(entry);
      }
      return;
    }
    if (++count > MAX) return;
    sent[k] = entry;
    list.push(entry);
  }
  function resourceCandidate(list, u, mime){
    var kind = kindFromMime(mime);
    var clean = cleanMime(mime);
    var path = String(u || '').split(/[?#]/)[0].toLowerCase();
    if (/\.(m3u8|mpd)$/i.test(path) ||
        clean === 'application/vnd.apple.mpegurl' || clean === 'application/x-mpegurl' ||
        clean === 'audio/mpegurl' || clean === 'audio/x-mpegurl' || clean === 'application/dash+xml') {
      streamSeen = true;
    }
    if (streamSeen && (/\.(ts|m4s|cmfv|cmfa)$/i.test(path) || clean === 'video/mp2t')) return;
    if (!kind) {
      if (/\.(m3u8|mpd|mp4|m4v|webm|mkv|mov|avi)$/i.test(path)) kind = 'video';
      else if (/\.(mp3|m4a|aac|flac|ogg|opus|wav)$/i.test(path)) kind = 'audio';
    }
    if (kind) push(list, u, kind, 0, 0, mime);
  }
  function reportResource(u, mime){
    var list = [];
    resourceCandidate(list, u, mime);
    if (list.length) post({ items: list, mse: mseSeen && !mseSent });
    if (list.length && mseSeen) mseSent = true;
  }
  function best(s){
    var out = '', bw = 0;
    String(s || '').split(',').forEach(function(p){
      var a = p.trim().split(/\s+/); if (!a[0]) return;
      var v = parseFloat(a[1] || '1') || 1;
      if (v >= bw) { bw = v; out = a[0]; }
    });
    return out;
  }
  function scan(){
    last = Date.now(); timer = 0;
    var list = [], i, j, els, m, t, ss;
    els = document.querySelectorAll('video,audio');
    for (i = 0; i < els.length; i++) {
      m = els[i]; t = m.tagName.toLowerCase();
      var vw = t === 'video' && m.readyState >= 1 ? m.videoWidth : 0;
      var vh = t === 'video' && m.readyState >= 1 ? m.videoHeight : 0;
      push(list, m.currentSrc, t, vw, vh, m.getAttribute('type'));
      push(list, m.getAttribute('src'), t, vw, vh, m.getAttribute('type'));
      // Common lazy-loader attributes are used by sites that defer the real media URL until scrolling/play.
      push(list, m.getAttribute('data-src'), t, vw, vh, m.getAttribute('type'));
      push(list, m.getAttribute('data-url'), t, vw, vh, m.getAttribute('type'));
      push(list, m.getAttribute('data-video'), 'video', vw, vh, m.getAttribute('type'));
      ss = m.querySelectorAll('source');
      for (j = 0; j < ss.length; j++) {
        push(list, ss[j].getAttribute('src'), t);
        push(list, ss[j].getAttribute('data-src'), t);
      }
      if (m.mediaKeys) eme();
    }
    els = document.images;
    for (i = 0; i < els.length && i < 1000; i++) {
      m = els[i];
      if (m.naturalWidth >= 200 && m.naturalHeight >= 200) push(list, best(m.srcset) || m.currentSrc || m.src, 'image', m.naturalWidth, m.naturalHeight);
    }
    els = document.querySelectorAll('meta[property="og:image"],meta[property="og:image:url"],meta[property="og:image:secure_url"]');
    for (i = 0; i < els.length; i++) push(list, els[i].getAttribute('content'), 'meta-image');
    els = document.querySelectorAll('meta[property="og:video"],meta[property="og:video:url"],meta[property="og:video:secure_url"]');
    for (i = 0; i < els.length; i++) push(list, els[i].getAttribute('content'), 'meta-video');
    // Embedded media/file URLs are candidates only when the URL or MIME classifier recognizes them.
    els = document.querySelectorAll('embed[src],object[data],iframe[src]');
    for (i = 0; i < els.length && i < 500; i++) {
      m = els[i];
      var embedUrl = m.getAttribute('src') || m.getAttribute('data');
      var embedMime = m.getAttribute('type') || '';
      if (embedUrl && (FILE.test(embedUrl) || /^(video|audio)\//i.test(embedMime))) {
        push(list, embedUrl, /audio\//i.test(embedMime) ? 'audio' : 'video', 0, 0, embedMime);
      }
    }
    els = document.querySelectorAll('a[href]');
    for (i = 0; i < els.length && i < 3000; i++) {
      var href = els[i].getAttribute('href');
      if (href && FILE.test(href)) push(list, href, 'link');
    }
    // Resource Timing also sees media URLs that never appear as a normal <video src>.
    try {
      var resources = performance && performance.getEntriesByType ? performance.getEntriesByType('resource') : [];
      for (i = Math.max(0, resources.length - 1500); i < resources.length; i++) {
        if (resources[i] && resources[i].name) resourceCandidate(list, resources[i].name, '');
      }
    } catch (e) {}
    if (streamSeen) {
      list = list.filter(function(entry){
        var entryPath = String(entry.u || '').split(/[?#]/)[0].toLowerCase();
        var entryMime = cleanMime(entry.m);
        return !(/\.(ts|m4s|cmfv|cmfa)$/i.test(entryPath) || entryMime === 'video/mp2t');
      });
    }
    var blob = blobSeen && !blobSent;
    if (blob) blobSent = true;
    var mse = mseSeen && !mseSent;
    if (mse) mseSent = true;
    if (list.length || blob || mse) post({ items: list, blob: blob, mse: mse });
  }
  function schedule(){
    if (timer) return;
    timer = setTimeout(scan, Math.max(0, 1000 - (Date.now() - last)));
  }
  window.__maglevScanNow = function(reset){ if (reset) { sent = {}; count = 0; } if (timer) { clearTimeout(timer); timer = 0; } scan(); };
  // Observe MSE without consuming or replacing media bytes.
  function markMse(){ if (mseSeen) return; mseSeen = true; schedule(); }
  try {
    var ms = window.MediaSource && window.MediaSource.prototype;
    if (ms && ms.addSourceBuffer && !ms.addSourceBuffer.__mg) {
      var nativeAddSourceBuffer = ms.addSourceBuffer;
      var wrappedAddSourceBuffer = function(type){ markMse(); return nativeAddSourceBuffer.apply(this, arguments); };
      wrappedAddSourceBuffer.__mg = 1;
      ms.addSourceBuffer = wrappedAddSourceBuffer;
    }
    var vs = window.SourceBuffer && window.SourceBuffer.prototype;
    if (vs && vs.appendBuffer && !vs.appendBuffer.__mg) {
      var nativeAppendBuffer = vs.appendBuffer;
      var wrappedAppendBuffer = function(data){ markMse(); return nativeAppendBuffer.apply(this, arguments); };
      wrappedAppendBuffer.__mg = 1;
      vs.appendBuffer = wrappedAppendBuffer;
    }
  } catch(e) {}
  // Observe script-initiated media requests without consuming or replacing their response bodies.
  try {
    var nativeFetch = window.fetch;
    if (nativeFetch && !nativeFetch.__mg) {
      var wrappedFetch = function(input, init){
        var method = (init && init.method) || (input && input.method) || 'GET';
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var result = nativeFetch.apply(this, arguments);
        if (String(method).toUpperCase() !== 'GET' || !result || typeof result.then !== 'function') return result;
        return result.then(function(response){
          try {
            var mime = response && response.headers ? response.headers.get('content-type') : '';
            reportResource((response && response.url) || url, mime);
          } catch (e) {}
          return response;
        });
      };
      wrappedFetch.__mg = 1;
      window.fetch = wrappedFetch;
    }
  } catch (e) {}
  try {
    var xp = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (xp && xp.open && xp.send && !xp.open.__mg) {
      var nativeOpen = xp.open, nativeSend = xp.send;
      var wrappedOpen = function(method, url){
        this.__mgMethod = String(method || 'GET').toUpperCase();
        this.__mgUrl = abs(url);
        return nativeOpen.apply(this, arguments);
      };
      wrappedOpen.__mg = 1;
      var wrappedSend = function(){
        var xhr = this;
        if (xhr.__mgMethod === 'GET' && xhr.addEventListener) {
          xhr.addEventListener('loadend', function(){
            try {
              reportResource(xhr.responseURL || xhr.__mgUrl, xhr.getResponseHeader('content-type') || '');
            } catch (e) {}
          }, { once: true });
        }
        return nativeSend.apply(this, arguments);
      };
      wrappedSend.__mg = 1;
      xp.open = wrappedOpen;
      xp.send = wrappedSend;
    }
  } catch (e) {}
  try {
    var nav = navigator, orig = nav.requestMediaKeySystemAccess;
    if (orig && !orig.__mg) {
      var w = function(){ eme(); return orig.apply(this, arguments); };
      w.__mg = 1;
      nav.requestMediaKeySystemAccess = w;
    }
  } catch (e) {}
  try {
    document.addEventListener('encrypted', eme, true);
    document.addEventListener('loadedmetadata', schedule, true);
    document.addEventListener('playing', schedule, true);
    document.addEventListener('sourceopen', markMse, true);
    window.addEventListener('load', schedule);
    if (document.documentElement) new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href', 'srcset', 'data-src', 'data-url', 'data-video', 'data'] });
  } catch (e) {}
  scan();
})();
"""

    /** Hides common ad containers. Injected only when ad blocking is on for the site (section 24.4). */
    private val COSMETIC_JS = """
(function(){
  var id = '__mg_cosmetic';
  if (document.getElementById(id)) return;
  var s = document.createElement('style'); s.id = id;
  s.textContent = 'ins.adsbygoogle,.adsbygoogle,[id^="google_ads_iframe"],[id^="div-gpt-ad"],iframe[src*="doubleclick.net"],iframe[src*="googlesyndication.com"],.ad-banner,.ad-slot,.ad-container,.advertisement,#ad-banner,.adsbox{display:none!important}';
  (document.head || document.documentElement).appendChild(s);
})();
"""

    fun scanScript(nonce: String): String = SCAN_JS.replace("%NONCE%", nonce)

    val cosmeticScript: String get() = COSMETIC_JS

    /** Runs the scan again and resends everything (new items only reach JS; the tracker dedupes). */
    const val RESCAN_JS = "if (window.__maglevScanNow) window.__maglevScanNow(true);"

    private fun clamp(n: Int): Int = if (n < 0) 0 else if (n > 100_000) 100_000 else n

    /** Validates one report. Null when it is too big, not JSON, has a wrong nonce or holds nothing usable. */
    fun parse(json: String?, nonce: String): ScanReport? {
        if (json == null || json.length > MAX_REPORT_CHARS || nonce.isEmpty()) return null
        val o = try { JSONObject(json) } catch (_: Exception) { return null }
        if (o.optString("n", "") != nonce) return null
        val out = ArrayList<ScanEntry>()
        val arr = o.optJSONArray("items")
        if (arr != null) {
            var i = 0
            while (i < arr.length() && out.size < MAX_ENTRIES) {
                val e = arr.optJSONObject(i++) ?: continue
                val url = e.optString("u", "")
                val type = e.optString("t", "")
                if (url.isEmpty() || url.length > MAX_URL_CHARS || type !in types) continue
                if (FoundClassifier.normalize(url) == null) continue
                val rawMime = e.optString("m", "").trim().substringBefore(';').lowercase()
                val mime = rawMime.takeIf { it.length <= MAX_MIME_CHARS && mimeTypePattern.matches(it) }
                out.add(ScanEntry(url, type, clamp(e.optInt("w", 0)), clamp(e.optInt("h", 0)), mime))
            }
        }
        return ScanReport(out, o.optBoolean("eme", false), o.optBoolean("blob", false), o.optBoolean("mse", false))
    }

    /** Turns a scan entry into an item, or null when it doesn't qualify. */
    fun toItem(e: ScanEntry, pageUrl: String, pageTitle: String): FoundItem? {
        val hint = when (e.type) {
            "video", "meta-video" -> "video"
            "audio" -> "audio"
            "image", "meta-image" -> "image"
            else -> null
        }
        val imageAllowed = hint != "image" || e.type == "meta-image" || (e.width >= 200 && e.height >= 200)
        if (!imageAllowed) return null
        // Prefer URL extensions, then response MIME, then the media element's hint.
        val c = FoundClassifier.classifyPage(e.url)
            ?: FoundClassifier.classifyMime(e.mime)
            ?: FoundClassifier.classifyPage(e.url, hint)
            ?: return null
        return FoundClassifier.item(
            e.url, c, "page", pageUrl, pageTitle,
            mime = e.mime,
            width = e.width.takeIf { it > 0 }, height = e.height.takeIf { it > 0 },
        )
    }
}

/**
 * The one object the page can call. It has ONE method that takes a JSON string and hands it to [sink]; the sink
 * validates it with [PageScan.parse]. Nothing else is exposed.
 */
class PageScanBridge(private val sink: (String) -> Unit) {
    @JavascriptInterface
    fun report(json: String?) {
        if (json == null || json.length > PageScan.MAX_REPORT_CHARS) return
        sink(json)
    }
}
