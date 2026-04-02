import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// FIXED: added /api proxy so frontend uses relative paths instead of hardcoded localhost
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
