/**
 * Plain-English subtitle copy, in one place (docs/NATIVE_CONTRACT.md section 36.10). Each error has one sentence and
 * one action. Pure.
 */
import { languageInfo, languageName } from './languages.ts';
import type { SubtitleErrorCode } from './payload.ts';

const localizedLanguage = (code: string): string => languageInfo(code)?.native ?? languageName(code);

export interface ErrorCopy {
  message: string;
  action: string;
}

export const SETTINGS_TITLE = '자막';
export const SETTINGS_SWITCH_SUBTITLE = '동영상에서 자막 찾기 표시';
export const HEARING_OPTIONS = { both: '둘 다 표시', prefer: '우선', avoid: '제외' } as const;
export const PRIVACY_LINE =
  "자막을 검색하면 동영상 파일명과 파일 식별 정보가 선택한 검색 사이트로 전송됩니다. '자막 찾기'를 누르기 전에는 전송하지 않습니다.";
export const TURNED_OFF_BY_MAGLEV = 'Maglev에서 꺼짐';

export const FIND_SUBTITLES = '자막 찾기…';
// NATIVE_CONTRACT 42.1
export const FILE_NOT_STARTED = '파일 다운로드가 시작되면';
export const SHEET_TITLE = '자막';
export const DOWNLOAD_BUTTON = '자막 다운로드';
// NATIVE_CONTRACT 42.3
export const SEARCHING_FOR_LABEL = '검색 대상';
export const CHANGE_NAME_LABEL = '검색할 이름 변경';
export const USE_FILE_NAME = '파일 이름 사용';
export const TYPE_A_TITLE = '제목 입력';
export const SEARCH_BUTTON = '검색';
// NATIVE_CONTRACT 42.5
export const NOTE_MATCHED_BY_NAME = '파일 이름으로 검색했습니다. 다운로드 완료 후 정확한 일치 여부를 확인할 수 있습니다.';
export const NOTE_MATCHED_BY_TYPED = '입력한 이름으로 검색했습니다.';
export const OTHER_LANGUAGE_TAB = '다른 언어…';
export const HEARING_IMPAIRED_TAG = '청각장애인용';

export const NOTHING_FITS_TITLE = '일치하는 자막이 없습니다';
export const NOTHING_FITS_BODY = '다른 영상 버전에 맞는 자막입니다. 자막 싱크는 대부분의 플레이어에서 조정할 수 있습니다.';

export const NAME_TAKEN_TITLE = '같은 이름의 자막 파일이 이미 있습니다.';
export const NAME_TAKEN_ACTIONS = { replace: '교체', keepBoth: '둘 다 저장', cancel: '취소' } as const;
export const KEEP_BOTH_NOTE = "플레이어가 두 번째 파일을 자동으로 불러오지 않을 수 있습니다.";

/** 39.1 S8: copies .2 to .9 all exist. */
export const COPIES_FULL_TITLE = '자막 복사본이 9개 있습니다. 하나를 교체하거나 취소하세요.';
/** 39.1 S7: every row of this language already failed. */
export const NO_OTHER_ROWS = '이 언어로 시도할 다른 자막이 없습니다.';
/** 39.1 S6: SAF (file picker) folders. Shown on the menu row and in Settings > Subtitles. */
export const SAF_UNAVAILABLE = '파일 선택기로 지정한 폴더에서는 아직 사용할 수 없습니다';

export const NOTICE_CONTINUE = '계속';
export const NOTICE_NOT_NOW = '나중에';

/** Shown instead of "No English subtitles found." when a subtitle in that language already sits next to the video. */
export function alreadyHasCopy(language: string): string {
  return `이 동영상에는 이미 ${localizedLanguage(language)} 자막이 있습니다.`;
}

/** One-time notice before the first lookup. `names` are the sources that are on. */
export function privacyNotice(names: readonly string[]): string {
  return `자막을 찾으면 동영상 파일명과 식별 정보가 활성 검색 사이트(${names.join(', ')})로 전송됩니다. 검색 사이트는 어떤 영상을 찾는지 알 수 있습니다.`;
}

const AMBIGUOUS_PACK = "이 파일에는 여러 회차 자막이 포함되어 있어 Maglev에서 해당 회차를 구분할 수 없습니다.";
const UNREADABLE_TEXT = "Maglev에서 이 자막의 텍스트를 읽을 수 없습니다.";
const UNSUPPORTED_FILE = "지원하지 않는 자막 파일 형식입니다.";

/** "1 video", "2 videos": the noun takes the singular for exactly 1 (46.1). */
export const plural = (n: number, one: string, many = `${one}s`): string => (n === 1 ? one : many);

export function groupFoundLine(count: number): string {
  return `${count}개 자막`;
}

export interface CopyArgs {
  /** The source's display name. */
  source?: string;
  /** A language code; shown by its English name. */
  language?: string;
}

