import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(root, { recursive: true });

/** JAAYKAT V brand */
const navy = [11, 13, 36, 255];
const canvas = [249, 252, 255, 255];
const orange = [255, 77, 0, 255];
const white = [255, 255, 255, 255];

const bolt = [
  [0.42, 0.18],
  [0.64, 0.18],
  [0.5, 0.46],
  [0.68, 0.46],
  [0.34, 0.86],
  [0.48, 0.52],
  [0.32, 0.52],
];

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function crc32(buffer) {
  let crc = ~0;
  for (const value of buffer) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y, size);
      const offset = row + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function roundedRect(nx, ny, margin, radius) {
  const x0 = margin;
  const y0 = margin;
  const x1 = 1 - margin;
  const y1 = 1 - margin;
  if (nx < x0 || ny < y0 || nx > x1 || ny > y1) return false;
  const nearLeft = nx - x0 < radius;
  const nearRight = x1 - nx < radius;
  const nearTop = ny - y0 < radius;
  const nearBottom = y1 - ny < radius;
  if (!(nearLeft || nearRight) || !(nearTop || nearBottom)) return true;
  const cx = nearLeft ? x0 + radius : x1 - radius;
  const cy = nearTop ? y0 + radius : y1 - radius;
  const dx = nx - cx;
  const dy = ny - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function iconPixel(maskable) {
  return (x, y, size) => {
    const nx = x / (size - 1);
    const ny = y / (size - 1);
    const margin = maskable ? 0.1 : 0.08;
    const radius = 0.18;
    const inTile = roundedRect(nx, ny, margin, radius);
    if (!inTile) return maskable ? navy : canvas;

    const localX = (nx - margin) / (1 - 2 * margin);
    const localY = (ny - margin) / (1 - 2 * margin);
    const scaled = bolt.map(([px, py]) => [px, py]);
    if (pointInPoly(localX, localY, scaled)) return white;
    return orange;
  };
}

writeFileSync(join(root, "icon-192.png"), png(192, iconPixel(false)));
writeFileSync(join(root, "icon-512.png"), png(512, iconPixel(false)));
writeFileSync(join(root, "icon-512-maskable.png"), png(512, iconPixel(true)));
writeFileSync(join(root, "apple-touch-icon.png"), png(180, iconPixel(false)));
console.log("icons written to", root);
