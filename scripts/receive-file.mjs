/**
 * 브라우저가 만든 파일을 디스크에 받아 두기 위한 일회용 수신 서버.
 * 테스트 이미지를 만들 때만 잠깐 쓰고, 평소에는 실행하지 않는다.
 *
 * 실행: node scripts/receive-file.mjs
 */
import { createServer } from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sample');
mkdirSync(OUT_DIR, { recursive: true });

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  const name = basename(new URL(req.url, 'http://x').searchParams.get('name') ?? 'out.bin');
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const buffer = Buffer.concat(chunks);
    writeFileSync(join(OUT_DIR, name), buffer);
    console.log(`saved ${name} ${(buffer.length / 1024).toFixed(1)}KB`);
    res.writeHead(200).end('ok');
  });
}).listen(5199, () => console.log('listening on 5199'));
