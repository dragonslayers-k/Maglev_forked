// Expo config plugin: add JitPack for TeamNewPipe's extractor artifact.
const MARKER = 'maglev-jitpack-repository';

function findMatchingBrace(source, openAt) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = openAt; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}' && --depth === 0) return i;
  }
  return -1;
}

function addJitpackRepository(source) {
  if (source.includes(MARKER)) return source;
  const dmr = /dependencyResolutionManagement\s*\{/m.exec(source);
  if (!dmr) {
    // Some Expo/RN settings.gradle templates omit this block entirely.
    // Add it rather than aborting Android prebuild.
    const newBlock = [
      '',
      'dependencyResolutionManagement {',
      '    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)',
      '    repositories {',
      '        google()',
      '        mavenCentral()',
      '        // ' + MARKER,
      '        maven { url = uri("https://www.jitpack.io") }',
      '    }',
      '}',
      '',
    ].join('\\n');
    return source.trimEnd() + newBlock;
  }
  const dmrOpen = source.indexOf('{', dmr.index);
  const dmrClose = findMatchingBrace(source, dmrOpen);
  if (dmrClose < 0) throw new Error('withJitpackRepository: malformed dependencyResolutionManagement block');

  const body = source.slice(dmrOpen + 1, dmrClose);
  const repositories = /\brepositories\s*\{/m.exec(body);
  const repositoryLine = '\n        // ' + MARKER + '\n        maven { url = uri("https://www.jitpack.io") }\n';
  if (repositories) {
    const repoOpen = dmrOpen + 1 + body.indexOf('{', repositories.index);
    const repoClose = findMatchingBrace(source, repoOpen);
    if (repoClose < 0 || repoClose > dmrClose) {
      throw new Error('withJitpackRepository: malformed repositories block');
    }
    return source.slice(0, repoClose) + repositoryLine + source.slice(repoClose);
  }

  // Recent Expo templates can omit the settings-level repositories block. Add a complete
  // settings repository block rather than failing prebuild or relying on project repos.
  const newBlock = '\n    repositories {\n        google()\n        mavenCentral()\n        // ' + MARKER + '\n        maven { url = uri("https://www.jitpack.io") }\n    }\n';
  return source.slice(0, dmrClose) + newBlock + source.slice(dmrClose);
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