/** The sentence and the action for an error code (36.10). */
export function errorCopy(code: SubtitleErrorCode, a: CopyArgs = {}): ErrorCopy {
  const source = a.source ?? 'This source';
  switch (code) {
    case 'offline':
      return { message: '오프라인 상태입니다.', action: '다시 시도' };
    case 'timeout':
    case 'error':
    case 'challenge':
      return { message: `${source} 응답이 없습니다.`, action: '다시 시도' };
    case 'limit':
      return { message: `${source}의 오늘 사용 한도에 도달했습니다.`, action: '다른 검색 사이트 사용' };
    case 'nothing':
      return { message: a.language ? `${localizedLanguage(a.language)} 자막을 찾지 못했습니다.` : '자막을 찾지 못했습니다.', action: '다른 언어' };
    case 'missing':
      return { message: '동영상 파일을 찾을 수 없습니다.', action: '닫기' };
    case 'CANT_WRITE':
      return { message: 'Maglev에서 이 폴더에 저장할 수 없습니다.', action: '폴더 열기' };
    case 'NO_SPACE':
      return { message: '저장 공간이 부족합니다.', action: '닫기' };
    case 'VERIFY_FAILED':
      return { message: '자막을 올바르게 저장하지 못했습니다.', action: '다시 시도' };
    case 'unreadable_text':
      return { message: UNREADABLE_TEXT, action: '다른 파일 선택' };
    case 'ambiguous_pack':
      return { message: AMBIGUOUS_PACK, action: '다른 파일 선택' };
    case 'REPLACE_DENIED':
      // NATIVE_CONTRACT 39.1 S5
      return { message: '다른 앱에서 사용하는 파일입니다. 복사본으로 저장할까요?', action: NAME_TAKEN_ACTIONS.keepBoth };
    case 'NAME_TAKEN':
      return { message: NAME_TAKEN_TITLE, action: NAME_TAKEN_ACTIONS.replace };
    case 'unsupported_archive':
    default:
      return { message: UNSUPPORTED_FILE, action: 'Pick another' };
  }
}

// ---------------------------------------------------------------- NATIVE_CONTRACT 44: the "Added" message and requests

/** 44.6. The switch's line in Settings > Subtitles. */
export const AUTO_NEW_VIDEOS_SUBTITLE = 'Maglev 실행 중, 설정한 언어의 자막 자동 검색';

/** 45.4: the confirm sheet for the Settings switch. It always shows, because names go out in the background. */
export const AUTO_CONFIRM_TITLE = '새 동영상의 자막을 자동으로 찾을까요?';
export const AUTO_CONFIRM_BODY =
  'Maglev가 실행 중이면 새로 추가한 동영상 이름을 자막 검색 사이트로 보내 일치하는 자막을 저장합니다. 비슷한 자막은 직접 선택할 수 있도록 대기합니다.';
export const AUTO_CONFIRM_TURN_ON = '켜기';
export const AUTO_CONFIRM_NOT_NOW = NOTICE_NOT_NOW;

/** 45.4: the sheet's text. When the one-time notice was never accepted, it comes first and Turn on accepts both. */
export function autoConfirmBody(needsNotice: boolean, names: readonly string[]): string {
  return needsNotice ? `${privacyNotice(names)}\n\n${AUTO_CONFIRM_BODY}` : AUTO_CONFIRM_BODY;
}

/** 44.7: results only in languages the user didn't pick. */
export const foundInOtherOnly = (language: string): string => `${languageName(language)}에서만 찾음`;

/** 44.8: what TalkBack says for the card icon, by state. */
export const CARD_ICON_WORDS = {
  getting: '자막 검색 중',
  saved: '자막 저장됨',
  'needs-look': '자막 선택 필요',
  none: '자막을 찾지 못함',
} as const;

// 44.9 The multi-video sheet.
/** 44.9 / 46.1: "Subtitles for 1 video", "Subtitles for 23 episodes". The singular is used for 1. */
export const multiTitle = (n: number, episodes = false): string => `${n}${episodes ? '개 회차' : '개 동영상'} 자막`;
export const USES_YOUR_LANGUAGES = '설정한 자막 언어 사용';
export const CHANGE_LANGUAGES = '변경';
const MULTI_BUTTON_NONE = '자막 찾기';
export const multiButton = (k: number): string => (k <= 0 ? MULTI_BUTTON_NONE : `${k}개 자막 찾기`);
export const SKIP_LABEL = '건너뛰기';
/** 44.15 D6: appended to a row whose title and detail match an earlier row's: " · 2nd", " · 3rd", " · 4th", " · 11th", " · 21st". */
export function ordinalSuffix(n: number): string {
  const tens = n % 100;
  const word = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return ` \u00B7 ${n}${word}`;
}
export const nonVideoOne = (name: string): string => `${name}은 음악 파일이므로 자막을 검색하지 않습니다.`;
export const nonVideoMany = (k: number): string => `동영상이 아닌 항목 ${k}개는 자막을 검색하지 않습니다.`;

/** 44.9 status mode: a phase in words. */
export const PHASE_WORDS = {
  queued: '파일 대기 중',
  searching: 'Getting\u2026',
  saved: '저장됨',
  'needs-pick': 'Close match \u00B7 pick',
  none: 'None found \u00B7 edit name',
  'has-already': '자막 있음',
  offline: '오프라인',
  limited: '검색 사이트 제한',
  skipped: '건너뜀',
  failed: '검색 사이트 응답 없음',
  unavailable: '여기에 저장할 수 없음',
} as const;

