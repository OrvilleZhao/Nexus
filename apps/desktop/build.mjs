import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'fs';

mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/ts/app.ts'],
  bundle: true,
  outfile: 'dist/app.js',
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: false,
});

cpSync('src/index.html', 'dist/index.html');
cpSync('src/css', 'dist/css', { recursive: true });

console.log('Frontend built → dist/');
