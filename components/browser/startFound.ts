/**
 * One found file into Transfers: probeUrl first (so a page that is not a file is refused), then addDownload with
 * the page's cookie, referer and user agent. The single-download sheet and the batch both use this path.
 * The engine and the header builder are passed in so the function runs without React or native modules.
 */
import type { DownloadOptions, EngineResult, UrlProbe } from '../../modules/maglev-engine/src/MaglevEngine.types';
import { pageUrlOption } from './pageUrlOption.ts';
import { parseNaverClipMediaId, resolveNaverClip } from '../../utils/browser/naverClip.ts';

export interface StartDeps {
  headersFor: (t: { url: string; pageUrl: string; userAgent: string }) => Promise<NonNullable<DownloadOptions['headers']>>;
  probeUrl: (url: string, options?: DownloadOptions) => Promise<({ ok: true } & UrlProbe) | { ok: false; code: string; message: string; httpStatus?: number | null }>;
  startDownload: (url: string, options?: DownloadOptions) => Promise<EngineResult<{ id: string }>>;
}

export async function startFound(
  deps: StartDeps,
  t: { url: string; pageUrl: string; userAgent: string },
  extra: Pick<DownloadOptions, 'name' | 'folder'> = {},
): Promise<{ ok: true; id: string } | { ok: false; code?: string; message?: string }> {
  // If this is a NAVER Clip page (or a synthetic clip item), resolve it to the progressive MP4.
  // The visible browser tray deliberately represents the whole clip once, not each TS fragment.
  const naverClipPage = parseNaverClipMediaId(t.pageUrl) ? t.pageUrl : parseNaverClipMediaId(t.url) ? t.url : null;
  const clip = naverClipPage ? await resolveNaverClip(naverClipPage) : null;
  const downloadUrl = clip?.url ?? t.url;
  // The resolver already extracts the actual clip title from the provider response.
  // Preserve it as the default output name instead of letting the engine fall back
  // to a URL/hash-derived filename. Always match the progressive MP4 container.
  const clipTitle = clip?.title?.trim() || (clip ? 'Naver-Clip-' + clip.mediaId : '');
  const clipNameRaw = extra.name?.trim() || clipTitle;
  const safeClipName = clip ? (clipNameRaw
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 140) || 'Naver-Clip-' + clip.mediaId) : '';
  const clipFileName = clip ? (safeClipName.replace(/\.mp4$/i, '') + '.mp4') : undefined;
  const outputName = clipFileName ?? extra.name;
  const headers = {
    ...(await deps.headersFor({ ...t, url: downloadUrl })),
    ...(naverClipPage ? { Referer: naverClipPage } : {}),
  };
  const probe = await deps.probeUrl(downloadUrl, { headers, ...pageUrlOption(t.pageUrl) });
  if (!probe.ok) return { ok: false, code: probe.code, message: probe.message };
  const res = await deps.startDownload(downloadUrl, { headers, ...pageUrlOption(t.pageUrl), ...extra, ...(outputName ? { name: outputName } : {}) });
  return res.ok ? { ok: true, id: res.id } : { ok: false, code: res.code, message: res.message };
}
