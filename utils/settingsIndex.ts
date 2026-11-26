/**
 * Searchable index of the settings rows and controls on every page in app/settings.
 * Used by the search box on the Settings tab. Titles are the visible labels.
 */

export interface SettingEntry {
  id: string;
  /** Visible label of the row or control. */
  title: string;
  /** Route segment under app/settings, for example 'network' for app/settings/network.tsx. */
  page: string;
  /** Title of that page. */
  pageTitle: string;
  section?: string;
  /** Extra words people might type for this setting. */
  keywords: string[];
}

const e = (
  id: string,
  title: string,
  page: string,
  pageTitle: string,
  keywords: string[],
  section?: string,
): SettingEntry => ({
  id,
  title,
  page,
  pageTitle,
  section,
  keywords,
});

export const SETTINGS_INDEX: SettingEntry[] = [
  // About
  e(
    "about-report-bug",
    "Report a bug",
    "about",
    "앱 정보",
    [
    "bug",
    "issue",
    "github",
    "problem",
    "feedback",
    "report",
  ],
  ),
  e(
    "about-highlights",
    "Show new features after updates",
    "about",
    "앱 정보",
    ["highlights", "release notes", "new features", "updates", "what's new", "version"],
  ),
  e(
    "about-export-debug-log",
    "Export debug log",
    "about",
    "앱 정보",
    ["logs", "log", "debug", "bug report", "diagnostics", "support", "share"],
  ),
  e(
    "about-built-by",
    "Built by Kaos",
    "about",
    "앱 정보",
    [
    "author",
    "developer",
    "kaos",
    "source code",
    "github",
  ],
  ),
  e(
    "about-crash-log",
    "충돌 기록 지우기",
    "about",
    "앱 정보",
    [
    "crash",
    "error",
    "log",
    "report",
    "copy crash report",
  ],
  ),

  // List updates (app self-updater removed)
  e(
    "updates-lists-auto",
    "Update lists automatically",
    "updates",
    "목록 업데이트",
    ["lists", "daily", "automatic", "block list", "trackers", "sources"],
    "Lists",
  ),
  e(
    "updates-ad-list",
    "Ad block list",
    "updates",
    "목록 업데이트",
    [
      "ads",
      "adblock",
      "ad blocking",
      "block",
      "domains",
      "list",
      "browser",
      "trackers",
    ],
    "Lists",
  ),
  e(
    "updates-sources",
    "Search sources and trackers",
    "updates",
    "목록 업데이트",
    ["search", "providers", "trackers", "sources", "list", "torrent"],
    "Lists",
  ),

  // Subtitles
  e(
    "subtitles-enabled",
    "자막",
    "subtitles",
    "자막",
    ["subtitles", "captions", "srt", "cc", "closed captions", "find subtitles", "switch", "on", "off", "video"],
  ),
  e(
    "subtitles-auto-new-videos",
    "Get subtitles for new videos",
    "subtitles",
    "자막",
    ["subtitles", "captions", "automatic", "auto", "new videos", "once a video starts", "download", "add", "switch", "on", "off"],
  ),
  e(
    "subtitles-languages",
    "Languages",
    "subtitles",
    "자막",
    ["subtitles", "captions", "language", "languages", "phone language", "order", "english", "foreign"],
    "Looking for",
  ),
  e(
    "subtitles-hearing",
    "Hearing impaired",
    "subtitles",
    "자막",
    ["hearing impaired", "sdh", "deaf", "captions", "sounds", "closed captions", "cc", "show both", "prefer", "avoid"],
    "Looking for",
  ),
  e(
    "subtitles-sources",
    "Subtitle sources",
    "subtitles",
    "자막",
    ["subtitles", "sources", "providers", "opensubtitles", "websites", "where from", "turn on", "turn off"],
    "Where from",
  ),
  e(
    "subtitles-opensubtitles-account",
    "OpenSubtitles account",
    "subtitles",
    "자막",
    ["opensubtitles", "account", "api key", "login", "sign in", "subtitles", "captions", "download limit"],
    "Where from",
  ),
  e(
    "subtitles-privacy",
    "Subtitle privacy",
    "subtitles",
    "자막",
    ["privacy", "fingerprint", "file name", "sent", "what is sent", "subtitles", "lookup"],
  ),
  e(
    "subtitle-languages-yours",
    "Your languages",
    "subtitle-languages",
    "Languages",
    ["subtitles", "language", "languages", "order", "move up", "move down", "remove", "phone language", "captions"],
    "Your languages",
  ),
  e(
    "subtitle-languages-all",
    "All languages",
    "subtitle-languages",
    "Languages",
    ["subtitles", "language", "languages", "search languages", "add language", "captions"],
    "All languages",
  ),
  e(
    "subtitle-sources-list",
    "Subtitle sources",
    "subtitle-sources",
    "Subtitle sources",
    ["subtitles", "sources", "providers", "opensubtitles", "fingerprint", "imdb", "turned off by maglev", "list updated", "on", "off", "captions"],
  ),

  // Appearance
  e(
    "appearance-mode",
    "Mode",
    "interface",
    "화면 모양",
    [
    "dark",
    "light",
    "oled",
    "dim",
    "night",
    "theme",
    "black",
    "system",
    "color",
    "colour",
    "day",
  ],
  ),
  e(
    "appearance-accent",
    "Accent",
    "interface",
    "화면 모양",
    [
    "color",
    "colour",
    "theme",
    "lime",
    "cyan",
    "pink",
    "orange",
    "highlight",
    "violet",
    "blue",
    "amber",
    "mint",
    "purple",
    "magenta",
    "yellow",
    "green",
  ],
  ),
  e(
    "appearance-font",
    "Font",
    "interface",
    "화면 모양",
    [
    "font style",
    "typeface",
    "text",
    "clean",
    "retro",
    "mono",
    "inter",
    "pixel",
    "change font",
    "font size",
  ],
  ),
  // NATIVE_CONTRACT 41.5: now "Download page"; the ListRow title matches, so opening it scrolls to the row and does not open the sheet.
  e(
    "appearance-transfer-details",
    "Download page",
    "interface",
    "화면 모양",
    [
      "compact",
      "detailed",
      "download page",
      "transfer page",
      "details",
      "stats",
      "peers",
      "ratio",
      "density",
    ],
  ),
  e(
    "appearance-speed-totals",
    "Speed totals",
    "interface",
    "화면 모양",
    [
    "speed",
    "total",
    "pause all",
    "transfers",
  ],
  ),
  e(
    "appearance-tabs",
    "Tabs",
    "interface",
    "화면 모양",
    [
    "tab bar",
    "navigation",
    "show",
    "hide",
    "reorder",
    "order",
    "transfers",
    "search",
    "feeds",
    "assistant",
    "browser",
    "settings",
    "remove",
    "remove tab",
    "hide tab",
  ],
  ),
  e(
    "appearance-app-icon",
    "App icon",
    "interface",
    "화면 모양",
    [
    "icon",
    "launcher",
    "home screen",
    "teal",
    "logo",
    "theme",
  ],
  ),

  // Assistant
  e(
    "assistant-enable",
    "도우미",
    "assistant",
    "도우미",
    [
    "ai",
    "chat",
    "bot",
    "llm",
    "experimental",
    "tab",
    "enable",
    "on",
    "off",
  ],
  ),
  e(
    "assistant-tokens",
    "Tokens used",
    "assistant",
    "도우미",
    [
    "usage",
    "tokens",
    "cost",
    "input",
    "output",
    "billing",
  ],
  ),
  e(
    "assistant-notice",
    "Show the usage notice again",
    "assistant",
    "도우미",
    ["notice", "warning", "privacy", "usage", "sent"],
  ),
  e(
    "assistant-provider-address",
    "Address",
    "assistant",
    "도우미",
    [
      "provider",
      "url",
      "endpoint",
      "server",
      "ollama",
      "local",
      "base url",
      "api",
    ],
    "Provider",
  ),
  e(
    "assistant-provider-paste-key",
    "Use another provider or paste a key",
    "assistant",
    "도우미",
    [
      "api key",
      "key",
      "provider",
      "openai",
      "token",
      "model",
      "secret",
      "chatgpt",
      "chat gpt",
      "gemini",
      "claude",
    ],
    "Provider",
  ),

  // Backup
  e(
    "backup-export",
    "백업 내보내기",
    "backup",
    "백업 및 복원",
    [
    "save",
    "backup",
    "file",
    "export",
    "settings",
    "lists",
  ],
  ),
  e(
    "backup-restore",
    "백업에서 복원",
    "backup",
    "백업 및 복원",
    [
    "restore",
    "import",
    "backup",
    "file",
    "load",
  ],
  ),
  e(
    "backup-part-settings",
    "Settings",
    "backup",
    "백업 및 복원",
    ["restore", "preferences", "config"],
    "What to restore",
  ),
  e(
    "backup-part-search",
    "검색 사이트",
    "backup",
    "백업 및 복원",
    ["restore", "providers", "search"],
    "What to restore",
  ),
  e(
    "backup-part-feeds",
    "피드 및 규칙",
    "backup",
    "백업 및 복원",
    ["restore", "rss", "auto-download", "rules"],
    "What to restore",
  ),
  e(
    "backup-part-schedule",
    "Schedule",
    "backup",
    "백업 및 복원",
    ["restore", "timer", "night", "rules"],
    "What to restore",
  ),
  e(
    "backup-part-assistant",
    "도우미",
    "backup",
    "백업 및 복원",
    ["restore", "ai", "chat"],
    "What to restore",
  ),
  e(
    "backup-part-torrents",
    "Torrents",
    "backup",
    "백업 및 복원",
    ["restore", "transfers", "magnet", "added paused"],
    "What to restore",
  ),
  e(
    "backup-part-downloads",
    "Downloads",
    "backup",
    "백업 및 복원",
    ["restore", "files", "transfers"],
    "What to restore",
  ),

  // Browser
  e(
    "browser-ad-blocking",
    "Ad blocking",
    "browser",
    "브라우저",
    [
    "ads",
    "adblock",
    "trackers",
    "block",
    "ad block",
    "privacy",
  ],
  ),
  e(
    "browser-add-list",
    "Add list address",
    "browser",
    "브라우저",
    [
    "block list",
    "hosts",
    "domain list",
    "url",
    "https",
    "filter",
  ],
    "List addresses",
  ),
  e(
    "browser-reset-list",
    "Reset to built-in list",
    "browser",
    "브라우저",
    [
    "block list",
    "default",
    "factory",
    "built in",
  ],
    "List addresses",
  ),
  e(
    "browser-update-list",
    "Update now",
    "browser",
    "브라우저",
    [
    "block list",
    "refresh",
    "fetch",
    "ads",
    "download",
  ],
    "Block list",
  ),
  e(
    "browser-allowed-ads",
    "Sites allowed to show ads",
    "browser",
    "브라우저",
    [
    "allow",
    "whitelist",
    "ads",
    "exception",
  ],
    "Sites allowed to show ads",
  ),
  e(
    "browser-engine-duckduckgo",
    "DuckDuckGo",
    "browser",
    "브라우저",
    [
      "search engine",
      "search",
      "default",
      "ddg",
      "private",
      "change search engine",
    ],
    "Search engine",
  ),
  e(
    "browser-engine-google",
    "Google",
    "browser",
    "브라우저",
    ["search engine", "search", "default", "change search engine"],
    "Search engine",
  ),
  e(
    "browser-engine-bing",
    "Bing",
    "browser",
    "브라우저",
    ["search engine", "search", "default", "microsoft", "change search engine"],
    "Search engine",
  ),
  e(
    "browser-engine-brave",
    "Brave",
    "browser",
    "브라우저",
    ["search engine", "search", "default", "change search engine"],
    "Search engine",
  ),
  e(
    "browser-desktop-site",
    "Desktop site",
    "browser",
    "브라우저",
    [
    "desktop",
    "mobile",
    "user agent",
    "site",
    "pc",
    "request",
    "desktop mode",
    "mode",
  ],
    "Search engine",
  ),
  e(
    "browser-text-size",
    "글자 크기",
    "browser",
    "브라우저",
    [
    "zoom",
    "font",
    "larger",
    "smaller",
    "size",
    "percent",
    "big",
    "small",
  ],
    "Search engine",
  ),
  e(
    "browser-popups-ask",
    "확인 후 허용",
    "browser",
    "브라우저",
    ["pop-up", "popup", "redirect", "window", "block"],
    "Pop-ups and redirects",
  ),
  e(
    "browser-popups-block",
    "항상 차단",
    "browser",
    "브라우저",
    ["pop-up", "popup", "redirect", "window", "block"],
    "Pop-ups and redirects",
  ),
  e(
    "browser-popups-allow",
    "허용",
    "browser",
    "브라우저",
    ["pop-up", "popup", "redirect", "window", "open"],
    "Pop-ups and redirects",
  ),
  e(
    "browser-popups-sites",
    "팝업 허용 사이트",
    "browser",
    "브라우저",
    ["pop-up", "popup", "redirect", "allow", "exception"],
    "Sites allowed to open pop-ups",
  ),
  e(
    "browser-clear-data",
    "Clear browsing data",
    "browser",
    "브라우저",
    [
    "cookies",
    "cache",
    "history",
    "clear",
    "sign out",
    "site data",
    "privacy",
  ],
    "History",
  ),
  e(
    "browser-private-browsing",
    "비공개 브라우징",
    "browser",
    "브라우저",
    [
      "private",
      "incognito",
      "history",
      "cookies",
      "tabs",
      "don't save",
      "dont save",
      "open tabs",
      "forget",
      "clear on leave",
    ],
    "History",
  ),
  e(
    "browser-save-history",
    "방문 기록 저장",
    "browser",
    "브라우저",
    [
    "history",
    "record",
    "pages",
    "log",
    "browsing",
    "private",
    "private browsing",
    "incognito",
  ],
    "History",
  ),
  e(
    "browser-suggest-history",
    "방문 기록 추천",
    "browser",
    "브라우저",
    [
    "history",
    "suggestions",
    "autocomplete",
    "address bar",
    "type",
  ],
    "History",
  ),
  e(
    "browser-clear-on-close",
    "Maglev 종료 시 방문 기록 삭제",
    "browser",
    "브라우저",
    [
      "history",
      "close",
      "exit",
      "clear",
      "privacy",
      "auto",
      "private",
      "private browsing",
      "delete",
      "delete history",
      "app",
      "when app closes",
    ],
    "History",
  ),
  e(
    "browser-open-bookmarks",
    "북마크",
    "browser",
    "브라우저",
    [
    "bookmark",
    "bookmarks",
    "saved pages",
    "favourites",
    "favorites",
    "star",
    "start page",
  ],
    "History",
  ),
  e(
    "browser-open-history",
    "방문 기록",
    "browser",
    "브라우저",
    [
    "history",
    "pages",
    "visited",
    "log",
  ],
    "History",
  ),
  e(
    "browser-clear-history",
    "방문 기록 삭제",
    "browser",
    "브라우저",
    [
    "history",
    "clear",
    "clear history",
    "delete",
    "remove",
    "erase",
  ],
    "History",
  ),

  // Auto-download (feeds)
  e(
    "feeds-auto",
    "Download new items automatically",
    "feeds",
    "자동 다운로드",
    [
      "feeds",
      "rss",
      "background",
      "auto",
      "check",
      "torrents",
      "automatic",
      "new episodes",
      "episodes",
      "new items",
    ],
  ),
  e(
    "feeds-interval",
    "Check every",
    "feeds",
    "자동 다운로드",
    [
    "interval",
    "minutes",
    "how often",
    "frequency",
    "schedule",
    "timer",
  ],
  ),
  e(
    "feeds-add-rule",
    "Add rule",
    "feeds",
    "자동 다운로드",
    [
    "rule",
    "filter",
    "match",
    "include",
    "new rule",
  ],
    "Rules",
  ),
  e(
    "feeds-check-now",
    "Check now",
    "feeds",
    "자동 다운로드",
    [
    "refresh",
    "run",
    "recheck",
    "feeds",
  ],
    "Status",
  ),
  e(
    "feeds-open",
    "Open Feeds",
    "feeds",
    "자동 다운로드",
    [
    "feeds",
    "rss",
    "follow",
    "tab",
  ],
    "Rules",
  ),

  // Network
  e(
    "network-wifi-only",
    "Wi-Fi only",
    "network",
    "네트워크",
    [
    "wifi",
    "wlan",
    "wireless",
    "mobile data",
    "cellular",
    "data",
    "metered",
    "network",
    "pause",
    "download",
    "downloads",
    "download over wifi",
    "save data",
  ],
  ),
  e(
    "network-share-mobile",
    "Share on mobile data",
    "network",
    "네트워크",
    [
    "seed",
    "upload",
    "mobile data",
    "cellular",
    "wifi",
    "data",
    "sharing",
    "torrents",
    "4g",
    "5g",
    "lte",
    "share on 4g",
    "seed on mobile data",
  ],
  ),
  e(
    "network-vpn-only",
    "Only download over a VPN",
    "network",
    "네트워크",
    [
    "vpn",
    "privacy",
    "tunnel",
    "secure",
    "network",
  ],
  ),
  e(
    "network-ssid-enable",
    "Only on these networks",
    "network",
    "네트워크",
    [
    "wifi",
    "wi-fi",
    "ssid",
    "network name",
    "allow list",
    "whitelist",
    "location",
    "home",
    "home wifi",
    "home network",
  ],
  ),
  e(
    "network-ssid-add",
    "Add network name",
    "network",
    "네트워크",
    [
    "wifi",
    "wi-fi",
    "ssid",
    "network name",
    "add",
    "home",
    "home wifi",
  ],
  ),
  e(
    "network-advanced",
    "Advanced",
    "network",
    "네트워크",
    ["advanced", "port", "proxy", "dht", "upnp", "blocklist", "torrent", "peers"],
  ),
  e(
    "network-port",
    "Incoming port",
    "network-advanced",
    "Advanced network",
    [
    "port",
    "listening",
    "firewall",
    "peers",
    "connection",
  ],
    "Connection",
  ),
  e(
    "network-upnp",
    "UPnP",
    "network-advanced",
    "Advanced network",
    [
    "router",
    "port",
    "forward",
    "open port",
    "firewall",
    "upnp",
    "port forwarding",
  ],
    "Connection",
  ),
  e(
    "network-dht",
    "DHT",
    "network-advanced",
    "Advanced network",
    [
    "peers",
    "trackers",
    "distributed",
    "find peers",
    "torrent",
  ],
    "Connection",
  ),
  e(
    "network-lsd",
    "Local peer discovery",
    "network-advanced",
    "Advanced network",
    [
    "lan",
    "wifi",
    "wi-fi",
    "local",
    "peers",
    "discovery",
  ],
    "Connection",
  ),
  e(
    "network-proxy-enable",
    "SOCKS5 proxy",
    "network-advanced",
    "Advanced network",
    [
    "proxy",
    "socks",
    "socks5",
    "tunnel",
    "vpn",
  ],
    "Proxy",
  ),
  e(
    "network-proxy-host",
    "Host",
    "network-advanced",
    "Advanced network",
    [
    "proxy",
    "socks",
    "address",
    "ip",
    "server",
    "hostname",
  ],
    "Proxy",
  ),
  e(
    "network-proxy-port",
    "Port",
    "network-advanced",
    "Advanced network",
    [
    "proxy",
    "socks",
    "number",
  ],
    "Proxy",
  ),
  e(
    "network-proxy-user",
    "Username",
    "network-advanced",
    "Advanced network",
    [
    "proxy",
    "socks",
    "login",
    "user",
    "account",
  ],
    "Proxy",
  ),
  e(
    "network-proxy-pass",
    "Password",
    "network-advanced",
    "Advanced network",
    [
    "proxy",
    "socks",
    "login",
    "secret",
    "pass",
  ],
    "Proxy",
  ),
  e(
    "network-ip-blocklist",
    "Block listed IPs",
    "network-advanced",
    "Advanced network",
    [
    "ip filter",
    "blocklist",
    "block list",
    "peers",
    "firewall",
    "ip",
    "file",
  ],
    "IP blocklist",
  ),

  // Notifications
  e(
    "notifications-finished",
    "Finished-download alerts",
    "notifications",
    "알림",
    [
      "alerts",
      "notify",
      "sound",
      "banner",
      "complete",
      "done",
      "finished",
      "downloads",
      "notifs",
      "notifications",
    ],
  ),
  e(
    "notifications-progress",
    "Live progress in status bar",
    "notifications",
    "알림",
    [
      "progress",
      "status bar",
      "ongoing",
      "persistent",
      "download progress",
      "live",
      "notifs",
      "notifications",
    ],
  ),

  // Power
  e(
    "power-charging-only",
    "Charging only",
    "power",
    "전원",
    [
    "battery",
    "charging",
    "plug",
    "power",
    "charger",
    "wall",
  ],
  ),
  e(
    "power-close-when-done",
    "Close when done",
    "downloads",
    "추가 및 완료",
    [
    "exit",
    "quit",
    "shut down",
    "battery",
    "stop",
    "finish",
  ],
    "When downloads finish",
  ),
  e(
    "power-resume-restart",
    "Resume after restart",
    "downloads",
    "추가 및 완료",
    [
    "restart",
    "reboot",
    "continue",
    "boot",
    "startup",
    "resume",
  ],
    "When downloads finish",
  ),
  e(
    "power-pause-below",
    "Pause below",
    "power",
    "전원",
    [
    "battery",
    "cutoff",
    "low battery",
    "percent",
    "power",
    "threshold",
  ],
  ),

  // Scheduling
  e(
    "scheduling-use",
    "Use a schedule",
    "scheduling",
    "예약",
    [
    "timer",
    "time",
    "times",
    "pause",
    "slow",
    "set times",
    "automatic",
    "schedule",
    "downloads",
    "timetable",
    "time of day",
  ],
  ),
  e(
    "scheduling-night",
    "Only download at night",
    "scheduling",
    "예약",
    [
    "night",
    "time",
    "sleep",
    "evening",
    "morning",
    "pause daytime",
    "preset",
  ],
  ),
  e(
    "scheduling-add-rule",
    "Add rule",
    "scheduling",
    "예약",
    [
    "rule",
    "time",
    "limit",
    "pause",
    "new rule",
    "speed",
  ],
    "Rules",
  ),

  // Search sources
  e(
    "search-adult",
    "Show adult sources",
    "search-providers",
    "검색 사이트",
    [
      "adult",
      "nsfw",
      "18+",
      "explicit",
      "porn",
      "sources",
      "hide",
      "adult sites",
      "porn sites",
      "block",
    ],
    "What sources to show",
  ),
  e(
    "search-warn-unsafe",
    "Warn about risky sources",
    "search-providers",
    "검색 사이트",
    [
      "warning",
      "unsafe",
      "malware",
      "virus",
      "fake",
      "harmful",
      "safety",
      "risky",
    ],
    "What sources to show",
  ),
  e(
    "search-clear-checks",
    "Clear site checks",
    "search-providers",
    "검색 사이트",
    [
      "cloudflare",
      "captcha",
      "cookies",
      "check",
      "clearance",
      "site",
      "sign out",
    ],
    "What sources to show",
  ),
  e(
    "search-wait-slow",
    "Wait for slow sources",
    "search-providers",
    "검색 사이트",
    ["timeout", "slow", "seconds", "wait", "time", "delay", "speed"],
    "How search behaves",
  ),
  e(
    "search-results-per-source",
    "Results per source",
    "search-providers",
    "검색 사이트",
    [
      "limit",
      "count",
      "how many",
      "number",
      "results",
      "max",
      "per site",
      "per source",
    ],
    "How search behaves",
  ),
  e(
    "search-trusted-uploaders",
    "Trusted uploaders only",
    "search-providers",
    "검색 사이트",
    [
      "trusted",
      "vip",
      "fake",
      "malware",
      "pirate bay",
      "tpb",
      "safe",
      "uploader",
    ],
    "How search behaves",
  ),
  e(
    "search-hide-dead",
    "Hide dead torrents",
    "search-providers",
    "검색 사이트",
    [
      "seeds",
      "seeders",
      "dead",
      "no seeders",
      "unseeded",
      "results",
      "empty",
      "filter",
    ],
    "How search behaves",
  ),
  e(
    "search-category",
    "Show sources for",
    "search-providers",
    "검색 사이트",
    [
      "category",
      "movies",
      "tv",
      "anime",
      "music",
      "apps",
      "filter",
      "type",
      "only movies",
      "only",
    ],
    "Show sources for",
  ),
  e(
    "search-name-lines",
    "Result name lines",
    "search-providers",
    "검색 사이트",
    [
      "name",
      "title",
      "lines",
      "wrap",
      "filename",
      "results",
      "list",
      "compact",
      "two lines",
      "cut off",
      "cut",
      "truncated",
    ],
    "Results",
  ),
  e(
    "search-jackett",
    "Connect Jackett or Prowlarr",
    "search-providers",
    "검색 사이트",
    [
      "jackett",
      "prowlarr",
      "torznab",
      "indexer",
      "api key",
      "private tracker",
      "own server",
      "tracker",
    ],
    "Your own indexer",
  ),

  // Speed & queue
  e(
    "speed-download-limit",
    "Download limit",
    "speed",
    "속도 및 공유",
    [
      "bandwidth",
      "throttle",
      "cap",
      "limit",
      "speed",
      "download speed",
      "kbps",
      "mbps",
      "slow down",
    ],
    "Speed",
  ),
  e(
    "speed-upload-limit",
    "Upload limit",
    "speed",
    "속도 및 공유",
    [
      "bandwidth",
      "throttle",
      "cap",
      "limit",
      "speed",
      "upload speed",
      "seed",
      "share",
      "kbps",
      "mbps",
    ],
    "Speed",
  ),
  e(
    "speed-connections",
    "Connections per torrent",
    "speed",
    "속도 및 공유",
    [
    "peers",
    "threads",
    "connections",
    "speed",
    "parallel",
    "per torrent",
    "more",
    "more connections",
  ],
    "Speed",
  ),
  e(
    "speed-active-downloads",
    "Active downloads",
    "speed",
    "속도 및 공유",
    [
    "queue",
    "at a time",
    "concurrent",
    "simultaneous",
    "max",
    "parallel",
    "downloads",
    "at once",
    "downloads at once",
  ],
    "Queue",
  ),
  e(
    "speed-peer-timeout",
    "Stop waiting for peers after",
    "speed",
    "속도 및 공유",
    [
      "timeout",
      "peers",
      "stalled",
      "stuck",
      "waiting",
      "no one sharing",
      "never starts",
      "give up",
      "queue",
    ],
    "Queue",
  ),
  e(
    "speed-sharing-at-once",
    "Sharing at once",
    "speed",
    "속도 및 공유",
    [
    "queue",
    "seeding",
    "seed",
    "upload",
    "share",
    "at a time",
    "concurrent",
  ],
    "Queue",
  ),
  e(
    "speed-upload-until-shared",
    "Upload until shared ×N",
    "speed",
    "속도 및 공유",
    ["ratio", "seed ratio", "share ratio", "upload", "seeding", "share"],
    "Queue",
  ),
  e(
    "speed-share-for",
    "Share for at most",
    "speed",
    "속도 및 공유",
    [
    "seed time",
    "seeding",
    "hours",
    "minutes",
    "upload",
    "time",
    "stop sharing",
  ],
    "Queue",
  ),

  // Storage
  e(
    "storage-folder",
    "Download folder",
    "storage",
    "저장 공간",
    [
    "folder",
    "location",
    "sd card",
    "path",
    "directory",
    "save",
    "where",
    "storage",
    "default folder",
  ],
  ),
  e(
    "storage-change",
    "Change folder",
    "storage",
    "저장 공간",
    [
    "folder",
    "location",
    "sd card",
    "path",
    "directory",
    "pick",
    "choose",
    "browse",
    "where",
    "files",
    "where files go",
    "move downloads",
  ],
  ),
  e(
    "storage-default",
    "Use default folder",
    "storage",
    "저장 공간",
    [
    "folder",
    "location",
    "reset",
    "default",
    "path",
  ],
  ),
  e(
    "storage-add-without-asking",
    "묻지 않고 바로 추가",
    "downloads",
    "추가 및 완료",
    [
    "magnet",
    "torrent",
    "share",
    "quick add",
    "confirm",
    "skip",
    "shared links",
    "file links",
  ],
    "Adding downloads",
  ),

  // Watches
  e(
    "watch-mobile-data",
    "모바일 데이터 사용",
    "watch",
    "Watches",
    [
    "wifi",
    "wi-fi",
    "cellular",
    "data",
    "metered",
    "check",
    "watch",
  ],
  ),
  e(
    "watch-interval",
    "Check every",
    "watch",
    "Watches",
    [
    "interval",
    "hours",
    "how often",
    "frequency",
    "watch",
    "timer",
  ],
  ),
  e(
    "watch-list",
    "Watches",
    "watch",
    "Watches",
    [
    "watch",
    "titles",
    "new copies",
    "notify",
    "alerts",
    "search",
    "new episodes",
    "episodes",
  ],
  ),
  e(
    "storage-hide-gallery",
    "Hide from gallery",
    "storage",
    "저장 공간",
    ["photos", "gallery", "video", "media", "pictures", "scan", "hide", "apps"],
  ),
  e(
    "storage-offer-links",
    "Offer to download copied links",
    "downloads",
    "추가 및 완료",
    ["clipboard", "copied", "copy", "paste", "links", "magnet", "share", "ask"],
    "Adding downloads",
  ),
  e(
    "speed-parts",
    "Parts per download",
    "downloads",
    "추가 및 완료",
    ["parts", "threads", "split", "segments", "connections", "faster", "speed", "link"],
    "Link downloads",
  ),
  e(
    "speed-retry",
    "Retry failed downloads",
    "downloads",
    "추가 및 완료",
    ["retry", "again", "failed", "fail", "tries", "attempts", "error"],
    "Link downloads",
  ),
  e(
    "speed-keep-trying",
    "Keep trying",
    "downloads",
    "추가 및 완료",
    ["retry", "keep", "tries", "forever", "stop", "no peers", "after 3 tries"],
    "Link downloads",
  ),
  e(
    "licenses-read",
    "Read the licence",
    "licenses",
    "Licences",
    [
    "licence",
    "license",
    "gpl",
    "terms",
    "legal",
    "copyright",
  ],
  ),
  e(
    "licenses-built-with",
    "Built with",
    "licenses",
    "Licences",
    [
    "libraries",
    "packages",
    "credits",
    "dependencies",
    "open source",
    "software",
  ],
  ),
  e(
    "about-open-source-licence",
    "Open-source licence",
    "about",
    "앱 정보",
    [
    "licence",
    "license",
    "gpl",
    "gpl-3.0",
    "legal",
    "open source",
  ],
  ),
  e(
    "about-source-code",
    "Source code on GitHub",
    "about",
    "앱 정보",
    [
    "github",
    "code",
    "repo",
    "source",
    "open source",
  ],
  ),
  e(
    "whats-new-latest",
    "Release notes",
    "whats-new",
    "Release notes",
    [
    "what's new",
    "whats new",
    "changelog",
    "release notes",
    "changes",
    "new",
    "version",
    "update",
  ],
  ),

  // Swipe, file icons, tab swipe, stats backup, crash report, rule editor
  e(
    "appearance-swipe-actions",
    "Swipe to pause or remove",
    "interface",
    "화면 모양",
    ["swipe", "gesture", "slide", "pause", "resume", "remove", "delete", "transfers", "downloads", "list"],
  ),
  e(
    "appearance-file-icons",
    "Show file type icons in Transfers",
    "interface",
    "화면 모양",
    ["file icon", "file type", "icon", "icons", "media", "video", "audio", "kind of file", "transfers", "downloads"],
  ),
  e(
    "browser-swipe-tabs",
    "주소창을 밀어 탭 전환",
    "browser",
    "브라우저",
    ["swipe", "gesture", "slide", "address bar", "url bar", "tabs", "switch tab", "next tab", "all tabs"],
  ),
  e(
    "browser-dark-pages",
    "웹페이지 어둡게 표시",
    "browser",
    "브라우저",
    ["dark", "night", "pages", "websites", "theme", "dark mode", "darken", "browser"],
  ),
  e(
    "backup-include-stats",
    "통계 포함",
    "backup",
    "백업 및 복원",
    ["backup", "export", "stats", "statistics", "history", "downloaded", "names", "save"],
  ),
  e(
    "backup-part-stats",
    "Stats",
    "backup",
    "백업 및 복원",
    ["restore", "stats", "statistics", "history", "backup"],
    "What to restore",
  ),
  e(
    "about-copy-crash-report",
    "충돌 보고서 복사",
    "about",
    "앱 정보",
    ["crash", "error", "log", "report", "bug", "copy", "problem"],
  ),
  e(
    "feeds-rule-skip-episodes",
    "Skip episodes I already have",
    "feeds",
    "자동 다운로드",
    ["episodes", "new only", "duplicates", "already have", "rule", "tv", "series"],
    "Rules",
  ),
  e(
    "feeds-rule-start-paused",
    "Start paused",
    "feeds",
    "자동 다운로드",
    ["paused", "wait", "resume", "rule", "added torrents", "manual"],
    "Rules",
  ),
  e(
    "feeds-rule-enabled",
    "Rule is on",
    "feeds",
    "자동 다운로드",
    ["rule", "enable", "disable", "on", "off", "turn off rule"],
    "Rules",
  ),
];

