const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('components/browser/startFound.ts', 'utf8');
assert.match(source, /resolveNaverClip\(naverClipPage\)/, 'NAVER Clip resolver must be called');
assert.match(source, /clip\?\.title\?\.trim\(\)/, 'provider title must be used as the default filename');
assert.match(source, /replace\(\/\[\\\\\\/:\*\?"<>\|\\u0000-\\u001f\]\/g, '_ '\.trim\(\)/, 'filename must be sanitized');
// A resolved clip is a progressive MP4, and the name must match its actual container.
assert.match(source, /safeClipName\.replace\(\/\\\.mp4\$\/i, ''\) \+ '\.mp4'/, 'filename must end in .mp4 exactly once');
assert.match(source, /\{ name: outputName \}/, 'resolved clip filename must be passed to the native downloader');
console.log('NAVER Clip filename integration checks passed');
