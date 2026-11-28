// Expo config plugin: alternate launcher icons (Settings > Appearance > App icon).
//
// Android switches the launcher icon by enabling one <activity-alias> and disabling the others
// (PackageManager.setComponentEnabledSetting). So at prebuild this plugin:
//   1. copies the generated drawables, colours and mipmaps from assets/app-icons/ (scripts/build-app-icons.py) into
//      android/app/src/main/res/, and
//   2. moves MainActivity's MAIN/LAUNCHER intent filter onto one alias per icon. MainActivity keeps every
//      other filter (maglev:// links, magnet:, .torrent, share), so deep links and shares are unaffected.
//      Only the default icon (teal) starts enabled.
// The Kotlin side (modules/maglev-engine/.../appicon/AppIconManager.kt) carries the same id list and the same
// alias names. scripts/test-app-icons.js fails when the two drift.
// Docs: https://developer.android.com/guide/topics/manifest/activity-alias-element
//       https://developer.android.com/reference/android/content/pm/PackageManager#setComponentEnabledSetting(android.content.ComponentName,%20int,%20int)
//       https://docs.expo.dev/config-plugins/plugins-and-mods/ (withAndroidManifest, withDangerousMod)

/** The 20 icons, in picker order. Must match constants/appIcons.ts. */
const ICON_IDS = [
  'teal', 'all-dark', 'lime', 'cyan', 'mono', 'mono-black', 'mono-white', 'mono-gray',
  'm-keycap-teal', 'm-keycap-lime', 'm-keycap-light', 'm-keycap-mono', 'm-keycap-cyan',
  'm-bare-lime', 'm-bare-teal', 'm-bare-mono', 'nose', 'dash', 'crt', 'amber',
];
const DEFAULT_ICON = 'teal';
const PACKAGE = 'com.maglev.plus';
const RES_PREFIX = 'ic_launcher_alt_';
const RES_DIRS = ['drawable', 'mipmap-anydpi', 'mipmap-anydpi-v26', 'values'];

const resName = (id) => RES_PREFIX + id.replace(/-/g, '_');
/** Fully qualified, so it does not depend on how the manifest package is resolved. */
const aliasName = (id) => `${PACKAGE}.MaglevIcon_${id.replace(/-/g, '_')}`;

const isLauncherFilter = (f) =>
  (f.action || []).some((a) => a.$ && a.$['android:name'] === 'android.intent.action.MAIN') &&
  (f.category || []).some((c) => c.$ && c.$['android:name'] === 'android.intent.category.LAUNCHER');

function buildAlias(id) {
  return {
    $: {
      'android:name': aliasName(id),
      'android:targetActivity': '.MainActivity',
      'android:enabled': id === DEFAULT_ICON ? 'true' : 'false',
      'android:exported': 'true',
      'android:icon': `@mipmap/${resName(id)}`,
      'android:roundIcon': `@mipmap/${resName(id)}`,
      'android:label': '@string/app_name',
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      },
    ],
  };
}

/** Pure transform for the parsed manifest (`modResults`). Idempotent. Throws when MainActivity is missing. */
function applyManifest(manifest) {
  const app = manifest.manifest.application[0];
  const main = (app.activity || []).find((a) => a.$ && a.$['android:name'] === '.MainActivity');
  if (!main) throw new Error('withAppIcons: .MainActivity not found in the manifest');
  main['intent-filter'] = (main['intent-filter'] || []).filter((f) => !isLauncherFilter(f));
  const mine = new Set(ICON_IDS.map(aliasName));
  const others = (app['activity-alias'] || []).filter((a) => !(a.$ && mine.has(a.$['android:name'])));
  app['activity-alias'] = [...others, ...ICON_IDS.map(buildAlias)];
  return manifest;
}