const MAX_RESULTS = 30;

/**
 * Concept groups for query words. A query word that belongs to a group also matches any other member of that
 * group: "cellular" finds "Share on mobile data", "plugged" finds "Charging only". Expansion applies to query words
 * only, never to the index. Typos are not expanded. Keep groups to general concepts, never to one fixture query.
 */
export const SYNONYM_GROUPS: string[][] = [
  ["cellular", "mobile", "data", "4g", "5g", "lte"],
  ["wifi", "wlan", "wireless"],
  ["battery", "charging", "charge", "plugged", "plug", "power"],
  ["reboot", "restart", "startup", "boot", "start"],
  ["ads", "ad", "adverts", "popups", "pop-ups"],
  ["web", "website", "websites", "page", "pages", "browser", "site"],
  ["big", "bigger", "large", "size", "text", "zoom"],
  ["hot", "heat", "temperature", "battery", "power"],
  ["night", "nighttime", "overnight", "schedule"],
  ["speed", "fast", "slow", "bandwidth", "bw", "throttle", "limit"],
  ["share", "seed", "seeding", "upload"],
  ["adult", "nsfw", "porn", "18"],
  ["folder", "location", "path", "directory", "storage", "sd"],
  ["notifications", "notifs", "alerts"],
  ["theme", "dark", "light", "oled", "colour", "color", "accent"],
  ["ai", "assistant", "chat", "language", "model"],
];

