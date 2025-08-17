/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // TypeScript 설정이 덮어쓰이지 않도록 명시적으로 설정
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  // Electron 빌드를 위해 정적(static) export 설정을 합니다.
  output: 'export',
  // 빌드 결과물을 프로젝트 루트의 `dist/renderer` 폴더에 생성하도록 지정합니다.
  distDir: 'dist/renderer',
  // Electron의 file:// 프로토콜에서 에셋(JS, CSS)을 올바르게 로드하기 위해 상대 경로를 사용하도록 설정합니다.
  assetPrefix: './',
  images: { unoptimized: true },
};

export default nextConfig;
