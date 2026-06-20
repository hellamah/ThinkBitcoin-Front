// mapUtils.js
// Utilitários de mapeamento e estilização para o Heatmap geopolítico

import { MapRegion } from './enums';

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
 * @param {number} value - Percentual de dominância
 * @param {object} [extras={}] - Dados extras opcionais para exibição no tooltip
 * @param {number} [extras.variacao24h] - Variação percentual nas últimas 24h
 * @param {number} [extras.volume] - Volume de negociação em USD
 * @returns {string} String HTML
 */
export const formatTooltipData = (countryName, coinSymbol, value, extras = {}) => {
  const sentiment = getMarketSentiment(value);
  const { variacao24h, volume } = extras;

  const corVariacao = variacao24h >= 0 ? '#4ade80' : '#f87171';
  const sinaisVariacao = variacao24h >= 0 ? '+' : '';

  const blocoVariacao = variacao24h !== undefined ? `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
      <span style="font-size: 12px; color: rgba(255,255,255,0.65);">Variação 24h:</span>
      <span style="font-size: 13px; font-weight: 700; color: ${corVariacao}; font-family: 'Share Tech Mono', monospace;">
        ${sinaisVariacao}${Number(variacao24h).toFixed(2)}%
      </span>
    </div>
  ` : '';

  const formatarVolume = (v) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${v}`;
  };

  const blocoVolume = volume !== undefined ? `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
      <span style="font-size: 12px; color: rgba(255,255,255,0.65);">Volume:</span>
      <span style="font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.9); font-family: 'Share Tech Mono', monospace;">
        ${formatarVolume(volume)}
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
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
        <span style="font-size: 13px; color: rgba(255,255,255,0.75);">Dominância ${coinSymbol}:</span>
        <span style="font-size: 15px; font-weight: 800; color: #ffd700; font-family: 'Share Tech Mono', monospace;">
          ${value}%
        </span>
      </div>
      ${blocoVariacao}
      ${blocoVolume}
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
 * @param {string} countryCode - ISO do país
 * @param {Array} allCoins - Lista completa de moedas do carrossel
 * @returns {Array} Lista filtrada de moedas
 */
export const filterCoinsByCountry = (countryCode, allCoins) => {
  if (!countryCode || !allCoins) return allCoins;
  const code = String(countryCode).toUpperCase().trim();
  
  return allCoins.filter(coin => {
    const sym = String(coin.simbolo).toUpperCase();
    if (code === 'US') return true;
    if (code === 'BR') return ['BTC', 'ETH', 'SOL', 'USDT'].includes(sym);
    if (code === 'DE') return ['BTC', 'ETH', 'ADA', 'DOT'].includes(sym);
    if (code === 'JP') return ['BTC', 'XRP', 'SOL', 'DOGE'].includes(sym);
    if (code === 'CH') return ['ETH', 'SOL', 'AVAX', 'LINK'].includes(sym);
    
    // Hash determinístico simples para outros países
    const val = (code.charCodeAt(0) + (code.charCodeAt(1) || 0) + sym.charCodeAt(0)) % 3;
    return val === 0 || sym === 'BTC'; // Garante que BTC sempre apareça
  });
};