/**
 * Filler words that carry no meaning for a setting search. "stop" and "use" are dropped too,
 * because no setting is titled that way. "change", "only", "off" and "night" stay: they name things.
 */
const STOP_WORDS = new Set([
  "a", "after", "an", "and", "any", "are", "at", "be", "by", "can", "do", "does", "for", "from", "get",
  "how", "i", "in", "is", "it", "make", "many", "me", "my", "of", "on", "over", "please", "set", "stop",
  "the", "this", "that", "to", "too", "turn", "use", "using", "want", "when", "will", "with", "you",
]);

/** Lowercase and drop every character that is not a letter or digit, so "Wi-Fi", "wi fi" and "wifi" match alike. */
function norm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9À-￿]/g, "");
}

/** Consonant pair left by a suffix ("plugg" -> "plug"). l, s, f and z keep their pair ("call", "pass"). */
function collapseDouble(s: string): string {
  const last = s[s.length - 1];
  if (s.length >= 2 && last === s[s.length - 2] && !"aeioulsfz".includes(last)) {
    return s.slice(0, -1);
  }
  return s;
}

/**
 * Light stemming, applied to query words and index words alike. Strips -ies (to -y), -ing, -ed, -es after a
 * sibilant, -er and -s, only when the stem keeps 4 or more letters. A final "e" is then dropped from stems over
 * 4 letters, so "share", "shared" and "sharing" all become "shar".
 */
