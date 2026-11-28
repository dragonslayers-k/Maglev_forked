/**
 * NAVER Clip (m.naver.com/shorts) single-file resolver.
 * Uses the page's shortform playback API and prefers a progressive video/mp4 BaseURL
 * over HLS/TS segment URLs, so one clip is added as one normal Maglev transfer.
 */
export type NaverClipResolution = { mediaId: string; url: string; title: string | null };

export function parseNaverClipMediaId(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (host !== 'm.naver.com' && host !== 'naver.com' && host !== 'www.naver.com') return null;
    if (!/^\/shorts\/?$/i.test(u.pathname)) return null;
    const id = u.searchParams.get('seedMediaId') || u.searchParams.get('mediaId');
    return id && /^[a-f0-9]{32,40}$/i.test(id) ? id.toUpperCase() : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function urlFromBase(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(urlFromBase);
  const obj = asRecord(value);
  if (!obj) return [];
  return ['value', 'url', 'href'].flatMap(key => urlFromBase(obj[key]));
}

function isProgressiveMp4(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && /\.mp4(?:$|\?)/i.test(u.pathname + u.search);
  } catch {
    return false;
  }
}

/** Extract only BaseURL values belonging to a video/mp4 adaptation set. */
export function findNaverClipMp4(payload: unknown): { url: string; title: string | null } | null {
  const urls: string[] = [];
  let title: string | null = null;
  const visit = (value: unknown, inheritedVideoMp4 = false) => {
    if (Array.isArray(value)) { value.forEach(v => visit(v, inheritedVideoMp4)); return; }
    const obj = asRecord(value);
    if (!obj) return;
    if (!title && typeof obj.title === 'string' && obj.title.trim()) title = obj.title.trim().slice(0, 180);
    const mime = String(obj.mimeType ?? obj.mime_type ?? '').toLowerCase();
    const videoMp4 = inheritedVideoMp4 || mime === 'video/mp4';
    if (videoMp4) {
      for (const key of ['BaseURL', 'baseURL', 'baseUrl', 'base_url']) {
        urls.push(...urlFromBase(obj[key]));
      }
      for (const [key, child] of Object.entries(obj)) {
        if (key !== 'BaseURL' && key !== 'baseURL' && key !== 'baseUrl' && key !== 'base_url') visit(child, true);
      }
      return;
    }
    for (const child of Object.values(obj)) visit(child, inheritedVideoMp4);
  };
  visit(payload);
  const url = urls.find(isProgressiveMp4);
  return url ? { url, title } : null;
}

export async function resolveNaverClip(
  raw: string,
  fetcher: typeof fetch = fetch,
): Promise<NaverClipResolution> {
  const mediaId = parseNaverClipMediaId(raw);
  if (!mediaId) throw new Error('네이버 클립 링크에서 영상 ID를 확인하지 못했습니다.');

  const referer = 'https://m.naver.com/shorts/?seedMediaId=' + encodeURIComponent(mediaId) + '&serviceType=CLIP';
  const candidates = [
    { serviceType: 'CLIP', panelType: 'clip_home', recType: 'CLIP' },
    { serviceType: 'CLIP', panelType: 'sdk_chzzk', recType: 'CLIP' },
    { serviceType: 'CHZZK', panelType: 'sdk_chzzk', recType: 'CHZZK' },
  ];
  let lastError: unknown = null;
  for (const candidate of candidates) {
    const query = new URLSearchParams({
      seedType: 'SPECIFIC',
      serviceType: candidate.serviceType,
      seedMediaId: mediaId,
      mediaType: 'VOD',
      panelType: candidate.panelType,
      referer,
      recType: candidate.recType,
      recId: JSON.stringify({ seedMediaId: mediaId, fromType: 'GLOBAL', listType: 'RECOMMEND' }),
      enableReverse: 'false',
      adAllowed: 'Y',
      clickNsc: 'clip_home',
      clickArea: 'clip_item',
      deviceType: 'html5_mo',
    });
    try {
      const response = await fetcher('https://api-videohub.naver.com/shortformhub/feeds/v9/card?' + query.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json', Referer: referer },
      });
      if (!response.ok) throw new Error('네이버 클립 재생 정보 요청 실패 (HTTP ' + response.status + ')');
      const payload: unknown = await response.json();
      const found = findNaverClipMp4(payload);
      if (found) return { mediaId, url: found.url, title: found.title };
      lastError = new Error('응답에서 단일 MP4 주소를 찾지 못했습니다.');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('네이버 클립의 단일 MP4 주소를 찾지 못했습니다.');
}
