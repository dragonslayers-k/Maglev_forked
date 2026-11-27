# PR #1 changed-file inventory — 2026-11-27

Source: GitHub PR #1 files API, head `6a03adf6b3e6b6fc41fa32c039a04a60b0d38a6e`, base `baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3`.

- Total changed files: 230; additions 16689; deletions 2516.
- GitHub PR metadata reports 740 commits. The PR commits endpoint returned only 250 commit records (API listing cap); therefore this file list is complete, but commit history listing is partial and must not be described as all 740.
- This is an inventory, not a keep/revert decision. Each file still needs source diff and baseline test review.

## Scope summary

| Area | Files | + | − |
|---|---:|---:|---:|
| CI/workflows | 3 | 195 | 35 |
| Root/package | 6 | 144 | 13 |
| Application screens/navigation | 22 | 905 | 745 |
| UI components | 35 | 300 | 247 |
| Shared utilities/localization | 11 | 1902 | 966 |
| Documentation | 23 | 4950 | 0 |
| Expo/native engine module | 33 | 3556 | 126 |
| Rust/Go native core | 15 | 3640 | 3 |
| Expo config plugins | 7 | 207 | 15 |
| Test scripts | 75 | 890 | 366 |

## Complete changed-file list

| Area | File | Status | + | − |
|---|---|---|---:|---:|
| CI/workflows | `.github/workflows/ci.yml` | modified | 70 | 27 |
| CI/workflows | `.github/workflows/monthly-upstream-review.yml` | added | 96 | 0 |
| CI/workflows | `.github/workflows/release-apk.yml` | modified | 29 | 8 |
| Root/package | `README.md` | modified | 4 | 2 |
| Root/package | `README_KO.md` | added | 104 | 0 |
| Root/package | `app.json` | modified | 14 | 5 |
| Application screens/navigation | `app/(tabs)/_layout.tsx` | modified | 10 | 16 |
| Application screens/navigation | `app/(tabs)/assistant.tsx` | removed | 0 | 95 |
| Application screens/navigation | `app/(tabs)/feeds.tsx` | modified | 14 | 14 |
| Application screens/navigation | `app/(tabs)/index.tsx` | modified | 6 | 6 |
| Application screens/navigation | `app/(tabs)/search.tsx` | modified | 28 | 28 |
| Application screens/navigation | `app/(tabs)/settings.tsx` | modified | 31 | 36 |
| Application screens/navigation | `app/+native-intent.tsx` | modified | 8 | 1 |
| Application screens/navigation | `app/_layout.tsx` | modified | 8 | 7 |
| Application screens/navigation | `app/add-download.tsx` | modified | 41 | 8 |
| Application screens/navigation | `app/browser.tsx` | modified | 134 | 30 |
| Application screens/navigation | `app/settings/about.tsx` | modified | 45 | 21 |
| Application screens/navigation | `app/settings/assistant.tsx` | removed | 0 | 55 |
| Application screens/navigation | `app/settings/backup.tsx` | modified | 1 | 1 |
| Application screens/navigation | `app/settings/interface.tsx` | modified | 21 | 20 |
| Application screens/navigation | `app/settings/network-advanced.tsx` | modified | 29 | 29 |
| Application screens/navigation | `app/settings/network.tsx` | modified | 8 | 0 |
| Application screens/navigation | `app/settings/search-providers.tsx` | modified | 35 | 35 |
| Application screens/navigation | `app/settings/subtitles.tsx` | modified | 1 | 1 |
| Application screens/navigation | `app/settings/updates.tsx` | modified | 46 | 318 |
| Application screens/navigation | `app/settings/wireguard.tsx` | added | 120 | 0 |
| Application screens/navigation | `app/stats.tsx` | modified | 25 | 24 |
| Application screens/navigation | `app/youtube-download.tsx` | added | 294 | 0 |
| Root/package | `babel.config.js` | added | 7 | 0 |
| UI components | `components/HeaderBar.tsx` | modified | 11 | 2 |
| UI components | `components/StarPrompt.tsx` | removed | 0 | 79 |
| UI components | `components/assistant/provider/ExperimentalTag.tsx` | modified | 2 | 2 |
| UI components | `components/assistant/provider/ProviderSection.tsx` | modified | 8 | 8 |
| UI components | `components/browser/FloatingSheet.tsx` | modified | 2 | 2 |
| UI components | `components/browser/FoundDownload.tsx` | modified | 7 | 7 |
| UI components | `components/browser/FoundTray.tsx` | modified | 1 | 1 |
| UI components | `components/browser/MediaMenu.tsx` | modified | 7 | 2 |
| UI components | `components/browser/SaveToRow.tsx` | modified | 4 | 4 |
| UI components | `components/browser/StreamSheet.tsx` | modified | 42 | 7 |
| UI components | `components/browser/foundFilter.ts` | modified | 27 | 10 |
| UI components | `components/browser/pageUrlOption.ts` | modified | 1 | 1 |
| UI components | `components/browser/startFound.ts` | modified | 27 | 4 |
| UI components | `components/search-providers/ProviderSheet.tsx` | modified | 16 | 16 |
| UI components | `components/search-providers/TorznabSheet.tsx` | modified | 6 | 6 |
| UI components | `components/settings/AppIconSection.tsx` | modified | 7 | 4 |
| UI components | `components/settings/DensitySheet.tsx` | modified | 10 | 10 |
| UI components | `components/settings/SettingsParts.tsx` | modified | 5 | 4 |
| UI components | `components/settings/StarTicket.tsx` | modified | 13 | 17 |
| UI components | `components/settings/Wordmark.tsx` | modified | 9 | 6 |
| UI components | `components/stats/StatCard.tsx` | modified | 3 | 2 |
| UI components | `components/tabs/TabsSection.tsx` | modified | 8 | 11 |
| UI components | `components/tabs/tabPrefs.ts` | modified | 6 | 10 |
| UI components | `components/ui/Banner.tsx` | modified | 4 | 3 |
| UI components | `components/ui/Button.tsx` | modified | 3 | 2 |
| UI components | `components/ui/Chip.tsx` | modified | 3 | 2 |
| UI components | `components/ui/EmptyBlock.tsx` | modified | 3 | 2 |
| UI components | `components/ui/KoreanText.tsx` | added | 35 | 0 |
| UI components | `components/ui/ListRow.tsx` | modified | 7 | 6 |
| UI components | `components/ui/RadioCard.tsx` | modified | 4 | 3 |
| UI components | `components/ui/Screen.tsx` | modified | 3 | 2 |
| UI components | `components/ui/SectionHeader.tsx` | modified | 3 | 2 |
| UI components | `components/ui/SegmentedControl.tsx` | modified | 3 | 2 |
| UI components | `components/ui/Sheet.tsx` | modified | 3 | 2 |
| UI components | `components/ui/TextField.tsx` | modified | 7 | 6 |
| Shared utilities/localization | `constants/appIcons.ts` | modified | 4 | 0 |
| Shared utilities/localization | `constants/bookmarkCopy.ts` | modified | 33 | 33 |
| Shared utilities/localization | `constants/copy.ts` | modified | 428 | 432 |
| Shared utilities/localization | `constants/korean.ts` | added | 815 | 0 |
| Documentation | `docs/CI707_RUNTIME_FAILURE_TRIAGE_KO.md` | added | 124 | 0 |
| Documentation | `docs/COMPREHENSIVE_DEVELOPMENT_KICKOFF_KO.md` | added | 521 | 0 |
| Documentation | `docs/FEATURE_PRESERVATION_AND_PROTECTED_MEDIA_KO.md` | added | 99 | 0 |
| Documentation | `docs/FINAL_SOURCE_IMPLEMENTATION_MATRIX_KO.md` | added | 84 | 0 |
| Documentation | `docs/GALAXY_TEST_PLAN_KO.md` | added | 61 | 0 |
| Documentation | `docs/IMPLEMENTATION_AUDIT_AND_REPAIR_PLAN_KO.md` | added | 86 | 0 |
| Documentation | `docs/INTEGRATED_FEATURE_AUDIT_AND_PORTING_PLAN_KO.md` | added | 147 | 0 |
| Documentation | `docs/INTEGRATED_PRODUCT_PLAN_KO.md` | added | 98 | 0 |
| Documentation | `docs/LJ_ANALYSIS_REVIEW_KO.md` | added | 82 | 0 |
| Documentation | `docs/MAGLEV_PLUS_SOURCE_REGISTER_KO.md` | added | 47 | 0 |
| Documentation | `docs/MASTER_MEDIA_DOWNLOADER_SPEC_KO.md` | added | 196 | 0 |
| Documentation | `docs/MPMUX_BENCHMARK_INTEGRATION_KO.md` | added | 111 | 0 |
| Documentation | `docs/PR1_REVIEW_AND_FIXLOG_KO.md` | added | 58 | 0 |
| Documentation | `docs/PRODUCT_TARGET_KO.md` | added | 122 | 0 |
| Documentation | `docs/PROJECT_HANDOFF_KO.md` | added | 265 | 0 |
| Documentation | `docs/PROJECT_HANDOFF_MAGLEV_PLUS_KO.md` | added | 68 | 0 |
| Documentation | `docs/PROJECT_HANDOVER_KO.md` | added | 78 | 0 |
| Documentation | `docs/REDESIGN_UPSTREAM_CAPABILITY_GROWTH_KO.md` | added | 176 | 0 |
| Documentation | `docs/RELEASE_ACCEPTANCE_MEDIA_VPN_BARREL_KO.md` | added | 64 | 0 |
| Documentation | `docs/ROADMAP.md` | added | 85 | 0 |
| Documentation | `docs/STREAM_DETECTION_CONTRACT_KO.md` | added | 106 | 0 |
| Documentation | `docs/UPSTREAM_SYNC_POLICY_KO.md` | added | 88 | 0 |
| Documentation | `docs/reference/Barrel_1.1.2_APK_심층_분석_다운로드_기능_이식_설계서.md` | added | 2184 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/build.gradle` | modified | 21 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/consumer-rules.pro` | modified | 13 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/AndroidManifest.xml` | modified | 7 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/assets/po_token.html` | added | 129 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/EngineHost.kt` | modified | 214 | 20 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/MaglevEngineModule.kt` | modified | 87 | 41 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/appicon/AppIconManager.kt` | modified | 2 | 2 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/FoundClassifier.kt` | modified | 55 | 2 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/MaglevBrowserView.kt` | modified | 324 | 14 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/PageScan.kt` | modified | 152 | 18 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/YouTubeUrl.kt` | added | 87 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/player/MaglevMediaPlayerActivity.kt` | added | 253 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/service/StorageGuard.kt` | modified | 2 | 2 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/share/QuickShareActivity.kt` | modified | 9 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/share/QuickShareText.kt` | modified | 20 | 20 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/update/AppUpdater.kt` | modified | 2 | 2 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/watch/MaglevWatchModule.kt` | modified | 87 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/wireguard/NativeTunnel.java` | added | 25 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/wireguard/WireGuardController.kt` | added | 181 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/wireguard/WireGuardProfileStore.java` | added | 192 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/MediaContainerConverter.kt` | added | 106 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/NewPipeYoutube.kt` | added | 276 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/YoutubeDownload.kt` | added | 452 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/potoken/JavascriptUtil.kt` | added | 133 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/potoken/NewPipePoTokenGenerator.kt` | added | 127 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/potoken/PoTokenWebView.kt` | added | 319 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/test/java/com/maglev/engine/browser/FoundClassifierTest.kt` | modified | 34 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/test/java/com/maglev/engine/browser/PageScanTest.kt` | added | 51 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/test/java/com/maglev/engine/browser/YouTubeUrlTest.kt` | added | 73 | 0 |
| Expo/native engine module | `modules/maglev-engine/android/src/test/java/com/maglev/engine/service/StorageGuardTest.kt` | modified | 2 | 2 |
| Expo/native engine module | `modules/maglev-engine/src/MaglevEngine.types.ts` | modified | 45 | 0 |
| Expo/native engine module | `modules/maglev-engine/src/MaglevMockEngine.ts` | modified | 26 | 0 |
| Expo/native engine module | `modules/maglev-engine/src/MaglevNativeBridge.ts` | modified | 50 | 3 |
| Rust/Go native core | `native/maglev-core/src/config.rs` | modified | 17 | 3 |
| Rust/Go native core | `native/wireguard/README.md` | added | 200 | 0 |
| Rust/Go native core | `native/wireguard/cmd/jni/jni.c` | added | 139 | 0 |
| Rust/Go native core | `native/wireguard/cmd/jni/main.go` | added | 94 | 0 |
| Rust/Go native core | `native/wireguard/config.go` | added | 346 | 0 |
| Rust/Go native core | `native/wireguard/config_test.go` | added | 255 | 0 |
| Rust/Go native core | `native/wireguard/engine.go` | added | 340 | 0 |
| Rust/Go native core | `native/wireguard/engine_test.go` | added | 483 | 0 |
| Rust/Go native core | `native/wireguard/go.mod` | added | 17 | 0 |
| Rust/Go native core | `native/wireguard/go.sum` | added | 16 | 0 |
| Rust/Go native core | `native/wireguard/lifecycle_test.go` | added | 117 | 0 |
| Rust/Go native core | `native/wireguard/netstack/tun.go` | added | 1081 | 0 |
| Rust/Go native core | `native/wireguard/proxy.go` | added | 214 | 0 |
| Rust/Go native core | `native/wireguard/proxy_test.go` | added | 185 | 0 |
| Rust/Go native core | `native/wireguard/shutdown_test.go` | added | 136 | 0 |
| Root/package | `package-lock.json` | modified | 3 | 3 |
| Root/package | `package.json` | modified | 12 | 3 |
| Expo config plugins | `plugins/babel-plugin-korean-text.js` | added | 40 | 0 |
| Expo config plugins | `plugins/withAbiSplits.js` | modified | 9 | 9 |
| Expo config plugins | `plugins/withAppIcons.js` | modified | 25 | 1 |
| Expo config plugins | `plugins/withJitpackRepository.js` | added | 88 | 0 |
| Expo config plugins | `plugins/withPictureInPicture.js` | added | 28 | 0 |
| Expo config plugins | `plugins/withShareIntents.js` | modified | 2 | 2 |
| Expo config plugins | `plugins/withSizeReduction.js` | modified | 15 | 3 |
| Test scripts | `scripts/build-app-icons.py` | modified | 7 | 2 |
| Test scripts | `scripts/test-016-more.js` | modified | 3 | 3 |
| Test scripts | `scripts/test-032-ui.js` | modified | 15 | 4 |
| Test scripts | `scripts/test-a11y-015.js` | modified | 8 | 8 |
| Test scripts | `scripts/test-abi-splits.js` | modified | 27 | 10 |
| Test scripts | `scripts/test-about-extras.js` | modified | 4 | 1 |
| Test scripts | `scripts/test-about-updates.js` | modified | 13 | 23 |
| Test scripts | `scripts/test-add-flow.js` | modified | 3 | 2 |
| Test scripts | `scripts/test-add-menu.js` | modified | 1 | 1 |
| Test scripts | `scripts/test-app-icons.js` | modified | 4 | 4 |
| Test scripts | `scripts/test-app-identity.js` | added | 27 | 0 |
| Test scripts | `scripts/test-app-wireguard-isolation.js` | added | 24 | 0 |
| Test scripts | `scripts/test-backup.js` | modified | 1 | 1 |
| Test scripts | `scripts/test-bookmarks-screen.js` | modified | 3 | 3 |
| Test scripts | `scripts/test-browser-batch.js` | modified | 6 | 6 |
| Test scripts | `scripts/test-browser-contract.js` | modified | 19 | 0 |
| Test scripts | `scripts/test-browser-find.js` | modified | 2 | 2 |
| Test scripts | `scripts/test-browser-found-files.js` | modified | 10 | 0 |
| Test scripts | `scripts/test-browser-history-ui.js` | modified | 3 | 3 |
| Test scripts | `scripts/test-browser-integration.js` | modified | 8 | 5 |
| Test scripts | `scripts/test-browser-overlay.js` | modified | 2 | 2 |
| Test scripts | `scripts/test-browser-tabs-ui.js` | modified | 6 | 4 |
| Test scripts | `scripts/test-browser-transfers.js` | modified | 3 | 3 |
| Test scripts | `scripts/test-browser-tray-video-first.js` | modified | 1 | 1 |
| Test scripts | `scripts/test-browser-ui.js` | modified | 17 | 2 |
| Test scripts | `scripts/test-copy-voice.js` | modified | 1 | 1 |
| Test scripts | `scripts/test-crash-safety.js` | modified | 3 | 2 |
| Test scripts | `scripts/test-engine-context.js` | modified | 3 | 2 |
| Test scripts | `scripts/test-engine-restart.js` | modified | 4 | 4 |
| Test scripts | `scripts/test-font-style.js` | modified | 4 | 4 |
| Test scripts | `scripts/test-highlights.js` | modified | 4 | 4 |
| Test scripts | `scripts/test-in-app-player-contract.js` | added | 66 | 0 |
| Test scripts | `scripts/test-korean-text.js` | added | 48 | 0 |
| Test scripts | `scripts/test-logo-light.js` | modified | 5 | 0 |
| Test scripts | `scripts/test-media-hit.js` | modified | 8 | 6 |
| Test scripts | `scripts/test-name-lines-move.js` | modified | 8 | 8 |
| Test scripts | `scripts/test-off-sources.js` | modified | 6 | 6 |
| Test scripts | `scripts/test-onboarding-motion.js` | modified | 1 | 1 |
| Test scripts | `scripts/test-p3-reality-contracts.js` | modified | 1 | 1 |
| Test scripts | `scripts/test-page-url-sent.js` | modified | 11 | 3 |
| Test scripts | `scripts/test-page-url.js` | modified | 1 | 1 |
| Test scripts | `scripts/test-play-storage.js` | modified | 4 | 4 |
| Test scripts | `scripts/test-plugins.js` | modified | 30 | 0 |
| Test scripts | `scripts/test-private-browsing.js` | modified | 2 | 2 |
| Test scripts | `scripts/test-process-text.js` | modified | 3 | 3 |
| Test scripts | `scripts/test-quick-share.js` | modified | 3 | 3 |
| Test scripts | `scripts/test-search-skeleton.js` | modified | 1 | 1 |
| Test scripts | `scripts/test-search-title-lines.js` | modified | 2 | 2 |
| Test scripts | `scripts/test-search-ux.js` | modified | 6 | 6 |
| Test scripts | `scripts/test-settings-coverage.js` | modified | 13 | 4 |
| Test scripts | `scripts/test-settings-groups.js` | modified | 18 | 14 |
| Test scripts | `scripts/test-settings-regroup.js` | modified | 21 | 30 |
| Test scripts | `scripts/test-settings-search.js` | modified | 19 | 9 |
| Test scripts | `scripts/test-share-mobile.js` | modified | 3 | 3 |
| Test scripts | `scripts/test-star-prompt.js` | modified | 7 | 10 |
| Test scripts | `scripts/test-start-found-naver.js` | added | 11 | 0 |
| Test scripts | `scripts/test-stats-delight.js` | modified | 3 | 3 |
| Test scripts | `scripts/test-stats-screen.js` | modified | 1 | 1 |
| Test scripts | `scripts/test-subtitle-requests.js` | modified | 14 | 14 |
| Test scripts | `scripts/test-subtitle-season.js` | modified | 17 | 17 |
| Test scripts | `scripts/test-subtitles-flow.js` | modified | 24 | 24 |
| Test scripts | `scripts/test-subtitles-row.js` | modified | 23 | 23 |
| Test scripts | `scripts/test-subtitles-settings.js` | modified | 7 | 7 |
| Test scripts | `scripts/test-subtitles.js` | modified | 8 | 8 |
| Test scripts | `scripts/test-tab-prefs.js` | modified | 14 | 14 |
| Test scripts | `scripts/test-textfield.js` | modified | 2 | 2 |
| Test scripts | `scripts/test-ui-edges.js` | modified | 1 | 1 |
| Test scripts | `scripts/test-update-native.js` | modified | 7 | 7 |
| Test scripts | `scripts/test-update.js` | modified | 4 | 4 |
| Test scripts | `scripts/test-url-download.js` | modified | 51 | 0 |
| Test scripts | `scripts/test-ux-014-adds.js` | modified | 2 | 2 |
| Test scripts | `scripts/test-ux-014-search-feeds.js` | modified | 2 | 2 |
| Test scripts | `scripts/test-ux-015.js` | modified | 13 | 13 |
| Test scripts | `scripts/test-youtube-format-selector.js` | added | 28 | 0 |
| Test scripts | `scripts/test-youtube-intents.js` | added | 135 | 0 |
| Shared utilities/localization | `utils/browser/mediaHit.ts` | modified | 41 | 18 |
| Shared utilities/localization | `utils/browser/naverClip.ts` | added | 114 | 0 |
| Shared utilities/localization | `utils/browser/openBrowser.ts` | modified | 1 | 1 |
| Shared utilities/localization | `utils/browser/youtube.ts` | added | 79 | 0 |
| Shared utilities/localization | `utils/settingsIndex.ts` | modified | 267 | 364 |
| Shared utilities/localization | `utils/subtitles/copy.ts` | modified | 118 | 116 |
| Shared utilities/localization | `utils/update/check.ts` | modified | 2 | 2 |

## Review flags from inventory

- The diff includes product-wide scope beyond downloader-only code: assistant-related screen/component removal, update screen rewrite, app identity/branding, localization, settings/navigation, workflow/release changes, media/player/WG, native Go/Rust, and extensive docs/tests.
- Presence in this diff does not imply approval or correctness. Review against explicit user requests and baseline behavior.
- Do not blanket revert: isolate file-level regression, preserve known-good behavior, and add/retain tests.
