import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const wasmSrcDir = path.resolve(rootDir, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmDestDir = path.resolve(rootDir, 'public/wasm');
const modelsDestDir = path.resolve(rootDir, 'public/models');
const modelDestFile = path.resolve(modelsDestDir, 'face_landmarker.task');

// Ensure destination directories exist
fs.mkdirSync(wasmDestDir, { recursive: true });
fs.mkdirSync(modelsDestDir, { recursive: true });

// Copy WASM files
if (fs.existsSync(wasmSrcDir)) {
  const files = fs.readdirSync(wasmSrcDir);
  for (const file of files) {
    const src = path.join(wasmSrcDir, file);
    const dest = path.join(wasmDestDir, file);
    if (!fs.existsSync(dest) || fs.statSync(src).size !== fs.statSync(dest).size) {
      fs.copyFileSync(src, dest);
      console.log(`Copied ${file} to public/wasm/`);
    }
  }
} else {
  console.warn('MediaPipe tasks-vision wasm source directory not found in node_modules.');
}

// Check model file
if (!fs.existsSync(modelDestFile) || fs.statSync(modelDestFile).size < 1000) {
  console.log('Downloading face_landmarker.task model...');
  const res = await fetch('https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task');
  if (!res.ok) {
    throw new Error(`Failed to download model: ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(modelDestFile, buffer);
  console.log('Model downloaded successfully to public/models/face_landmarker.task');
} else {
  console.log('MediaPipe model asset is up to date.');
}
