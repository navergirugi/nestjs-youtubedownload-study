/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Electron 빌드를 위해 정적(static) export 설정을 합니다.
  output: 'export',
  images: { unoptimized: true },
}

module.exports = nextConfig