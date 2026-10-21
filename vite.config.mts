import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        page1: resolve(__dirname, 'page1.html'),
        page2: resolve(__dirname, 'page2.html'),
        page3: resolve(__dirname, 'page3.html'),
      },
    },
  },
});
