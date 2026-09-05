import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/analyze-budget': 'http://localhost:3001',
    },
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      input: {
        main:        resolve(__dirname, 'index.html'),
        app:         resolve(__dirname, 'app.html'),
        goals:       resolve(__dirname, 'goals.html'),
        profile:     resolve(__dirname, 'profile.html'),
        analytics:   resolve(__dirname, 'analytics.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/chartjs')) return 'chartjs';
          if (id.includes('node_modules/leaflet')) return 'leaflet';
        },
      },
    },
  },
});