export function stem(raw: string): string {
  const w = raw;
  let s = w;
  if (w.endsWith("ies") && w.length - 3 >= 4) s = `${w.slice(0, -3)}y`;
  else if (w.endsWith("ing") && w.length - 3 >= 4) s = collapseDouble(w.slice(0, -3));
  else if (w.endsWith("ed") && w.length - 2 >= 4) s = collapseDouble(w.slice(0, -2));
  else if (w.endsWith("er") && w.length - 2 >= 4) s = collapseDouble(w.slice(0, -2));
  else if (/(s|x|z|ch|sh)es$/.test(w) && w.length - 2 >= 4) s = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss") && w.length - 1 >= 4) s = w.slice(0, -1);
  return s.length > 4 && s.endsWith("e") ? s.slice(0, -1) : s;
}

/** Stem -> stems of the other members of every group that contains it. Built once. */
const SYNONYMS = new Map<string, Set<string>>();
for (const group of SYNONYM_GROUPS) {
  const forms = group.map((g) => stem(norm(g)));
  for (const f of forms) {
    const set = SYNONYMS.get(f) ?? new Set<string>();
    for (const other of forms) if (other !== f) set.add(other);
    SYNONYMS.set(f, set);
  }
}

/** A field split into stemmed words. `flat` is the words joined, so a long word can match across a hyphen. */
interface Part {
  words: string[];
  flat: string;
}

