#!/usr/bin/env node
// Maglev+ must install independently from upstream Maglev.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
assert.strictEqual(app.name, 'Maglev+');
assert.strictEqual(app.slug, 'maglev-plus');
assert.strictEqual(app.version, '0.34');
assert.strictEqual(app.android.package, 'com.maglev.plus');
assert.strictEqual(app.android.versionCode, 34);
assert.strictEqual(app.ios.bundleIdentifier, 'com.maglev.plus.client');
assert.strictEqual(pkg.name, 'maglev-plus');
assert.strictEqual(pkg.version, '0.34.0');
assert.strictEqual(lock.name, 'maglev-plus');
assert.strictEqual(lock.version, '0.34.0');
assert.strictEqual(lock.packages[''].version, '0.34.0');
assert(read('plugins/withShareIntents.js').includes("const PACKAGE = 'com.maglev.plus';"));
assert(read('plugins/withAppIcons.js').includes("const PACKAGE = 'com.maglev.plus';"));
assert(read('modules/maglev-engine/android/src/main/java/com/maglev/engine/appicon/AppIconManager.kt').includes('private const val PACKAGE = "com.maglev.plus"'));
assert(read('modules/maglev-engine/android/src/main/java/com/maglev/engine/update/AppUpdater.kt').includes('private const val PACKAGE = "com.maglev.plus"'));
assert(!app.android.package.includes('com.maglev"'), 'fork applicationId must not equal upstream com.maglev');
console.log('Maglev+ identity/package contract passed');
