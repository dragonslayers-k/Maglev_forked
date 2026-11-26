#!/usr/bin/env node
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
const root = path.join(__dirname, '..');
const plugin = require('../plugins/babel-plugin-korean-text');

const output = babel.transformSync(
  "import { Text, View, Pressable } from 'react-native'; export const A = () => <Text accessibilityLabel='Close'>Settings</Text>;",
  {
    configFile: false,
    babelrc: false,
    filename: path.join(root, 'app', 'korean-transform-fixture.tsx'),
    parserOpts: { plugins: ['jsx'] },
    plugins: [plugin],
  },
).code;

assert.match(output, /KoreanText as Text/);
assert.match(output, /from ['"]\.\.\/components\/ui\/KoreanText['"]/);
assert.match(output, /View/);
assert.match(output, /Pressable/);
assert.doesNotMatch(output, /import \{ Text,/);
const wrapper = require('node:fs').readFileSync(path.join(root, 'components/ui/KoreanText.tsx'), 'utf8');
const korean = require('node:fs').readFileSync(path.join(root, 'constants/korean.ts'), 'utf8');
for (const label of ['Paste new link', 'No app can open this file.', 'Charging only', 'Any network', 'More below', 'Start the downloader', 'Pick folder again', 'The folder is not available.']) {
  assert.ok(korean.includes(JSON.stringify(label)), `Korean dictionary must include ${label}`);
}
assert.match(wrapper, /koUiText/);
assert.match(wrapper, /translateChildren/);
const config = require('node:fs').readFileSync(path.join(root, 'babel.config.js'), 'utf8');
assert.match(config, /babel-plugin-korean-text/);
const jitpack = require('../plugins/withJitpackRepository').addJitpackRepository;
const settings = 'dependencyResolutionManagement { repositories { google(); mavenCentral() } }';
const withRepo = jitpack(settings);
assert.match(withRepo, /maglev-jitpack-repository/);
assert.match(withRepo, /www\.jitpack\.io/);
assert.equal(jitpack(withRepo), withRepo, 'JitPack repository injection must be idempotent');
const settingsWithoutRepositories = 'dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS) }';
const injectedWithoutRepositories = jitpack(settingsWithoutRepositories);
assert.ok(injectedWithoutRepositories.includes('repositories {'));
assert.ok(injectedWithoutRepositories.includes('google()'));
assert.ok(injectedWithoutRepositories.includes('mavenCentral()'));
assert.match(injectedWithoutRepositories, /maglev-jitpack-repository/);
assert.equal(jitpack(injectedWithoutRepositories), injectedWithoutRepositories, 'JitPack injection without a repositories block must be idempotent');
const appJson = JSON.parse(require('node:fs').readFileSync(path.join(root, 'app.json'), 'utf8'));
assert.ok(appJson.expo.plugins.includes('./plugins/withJitpackRepository.js'), 'prebuild must register JitPack repository plugin');
console.log('test-korean-text: all assertions passed');
