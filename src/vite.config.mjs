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
    // `npm run preview` serve o bundle de produção com a MESMA CSP que o
    // vercel.json e o default.conf publicam. É o único jeito de exercitar a
    // política antes do deploy: `npm run dev` não serve, porque o dev server
    // injeta script inline e usa eval para o refresh, e acusaria violações que
    // não existem em produção.
    //
    // Foi assim que apareceu o `https://www.gstatic.com` no style-src: o pacote
    // geochart do Google Charts busca tooltip.css e util.css do gstatic, e sem
    // essa origem o load do pacote nunca completa — o mapa inteiro fica em
    // branco. A política vinha como Report-Only, então isso passou despercebido
    // até alguém ligá-la.
    //
    // ATENÇÃO: são três cópias da mesma política (aqui, vercel.json e
    // default.conf). Mudou uma, mude as três — arquivo estático não importa
    // constante de JS.
    //
    // A única divergência proposital está no connect-src: as duas cópias que
    // servem localmente (esta e a default.conf, que vai na imagem publicada em
    // localhost:3000 pelo Helm) liberam as origens locais da API, porque o
    // api.js ignora VITE_API_URL quando o hostname é localhost e monta
    // http://localhost:13501 pelas portas do minikube. O vercel.json, que é
    // produção, continua sem elas — lá não existe API em localhost.
    preview: {
      headers: {
        'Content-Security-Policy':
          "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://www.gstatic.com; font-src 'self' data:; img-src 'self' data: blob: https://www.gstatic.com; connect-src 'self' https://api.minerthinkbitcoin.com https://thinkbitcoin-api.ddns.net https://www.gstatic.com http://localhost:* http://127.0.0.1:* https://thinkbitcoin.local:*; frame-src 'none'; upgrade-insecure-requests",
      },
    },
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
