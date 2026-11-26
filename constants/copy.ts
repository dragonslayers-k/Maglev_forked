import { formatBytes } from './format.ts';

/**
 * One voice for notices, banners and empty states. Every string a notice, banner or empty state
 * shows lives here, grouped by screen, so scripts/test-copy-voice.js can lint them all.
 * (Native error messages, assistant output and the assistant system prompt are out of scope.)
 *
 * Voice
 *   - Plain, calm, second person. Sentence case. No "!", "Successfully", "Oops", "Uh oh",
 *     "Error:", emoji, ALL CAPS words (acronyms such as VPN, URL, RSS are fine) or ellipses.
 *   - Contractions: "Couldn't", "Can't". Never "Could not", "Cannot", "Please", or a sentence that starts "Unable to" or "Failed to".
 *
 * Notices (toasts)
 *   - Say what happened in the past tense, or what is true now. At most 12 words. Ends with a period.
 *   - An error names the cause in plain words. When the user can do something, the notice carries an
 *     action (Undo, Retry, Open settings), matching AGENTS.md section 4.7 and components/detail/errorActions.ts.
 *     Do not repeat that mapping here.
 *
 * Banners
 *   - A title of at most 8 words with no period, then an optional body of at most 16 words that ends
 *     with a period. At most one action.
 *
 * Empty states
 *   - A title saying what is empty: at most 5 words, no period.
 *   - One line saying how to fill it: at most 16 words, ends with a period.
 *   - At most one primary action. The same structure on every screen.
 *   - A body that comes from the engine at run time (an error message) is passed in by the screen.
 *
 * Glossary: the same word for the same thing everywhere.
 *   - transfer: any item in the Transfers list. The tab, filters and bulk actions say "transfers".
 *   - torrent: an item added from a magnet link or a .torrent file ("Add torrent", the torrent screen).
 *   - download: an item added from a web link ("Add download"), and the act of downloading.
 *   - magnet link: never "magnet URL". folder: never "directory" or "path".
 *   - source: a place Search looks in. Never "provider" or "indexer" on screen.
 *   Known outliers left alone because they come from outside this file: native error messages
 *   ("already in your list") and the assistant ("Already in your downloads").
 */

export const glossary = {
  transfer: { use: 'transfer', avoid: [/\byour list\b/i, /\bqueue item\b/i] },
  torrent: { use: 'torrent', avoid: [/\btorrent url\b/i] },
  magnet: { use: 'magnet link', avoid: [/\bmagnet url\b/i] },
  folder: { use: 'folder', avoid: [/\bdirectory\b/i, /\bfile path\b/i] },
  source: { use: 'source', avoid: [/\bprovider\b/i, /\bindexer\b/i] },
} as const;

/** Words that may be written in capitals. */
export const ACRONYMS = ['VPN', 'URL', 'RSS', 'SD', 'DHT', 'IP', 'ID', 'USB', 'UI', 'OK', 'API', 'VLC', 'HTTP', 'HTTPS', 'UPnP', 'DRM', 'HLS', 'DASH', 'MIME', 'MP4', 'M3U8'] as const;

/** Capitalised words that may appear mid-sentence. */
export const PROPER_WORDS = ['Maglev', "Maglev's", 'Android', 'Transfers', 'Wi-Fi', 'Atom', 'Settings', 'Search', 'Feeds', 'Undo', 'Retry', 'Inter'] as const;

const toName = (s: string | number) => String(s);

