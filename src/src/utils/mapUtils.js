// mapUtils.js
// Utilitários de mapeamento e estilização para o Heatmap geopolítico

import { MapRegion } from './enums';

/**
 * Resolve o nome localizado de um país a partir do código ISO usando a API
 * nativa Intl.DisplayNames (cobre todos os países, em qualquer idioma).
 * Instâncias são cacheadas por locale; códigos inválidos retornam o próprio código.
 * @param {string} code - Código ISO do país (ex: BR, US, TR)
 * @param {string} [locale='en'] - Locale BCP 47 (ex: 'pt', 'en'). Acompanha o
 *   idioma padrão do app; na prática todo chamador passa o locale do registro.
 * @returns {string} Nome do país localizado, ou o código se não resolvido
 */
const displayNamesCache = {};
export const getCountryName = (code, locale = 'en') => {
  const c = String(code || '').toUpperCase().trim();
  try {
    if (!displayNamesCache[locale]) {
      displayNamesCache[locale] = new Intl.DisplayNames([locale], { type: 'region' });
    }
    return displayNamesCache[locale].of(c) || c;
  } catch {
    return c;
  }
};

/**
 * Retorna o sentimento de mercado correspondente ao percentual de dominância/busca.
 * @param {number} value - Percentual de dominância
 * @returns {string} Frase de sentimento de mercado
 */
export const getMarketSentiment = (value) => {
  const num = Number(value);
  if (num >= 75) return '🔥 Engajamento Crítico (Narrativa Dominante)';
  if (num >= 40) return '🚀 Aceleração Forte (Adoção em Alta)';
  if (num >= 15) return '📈 Interesse Moderado (Estável)';
  if (num > 0) return '⏳ Baixo Interesse (Acumulação Lenta)';
  return '❄️ Sem Atividade Relevante';
};

/**
 * Gera a string de HTML para exibição do Tooltip customizado premium e com glassmorphism.
 * @param {string} countryName - Nome formatado do país
 * @param {string} coinSymbol - Símbolo da moeda selecionada (ex: BTC, ETH)
 * @param {number} value - Participação percentual dentro do top 5
 * @param {object} [extras={}] - Dados extras opcionais para exibição no tooltip
 * @param {number} [extras.variacao24h] - Variação percentual recente do preço do ativo
 * @param {number} [extras.lideranca] - Nº de vezes que o país liderou as buscas no período
 * @param {number} [extras.intensidade] - Intensidade média de busca (0-100)
 * @param {object} [labels={}] - Rótulos localizados (fallback em PT-BR)
 * @returns {string} String HTML
 */
