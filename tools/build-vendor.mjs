// Firebase SDK'sını tek dosyaya paketler: npm run vendor
import { build } from 'esbuild';

await build({
  entryPoints: ['tools/entry-firebase.js'],
  outfile: 'js/vendor/firebase.js',
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2020',
  legalComments: 'none',
});