// ---------------------------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------------------------
export const notices = {
  /** Used by more than one screen. */
  common: {
    retryFailed: "다시 시도하지 못했습니다.",
  },
  /** Inline errors set by a screen and shown in a banner or sheet. */
  inline: {
    notTorrentFile: "토렌트(.torrent) 파일이 아닙니다.",
    openFileFailed: "파일을 열지 못했습니다.",
    clipboardEmpty: '클립보드가 비어 있습니다.',
    startDownloadFailed: '다운로드를 시작하지 못했습니다.',
    folderPickerFailed: "폴더 선택기를 열지 못했습니다. 다시 시도하세요.",
    folderNotDirect: "해당 폴더에 직접 저장할 수 없습니다. 다른 폴더를 선택하세요.",
    storageRefused: '저장소 접근이 거부되어 앱 내부 저장소에 파일을 저장합니다.',
    readFileFailed: "파일을 읽지 못했습니다. 다른 파일을 선택하세요.",
    removeTorrentFailed: "토렌트를 삭제하지 못했습니다. 다시 시도하세요.",
    shareFailed: "공유하지 못했습니다. 다시 시도하세요.",
    resumeFailed: "토렌트를 재개하지 못했습니다.",
    streamFailed: '스트림을 시작하지 못했습니다.',
    noPlayer: '재생 앱을 찾지 못했습니다. VLC 또는 다른 플레이어를 설치하세요.',
    readInfoFailed: "토렌트 정보를 읽지 못했습니다.",
    apiKeyFailed: "이 기기에 API 키를 저장하지 못했습니다. 다시 시도하세요.",
  },
  /** context/EngineContext.tsx */
  engine: {
    removed: (name: string | number) => `Removed ${toName(name)}.`,
    removedMany: (count: string | number) => `Removed ${toName(count)} transfers.`,
    removeFailed: (name: string | number) => `Couldn't remove ${toName(name)}. Try again.`,
    removeFailedMany: (count: string | number) => `Couldn't remove ${toName(count)} transfers. Try again.`,
    pauseFailed: (label: string | number) => `Couldn't pause ${toName(label)}. Try again.`,
    resumeFailed: (label: string | number) => `Couldn't resume ${toName(label)}. Try again.`,
    pauseAllFailed: "모두 일시 정지하지 못했습니다. 다시 시도하세요.",
    resumeAllFailed: "모두 재개하지 못했습니다. 다시 시도하세요.",
    downloadActionFailed: (verb: string | number) => `Couldn't ${toName(verb)}. Try again.`,
  },
  /** Multi-select actions on Transfers. */
  bulk: {
    someFailed: (done: string | number, failed: string | number, verb: string | number) =>
      `${toName(verb)} ${toName(done)}. Couldn't finish ${toName(failed)}.`,
    allFailed: (failed: string | number, verb: string | number) => `Couldn't ${toName(verb)} ${toName(failed)}.`,
  },
  browser: {
    popup: '팝업을 차단했습니다.',
    scheme: '다른 앱을 여는 링크를 차단했습니다.',
    permission: '카메라, 마이크 또는 위치 권한 요청을 차단했습니다.',
    drm: 'DRM 보호 영상은 저장할 수 없습니다.',
    blob: '이 플레이어의 스트림은 직접 저장할 수 없습니다.',
    mpmuxGuideOpenFailed: 'MPMux 안내를 열지 못했습니다.',
    mpmuxExtensionOpenFailed: 'MPMux 확장 프로그램 안내를 열지 못했습니다.',
    linkCopied: '링크를 복사했습니다.',
    linkCopyFailed: '링크를 복사하지 못했습니다.',
    addedToTransfers: '다운로드 목록에 추가했습니다.',
    /** The summary after a batch. `duplicate` is files already in Transfers. */
    batchDone: (added: string | number, duplicate: string | number, failed: string | number) => {
      const a = Number(added);
      const d = Number(duplicate);
      const f = Number(failed);
      if (a === 0 && d === 0) return `파일 ${f}개를 추가하지 못했습니다.`;
      return [a > 0 ? `${a}개 추가` : '', d > 0 ? `이미 목록에 있는 파일 ${d}개` : '', f > 0 ? `실패 ${f}개` : ''].filter(Boolean).join(' · ') + '.';
    },
    adsAllowed: (site: string | number) => `${toName(site)} 사이트의 광고를 허용했습니다.`,
    adsBlocked: (site: string | number) => `${toName(site)} 사이트의 광고를 차단합니다.`,
    listUpdated: (domains: string | number) => `차단 목록을 업데이트했습니다. 도메인 ${toName(domains)}개입니다.`,
    listReset: '기본 차단 목록으로 돌아갔습니다.',
    listAddressAdded: '목록 주소를 추가했습니다.',
    dataCleared: '인터넷 사용 데이터를 삭제했습니다.',
    dataClearFailed: '인터넷 사용 데이터를 삭제하지 못했습니다.',
    historyCleared: '방문 기록을 삭제했습니다.',
    historyClearFailed: '방문 기록을 삭제하지 못했습니다.',
    historyRemoved: '방문 기록에서 삭제했습니다.',
    historyHostRemoved: (count: string | number, host: string | number) =>
      `${toName(host)}의 방문 기록 ${toName(count)}개를 삭제했습니다.`,
    historyRemoveFailed: '방문 기록을 삭제하지 못했습니다.',
    historyRestoreFailed: '방문 기록을 복원하지 못했습니다.',
    /** Block list update errors, keyed by the native error code. */
    listError: {
      NETWORK: "목록에 연결하지 못했습니다. 인터넷 연결을 확인하세요.",
      HTTP_STATUS: '목록 서버에서 오류를 반환했습니다.',
      LIST_TOO_LARGE: '목록 파일이 너무 큽니다.',
      LIST_INVALID: "차단 목록 형식이 아닙니다.",
      BLOCKED: '네트워크 설정에서 차단했습니다.',
      INVALID_ARGUMENT: "목록 주소가 올바르지 않습니다.",
      OTHER: "목록을 업데이트하지 못했습니다.",
    },
  },
  addDownload: {
    duplicate: '이미 다운로드 목록에 있는 링크입니다.',
  },
  addTorrent: {
    addedWaiting: '추가했습니다. 정보가 도착하면 파일을 선택할 수 있습니다.',
    addFailed: '문제가 발생했습니다. 다시 시도하세요.',
  },
  detail: {
    keepOneFile: '파일을 하나 이상 남겨 두세요.',
    priorityFailed: "파일 우선순위를 변경하지 못했습니다.",
    lookingForPeers: '피어를 더 찾고 있습니다.',
    retryIn: (seconds: string | number) => `Try again in ${toName(seconds)} s.`,
    peersFailed: "피어를 더 요청하지 못했습니다.",
    magnetCopied: '마그넷 링크를 복사했습니다.',
    magnetCopyFailed: "마그넷 링크를 복사하지 못했습니다.",
    magnetShareFailed: "마그넷 링크를 공유하지 못했습니다.",
    torrentSaveFailed: "토렌트 파일을 저장하지 못했습니다.",
    limitFailed: "속도 제한을 변경하지 못했습니다.",
    moving: '파일을 이동하고 있습니다.',
    checking: '파일을 확인하고 있습니다.',
    openFolderFailed: "폴더를 열지 못했습니다.",
    stateFailed: "토렌트 상태를 변경하지 못했습니다.",
    resumedToStream: '스트리밍을 위해 다운로드를 재개했습니다.',
  },
} as const;

