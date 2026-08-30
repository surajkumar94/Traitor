import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative asset paths keep the same build working on user.github.io/<repo>/,
  // a custom domain, or any static host without a rebuild.
  base: './',
  plugins: [react(), tailwindcss()],
  server: { host: true },
});
