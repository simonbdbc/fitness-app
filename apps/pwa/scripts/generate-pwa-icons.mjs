import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const sourceIconPath = path.resolve("assets/app-icon-source.png");
const outputs = [
  { path: path.resolve("assets/app-icon.png"), size: 1024 },
  { path: path.resolve("public/icons/app-icon-192.png"), size: 192 },
  { path: path.resolve("public/icons/app-icon-512.png"), size: 512 },
  { path: path.resolve("public/icons/app-icon-maskable-512.png"), size: 512 },
  { path: path.resolve("public/icons/apple-touch-icon.png"), size: 180 },
];
const legacyPublicIcons = [
  "icon-fitness-app-rounded.png",
  "acrea-icon-192.png",
  "acrea-icon-512.png",
  "acrea-maskable-512.png",
];

const signature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    scanlines[y * (stride + 1)] = 0;
    pixels.copy(scanlines, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  return upDistance <= upLeftDistance ? up : upLeft;
}

function decodePng(buffer) {
  if (!buffer.subarray(0, signature.length).equals(signature)) {
    throw new Error("Source icon must be a PNG file.");
  }

  let offset = signature.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const data = buffer.subarray(dataStart, dataStart + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlaceMethod = data[12];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataStart + length + 4;
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlaceMethod !== 0) {
    throw new Error("Source icon must be a non-interlaced 8-bit RGB or RGBA PNG.");
  }

  const channels = colorType === 6 ? 4 : 3;
  const sourceStride = width * channels;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const rgba = Buffer.alloc(width * height * 4);
  let previousRow = Buffer.alloc(sourceStride);
  let readOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[readOffset];
    readOffset += 1;
    const encodedRow = inflated.subarray(readOffset, readOffset + sourceStride);
    readOffset += sourceStride;
    const row = Buffer.alloc(sourceStride);

    for (let x = 0; x < sourceStride; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = previousRow[x] ?? 0;
      const upLeft = x >= channels ? previousRow[x - channels] : 0;
      let value = encodedRow[x];

      if (filter === 1) {
        value += left;
      } else if (filter === 2) {
        value += up;
      } else if (filter === 3) {
        value += Math.floor((left + up) / 2);
      } else if (filter === 4) {
        value += paethPredictor(left, up, upLeft);
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter type: ${filter}`);
      }

      row[x] = value & 0xff;
    }

    for (let x = 0; x < width; x += 1) {
      const sourceIndex = x * channels;
      const targetIndex = (y * width + x) * 4;
      rgba[targetIndex] = row[sourceIndex];
      rgba[targetIndex + 1] = row[sourceIndex + 1];
      rgba[targetIndex + 2] = row[sourceIndex + 2];
      rgba[targetIndex + 3] = channels === 4 ? row[sourceIndex + 3] : 255;
    }

    previousRow = row;
  }

  return { width, height, pixels: rgba };
}

function samplePremultiplied(pixels, width, x, y) {
  const index = (y * width + x) * 4;
  const alpha = pixels[index + 3] / 255;

  return [
    pixels[index] * alpha,
    pixels[index + 1] * alpha,
    pixels[index + 2] * alpha,
    alpha,
  ];
}

function resizeSquareIcon(source, size) {
  const output = Buffer.alloc(size * size * 4);
  const scaleX = source.width / size;
  const scaleY = source.height / size;

  for (let y = 0; y < size; y += 1) {
    const sourceY = (y + 0.5) * scaleY - 0.5;
    const y0 = Math.max(0, Math.floor(sourceY));
    const y1 = Math.min(source.height - 1, y0 + 1);
    const wy = sourceY - y0;

    for (let x = 0; x < size; x += 1) {
      const sourceX = (x + 0.5) * scaleX - 0.5;
      const x0 = Math.max(0, Math.floor(sourceX));
      const x1 = Math.min(source.width - 1, x0 + 1);
      const wx = sourceX - x0;

      const topLeft = samplePremultiplied(source.pixels, source.width, x0, y0);
      const topRight = samplePremultiplied(source.pixels, source.width, x1, y0);
      const bottomLeft = samplePremultiplied(source.pixels, source.width, x0, y1);
      const bottomRight = samplePremultiplied(source.pixels, source.width, x1, y1);
      const weights = [
        (1 - wx) * (1 - wy),
        wx * (1 - wy),
        (1 - wx) * wy,
        wx * wy,
      ];
      const alpha =
        topLeft[3] * weights[0] +
        topRight[3] * weights[1] +
        bottomLeft[3] * weights[2] +
        bottomRight[3] * weights[3];
      const index = (y * size + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const premultiplied =
          topLeft[channel] * weights[0] +
          topRight[channel] * weights[1] +
          bottomLeft[channel] * weights[2] +
          bottomRight[channel] * weights[3];
        output[index + channel] =
          alpha === 0 ? 0 : Math.round(premultiplied / alpha);
      }

      output[index + 3] = Math.round(alpha * 255);
    }
  }

  return output;
}

async function main() {
  const source = decodePng(await readFile(sourceIconPath));

  for (const filename of legacyPublicIcons) {
    await rm(path.resolve("public/icons", filename), { force: true });
  }

  for (const output of outputs) {
    await mkdir(path.dirname(output.path), { recursive: true });
    await writeFile(
      output.path,
      encodePng(output.size, output.size, resizeSquareIcon(source, output.size)),
    );
  }
}

await main();
