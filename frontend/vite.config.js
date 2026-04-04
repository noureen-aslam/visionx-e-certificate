import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/synapse-ai/', // Add this line
  server: {
    port: 3000,
  },
});