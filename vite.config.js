import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react' 如果你是 React 环境
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 支持我们代码里的暗色模式切换
  theme: {
    extend: {},
  },
  plugins: [
  tailwindcss(),
  ],
})