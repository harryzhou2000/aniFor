import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodeVisualLabPng, inspectVisualLabPng } from './visual-lab-png.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crc32 = (bytes) => {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

const chunk = (type, data) => {
  const typeBytes = Buffer.from(type, 'ascii');
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return result;
};

const paeth = (left, up, upperLeft) => {
  const prediction = left + up - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const upDistance = Math.abs(prediction - up);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
};

const filteredRow = (row, previousRow, filter, channels) => {
  const encoded = Buffer.alloc(row.length + 1);
  encoded[0] = filter;
  for (let column = 0; column < row.length; column++) {
    const left = column >= channels ? row[column - channels] : 0;
    const up = previousRow?.[column] ?? 0;
    const upperLeft = column >= channels ? (previousRow?.[column - channels] ?? 0) : 0;
    let predictor = 0;
    if (filter === 1) predictor = left;
    else if (filter === 2) predictor = up;
    else if (filter === 3) predictor = Math.floor((left + up) / 2);
    else if (filter === 4) predictor = paeth(left, up, upperLeft);
    encoded[column + 1] = (row[column] - predictor) & 0xFF;
  }
  return encoded;
};

const makePng = ({
  width,
  height,
  channels,
  scanlines,
  compressed = deflateSync(scanlines),
}) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 3 ? 2 : 6;
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const rawRowsFor = (channels) => [
  Buffer.from(Array.from({ length: channels * 3 }, (_, index) => (19 + index * 29) & 0xFF)),
  Buffer.from(Array.from({ length: channels * 3 }, (_, index) => (203 - index * 17) & 0xFF)),
];

describe('visual lab PNG decoder', () => {
  for (const channels of [3, 4]) {
    for (const filter of [0, 1, 2, 3, 4]) {
      it(`unfilters deterministic ${channels === 3 ? 'RGB' : 'RGBA'} rows with PNG filter ${filter}`, () => {
        const rows = rawRowsFor(channels);
        const scanlines = Buffer.concat(rows.map((row, index) => filteredRow(
          row,
          rows[index - 1],
          filter,
          channels,
        )));
        const png = makePng({
          width: 3,
          height: 2,
          channels,
          scanlines,
        });

        expect(inspectVisualLabPng(png, 'fixture')).toEqual({ width: 3, height: 2 });
        const decoded = decodeVisualLabPng(png, 'fixture');
        expect(decoded.width).toBe(3);
        expect(decoded.height).toBe(2);
        expect(decoded.channels).toBe(channels);
        expect(Array.from(decoded.pixels)).toEqual(Array.from(Buffer.concat(rows)));
      });
    }
  }

  it('rejects malformed signatures, CRCs, trailing compressed bytes, and row filters', () => {
    const rows = rawRowsFor(3);
    const scanlines = Buffer.concat(rows.map((row, index) => filteredRow(row, rows[index - 1], 4, 3)));
    const png = makePng({ width: 3, height: 2, channels: 3, scanlines });

    const invalidSignature = Buffer.from(png);
    invalidSignature[0] = 0;
    expect(() => decodeVisualLabPng(invalidSignature, 'signature')).toThrow(/PNG signature/);

    const invalidCrc = Buffer.from(png);
    invalidCrc[45] ^= 1;
    expect(() => decodeVisualLabPng(invalidCrc, 'crc')).toThrow(/PNG CRC/);

    const trailingStream = makePng({
      width: 3,
      height: 2,
      channels: 3,
      scanlines,
      compressed: Buffer.concat([deflateSync(scanlines), Buffer.from([0])]),
    });
    expect(() => decodeVisualLabPng(trailingStream, 'trailing')).toThrow(/trailing bytes/);

    const invalidFilter = makePng({
      width: 3,
      height: 1,
      channels: 3,
      scanlines: Buffer.from([5, ...rows[0]]),
    });
    expect(() => decodeVisualLabPng(invalidFilter, 'filter')).toThrow(/row filter/);
  });

  it('preserves the bounded dimension guard before decoding image bytes', () => {
    const png = makePng({
      width: 8_193,
      height: 1,
      channels: 3,
      scanlines: Buffer.from([0]),
    });
    expect(() => inspectVisualLabPng(png, 'budget')).toThrow(/bounded PNG capture budget/);
  });
});