// ---------------------------------------------------------------------------------------------
// Banners (inline notices with a title, an optional body and at most one action)
// ---------------------------------------------------------------------------------------------
export const banners = {
  settings: {
    notificationsOff: { title: '알림이 꺼져 있습니다', body: '백그라운드에서 다운로드가 중단될 수 있습니다.' },
    batteryRestricted: { title: '배터리 절약을 위해 Android가 다운로드를 중단할 수 있습니다' },
    legacyStorageDenied: { title: '저장소 접근이 거부되었습니다', body: '파일은 앱 내부 저장소에 저장됩니다.' },
  },
  storage: {
    folderAccessLost: { title: '폴더 접근 권한이 사라졌습니다', body: '선택한 폴더에 더 이상 저장할 수 없습니다.' },
    appStorageFallback: { title: '앱 내부 저장소에 파일을 저장합니다', body: "현재 다운로드 폴더를 사용할 수 없습니다." },
  },
  browser: {
    installer: { title: '앱 설치 파일입니다', body: '신뢰할 수 있는 사이트의 파일만 다운로드하세요.' },
    sslRefused: { title: '보안 연결을 열 수 없습니다', body: '사이트 인증서를 신뢰할 수 없어 연결을 중단했습니다.' },
    localRefused: { title: '로컬 네트워크 주소를 차단했습니다', body: '페이지가 내부 기기로 연결할 수 없습니다. 신뢰하는 주소는 직접 입력하세요.' },
    streamProtected: { title: '보호된 영상입니다' },
    streamLive: { title: '실시간 스트림은 저장할 수 없습니다' },
    streamUnsupported: { title: '지원하지 않는 스트림 형식입니다' },
    streamFailed: { title: '스트림을 읽지 못했습니다' },
  },
  addDownload: {
    notEnoughSpace: { title: '저장 공간이 부족합니다', body: '저장 공간을 확보한 뒤 다시 시도하세요.' },
  },
  addTorrent: {
    addFailed: { title: "토렌트를 추가하지 못했습니다" },
  },
  feeds: {
    loadFailed: (name: string | number) => ({ title: `Couldn't load ${toName(name)}` }),
  },
  transfers: {
    magnetInClipboard: { title: '복사한 마그넷 링크를 추가할까요?' },
    torrentLinkInClipboard: { title: '복사한 토렌트 링크를 추가할까요?' },
    linkInClipboard: { title: '복사한 링크를 추가할까요?' },
  },
  detail: {
    updatesPaused: { title: '업데이트가 일시 정지되었습니다' },
    torrentProblem: { title: '토렌트에 문제가 있습니다' },
    deleteFailed: { title: "삭제하지 못했습니다" },
    removeFailed: { title: "제거하지 못했습니다" },
    shareFailed: { title: "공유하지 못했습니다" },
    actionFailed: { title: "작업을 수행하지 못했습니다" },
    moveFailed: { title: "이동하지 못했습니다" },
  },
  sources: {
    unsafe: { title: '안전하지 않은 출처' },
  },
} as const;

// ---------------------------------------------------------------------------------------------
// Empty states: a title (what is empty) and a body (how to fill it)
// ---------------------------------------------------------------------------------------------
/** NATIVE_CONTRACT 45.5 */
export const SEARCH_TURN_ON_MORE = '검색 사이트 더 켜기';
export const offSourcesSentence = (k: number): string => (k === 1 ? '1 more source is off.' : `${k} more sources are off.`);

export const empty = {
  transfers: {
    none: { title: '다운로드 중인 항목이 없습니다', body: '링크나 .torrent 파일을 추가하거나 검색해 보세요.' },
    /** Under the finder tiles: the Share route, which the screen's buttons don't cover. */
    shareHint: '다른 앱에서 "공유"를 누른 다음 Maglev를 선택하세요.',
    noMatch: { title: '일치하는 전송 항목이 없습니다', body: '다른 검색어를 입력해 보세요.' },
    noneInFilter: (filter: string | number) => ({
      title: `No ${toName(filter).toLowerCase()} transfers`,
      body: '다른 필터를 선택하면 더 볼 수 있습니다.',
    }),
  },
  search: {
    unavailable: { title: '현재 검색을 사용할 수 없습니다', body: '인터넷 연결을 확인하고 다시 시도하세요.' },
    noSource: { title: '이 분류를 검색하는 사이트가 없습니다', body: '해당 분류를 검색하는 사이트를 켜세요.' },
    idle: (sources: number | string) => ({
      title: `${toName(sources)}개 검색 사이트를 한 번에 검색하세요`,
      body: '검색창을 눌러 최근 검색어를 확인하세요.',
    }),
    noAnswer: { title: '응답한 검색 사이트가 없습니다', body: '인터넷 연결을 확인하거나 다른 검색 사이트를 사용하세요.' },
    /** `off`: NATIVE_CONTRACT 45.5, the sources that are switched off and could have answered. */
    noResults: (query: string | number, off = 0) => ({
      title: '검색 결과가 없습니다',
      body: `Nothing matches "${toName(query)}". Try fewer words or another category.${off > 0 ? ` ${offSourcesSentence(off)}` : ''}`,
    }),
  },
  feeds: {
    none: { title: '피드가 아직 없습니다', body: 'RSS 또는 Atom 피드를 구독하면 새 토렌트가 여기에 표시됩니다.' },
    nothingNew: { title: '새 항목이 없습니다', body: '아래로 당겨 새 항목을 확인하세요.' },
  },
  addTorrent: {
    noFiles: { title: '목록에 파일이 없습니다', body: '선택할 수 있는 파일이 없습니다.' },
    duplicate: { title: '이미 전송 목록에 있습니다', body: '이 토렌트는 이미 추가되어 있습니다.' },
    timedOut: { title: "토렌트 정보를 찾지 못했습니다" },
    timedOutMagnet: 'No peers answered in time. Retry, or add it anyway and Maglev keeps looking.',
    timedOutFile: '제한 시간 내에 피어가 응답하지 않았습니다.',
    readFailed: { title: "토렌트를 읽지 못했습니다" },
  },
  addDownload: {
    waitingForNetwork: { title: 'Wi-Fi 연결 대기 중' },
    deviceOnNetwork: { title: '네트워크의 기기' },
    badLink: { title: "이 링크를 사용할 수 없습니다" },
  },
  detail: {
    notFound: { title: '토렌트를 찾지 못했습니다', body: '삭제되었을 수 있습니다.' },
    /** The page of a link download whose id is not in the list (removed, or a stale link). */
    downloadNotFound: { title: '다운로드를 찾지 못했습니다', body: '삭제되었을 수 있습니다.' },
    loadFailed: { title: "토렌트를 불러오지 못했습니다" },
    noFiles: { title: '파일 정보가 아직 없습니다', body: '토렌트 메타데이터를 받으면 파일 정보가 표시됩니다.' },
    peersUnavailable: (connected: string | number) => ({
      title: "피어 정보가 아직 없습니다",
      body: `${toName(connected)} connected. The list fills in shortly.`,
    }),
    noPeers: { title: '연결된 피어가 없습니다', body: '토렌트가 실행되면 피어가 표시됩니다.' },
    noTrackers: { title: '트래커가 없습니다', body: '트래커가 없어도 피어를 찾을 수 있습니다. 더 찾으려면 트래커를 추가하세요.' },
  },
  browser: {
    start: { title: '열린 페이지가 없습니다', body: '위 주소창에 주소를 입력하거나 검색어를 입력하세요.' },
    crashed: { title: '페이지가 응답하지 않습니다', body: '새로고침해 다시 시도하세요.' },
    noFiles: { title: '감지된 파일이 없습니다', body: '영상을 재생하거나 파일이 있는 페이지를 열면 여기에 표시합니다.' },
    noAllowedSites: { title: '허용한 사이트가 없습니다', body: '광고를 허용한 사이트가 여기에 표시됩니다.' },
    historyEmpty: { title: '방문 기록이 없습니다', body: '브라우저에서 방문한 페이지가 여기에 표시됩니다.' },
    historyOff: { title: '방문 기록이 꺼져 있습니다', body: '브라우저 설정에서 방문 기록을 켜세요.' },
    historyNoResults: { title: '검색 결과가 없습니다', body: '다른 단어나 주소 일부를 입력하세요.' },
    historyFailed: { title: '방문 기록을 사용할 수 없습니다', body: '방문 기록을 불러오지 못했습니다. 다시 시도하세요.' },
  },
  engineError: {
    title: "다운로더가 시작되지 않았습니다",
  },
  /** utils/addErrorNotice.ts, app/add-torrent.tsx, app/engine-error.tsx */
  engineStopped: {
    title: '다운로더가 중지되었습니다',
    noReason: "다시 시작하지 못했습니다.",
  },
} as const;

