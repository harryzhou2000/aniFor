import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_CAPTURE_AXIS = 8_192;
const MAX_CAPTURE_PIXELS = 16_777_216;

const paethPredictor = (left, up, upperLeft) => {
  const prediction = left + up - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const upDistance = Math.abs(prediction - up);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
};

const parseVisualLabPng = (bytes, label) => {
  if (!Buffer.isBuffer(bytes)) throw new TypeError(`${label} PNG bytes must be a Buffer`);
  if (bytes.length < 57 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${label} does not have a PNG signature`);
  }
  let offset = PNG_SIGNATURE.length;
  let chunkIndex = 0;
  let width;
  let height;
  let idatBytes = 0;
  const idatChunks = [];
  let ended = false;
  let channels;
  let bitDepth;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error(`${label} has a truncated PNG chunk`);
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > bytes.length) {
      throw new Error(`${label} has a truncated ${type || 'unknown'} PNG chunk`);
    }
    if (chunkIndex === 0 && (type !== 'IHDR' || length !== 13)) {
      throw new Error(`${label} does not begin with a canonical IHDR chunk`);
    }
    if (type === 'IHDR') {
      if (chunkIndex !== 0 || width !== undefined || length !== 13) {
        throw new Error(`${label} has an invalid duplicate IHDR chunk`);
      }
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      if (width === 0 || height === 0) throw new Error(`${label} has zero PNG dimensions`);
      if (width > MAX_CAPTURE_AXIS || height > MAX_CAPTURE_AXIS
        || width * height > MAX_CAPTURE_PIXELS) {
        throw new Error(`${label} exceeds the bounded PNG capture budget`);
      }
      bitDepth = bytes[dataStart + 8];
      const colorType = bytes[dataStart + 9];
      channels = ({ 2: 3, 6: 4 })[colorType];
      if (bitDepth !== 8 || channels === undefined
        || bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0
        || bytes[dataStart + 12] !== 0) {
        throw new Error(`${label} is not a supported non-interlaced 8-bit RGB/RGBA PNG`);
      }
    } else if (type === 'IDAT') {
      idatBytes += length;
      idatChunks.push(bytes.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      if (length !== 0 || chunkEnd !== bytes.length) {
        throw new Error(`${label} has an invalid IEND tail`);
      }
      ended = true;
    }
    let crc = 0xFFFFFFFF;
    for (let index = offset + 4; index < dataEnd; index++) {
      crc ^= bytes[index];
      for (let bit = 0; bit < 8; bit++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    const expectedCrc = (crc ^ 0xFFFFFFFF) >>> 0;
    if (bytes.readUInt32BE(dataEnd) !== expectedCrc) {
      throw new Error(`${label} has an invalid ${type || 'unknown'} PNG CRC`);
    }
    offset = chunkEnd;
    chunkIndex++;
    if (ended) break;
  }
  if (width === undefined || height === undefined || idatBytes === 0 || !ended) {
    throw new Error(`${label} does not contain a complete IHDR/IDAT/IEND PNG stream`);
  }
  const inflatedLength = (width * channels + 1) * height;
  let imageBytes;
  try {
    const compressed = Buffer.concat(idatChunks, idatBytes);
    const inflated = inflateSync(compressed, {
      maxOutputLength: inflatedLength,
      info: true,
    });
    if (inflated.engine.bytesWritten !== compressed.byteLength) {
      throw new Error('compressed stream has trailing bytes');
    }
    imageBytes = inflated.buffer;
  } catch (error) {
    throw new Error(
      `${label} has an invalid compressed PNG image stream: ${error.message}`,
      { cause: error },
    );
  }
  if (imageBytes.byteLength !== inflatedLength) {
    throw new Error(`${label} has an incomplete decompressed PNG image stream`);
  }
  const encodedRowStride = width * channels + 1;
  for (let row = 0; row < height; row++) {
    if (imageBytes[row * encodedRowStride] > 4) {
      throw new Error(`${label} has an invalid PNG row filter`);
    }
  }
  return { width, height, channels, imageBytes };
};

/** Preserves the strict bounded structural validation used by batch packages. */
export const inspectVisualLabPng = (bytes, label) => {
  const { width, height } = parseVisualLabPng(bytes, label);
  return { width, height };
};

/**
 * Decodes the already-bounded RGB/RGBA capture into row-major channel bytes.
 * This is evidence tooling only; it never participates in the renderer.
 */
export const decodeVisualLabPng = (bytes, label) => {
  const {
    width, height, channels, imageBytes,
  } = parseVisualLabPng(bytes, label);
  const rowStride = width * channels;
  const encodedRowStride = rowStride + 1;
  const pixels = Buffer.allocUnsafe(rowStride * height);
  for (let row = 0; row < height; row++) {
    const filter = imageBytes[row * encodedRowStride];
    const sourceRow = row * encodedRowStride + 1;
    const outputRow = row * rowStride;
    for (let column = 0; column < rowStride; column++) {
      const raw = imageBytes[sourceRow + column];
      const left = column >= channels ? pixels[outputRow + column - channels] : 0;
      const up = row > 0 ? pixels[outputRow - rowStride + column] : 0;
      const upperLeft = row > 0 && column >= channels
        ? pixels[outputRow - rowStride + column - channels]
        : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paethPredictor(left, up, upperLeft);
      pixels[outputRow + column] = (raw + predictor) & 0xFF;
    }
  }
  return Object.freeze({ width, height, channels, pixels });
};
