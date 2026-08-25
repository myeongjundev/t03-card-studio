/**
 * 빌드 결과(dist)를 정적으로 서빙한다. e2e 는 개발 서버가 아니라
 * **실제로 배포되는 것과 같은 산출물**을 대상으로 해야 의미가 있다.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

export async function startDistServer() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist/index.html 이 없다. npm run build 를 먼저 실행할 것.');
  }

  const server = http.createServer((req, res) => {
    // base 가 './' 라 요청은 루트 기준으로 들어온다.
    const url = new URL(req.url, 'http://localhost');
    const rel = url.pathname.replace(/^\/+/, '');
    const file = path.join(DIST, rel === '' ? 'index.html' : rel);

    // dist 밖으로 나가는 경로는 거부한다.
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, body) => {
      if (error) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
