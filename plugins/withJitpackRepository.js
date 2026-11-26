// Expo config plugin: add JitPack for TeamNewPipe's extractor artifact.
const MARKER = 'maglev-jitpack-repository';
function addJitpackRepository(source) {
  if (source.includes(MARKER)) return source;
  const block = /dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{/m;
  const match = block.exec(source);
  if (!match) throw new Error('withJitpackRepository: dependencyResolutionManagement repositories block not found');
  const at = match.index + match[0].length;
  return source.slice(0, at) +
    '\n        // ' + MARKER + '\n        maven { url = uri("https://www.jitpack.io") }\n' +
    source.slice(at);
}
function withJitpackRepository(config) {
  const { withSettingsGradle } = require('expo/config-plugins');
  return withSettingsGradle(config, (c) => {
    c.modResults.contents = addJitpackRepository(c.modResults.contents);
    return c;
  });
}
module.exports = withJitpackRepository;
module.exports.addJitpackRepository = addJitpackRepository;
