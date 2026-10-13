import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(rootDir, "src/assets/source");
const publicDir = path.join(rootDir, "public");

await Promise.all([
  mkdir(path.join(publicDir, "fonts"), { recursive: true }),
  mkdir(path.join(publicDir, "icons"), { recursive: true }),
  mkdir(path.join(publicDir, "images"), { recursive: true }),
  mkdir(path.join(publicDir, "social"), { recursive: true }),
]);

await Promise.all([
  buildResponsiveImage("hero-push-up.png", "hero-push-up"),
  buildResponsiveImage("final-plank.png", "final-plank"),
  buildResponsiveImage("acrea-method.png", "acrea-method"),
  buildResponsiveImage("weekly-program.png", "weekly-program", [480, 720, 940]),
  buildIcons(),
  buildSocialImage(),
  copyFonts(),
]);

console.log("Landing production assets prepared.");

async function buildResponsiveImage(
  sourceName,
  outputName,
  widths = [640, 1024, 1600],
) {
  const source = path.join(sourceDir, sourceName);

  await Promise.all(
    widths.flatMap((width) => [
      sharp(source)
        .resize({ width, withoutEnlargement: true })
        .avif({ quality: 48, effort: 7 })
        .toFile(path.join(publicDir, "images", `${outputName}-${width}.avif`)),
      sharp(source)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 74, effort: 6 })
        .toFile(path.join(publicDir, "images", `${outputName}-${width}.webp`)),
    ]),
  );
}

async function buildIcons() {
  const source = path.join(sourceDir, "app-icon-1024.png");
  const variants = [
    [32, "favicon-32.png"],
    [64, "acrea-icon-64.png"],
    [180, "apple-touch-icon.png"],
    [192, "acrea-icon-192.png"],
  ];

  await Promise.all(
    variants.map(([size, name]) =>
      sharp(source)
        .resize(Number(size), Number(size), { fit: "cover" })
        .png({ compressionLevel: 9, palette: true })
        .toFile(path.join(publicDir, "icons", String(name))),
    ),
  );
}

async function buildSocialImage() {
  await sharp(path.join(sourceDir, "hero-push-up.png"))
    .resize(1200, 630, { fit: "cover", position: "centre" })
    .webp({ quality: 76, effort: 6 })
    .toFile(path.join(publicDir, "social", "acrea-fitness-og.webp"));
}

async function copyFonts() {
  const fontSourceDir = path.join(rootDir, "node_modules/@fontsource");
  const fonts = [
    [
      "barlow-condensed/files/barlow-condensed-latin-800-normal.woff2",
      "barlow-condensed-latin-800.woff2",
    ],
    [
      "barlow-condensed/files/barlow-condensed-latin-700-normal.woff2",
      "barlow-condensed-latin-700.woff2",
    ],
    ["inter/files/inter-latin-400-normal.woff2", "inter-latin-400.woff2"],
    ["inter/files/inter-latin-600-normal.woff2", "inter-latin-600.woff2"],
    ["inter/files/inter-latin-700-normal.woff2", "inter-latin-700.woff2"],
  ];

  await Promise.all(
    fonts.map(([source, destination]) =>
      copyFile(
        path.join(fontSourceDir, source),
        path.join(publicDir, "fonts", destination),
      ),
    ),
  );
}