/** Labels for browser history (NATIVE_CONTRACT 24.9): the screen, the suggestions, the clear sheet and its settings. */
export const historyCopy = {
  title: '방문 기록',
  menuRow: '방문 기록',
  searchPlaceholder: '방문 기록 검색',
  searchLabel: '방문 기록 검색',
  clear: '방문 기록 삭제',
  clearLabel: '방문 기록 삭제',
  today: '오늘',
  yesterday: '어제',
  rowMenuLabel: (title: string | number) => `${title} 옵션`,
  remove: '삭제',
  removeHost: (host: string | number) => `${host}의 기록 모두 삭제`,
  loadMore: '더 불러오는 중',
  retry: '다시 시도',
  suggestionsLabel: '방문 기록 추천',
  bookmarkHint: '북마크',
  /** The ⋮ sheet title: with a page open, and on a blank tab (24.11). */
  menuTitlePage: '현재 페이지',
  menuTitleBlank: '브라우저',
  /** "Recent" on the new-tab page (24.11). */
  recent: { title: '최근', label: '최근 방문 페이지', seeAll: '모두 보기', seeAllLabel: '방문 기록 모두 보기' },
  settings: {
    section: '방문 기록',
    private: '비공개 브라우징',
    privateSubtitle: '방문 기록과 열린 탭을 저장하지 않습니다. 브라우저를 닫으면 방문 사이트의 쿠키와 캐시를 삭제합니다. 사이트 저장소와 일부 제3자 쿠키는 남을 수 있습니다.',
    privateIndicator: '비공개 브라우징 사용 중',
    save: '방문 기록 저장',
    saveSubtitle: '이 기기에 방문한 페이지를 저장합니다.',
    suggest: '방문 기록 추천',
    suggestSubtitle: '주소를 입력할 때 일치하는 페이지를 표시합니다.',
    clearOnClose: 'Maglev 종료 시 방문 기록 삭제',
    clearOnCloseSubtitle: 'Maglev를 닫을 때 방문 기록을 삭제하고 다음 실행 시에도 정리합니다.',
    open: '방문 기록',
    clear: '방문 기록 삭제',
  },
  sheet: {
    rangeTitle: '방문 기록 삭제',
    rangeSubtitle: '브라우저에서 방문한 페이지를 삭제합니다.',
    dataTitle: '인터넷 사용 데이터 삭제',
    dataSubtitle: '쿠키를 삭제하면 사이트에서 로그아웃됩니다. 검색 중 완료한 보안 확인도 초기화됩니다.',
    ranges: { hour: '최근 1시간', today: '오늘', week: '최근 7일', all: '전체 기간' },
    history: '방문 기록',
    cookies: '쿠키 및 사이트 데이터',
    cache: '캐시',
    clear: '삭제',
    cancel: '취소',
    retry: '다시 시도',
    clearing: '삭제 중',
  },
} as const;

/** Labels for browser tabs, the link menu and pop-ups (NATIVE_CONTRACT 24.10). */
export const browserTabs = {
  tabButtonLabel: (count: number | string) => `탭 ${count}개 열림`,
  /** Shown in the tab button above 99. */
  tabButtonMany: '99+',
  switcher: {
    title: '탭',
    newTab: '새 탭',
    menuLabel: '탭 옵션',
    closeAll: '모든 탭 닫기',
    closeTabLabel: (title: string | number) => `${title} 탭 닫기`,
    blankTitle: '새 탭',
  },
  closedTab: '탭을 닫았습니다.',
  closedAll: '모든 탭을 닫았습니다.',
  undo: '실행 취소',
  capNotice: '탭은 최대 50개까지 열 수 있습니다. 기존 탭을 닫으세요.',
  longPress: {
    openNewTab: '새 탭에서 열기',
    openBackground: '백그라운드 탭에서 열기',
    copyLink: '링크 복사',
    downloadLink: '링크 다운로드',
    shareLink: '링크 공유',
    openImageNewTab: '새 탭에서 이미지 열기',
    downloadImage: '이미지 다운로드',
    copyImageLink: '이미지 링크 복사',
    shareImageLink: '이미지 링크 공유',
    addTorrent: '토렌트 추가',
  },
  openedInNewTab: '새 탭에서 열었습니다.',
  switchTo: '전환',
  popup: {
    windowTitle: '이 페이지에서 팝업을 열려고 합니다',
    redirectTitle: '이 페이지에서 다른 사이트로 이동하려고 합니다',
    appTitle: '이 링크에서 다른 앱을 열려고 합니다',
    open: '열기',
    block: '차단',
    alwaysAllow: (host: string | number) => `${host}에서 항상 허용`,
    moreBlocked: (n: number | string) => `외 ${n}개 더 차단`,
    noApp: '이 링크를 열 수 있는 앱이 없습니다.',
  },
  thisPage: {
    popupsRow: '팝업',
    blockedOnPage: (n: number | string) => `이 페이지에서 ${n}개 차단`,
    clearSiteRow: '이 사이트 데이터 삭제',
    clearSiteTitle: '이 사이트 데이터를 삭제하시겠습니까?',
    clearSiteBody: (host: string) => `${host}에서 로그아웃됩니다.`,
    clearSiteAction: '삭제',
    clearSiteDone: '사이트 데이터를 삭제했습니다.',
  },
  settings: {
    section: '팝업 및 리디렉션',
    ask: '확인 후 허용',
    block: '항상 차단',
    allow: '허용',
    allowedSites: '팝업 허용 사이트',
    remove: '제거',
    swipeTabs: '주소창을 밀어 탭 전환',
    swipeTabsSubtitle: '주소창을 좌우로 밀어 탭을 전환하거나 아래로 밀어 전체 탭을 보세요.',
    darkPages: '웹페이지 어둡게 표시',
    darkPagesSubtitle: '어두운 테마에서 밝은 웹페이지를 어둡게 표시합니다.',
  },
} as const;

