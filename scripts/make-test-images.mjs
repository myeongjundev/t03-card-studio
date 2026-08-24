/**
 * 테스트용 이미지를 코드로 만든다.
 *
 * 인터넷에서 가져온 이미지는 사용 권한과 EXIF 위치 정보가 문제가 될 수 있어
 * 직접 생성한다. 여기서 만든 파일에는 메타데이터가 아예 들어가지 않는다.
 *
 * 실행: node scripts/make-test-images.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sample');

// ── 최소 PNG 인코더 (8bit RGBA) ──────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** @param {(x:number,y:number)=>[number,number,number,number]} shade */
function encodePng(width, height, shade) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // 필터 없음
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = shade(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
      offset += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // 10~12: compression / filter / interlace 는 모두 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 테스트 이미지 3종 ────────────────────────────────────
const clamp255 = (value) => Math.max(0, Math.min(255, Math.round(value)));

/** 세로로 긴 이미지. cover 에서 좌우가 잘리는지 본다. */
const portrait = encodePng(800, 1400, (x, y) => {
  const band = Math.floor(y / 100) % 2;
  const gx = (x / 800) * 90;
  const gy = (y / 1400) * 120;
  const grid = x % 100 < 3 || y % 100 < 3 ? 45 : 0;
  return [clamp255(30 + gx + grid), clamp255(60 + gy + grid), clamp255(120 + band * 25 + grid), 255];
});

/** 가로로 긴 이미지. cover 에서 위아래가 잘리는지 본다. */
const landscape = encodePng(1600, 600, (x, y) => {
  const band = Math.floor(x / 200) % 2;
  const grid = x % 200 < 3 || y % 100 < 3 ? 50 : 0;
  return [
    clamp255(150 - (x / 1600) * 80 + grid),
    clamp255(60 + (y / 600) * 90 + band * 20 + grid),
    clamp255(70 + grid),
    255,
  ];
});

/** 투명 PNG. 가운데 원만 불투명하고 나머지는 완전 투명이다. */
const transparent = encodePng(600, 600, (x, y) => {
  const dx = x - 300;
  const dy = y - 300;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > 260) return [0, 0, 0, 0]; // 완전 투명
  const edge = distance > 250 ? clamp255((260 - distance) * 25) : 255;
  return [clamp255(255 - distance * 0.4), clamp255(90 + distance * 0.3), 120, edge];
});

mkdirSync(OUT_DIR, { recursive: true });
const files = [
  ['portrait-800x1400.png', portrait],
  ['landscape-1600x600.png', landscape],
  ['transparent-circle-600x600.png', transparent],
];
for (const [name, buffer] of files) {
  writeFileSync(join(OUT_DIR, name), buffer);
  console.log(`${name}  ${(buffer.length / 1024).toFixed(1)}KB`);
}
