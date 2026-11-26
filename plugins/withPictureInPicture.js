const { withAndroidManifest } = require('expo/config-plugins');

/** Enables Android's native PiP mode on the app Activity. Idempotent and safe for prebuild. */
function applyPictureInPictureManifest(manifest) {
  const application = manifest?.manifest?.application?.[0];
  const activities = application?.activity ?? [];
  const main = activities.find((activity) => /(^|\.)MainActivity$/.test(activity.$?.['android:name'] ?? ''));
  if (!main) throw new Error('withPictureInPicture: MainActivity not found in AndroidManifest.xml');

  const attrs = main.$ ?? (main.$ = {});
  attrs['android:supportsPictureInPicture'] = 'true';
  attrs['android:resizeableActivity'] = 'true';

  const changes = new Set(String(attrs['android:configChanges'] ?? '').split('|').filter(Boolean));
  for (const item of ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation']) changes.add(item);
  attrs['android:configChanges'] = [...changes].join('|');
  return manifest;
}

function withPictureInPicture(config) {
  return withAndroidManifest(config, (mod) => {
    mod.modResults = applyPictureInPictureManifest(mod.modResults);
    return mod;
  });
}

module.exports = withPictureInPicture;
module.exports.applyPictureInPictureManifest = applyPictureInPictureManifest;
