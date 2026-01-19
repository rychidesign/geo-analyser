// Script to copy sql.js WASM file to public and dist-electron
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const source = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

// Copy to public (for dev)
const publicDir = path.join(__dirname, 'public');
const publicDest = path.join(publicDir, 'sql-wasm.wasm');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.copyFileSync(source, publicDest);
console.log('✓ Copied sql-wasm.wasm to public folder');

// Copy to dist-electron (for production build)
const distElectronDir = path.join(__dirname, 'dist-electron');
const distElectronDest = path.join(distElectronDir, 'sql-wasm.wasm');

if (!fs.existsSync(distElectronDir)) {
  fs.mkdirSync(distElectronDir, { recursive: true });
}

fs.copyFileSync(source, distElectronDest);
console.log('✓ Copied sql-wasm.wasm to dist-electron folder');