function withAppIcons(config) {
  const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
  const fs = require('fs');
  const path = require('path');
  config = withAndroidManifest(config, (c) => {
    c.modResults = applyManifest(c.modResults);
    return c;
  });
  config = withDangerousMod(config, [
    'android',
    (c) => {
      const from = path.join(c.modRequest.projectRoot, 'assets', 'app-icons');
      const res = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      for (const dir of RES_DIRS) {
        const src = path.join(from, dir);
        if (!fs.existsSync(src)) throw new Error(`withAppIcons: ${src} is missing. Run scripts/build-app-icons.py.`);
        fs.mkdirSync(path.join(res, dir), { recursive: true });
        // Drop what an earlier prebuild left, so renamed or merged drawables do not pile up.
        for (const old of fs.readdirSync(path.join(res, dir))) {
          if (old.startsWith(RES_PREFIX)) fs.rmSync(path.join(res, dir, old));
        }
        for (const file of fs.readdirSync(src)) {
          if (file.startsWith(RES_PREFIX)) fs.copyFileSync(path.join(src, file), path.join(res, dir, file));
        }
      }
      // Maglev+ identity badge: keep the upstream train mark intact and add a distinct top-right plus.
      const badgeCircle = 'M84 11 C90.075 11 95 15.925 95 22 C95 28.075 90.075 33 84 33 C77.925 33 73 28.075 73 22 C73 15.925 77.925 11 84 11 Z';
      const badgePlus = 'M82 16 H86 V20 H90 V24 H86 V28 H82 V24 H78 V20 H82 Z';
      const colorBadge = [
        `    <path android:fillColor="#FFB000" android:pathData="${badgeCircle}" />\n`,
        `    <path android:fillColor="#05070A" android:pathData="${badgePlus}" />\n`,
      ].join('');
      const monoBadge = `    <path android:fillColor="#FFFFFFFF" android:pathData="${badgePlus}" />\n`;
      const appendVectorPaths = (file, paths) => {
        let xml = fs.readFileSync(file, 'utf8');
        const missing = paths.filter((p) => !xml.includes(p));
        if (!missing.length || !xml.includes('</vector>')) return;
        fs.writeFileSync(file, xml.replace('</vector>', missing.join('') + '</vector>'));
      };
      for (const file of fs.readdirSync(path.join(res, 'drawable'))) {
        if (!file.startsWith(RES_PREFIX) || !file.endsWith('.xml')) continue;
        const full = path.join(res, 'drawable', file);
        if (file.endsWith('_fg.xml')) appendVectorPaths(full, [badgeCircle, badgePlus].map((d, i) =>
          `    <path android:fillColor="${i === 0 ? '#FFB000' : '#05070A'}" android:pathData="${d}" />\n`));
        else if (/^ic_launcher_alt_mono_(dash|keycap|m|nose|train)\.xml$/.test(file)) appendVectorPaths(full, [monoBadge.trim()]);
      }
      for (const file of fs.readdirSync(path.join(res, 'mipmap-anydpi'))) {
        if (file.startsWith(RES_PREFIX) && file.endsWith('.xml')) appendVectorPaths(path.join(res, 'mipmap-anydpi', file), colorBadge.trim().split('\n'));
      }
      // Every icon needs its two mipmaps, and every drawable or colour they name must have arrived.
      const have = (dir, file) => fs.existsSync(path.join(res, dir, file));
      for (const id of ICON_IDS) {
        const mip = resName(id) + '.xml';
        for (const dir of ['mipmap-anydpi', 'mipmap-anydpi-v26']) {
          if (!have(dir, mip)) throw new Error(`withAppIcons: ${dir}/${mip} was not copied`);
        }
        const adaptive = fs.readFileSync(path.join(res, 'mipmap-anydpi-v26', mip), 'utf8');
        for (const m of adaptive.matchAll(/@(drawable|color)\/([A-Za-z0-9_]+)/g)) {
          const ok = m[1] === 'drawable'
            ? have('drawable', `${m[2]}.xml`)
            : fs.readFileSync(path.join(res, 'values', 'ic_launcher_alt_colors.xml'), 'utf8').includes(`name="${m[2]}"`);
          if (!ok) throw new Error(`withAppIcons: ${mip} uses @${m[1]}/${m[2]}, which was not copied`);
        }
      }
      return c;
    },
  ]);
  return config;
}

module.exports = withAppIcons;
module.exports.applyManifest = applyManifest;
module.exports.ICON_IDS = ICON_IDS;
module.exports.DEFAULT_ICON = DEFAULT_ICON;
module.exports.aliasName = aliasName;
module.exports.resName = resName;
module.exports.RES_DIRS = RES_DIRS;
