/**
 * Deterministic PWA PNG icons with no third-party graphics dependencies.
 * Generated files intentionally live outside Git version control.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import path from "node:path";

const destination = path.resolve("public/icons");
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4); data.copy(out, 8);
  let crc = 0xffffffff;
  for (const byte of name) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4);
  return out;
}
function drawIcon(size) {
  const bg = [17, 40, 44];
  const mint = [190, 246, 176];
  const bytes = Buffer.alloc((size * 4 + 1) * size);
  const samples = [[.25,.25],[.25,.75],[.75,.25],[.75,.75]];
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    bytes[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      let coverage = 0;
      for (const [sx, sy] of samples) {
        const px = ((x + sx) / size - 0.5);
        const py = ((y + sy) / size - 0.5);
        const diamond = Math.abs(px) + Math.abs(py);
        if (diamond <= 0.31 && diamond >= 0.205) coverage++;
      }
      const mix = coverage / samples.length;
      const offset = rowStart + 1 + x * 4;
      for (let channel = 0; channel < 3; channel++) {
        bytes[offset + channel] = Math.round(bg[channel] * (1 - mix) + mint[channel] * mix);
      }
      bytes[offset + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(bytes, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
await mkdir(destination, { recursive: true });
for (const size of [192, 512]) {
  await writeFile(path.join(destination, "icon-" + size + ".png"), drawIcon(size));
}
await writeFile(path.join(destination, "maskable-512.png"), drawIcon(512));
await writeFile(path.join(destination, "apple-touch-icon-180.png"), drawIcon(180));
console.log("PWA app icons generated (192, 512, maskable, Apple touch).");