export const formatTooltipData = (countryName, coinSymbol, value, extras = {}, labels = {}) => {
  const sentiment = getMarketSentiment(value);
  const { variacao24h, lideranca, intensidade } = extras;
  const rotulos = {
    participacao: labels.participacao || 'Participação no top 5',
    lideranca: labels.lideranca || 'Liderança de buscas',
    intensidade: labels.intensidade || 'Intensidade média',
    variacao: labels.variacao || 'Variação',
  };

  const corVariacao = variacao24h >= 0 ? '#4ade80' : '#f87171';
  const sinaisVariacao = variacao24h >= 0 ? '+' : '';

  const blocoVariacao = variacao24h !== undefined && variacao24h !== null ? `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
      <span style="font-size: 12px; color: rgba(255,255,255,0.65);">${rotulos.variacao} ${coinSymbol}:</span>
      <span style="font-size: 13px; font-weight: 700; color: ${corVariacao}; font-family: 'Share Tech Mono', monospace;">
        ${sinaisVariacao}${Number(variacao24h).toFixed(2)}%
      </span>
    </div>
  ` : '';

  const blocoLideranca = lideranca !== undefined && lideranca !== null ? `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
      <span style="font-size: 12px; color: rgba(255,255,255,0.65);">${rotulos.lideranca}:</span>
      <span style="font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.9); font-family: 'Share Tech Mono', monospace;">
        ${lideranca}x
      </span>
    </div>
  ` : '';

  const blocoIntensidade = intensidade !== undefined && intensidade !== null && Number(intensidade) > 0 ? `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
      <span style="font-size: 12px; color: rgba(255,255,255,0.65);">${rotulos.intensidade}:</span>
      <span style="font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.9); font-family: 'Share Tech Mono', monospace;">
        ${Number(intensidade).toFixed(0)}/100
      </span>
    </div>
  ` : '';

  return `
    <div style="
      padding: 14px 18px;
      background: rgba(15, 15, 15, 0.97);
      border: 1px solid rgba(255, 215, 0, 0.35);
      border-radius: 14px;
      color: #ffffff;
      font-family: 'Outfit', sans-serif;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,215,0,0.08);
      backdrop-filter: blur(16px);
      min-width: 220px;
      pointer-events: none;
    ">
      <div style="font-size: 11px; text-transform: uppercase; color: #ffd700; font-weight: 800; letter-spacing: 0.8px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">
        📍 ${countryName}
      </div>
      ${Number(value) > 0 ? `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
        <span style="font-size: 13px; color: rgba(255,255,255,0.75);">${rotulos.participacao}:</span>
        <span style="font-size: 15px; font-weight: 800; color: #ffd700; font-family: 'Share Tech Mono', monospace;">
          ${value}%
        </span>
      </div>` : ''}
      ${blocoLideranca}
      ${blocoIntensidade}
      ${blocoVariacao}
      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #fff; font-weight: 500; display: flex; align-items: center; gap: 4px;">
        ${sentiment}
      </div>
    </div>
  `;
};

/**
 * Retorna o código de região (continente) de acordo com o código ISO do país.
 * Permite auto-zoom interativo nas regiões corretas.
 * @param {string} countryCode - ISO do país (ex: BR, US, DE)
 * @returns {string} Código de região do MapRegion
 */
export const getRegionForCountry = (countryCode) => {
  const code = String(countryCode).toUpperCase().trim();
  const americas = ['US', 'CA', 'BR', 'AR', 'MX', 'CO', 'CL', 'PE', 'VE'];
  const europe = ['DE', 'CH', 'GB', 'FR', 'NO', 'SE', 'NL', 'IT', 'ES', 'PT', 'RU', 'UA', 'PL'];
  const asia = ['JP', 'CN', 'IN', 'SG', 'KR', 'AE', 'SA', 'TR', 'HK', 'TW'];
  const africa = ['ZA', 'NG', 'EG', 'KE', 'GH', 'MA'];
  const oceania = ['AU', 'NZ'];

  if (americas.includes(code)) return MapRegion.AMERICAS;
  if (europe.includes(code)) return MapRegion.EUROPE;
  if (asia.includes(code)) return MapRegion.ASIA;
  if (africa.includes(code)) return MapRegion.AFRICA;
  if (oceania.includes(code)) return MapRegion.OCEANIA;

  return MapRegion.WORLD;
};

/**
 * Filtra a lista de moedas com base no país selecionado (interatividade mapa-carrossel).
 * Usa dado real: cada moeda do carrossel carrega o último registro de /trend com
 * `geoTop1Code` (país que lidera as buscas por aquele ativo). Ficam no carrossel
 * as moedas cujo país líder é o país clicado no mapa.
 * @param {string} countryCode - ISO do país
 * @param {Array} allCoins - Lista completa de moedas do carrossel (com `trend` anexado)
 * @returns {Array} Lista filtrada de moedas
 */
export const filterCoinsByCountry = (countryCode, allCoins) => {
  if (!countryCode || !allCoins) return allCoins;
  const code = String(countryCode).toUpperCase().trim();

  return allCoins.filter(coin =>
    String(coin?.trend?.geoTop1Code || '').toUpperCase().trim() === code
  );
};

