import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/analyze-budget': 'http://localhost:3001',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main:    resolve(__dirname, 'index.html'),
        app:     resolve(__dirname, 'app.html'),
        goals:   resolve(__dirname, 'goals.html'),
        profile: resolve(__dirname, 'profile.html'),
      },
    },
  },
});