function partOf(text: string): Part {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map(norm)
    .filter(Boolean)
    .map(stem);
  return { words, flat: words.join("") };
}

interface Fields {
  title: Part;
  keywords: Part[];
  /** Section and page name. Never fuzzy-matched. */
  place: Part;
  /** Title and keyword words of 3+ letters, the only words a typo can match. */
  tokens: string[];
}

const fieldCache = new WeakMap<SettingEntry, Fields>();

function fieldsOf(entry: SettingEntry): Fields {
  let f = fieldCache.get(entry);
  if (!f) {
    const title = partOf(entry.title);
    const keywords = entry.keywords.map(partOf);
    const place = partOf(`${entry.section ?? ""} ${entry.pageTitle}`);
    const tokens = [title, ...keywords]
      .flatMap((p) => p.words)
      .filter((t) => t.length >= 3);
    f = { title, keywords, place, tokens };
    fieldCache.set(entry, f);
  }
  return f;
}

/** True when a stemmed query word occurs in a field. Words over 3 letters match anywhere; shorter ones match a word start. */
function partMatch(part: Part, q: string): boolean {
  if (q.length > 3) return part.flat.includes(q);
  return part.words.some((w) => w.startsWith(q));
}

/** Optimal string alignment distance: insertions, deletions, substitutions and adjacent swaps. */
function editDistance(a: string, b: string): number {
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Typo rule on stems. Words of 7+ letters may be 2 edits from a title or keyword word, 4-6 letters 1 edit.
 * A 3-letter word matches a 4-letter word when deleting one letter from that word gives it ("wfi" -> "wifi").
 */
function typoMatch(q: string, token: string): boolean {
  const max = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  if (max > 0) return editDistance(q, token) <= max;
  if (q.length === 3 && token.length === 4) {
    for (let i = 0; i < token.length; i++) {
      if (token.slice(0, i) + token.slice(i + 1) === q) return true;
    }
  }
  return false;
}

/**
 * Where one stemmed word matches directly: 0 title starts with it, 1 title contains it, 2 keyword,
 * 3 section or page. -1 when it does not match.
 */
function directTier(f: Fields, q: string): number {
  if (f.title.flat.startsWith(q)) return 0;
  if (partMatch(f.title, q)) return 1;
  if (f.keywords.some((k) => partMatch(k, q))) return 2;
  if (partMatch(f.place, q)) return 3;
  return -1;
}

/**
 * Where a synonym (a member of the query word's group) matches. Short members must equal a whole word, so "ad"
 * finds "Ad blocking" but not "Add rule". A synonym never ranks above a direct keyword match (tier 2), so a word
 * typed as itself always outranks the same word found only through its group.
 */
function memberTier(f: Fields, m: string): number {
  if (m.length <= 3) {
    if (f.title.words.includes(m) || f.keywords.some((k) => k.words.includes(m))) return 2.5;
    if (f.place.words.includes(m)) return 3.5;
    return -1;
  }
  const t = directTier(f, m);
  return t < 0 ? -1 : Math.max(t + 0.5, 2.5);
}

/**
 * Best tier of one query word against an entry, or -1. Tiers: 0 title start, 1 title contains, 2 keyword,
 * 3 section or page, 4 typo, and +0.5 for a synonym. With `expand`, the word's concept group is tried too.
 */
function wordTier(f: Fields, raw: string, expand: boolean): number {
  const q = stem(raw);
  let best = directTier(f, q);
  if (best < 0 && f.tokens.some((t) => typoMatch(q, t))) best = 4;
  if (expand) {
    for (const m of SYNONYMS.get(q) ?? []) {
      const t = memberTier(f, m);
      if (t >= 0 && (best < 0 || t < best)) best = t;
    }
  }
  return best;
}

interface Score {
  /** Query words that matched the entry. More is better. */
  matched: number;
  /** Matched words at title level (tier 0 or 1, synonyms included). More is better. */
  titleHits: number;
  /** Worst tier among the matched words. Lower is better. */
  worst: number;
  titleLength: number;
  order: number;
}

function better(a: Score, b: Score): boolean {
  if (a.matched !== b.matched) return a.matched > b.matched;
  if (a.titleHits !== b.titleHits) return a.titleHits > b.titleHits;
  if (a.worst !== b.worst) return a.worst < b.worst;
  if (a.titleLength !== b.titleLength) return a.titleLength < b.titleLength;
  return a.order < b.order;
}

/**
 * Settings whose title, keywords, section or page match the query.
 *
 * Filler words are dropped first (a query made only of filler words keeps its words). Words of 1-2 letters are
 * ignored unless they are the whole query. Each remaining word matches when it hits the entry directly, through its
 * synonym group, or as a typo. Soft AND: an entry qualifies when it matches at least ceil(words / 2) of them (and at
 * least one), so a single-word query must match that word. The whole query with spaces removed is also tried ("wi fi").
 *
 * Ranking: more matched words first, then more matched words at title level, then the better worst match
 * (title > keyword > section or page > synonym and typo), then the shorter title, then index order. At most 30.
 */
export function searchSettings(
  query: string,
  index: SettingEntry[] = SETTINGS_INDEX,
): SettingEntry[] {
  const spaced = query.toLowerCase().trim();
  if (!spaced) return [];
  const all = spaced.split(/\s+/).map(norm).filter(Boolean);
  if (all.length === 0) return [];
  const kept = all.filter((w) => !STOP_WORDS.has(w));
  const content = kept.length > 0 ? kept : all;
  const matchable =
    content.length === 1
      ? content
      : content.filter((w) => w.length >= 3 || /\d/.test(w));
  const need =
    matchable.length === 2 ? 2 : Math.max(1, Math.ceil(matchable.length / 2));
  const joined = norm(spaced);

  const scored: { entry: SettingEntry; score: Score }[] = [];
  index.forEach((entry, order) => {
    const f = fieldsOf(entry);
    const titleLength = norm(entry.title).length;
    let best: Score | null = null;

    if (matchable.length > 0) {
      let matched = 0;
      let titleHits = 0;
      let worst = -1;
      for (const word of matchable) {
        const tier = wordTier(f, word, true);
        if (tier < 0) continue;
        matched++;
        if (tier <= 1) titleHits++;
        worst = Math.max(worst, tier);
      }
      if (matched >= need) best = { matched, titleHits, worst, titleLength, order };
    }

    if (all.length > 1) {
      const tier = wordTier(f, joined, false);
      if (tier >= 0) {
        const candidate: Score = {
          matched: all.length,
          titleHits: tier <= 1 ? all.length : 0,
          worst: tier,
          titleLength,
          order,
        };
        if (!best || better(candidate, best)) best = candidate;
      }
    }

    if (best) scored.push({ entry, score: best });
  });

  scored.sort((a, b) =>
    better(a.score, b.score) ? -1 : better(b.score, a.score) ? 1 : 0,
  );
  return scored.slice(0, MAX_RESULTS).map((s) => s.entry);
}