/** Labels on the browser's found-files list. Short field names, not notices. */
export const foundTray = {
  title: '감지 파일',
  count: (n: string | number) => `이 페이지에서 ${n}개 감지`,
  clear: '비우기',
  clearLabel: '감지된 파일 목록 비우기',
  remove: (name: string | number) => `${name} 목록에서 제거`,
  hideSmall: '작은 파일 숨기기',
  hidden: (n: string | number) => `${n}개 숨김`,
  showHidden: (n: string | number) => `숨긴 작은 파일 ${n}개 보기`,
  hideAgain: '다시 숨기기',
  inTransfers: '다운로드 목록에 있음',
  view: '보기',
  downloading: (n: string | number) => `${n}개 다운로드 중`,
  downloadingLabel: (text: string) => `${text}. 다운로드 목록 열기`,
  selectAll: '전체 선택',
  selectNone: '선택 해제',
  cancelSelect: '취소',
  downloadN: (n: string | number) => `다운로드 (${n})`,
  copyLink: '링크 복사',
  selectedLabel: (n: string | number) => `${n}개 선택`,
  capNote: (n: string | number) => `한 번에 최대 ${n}개까지 추가할 수 있습니다.`,
  batchTitle: (n: string | number) => `파일 ${n}개 다운로드`,
  batchKnown: (size: string) => `전체 크기 ${size}`,
  unknownSizes: (n: string | number) => (Number(n) === 1 ? '크기를 확인할 수 없는 파일 1개는 합계에서 제외했습니다.' : `크기를 확인할 수 없는 파일 ${n}개는 합계에서 제외했습니다.`),
  scanAgain: '다시 감지',
  scanAgainLabel: '목록을 비우고 페이지 다시 감지',
  undo: '실행 취소',
  removed: (name: string | number) => `${name} 파일을 목록에서 제거했습니다.`,
  cleared: (n: string | number) => `파일 ${n}개를 목록에서 비웠습니다.`,
} as const;

/** Labels for the one-download folder choice in the browser's download sheet. Short field names. */
export const saveTo = {
  title: '저장 위치',
  defaultFolder: '기본 폴더',
  subfolder: '하위 폴더',
  namePlaceholder: '폴더 이름',
  onlyThis: '이번 다운로드에만 적용됩니다.',
} as const;

/** Labels on the browser's stream sheet. Not linted as notices; they are short field names. */
export const streamSheet = {
  title: '스트리밍 영상',
  reading: '스트림 정보를 확인하고 있습니다',
  quality: '화질',
  audio: '오디오',
  name: '파일 이름',
} as const;

// ---------------------------------------------------------------------------------------------
// Onboarding: what each step says. Plain, concrete, no hype.
// ---------------------------------------------------------------------------------------------
export const onboarding = {
  welcome: {
    title: 'Maglev',
    body: '토렌트, 웹 링크, 동영상을 한곳에서 관리하세요.',
    detail: '여러 사이트를 동시에 검색하고, 브라우저에서 동영상을 찾고, 피드로 새 항목을 받아보세요.',
  },
  notifications: {
    title: '다운로드 완료 알림',
    body: '다운로드가 완료되면 알려 드리고 백그라운드에서도 진행 상황을 표시합니다.',
  },
  folder: {
    title: '다운로드 폴더',
    body: '완료된 파일이 여기에 저장됩니다. 설정에서 변경할 수 있습니다.',
  },
  background: {
    title: '백그라운드 실행 유지',
    body: '배터리 절약을 위해 Android가 다운로드를 중단할 수 있습니다. Maglev의 실행을 허용할까요?',
  },
  mobileData: {
    title: '모바일 데이터로 다운로드할까요?',
    body: '대용량 다운로드는 데이터 요금이 많이 발생할 수 있습니다.',
  },
};
/** The + button's menu (components/add/AddMenuSheet.tsx). */
export const addMenu = {
  title: '추가',
  magnet: '마그넷 링크',
  copyFirst: '먼저 링크를 복사하세요',
  typeHint: '웹 링크 또는 마그넷 링크를 입력하세요',
  fileHint: '휴대전화에서 파일을 선택하세요',
  searchHint: '검색 사이트에서 찾아보세요',
  browseHint: '웹페이지에서 파일이나 동영상을 찾으세요',
} as const;

// ---------------------------------------------------------------------------------------------
// Mobile data note on the add screens (one quiet line; the size is formatted at run time)
// ---------------------------------------------------------------------------------------------
/**
 * The one line the add screens show under the size. Null when there is nothing to say: not on mobile data,
 * or on mobile data with Wi-Fi only off and no known size. With Wi-Fi only on the download waits, so the
 * size doesn't matter.
 */
export function mobileDataLine(onMetered: boolean, wifiOnly: boolean, sizeBytes: number | null): string | null {
  if (!onMetered) return null;
  if (wifiOnly) return 'Wi-Fi 연결 시 다운로드합니다.';
  if (sizeBytes == null || !(sizeBytes > 0)) return null;
  return `현재 모바일 데이터를 사용 중입니다. 파일 크기는 ${formatBytes(sizeBytes)}입니다.`;
}
/**
 * Settings > Interface > Font. Each description is linted by scripts/test-copy-voice.js like a
 * banner body: at most 16 words, ends with a period. The sample is a made-up file shown in each style.
 */
