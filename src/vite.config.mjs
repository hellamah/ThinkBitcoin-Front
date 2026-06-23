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
    // Ambiente Node puro: não há window/localStorage reais.
    // Os testes que dependem deles (ex.: cache, preferences) mockam essas APIs manualmente.
    // Para testar componentes React seria necessário trocar para 'jsdom'.
    environment: 'node',
    globals: false,
  },
});
