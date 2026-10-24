import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

// Vite only reads `define` at the config root. Putting it under `build`
// leaves `process.env.NODE_ENV` in the output, which throws
// "ReferenceError: process is not defined" in browser/content-script contexts.
const define = {
  'process.env.NODE_ENV': JSON.stringify('production')
};

async function runBuild() {
  console.log('--- Step 1: Ensuring assets (WASM & model) ---');
  await import('./copy-assets.js');

  console.log('\n--- Step 2: Building HTML pages (Popup & Tracker) ---');
  await build({
    root: rootDir,
    plugins: [react()],
    base: '',
    define,
    build: {
      outDir: distDir,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: path.resolve(rootDir, 'index.html'),
          tracker: path.resolve(rootDir, 'offscreen.html')
        }
      }
    }
  });

  console.log('\n--- Step 3: Building Content Script (IIFE) ---');
  await build({
    root: rootDir,
    configFile: false,
    plugins: [react()],
    define,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'src/content.jsx'),
        name: 'HandsFreeContentScript',
        formats: ['iife'],
        fileName: () => 'content.js'
      }
    }
  });

  console.log('\n--- Step 4: Building Background Script ---');
  await build({
    root: rootDir,
    configFile: false,
    define,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'src/background.js'),
        name: 'HandsFreeBackground',
        formats: ['iife'],
        fileName: () => 'background.js'
      }
    }
  });

  // Guard against shipping browser bundles that reference Node globals.
  // This was the cause of "ReferenceError: process is not defined" in content.js.
  for (const file of ['content.js', 'background.js']) {
    const bundle = fs.readFileSync(path.resolve(distDir, file), 'utf8');
    if (/\bprocess\.env\b/.test(bundle)) {
      throw new Error(`${file} still references process.env; Vite define was not applied.`);
    }
  }

  console.log('\n--- Step 5: Copying manifest.json ---');
  fs.copyFileSync(
    path.resolve(rootDir, 'manifest.json'),
    path.resolve(distDir, 'manifest.json')
  );

  console.log('\n✓ Build complete! Output in dist/');
}

runBuild().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