export const fontStyleCopy = {
  label: '글꼴',
  hint: '선택하면 바로 적용됩니다.',
  sampleName: '빅 벅 버니 1080p',
  sampleSize: '691 MB',
  options: [
    { value: 'clean', title: '깔끔하게', description: '읽기 쉬운 글꼴입니다. 제목, 이름, 숫자에 Inter를 사용합니다.' },
    { value: 'retro', title: '레트로', description: '옛 터미널처럼 픽셀 제목과 고정폭 숫자를 사용합니다.' },
    { value: 'mono', title: '고정폭', description: '제목, 이름, 숫자를 고정폭으로 표시합니다. 설명과 본문은 읽기 쉽게 유지됩니다.' },
  ],
} as const;

/** Settings > Interface > Tabs. */
export const tabsCopy = {
  label: '탭',
  hint: '표시할 탭과 순서를 선택합니다. 변경 사항은 바로 적용됩니다.',
  reorderHint: '탭을 길게 눌러 드래그하면 순서를 바꿀 수 있습니다.',
  alwaysShown: '항상 표시',
  assistantNote: '설정에서 도우미를 켜면 여기에 탭이 표시됩니다.',
  names: {
    index: '다운로드',
    search: '검색',
    feeds: '피드',
    assistant: '도우미',
    browse: '브라우저',
    settings: '설정',
  },
} as const;

/** Settings > Appearance > App icon. The hint is linted like a banner body: at most 16 words, ends with a period. */
export const appIconCopy = {
  label: '앱 아이콘',
  hint: 'Maglev를 나가면 변경됩니다. 홈 화면에 반영되기까지 잠시 걸릴 수 있습니다.',
  /** "Teal app icon, selected" */
  a11y: (name: string, selected: boolean) => `${name} 앱 아이콘${selected ? ', 선택됨' : ''}`,
} as const;

/** The screen shown when a screen crashes, and the crash log row in Settings > About. */
export const errorScreenCopy = {
  title: '문제가 발생했습니다',
  body: '이 화면에서 오류가 발생했습니다. 다시 불러와 시도하세요.',
  reload: '다시 불러오기',
  copy: '충돌 보고서 복사',
  copied: '보고서를 복사했습니다',
  copyFailed: 'Couldn\'t copy the report',
  about: {
    title: '충돌 보고서',
    subtitle: '이 휴대전화에만 저장되며 외부로 전송되지 않습니다.',
    clear: '충돌 기록 지우기',
  },
} as const;

// ---------------------------------------------------------------------------------------------
// play (0.19: Play while downloading; docs/contracts-0.19/play-and-storage.md section 1)
// ---------------------------------------------------------------------------------------------
export const playCopy = {
  label: '재생',
  a11y: (name: string) => `Play ${name}`,
  needsResume: '먼저 다운로드를 재개하세요.',
  storageFull: '휴대전화 저장 공간이 부족합니다. 공간을 확보해야 다운로드를 계속할 수 있습니다.',
  noFile: "이 토렌트에는 아직 재생할 파일이 없습니다.",
  failed: "재생을 시작하지 못했습니다.",
  resumedToPlay: '재생할 수 있도록 다운로드를 재개했습니다.',
} as const;

// ---------------------------------------------------------------------------------------------
// storage (0.19: low-storage protection and the Free up space screen; same contract, sections 2 and 3)
// ---------------------------------------------------------------------------------------------
export const storageCopy = {
  /** Same words as the notification: StorageGuard.PAUSED_TITLE / PAUSED_TEXT. */
  pausedTitle: '일시 정지됨: 휴대전화 저장 공간이 거의 없습니다',
  freeUp: '공간 확보',
  screenTitle: '공간 확보',
  freeLabel: '현재 여유 공간',
  reserveLabel: '휴대전화용으로 남겨 둔 공간',
  unknown: '—',
  listTitle: '완료된 다운로드 · 큰 파일순',
  emptyTitle: '삭제할 완료 항목이 없습니다',
  emptyBody: '완료된 토렌트와 다운로드가 큰 파일순으로 표시됩니다.',
  removeAction: '항목 및 파일 삭제',
  removeSelected: (n: number) => `Remove and delete ${n} ${n === 1 ? 'item' : 'items'}`,
  confirmTitle: '휴대전화에서 파일을 삭제할까요?',
  confirmBody: (count: number, size: string) =>
    `This removes ${count} ${count === 1 ? 'item' : 'items'} and deletes ${size} from your phone. There is no undo.`,
  removed: (count: number) => `Removed ${count} ${count === 1 ? 'item' : 'items'}.`,
  removeFailed: "Couldn't remove everything. Try again.",
  selectNone: '선택 해제',
  selectAll: '모두 선택',
} as const;

// ---- backup (Settings > Backup and restore) ----
export const backupCopy = {
  title: '백업 및 복원',
  export: { title: '백업 내보내기', subtitle: '설정, 북마크, 목록을 하나의 파일로 저장합니다.' },
  restore: { title: '백업에서 복원', subtitle: '이 휴대전화에서 백업 파일을 선택하세요.' },
  includeStats: { title: '통계 포함', restore: 'Stats', note: 'Stats include the names of what you downloaded.' },
  last: (when: string) => `Last backup ${when}`,
  never: '백업이 없습니다',
  secrets: '비밀번호, API 키, 토큰은 백업에 포함되지 않습니다.',
  notIncluded: '다운로드 파일, 방문 기록, 대화 기록, 충돌 로그는 포함되지 않습니다.',
  exportDone: (name: string) => `Saved ${name}`,
  exportFailed: "백업을 저장하지 못했습니다",
  readFailed: "파일을 읽지 못했습니다",
  previewTitle: '이 백업 복원',
  partsHeader: '복원할 항목',
  parts: {
    settings: 'Settings',
    search: '검색 사이트',
    feeds: '피드 및 규칙',
    schedule: '예약',
    assistant: '도우미',
    torrents: '토렌트',
    downloads: '다운로드',
  },
  torrentsNote: '토렌트와 다운로드는 일시 정지 상태로 추가됩니다. 파일은 백업에 포함되지 않으므로 먼저 저장 폴더를 확인합니다.',
  settingsConfirm: {
    title: '설정을 교체할까요?',
    body: '백업의 설정으로 이 휴대전화의 설정을 교체합니다. 북마크는 기존 항목에 추가됩니다.',
    action: '교체 및 복원',
  },
  restoreAction: 'Restore',
  restoring: '복원 중',
  doneTitle: '복원이 완료되었습니다',
  added: (n: number) => `${n} added`,
  skipped: (n: number) => `${n} already here, skipped`,
  failed: (n: number) => `${n} couldn't be added`,
  defaultFolder: (n: number) => `${n} saved to the default folder, because the old folder isn't on this phone`,
  restartNote: '일부 변경 사항은 Maglev를 다시 시작한 뒤 적용됩니다.',
  startAll: '모두 시작',
  started: (n: number) => `Started ${n}`,
  done: '완료',
} as const;

