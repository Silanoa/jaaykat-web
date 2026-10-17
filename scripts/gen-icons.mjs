import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(root, { recursive: true });

const green = [11, 110, 79, 255];
const cream = [250, 247, 242, 255];
const accent = [247, 147, 26, 255];

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

function iconPixel(maskable) {
  return (x, y, size) => {
    const nx = x / (size - 1);
    const ny = y / (size - 1);
    const cx = nx - 0.5;
    const cy = ny - 0.5;
    const inCircle = cx * cx + cy * cy < 0.16;
    const scaled = bolt.map(([px, py]) => [0.18 + px * 0.64, 0.16 + py * 0.68]);
    if (!maskable) {
      const margin = 0.06;
      if (nx < margin || ny < margin || nx > 1 - margin || ny > 1 - margin) return cream;
    }
    if (pointInPoly(nx, ny, scaled)) return accent;
    if (inCircle) return cream;
    return green;
  };
}

writeFileSync(join(root, "icon-192.png"), png(192, iconPixel(false)));
writeFileSync(join(root, "icon-512.png"), png(512, iconPixel(false)));
writeFileSync(join(root, "icon-512-maskable.png"), png(512, iconPixel(true)));
writeFileSync(join(root, "apple-touch-icon.png"), png(180, iconPixel(false)));
