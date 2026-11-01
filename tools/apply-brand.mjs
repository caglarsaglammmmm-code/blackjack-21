// js/brand.js ve package.json sürümünü diğer dosyalara yayar: npm run brand
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND } from '../js/brand.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = (name) => path.join(root, name);
const edit = (name, change) => {
  if (!fs.existsSync(file(name))) return;
  const before = fs.readFileSync(file(name), 'utf8');
  const after = change(before);
  if (after !== before) fs.writeFileSync(file(name), after);
};
const xml = (text) => text.replace(/&/g, '&amp;').replace(/'/g, "\\'");

const { version } = JSON.parse(fs.readFileSync(file('package.json'), 'utf8'));
const [major, minor, patch] = version.split('.').map(Number);

fs.writeFileSync(file('manifest.json'), `${JSON.stringify({
  name: BRAND.name,
  short_name: BRAND.shortName,
  description: BRAND.tagline,
  id: './',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#0b0606',
  theme_color: '#0b0606',
  lang: 'tr',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2)}\n`);

fs.writeFileSync(file('capacitor.config.json'), `${JSON.stringify({
  appId: 'com.caglarsaglam.tamtokatlik21',
  appName: BRAND.name,
  webDir: 'www',
  backgroundColor: '#0b0606',
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
  plugins: { SystemBars: { style: 'DARK', insetsHandling: 'css' } },
}, null, 2)}\n`);

edit('index.html', (html) => html
  .replace(/<title>.*?<\/title>/, `<title>${BRAND.name}</title>`)
  .replace(/(apple-mobile-web-app-title" content=")[^"]*/, `$1${BRAND.name}`));

edit('js/brand.js', (text) => text.replace(/VERSION = '[^']*'/, `VERSION = '${version}'`));

edit('android/app/src/main/res/values/strings.xml', (text) => text
  .replace(/(<string name="app_name">).*?(<\/string>)/, `$1${xml(BRAND.name)}$2`)
  .replace(/(<string name="title_activity_main">).*?(<\/string>)/, `$1${xml(BRAND.name)}$2`));

edit('android/app/build.gradle', (text) => text
  .replace(/versionCode \d+/, `versionCode ${major * 10000 + minor * 100 + patch}`)
  .replace(/versionName "[^"]*"/, `versionName "${version}"`));

edit('android/app/src/main/AndroidManifest.xml', (text) => {
  let out = text;
  if (!out.includes('android.permission.VIBRATE')) {
    out = out.replace('</manifest>', '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>');
  }
  if (!out.includes('android:screenOrientation')) {
    out = out.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"');
  }
  return out;
});
edit('android/app/src/main/res/values/styles.xml', (text) => (text.includes('android:statusBarColor') ? text : text.replace(
  /(<style name="AppTheme.NoActionBar"[^>]*>)/,
  `$1
        <item name="android:statusBarColor">#0b0606</item>
        <item name="android:navigationBarColor">#0b0606</item>
        <item name="android:windowLightStatusBar">false</item>`,
)));

edit('android/app/src/main/res/values/styles.xml', (text) => (text.includes('android:windowBackground">#') ? text : text.replace(
  /(<style name="AppTheme.NoActionBar"[^>]*>)/,
  `$1
        <item name="android:windowBackground">#0b0606</item>`,
)));

console.log(`Marka: ${BRAND.name}, sürüm ${version}`);
