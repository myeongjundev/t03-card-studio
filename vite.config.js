import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 상대 경로로 빌드한다. GitHub Pages의 프로젝트 페이지
  // (https://<id>.github.io/<repo>/)에서 저장소 이름과 무관하게 동작한다.
  base: './',
  plugins: [react()],
});