/** Summary line of status mode, e.g. "2 saved \u00B7 1 needs you". Empty when nothing to say. */
export function statusSummary(c: { saved: number; needsYou: number; waiting: number }): string {
  const parts: string[] = [];
  if (c.saved > 0) parts.push(`${c.saved}개 저장`);
  if (c.needsYou > 0) parts.push(`${c.needsYou}개 선택 필요`);
  if (c.waiting > 0) parts.push(`${c.waiting}개 검색 중`);
  return parts.join(' \u00B7 ');
}

// 44.14 The Subtitles row on the download page.
export const ROW_LABEL = '자막';
export const ROW_NOT_STARTED = FILE_NOT_STARTED;
export const ROW_NOT_ASKED = '아직 요청하지 않음';
export const ROW_QUEUED_NO_LIST = '파일 목록을 받으면 시작';
export const ROW_QUEUED = '파일 대기 중';
export const ROW_SEARCHING = '자막 검색 중…';
export const ROW_CLOSE_MATCH = '비슷한 자막을 찾음';
export const ROW_NONE = '아직 찾지 못함';
export const ROW_OFFLINE = '인터넷 연결 대기';
export const ROW_LIMITED = '검색 사이트 사용량 제한 · 잠시 후 재시도';
export const ROW_SKIPPED = '건너뜀';
// 44.15 D8, D9, D10
export const ROW_FAILED = '검색 사이트 응답 없음';
export const ROW_UNAVAILABLE = '이 폴더에 자막을 저장할 수 없음';
export const ROW_NEEDS_OK = '선택 필요';
export const ROW_BUTTONS = {
  find: '찾기',
  cancel: '취소',
  change: '변경',
  pick: '선택',
  editName: '이름 수정',
  findMore: '더 찾기',
  seeAll: '모두 보기',
  tryAgain: '다시 시도',
  review: '검토',
  getSubtitles: '자막 찾기',
} as const;
export const rowSaved = (language: string): string => `${languageName(language)} · 영상 버전 일치`;
export const rowSavedNoLanguage = '저장됨';
export const rowHasAlready = (language: string | null): string => (language ? `${languageName(language)} 자막 있음` : '자막 있음');
/** Season pack: "8 of 10 saved · 2 need you". */
export function rowPackLine(c: { saved: number; total: number; needYou: number }): string {
  const base = `${c.total}개 중 ${c.saved}개 저장`;
  return c.needYou > 0 ? `${base} · ${c.needYou}개 선택 필요` : base;
}
/** What TalkBack reads: "Subtitles, {line}, button {label}". */
export const rowLabel = (line: string, button: string | null): string => (button ? `${ROW_LABEL}, ${line}, button ${button}` : `${ROW_LABEL}, ${line}`);

// ---------------------------------------------------------------- NATIVE_CONTRACT 45.5: sources that are off

export const TURN_ON_MORE_SOURCES = '검색 사이트 더 켜기';
export const MORE_SOURCES = '검색 사이트';

/** The sheet's line. When the video is anime and an anime source is off, it names that source. */
export function offSourcesLine(k: number, animeName: string | null = null): string {
  const line = k === 1 ? '자막 검색 사이트 1개가 꺼져 있습니다' : `자막 검색 사이트 ${k}개가 꺼져 있습니다`;
  if (!animeName) return line;
  return k === 1 ? `${line} (${animeName})` : `${line} (예: ${animeName})`;
}

/** The multi-video sheet's summary tail, joined to the status summary. */
export const offSourcesTail = (k: number): string => (k === 1 ? '검색 사이트 1개 꺼짐' : `검색 사이트 ${k}개 꺼짐`);

/** The page row's line: "No match yet · 2 sources off". */
export const rowNoneOff = (k: number): string => `${ROW_NONE} \u00B7 ${offSourcesTail(k)}`;

// ---------------------------------------------------------------- NATIVE_CONTRACT 46: a season

/** 46.1: the main line of an episode row. */
export const episodeMain = (code: string, title: string): string => (title ? `${code} \u00B7 ${title}` : code);
/** 46.1: "Saved · English". */
export const episodeSaved = (language: string | null): string => (language ? `Saved \u00B7 ${languageName(language)}` : 'Saved');
/** 46.3: the button in the status sheet. */
export const useBestMatchFor = (k: number): string => `${k}개 항목에 가장 적합한 자막 사용`;
/** 46.5: the page row's button. */
export const USE_BEST_MATCH = '가장 적합한 자막 사용';
/** 46.3: while it runs. */
export const bulkProgress = (i: number, k: number): string => `Saving ${i} of ${k}\u2026`;
/** 46.3: the line after it finished. The second part is left out when nothing is left. */
export function bulkResult(saved: number, stillNeed: number): string {
  const head = `${saved}개 저장했습니다.`;
  return stillNeed > 0 ? `${head} ${stillNeed}개 항목을 직접 선택해야 합니다.` : head;
}
