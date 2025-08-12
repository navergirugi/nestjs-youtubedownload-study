/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tailwind가 스타일을 적용할 파일들의 경로를 지정합니다.
  // UI 코드가 있는 'renderer' 폴더를 가리키도록 설정합니다.
  content: [
    './renderer/pages/**/*.{js,ts,jsx,tsx}',
    './renderer/components/**/*.{js,ts,jsx,tsx}', // components 폴더도 포함
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};