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
