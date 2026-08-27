/**
 * Rebuild original brand assets with SVG + sharp, without a remote image API.
 * Optional: OG_FONT_PATH=/path/to/a/Japanese-font.ttf node scripts/generate-assets.mjs
 * Requires sharp (already supplied by Next.js) and a local Japanese font.
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const publicDir = path.join(projectRoot, "public");
const iconsDir = path.join(publicDir, "icons");
await mkdir(iconsDir, { recursive: true });
const originalIcon = await readFile(path.join(publicDir, "icon.svg"));

await Promise.all([
  sharp(originalIcon)
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, "icon-192.png")),
  sharp(originalIcon)
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, "icon-512.png")),
  sharp(originalIcon)
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, "apple-touch-icon.png")),
]);

// Keep every meaningful part inside the maskable icon's central safe circle.
const maskableMark = await sharp(originalIcon)
  .resize(364, 364)
  .png()
  .toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#e3f1df" },
})
  .composite([{ input: maskableMark, left: 74, top: 64 }])
  .png()
  .toFile(path.join(iconsDir, "maskable-512.png"));

// ICO accepts PNG payloads; no extra image tool or native dependency is needed.
const faviconSizes = [16, 32, 48];
const faviconPngs = await Promise.all(
  faviconSizes.map((size) =>
    sharp(originalIcon).resize(size, size).png().toBuffer(),
  ),
);
const icoHeader = Buffer.alloc(6 + 16 * faviconSizes.length);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(faviconSizes.length, 4);
let offset = icoHeader.length;
faviconPngs.forEach((png, index) => {
  const entry = 6 + index * 16;
  icoHeader[entry] = faviconSizes[index];
  icoHeader[entry + 1] = faviconSizes[index];
  icoHeader.writeUInt16LE(1, entry + 4);
  icoHeader.writeUInt16LE(32, entry + 6);
  icoHeader.writeUInt32LE(png.length, entry + 8);
  icoHeader.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(
  path.join(publicDir, "favicon.ico"),
  Buffer.concat([icoHeader, ...faviconPngs]),
);

const fontOptions = [
  { file: process.env.OG_FONT_PATH, family: "sans-serif" },
  { file: "C:/Windows/Fonts/YuGothB.ttc", family: "Yu Gothic Bold" },
  {
    file: "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    family: "Noto Sans CJK JP Bold",
  },
  {
    file: "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
    family: "Hiragino Sans W6",
  },
];
let font;
for (const candidate of fontOptions) {
  if (!candidate.file) continue;
  try {
    await access(candidate.file);
    font = candidate;
    break;
  } catch {
    // Try the next locally installed font. No font is downloaded.
  }
}
if (!font)
  throw new Error(
    "Set OG_FONT_PATH to a local Japanese font to regenerate the OG image.",
  );

const escapeMarkup = (text) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const textImage = (text, size, color = "#173e32") =>
  sharp({
    text: {
      text: `<span foreground="${color}">${escapeMarkup(text)}</span>`,
      font: `${font.family} ${size}`,
      fontfile: font.file,
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer();

const background =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f6f8f5"/>
  <circle cx="1140" cy="300" r="363" fill="#e3f1df"/>
  <circle cx="1019" cy="312" r="235" fill="none" stroke="#c9dfc3" stroke-width="1.5"/>
  <circle cx="1019" cy="312" r="184" fill="none" stroke="#c9dfc3" stroke-width="1.5"/>
  <path d="M66 141H1134" stroke="#dce5d9"/>
  <rect x="66" y="530" width="314" height="44" rx="22" fill="#e3f1df"/>
  <rect x="394" y="530" width="244" height="44" rx="22" fill="none" stroke="#cddbcc"/>
  <rect x="863" y="229" width="262" height="262" rx="77" transform="rotate(-8 994 360)" fill="#fff" opacity=".54"/>
  <circle cx="1140" cy="186" r="9" fill="#173e32"/>
  <circle cx="817" cy="443" r="5" fill="#173e32"/>
</svg>`);
const labels = await Promise.all([
  textImage("謝罪AI", 34),
  textImage("APOLOGY INTELLIGENCE", 15, "#526c5c"),
  textImage("考え抜いた結果、", 65),
  textImage("すみません。", 83),
  textImage("どんな相談にも、ひとつの答え。", 25, "#536458"),
  textImage("AI風のジョークアプリです", 19),
  textImage("生成AI API不使用", 19),
]);
const brandIcon = await sharp(originalIcon).resize(58, 58).png().toBuffer();
const heroIcon = await sharp(originalIcon).resize(265, 265).png().toBuffer();
await sharp(background)
  .composite([
    { input: brandIcon, top: 56, left: 66 },
    { input: labels[0], top: 69, left: 142 },
    { input: labels[1], top: 79, left: 865 },
    { input: labels[2], top: 208, left: 65 },
    { input: labels[3], top: 301, left: 62 },
    { input: labels[4], top: 436, left: 67 },
    { input: labels[5], top: 543, left: 97 },
    { input: labels[6], top: 543, left: 439 },
    { input: heroIcon, top: 212, left: 855 },
  ])
  .png()
  .toFile(path.join(publicDir, "og.png"));

for (const name of [
  "icon-192.png",
  "icon-512.png",
  "maskable-512.png",
  "apple-touch-icon.png",
]) {
  const metadata = await sharp(path.join(iconsDir, name)).metadata();
  console.log(`${name}: ${metadata.width}×${metadata.height}`);
}
console.log(
  "favicon.ico: 16, 32, 48 px; og.png: 1200×630; no remote image generation used.",
);
