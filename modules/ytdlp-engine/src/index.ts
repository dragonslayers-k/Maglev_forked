import { EventEmitter, requireOptionalNativeModule } from 'expo-modules-core';

export type YtdlpFormat = {
  formatId?: string; ext?: string; format?: string; width?: number; height?: number; fps?: number;
  videoCodec?: string; audioCodec?: string; hasVideo: boolean; hasAudio: boolean; size?: number;
  bitrate?: number; audioBitrate?: number;
};
export type YtdlpInfo = { ok: boolean; id?: string; title?: string; extractor?: string; uploader?: string; durationSeconds?: number; thumbnail?: string; formats?: YtdlpFormat[]; code?: string; message?: string; errorType?: string };
export type YtdlpProgress = { id: string; percent: number; etaSeconds: number; speed?: string; line?: string };
export type YtdlpCompletion = { id: string; outputDirectory: string; files: { name: string; bytes: number }[]; stdout?: string };
export type YtdlpFailure = { id: string; code: string; message: string; errorType?: string };

const Native: any = requireOptionalNativeModule('YtdlpEngine');
const emitter = Native ? new EventEmitter(Native) : null;
const unavailable = () => { throw new Error('yt-dlp native module is not installed in this build'); };

export const ytdlpEngine = {
  available: !!Native,
  init: async (): Promise<{ ok: boolean; version: string; runtime: string }> => Native ? Native.init() : unavailable(),
  getInfo: async (url: string): Promise<YtdlpInfo> => Native ? Native.getInfo(url) : unavailable(),
  download: async (id: string, url: string, formatSelector: string): Promise<{ ok: boolean; started: boolean; id: string; outputDirectory: string }> => Native ? Native.download(id, url, formatSelector) : unavailable(),
  cancel: (id: string): boolean => Native ? Native.cancel(id) : unavailable(),
  update: async (channel: 'stable' | 'nightly' = 'stable'): Promise<{ ok: boolean; status?: string; version?: string }> => Native ? Native.update(channel) : unavailable(),
  onProgress: (listener: (event: YtdlpProgress) => void) => emitter?.addListener('onProgress', listener) ?? { remove() {} },
  onCompleted: (listener: (event: YtdlpCompletion) => void) => emitter?.addListener('onCompleted', listener) ?? { remove() {} },
  onFailed: (listener: (event: YtdlpFailure) => void) => emitter?.addListener('onFailed', listener) ?? { remove() {} },
};
