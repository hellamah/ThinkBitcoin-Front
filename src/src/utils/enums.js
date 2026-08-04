// enums.js
// Definições de enumerações reutilizáveis no projeto

export const ChartType = Object.freeze({
  TRADED_VALUE: 'tradedValue',
  PERCENT_VARIATION: 'percentVariation',
});

/**
 * Como o gráfico de preço é desenhado.
 * LINE – linha do preço de fechamento.
 * CANDLE – candles OHLC; só faz sentido com uma única moeda selecionada.
 */
export const PriceChartMode = Object.freeze({
  LINE: 'linha',
  CANDLE: 'vela',
});

// Como as séries são reescaladas para comparação entre moedas. Os valores
// eram strings soltas repetidas no Dashboard, no hook e no seletor.
export const Normalization = Object.freeze({
  RAW: 'bruto',
  BASE_100: 'base100',
  MIN_MAX: 'minmax',
  Z_SCORE: 'zscore',
});

// Assunto do segundo painel. Separado de PriceChartMode de propósito: aquele
// controla COMO o preço é desenhado, este controla O QUE o painel ao lado
// mostra. Amarrar os dois faria o seletor de visualização trocar o conteúdo
// da tela, que não é o que o rótulo promete.
export const SecondaryChart = Object.freeze({
  VARIATION: 'variacao',
  VOLUME: 'volume',
});

export const FilterResult = Object.freeze({
  ALL: 'ALL',
  WIN: 'WIN',
  LOSS: 'LOSS',
});

export const FilterInterval = Object.freeze({
  H24: '24h',
  D7: '7d',
  M1: '1m',
  CUSTOM: 'custom',
});

export const MapRegion = Object.freeze({
  WORLD: 'world',
  AMERICAS: '019',
  EUROPE: '150',
  ASIA: '142',
  AFRICA: '002',
  OCEANIA: '009',
});

/**
 * Variante de tema visual da plataforma.
 * DEFAULT – tema escuro padrão.
 * HIGH_CONTRAST – alto contraste para acessibilidade.
 */
export const ThemeVariant = Object.freeze({
  DEFAULT: 'default',
  HIGH_CONTRAST: 'high-contrast',
});

/**
 * Formatos de exportação de dados do Heatmap.
 */
export const ExportFormat = Object.freeze({
  CSV: 'csv',
  JSON: 'json',
  PNG: 'png',
});

/**
 * Métrica usada para colorir o mapa geopolítico.
 * LIDERANCA – nº de vezes que o país liderou as buscas no período.
 * INTENSIDADE – intensidade média de busca (0-100).
 */
export const MapMetric = Object.freeze({
  LIDERANCA: 'lideranca',
  INTENSIDADE: 'intensidade',
});

