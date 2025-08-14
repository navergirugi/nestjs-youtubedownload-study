/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tailwind가 스타일을 적용할 파일들의 경로를 지정합니다.
  // renderer 폴더에서 실행되므로 현재 폴더 기준으로 설정합니다.
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}', // components 폴더도 포함
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};