// region quick share
/** The card that floats over the app you shared from (docs/contracts-0.19/quick-share.md). Mirrored in share/QuickShareText.kt; scripts/test-quick-share.js keeps them equal. */
export const quickShareCopy = {
  setting: {
    title: '묻지 않고 바로 추가',
    subtitle: '공유한 마그넷 링크, 토렌트 파일, 파일 링크는 바로 시작합니다. 웹 페이지는 확인 카드를 표시합니다.',
  },
  gettingDetails: '정보 확인 중…',
  magnetName: '마그넷 링크',
  torrentName: '토렌트 파일',
  adding: '추가 중…',
  sizeUnknown: '크기 알 수 없음',
  savesTo: '저장 위치',
  download: '다운로드',
  downloadAnyway: '그래도 다운로드',
  openInMaglev: 'Maglev에서 열기',
  freeUpSpace: '저장 공간 확보',
  findVideos: '이 페이지의 동영상 찾기',
  close: '닫기',
  webPage: '웹 페이지이며 파일이 아닙니다',
  noLink: '공유한 항목에서 링크를 찾지 못했습니다',
  alreadyIn: '이미 Maglev에 있습니다',
  added: 'Maglev에 추가했습니다',
  addedServiceLater: 'Maglev에 추가했습니다. 앱을 열면 다운로드가 시작됩니다.',
  couldNotAdd: '추가하지 못했습니다. 다시 시도하세요.',
  engineFailed: 'Maglev를 시작하지 못했습니다. 앱을 열고 다시 시도하세요.',
} as const;
// endregion quick share

// region watch
/** Watch for a title (docs/contracts-0.19/watch.md). Screens: Settings > Watches, the Watch button on Search. */
export const watchCopy = {
  title: '관심 항목',
  rowTitle: '관심 항목',
  rowValue: (n: number) => (n === 0 ? 'None' : n === 1 ? '1 title' : `${n} titles`),
  intro: 'Maglev가 백그라운드에서 새 영상이나 파일을 확인하고 발견하면 알려 드립니다.',
  empty: '아직 관심 항목이 없습니다. 제목을 검색하고 관심 등록을 누르세요.',
  watchButton: '관심 등록',
  watchHint: '이 검색을 관심 등록',
  watching: (q: string) => `Watching "${q}"`,
  watchingBody: '새 항목이 발견되면 알림을 받습니다. 설정의 관심 항목에서 변경할 수 있습니다.',
  capNotice: '최대 20개까지 관심 등록할 수 있습니다. 먼저 하나를 삭제하세요.',
  alreadyNotice: '이미 관심 등록한 항목입니다.',
  mobileData: '모바일 데이터 사용',
  mobileDataHint: '끄면 Wi-Fi에서만 확인합니다.',
  pause: 'Pause',
  resume: 'Resume',
  paused: 'Paused',
  delete: 'Delete',
  deleteTitle: 'Delete this watch?',
  deleteBody: 'You will stop getting notifications for it.',
  lastNew: (name: string) => `Last new: ${name}`,
  noneNew: '새 항목이 없습니다',
  every: 'Check every',
  backgroundNote: 'Android decides the exact time, so a check can come later than you chose. It does not run after you force-stop Maglev, until you open it again.',
} as const;
// endregion watch

// region updates
/** In-app updates and Report a bug (docs/NATIVE_CONTRACT.md section 27). Screens: Settings > About. */
export const updateCopy = {
  versionBadge: 'Update available',
  check: { title: 'Check for updates', checking: 'Checking…', upToDate: "You're up to date", failed: "Couldn't check. Try again." },
  available: (version: string) => `Maglev ${version} is available`,
  managedBy: (by: 'fdroid' | 'obtainium' | 'play' | 'accrescent' | 'store') =>
    by === 'accrescent'
      ? 'Updates come from Accrescent.'
      : by === 'store'
        ? 'Updates come from the app store you installed Maglev from.'
        : `Updates come from ${by === 'fdroid' ? 'F-Droid' : by === 'obtainium' ? 'Obtainium' : 'Google Play'}.`,
  updatesRow: { title: 'Updates', autoCheck: 'Check automatically', autoCheckHint: 'Once a day, Maglev asks GitHub for the latest version.' },
  modes: [
    { value: 'ask', title: 'Tell me', description: 'Get a notification when a new version is out.' },
    { value: 'download', title: 'Download on Wi-Fi, then ask', description: 'The file downloads on Wi-Fi. You choose when to install.' },
    { value: 'auto', title: 'Install automatically', description: 'Downloads on Wi-Fi, then installs when nothing is transferring.' },
  ],
  card: {
    title: (version: string) => `Maglev ${version}`,
    whatsNew: "What's new",
    noNotes: 'No release notes.',
    download: 'Download',
    later: 'Later',
    skip: 'Skip this version',
    install: 'Install',
    retry: 'Try again',
    allowInstalls: 'Allow installs',
    downloading: 'Downloading',
    waitingForWifi: 'Wi-Fi 연결 대기 중',
    installing: 'Installing',
    confirm: 'Confirm on the screen Android shows.',
    ready: (version: string) => `Maglev ${version} is ready`,
  },
  notices: {
    invalid: "This update didn't pass Maglev's checks, so it wasn't installed.",
    needsPermission: 'To install updates, allow Maglev to install apps.',
    restartWarning: 'Maglev restarts to finish. Downloads pick up where they left off.',
    downloadFailed: "Couldn't download the update. Try again.",
    blocked: 'Your network settings block this download right now.',
    storageFull: "There isn't enough space for the update.",
    installFailed: "Android didn't install the update. Try again.",
  },
  hints: {
    firstUpdate: 'Android asks you to confirm the first update. After that, updates can install on their own.',
  },
  report: {
    title: 'Report a bug',
    subtitle: 'Opens GitHub with your version and phone filled in.',
  },
} as const;
// endregion updates

