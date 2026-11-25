/** YouTube URL recognition and canonicalization for incoming Android share intents. This does not extract media. */
export type YouTubeLink = { videoId: string; playlistId?: string; startSeconds?: number; canonicalUrl: string };
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,80}$/;
const HOSTS = new Set(['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com','youtu.be']);

function parseTime(value: string | null): number | undefined {
  if (!value || value.length > 32) return;
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 1 && n <= 86400 ? n : undefined;
  }
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!m || !m[1] && !m[2] && !m[3]) return;
  const h = Number(m[1] || 0), min = Number(m[2] || 0), sec = Number(m[3] || 0);
  const n = h * 3600 + min * 60 + sec;
  return Number.isSafeInteger(n) && n >= 1 && n <= 86400 ? n : undefined;
}

export function parseYouTubeLink(raw: string | null | undefined): YouTubeLink | null {
  if (!raw || raw.length > 4096) return null;
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] ?? null;
  else {
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] === 'watch' || segments.length === 0) id = url.searchParams.get('v');
    else if (['shorts','live','embed','v'].includes(segments[0])) id = segments[1] ?? null;
  }
  if (!id || !VIDEO_ID.test(id)) return null;
  const playlist = url.searchParams.get('list');
  const playlistId = playlist && PLAYLIST_ID.test(playlist) ? playlist : undefined;
  const startSeconds = parseTime(url.searchParams.get('t') ?? url.searchParams.get('start'));
  const canonicalUrl = 'https://www.youtube.com/watch?v=' + id +
    (playlistId ? '&list=' + encodeURIComponent(playlistId) : '') +
    (startSeconds ? '&t=' + startSeconds + 's' : '');
  return { videoId: id, playlistId, startSeconds, canonicalUrl };
}
