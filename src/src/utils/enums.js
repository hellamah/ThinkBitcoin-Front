// enums.js
// Definições de enumerações reutilizáveis no projeto

export const ChartType = Object.freeze({
  TRADED_VALUE: 'tradedValue',
  PERCENT_VARIATION: 'percentVariation',
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