// region self-updating lists (docs/NATIVE_CONTRACT.md section 31)
export const listsCopy = {
  autoUpdate: 'Update lists automatically',
  checkNow: 'Check now',
  checking: 'Checking',
  adList: {
    title: 'Ad block list',
    info: (domains: number | string, when: string) => `${domains} domains · updated ${when}`,
    builtIn: (domains: number | string) => `${domains} domains · built in`,
  },
  sources: {
    title: 'Search sources and trackers',
    updated: (when: string) => `Updated ${when}`,
    builtIn: 'Built in',
  },
  /** Short results shown in the row value. */
  values: {
    upToDate: 'Up to date',
    updated: 'Updated',
    updatedSources: (n: number | string) => `Updated. ${n} sources changed`,
    failed: "Couldn't check. Try again.",
  },
  /** Sentences shown under a row. */
  hints: {
    autoUpdateSubtitle: 'Ad block list, search sources and trackers, once a day.',
    rejected: "The list didn't pass Maglev's checks, so it wasn't used.",
    blocked: 'Your network settings block this download right now.',
  },
  providers: {
    turnedOff: 'Turned off by Maglev',
    turnedOffWithNote: (note: string) => `Turned off by Maglev. ${note}`,
  },
  browser: {
    upToDate: 'The block list is already up to date.',
  },
} as const;
// endregion self-updating lists

// region browser find and text size (docs/NATIVE_CONTRACT.md section 28)
export const findCopy = {
  menuRow: '페이지에서 찾기',
  placeholder: '페이지에서 찾기',
  noMatches: '일치하는 항목이 없습니다',
  count: (n: number | string, total: number | string) => `${n}/${total}`,
  matchLabel: (n: number | string, total: number | string) => `${total}개 중 ${n}번째 항목`,
  previous: '이전 항목',
  next: '다음 항목',
  close: '찾기 닫기',
} as const;

export const textSizeCopy = {
  menuRow: '글자 크기',
  title: '글자 크기',
  settingsLabel: '글자 크기',
  value: (percent: number | string) => `${percent}%`,
  smaller: '글자 작게',
  larger: '글자 크게',
  reset: '기본값',
} as const;
// endregion browser find and text size

// region star prompt (docs/NATIVE_CONTRACT.md section 33)
export const starCopy = {
  title: 'Enjoying Maglev?',
  body: 'A star on GitHub helps other people find it.',
  star: 'Star on GitHub',
  notNow: 'Not now',
  never: "Don't ask again",
} as const;
// endregion star prompt

// region subtitle settings (docs/NATIVE_CONTRACT.md section 36.10). Strings shared with the sheet live in utils/subtitles/copy.ts.
export const subtitleSettingsCopy = {
  languages: {
    title: 'Languages',
    caption: 'Maglev looks for the first language on the list, then the next. Leave it empty to follow your phone.',
    yours: 'Your languages',
    all: 'All languages',
    search: 'Search languages',
    followsPhone: 'Follows your phone until you pick a language.',
    noMatch: (query: string) => `No language matches "${query}".`,
    moveUp: (name: string) => `Move ${name} up`,
    moveDown: (name: string) => `Move ${name} down`,
    remove: (name: string) => `Remove ${name}`,
  },
  hearing: {
    title: 'Hearing impaired',
    caption: 'Subtitles that also describe sounds. Show both lists them next to the others.',
  },
  sources: {
    title: 'Subtitle sources',
    pageTitle: 'Subtitle sources',
    caption: 'Maglev asks the sources you turn on when you tap Find subtitles.',
    empty: '검색 사이트가 없습니다',
    emptyBody: 'Sources arrive with app and list updates.',
    on: (n: number) => `On · ${n}`,
    off: 'Off',
    nothingOn: 'Nothing is on. Turn on a source below.',
    footer: "Maglev doesn't host any subtitles. Sources are third-party websites.",
    listLine: (when: string) => `Source list: ${when}`,
    toggle: (name: string) => `Use ${name} for subtitles`,
    matchesBy: 'Finds subtitles',
    spokenLanguages: 'Languages',
    website: 'Website',
  },
  account: {
    title: 'OpenSubtitles account',
    subtitle: 'Sign in to raise your daily limit',
  },
} as const;
// endregion subtitle settings

// region new-feature highlight (docs/NATIVE_CONTRACT.md section 37)
export const highlightCopy = {
  notNow: 'Not now',
  allNotes: 'All release notes',
  footer: 'You can turn these off in Settings → Updates',
  settingTitle: 'Show new features after updates',
  settingSubtitle: 'A short card after an update, when it has a headline feature.',
} as const;
// endregion new-feature highlight

// region network advanced
/** app/settings/network.tsx, app/settings/network-advanced.tsx, components/settings/NetworkRestartBanner.tsx, utils/networkStatus.ts */
export const networkAdvancedCopy = {
  rowTitle: 'Advanced',
  rowSubtitle: 'Port, peer finding, proxy and block list.',
  pageTitle: 'Advanced network',
  restartTitle: 'Restart the downloader to apply these changes',
  restartAction: 'Restart',
  restarting: 'Restarting\u2026',
  restarted: 'The downloader restarted.',
  restartFailed: "Couldn't restart the downloader. Try again.",
  noFile: 'No file chosen',
  unreadable: "Couldn't read the block list",
  rules: (count: number) => (count === 1 ? '1 rule' : `${toName(count)} rules`),
} as const;
// endregion network advanced
