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
    plugins: [require('@babel/plugin-syntax-jsx'), plugin],
  },
).code;

assert.match(output, /KoreanText as Text/);
assert.match(output, /from ['"]\\.\\.\\/components\\/ui\\/KoreanText['"]/);
assert.match(output, /View/);
assert.match(output, /Pressable/);
assert.doesNotMatch(output, /import \\{ Text,/);
const wrapper = require('node:fs').readFileSync(path.join(root, 'components/ui/KoreanText.tsx'), 'utf8');
assert.match(wrapper, /koUiText/);
assert.match(wrapper, /translateChildren/);
const config = require('node:fs').readFileSync(path.join(root, 'babel.config.js'), 'utf8');
assert.match(config, /babel-plugin-korean-text/);
console.log('test-korean-text: all assertions passed');
