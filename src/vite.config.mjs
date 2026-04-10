import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ThinkBitcoin': {
        target: 'http://localhost:13501',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  test: {
    // Arquivo executado antes de cada suite de testes para configurar o ambiente
    setupFiles: ['./test/vitest.setup.js'],
    // Simula um ambiente de browser para testes de código que acessa window/localStorage
    environment: 'node',
    globals: false,
  },
});
