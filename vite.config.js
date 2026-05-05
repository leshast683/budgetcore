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
        main:        resolve(__dirname, 'index.html'),
        app:         resolve(__dirname, 'app.html'),
        goals:       resolve(__dirname, 'goals.html'),
        profile:     resolve(__dirname, 'profile.html'),
        analytics:   resolve(__dirname, 'analytics.html'),
        investments: resolve(__dirname, 'investments.html'),
        networth:    resolve(__dirname, 'networth.html'),
        challenges:  resolve(__dirname, 'challenges.html'),
      },
    },
  },
});
