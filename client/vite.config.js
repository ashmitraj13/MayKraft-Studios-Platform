import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api and /socket.io are proxied to the Express server, so no CORS setup is needed locally.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5050',
      '/socket.io': { target: 'http://localhost:5050', ws: true },
    },
  },
});
