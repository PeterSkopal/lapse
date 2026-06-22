// Rasterises public/favicon.svg into the PNG icons the PWA manifest references.
// Run with: npm run icons
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(join(root, 'public', 'favicon.svg'));

const render = (name, size) =>
  sharp(svg, { density: 512 })
    .resize(size, size, { fit: 'contain', background: { r: 11, g: 13, b: 18, alpha: 1 } })
    .png()
    .toFile(join(root, 'public', name));

await Promise.all([
  render('icon-192.png', 192),
  render('icon-512.png', 512),
  render('icon-512-maskable.png', 512),
  render('apple-touch-icon-180.png', 180),
]);

console.log('✓ icons generated in public/');
