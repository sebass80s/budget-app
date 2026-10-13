/**
 * Generate all PWA icon dimensions directly from the chosen original artwork.
 * The original PNG is committed; derived icons are build artifacts.
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const source = path.resolve("public/assets/budget-icon.png");
const destination = path.resolve("public/icons");
const original = await readFile(source);
const metadata = await sharp(original).metadata();
if (metadata.format !== "png" || !metadata.width || !metadata.height ||
    metadata.width < 512 || metadata.height < 512) {
  throw new Error("PWA original image must be a PNG of at least 512 × 512 pixels.");
}
await mkdir(destination, { recursive: true });
async function generate(filename, size) {
  const resized = await sharp(original).rotate().resize(size, size, {
    fit: "cover", position: "centre",
  }).png().toBuffer();
  await writeFile(path.join(destination, filename), resized);
}
await generate("icon-192.png", 192);
await generate("icon-512.png", 512);
await generate("maskable-512.png", 512);
await generate("apple-touch-icon-180.png", 180);
console.log("PWA wallet icons generated from public/assets/budget-icon.png (180, 192, 512).");
