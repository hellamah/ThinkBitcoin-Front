import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Sem VITE_API_URL, o fallback de api.js monta a URL a partir do hostname atual
// somado à porta do Minikube: em produção isso vira https://minerthinkbitcoin.com:13502
// e *toda* request falha, sem um único aviso dizendo por quê. Falhar aqui, no
// build, custa um job vermelho; falhar em produção custa um app mudo no ar.
// Para inspecionar o bundle localmente: VITE_API_URL=http://localhost:13501 npm run build
const guardApiUrl = (mode) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (env.VITE_API_URL) return;
  throw new Error(
    'VITE_API_URL não está definida neste build de produção.\n' +
    'O app cairia no fallback de portas do Minikube e não conseguiria falar com a API.\n' +
    'Defina a variável no projeto da Vercel (ou no ambiente do build) e rode de novo.'
  );
};

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'production') guardApiUrl(mode);

  return {
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
  };
});
