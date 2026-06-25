/**
 * Utilitários matemáticos para processamento de dados de mercado.
 */

/**
 * Normaliza uma série de valores para Base 100.
 * O primeiro valor válido da série torna-se 100 e os subsequentes são proporcionais.
 * 
 * @param {Array<number|null>} values - Array de valores numéricos ou null.
 * @returns {Array<number|null>} - Array normalizado.
 */
export const normalizeToBase100 = (values) => {
  if (!Array.isArray(values) || values.length === 0) return values
  const firstValue = values.find(v => v !== null && v !== undefined && v !== 0)
  if (!firstValue) return values
  return values.map(v => (v !== null && v !== undefined ? (v / firstValue) * 100 : null))
}

/**
 * Normaliza uma série de valores usando Min-Max (escala de 0 a 1).
 * 
 * @param {Array<number|null>} values - Array de valores numéricos ou null.
 * @returns {Array<number|null>} - Array normalizado entre 0 e 1.
 */
export const normalizeMinMax = (values) => {
  if (!Array.isArray(values) || values.length === 0) return values
  const validValues = values.filter(v => v !== null && v !== undefined)
  if (validValues.length === 0) return values
  
  const min = Math.min(...validValues)
  const max = Math.max(...validValues)
  const range = max - min
  
  if (range === 0) return values.map(v => (v !== null && v !== undefined ? 1 : null))
  return values.map(v => (v !== null && v !== undefined ? (v - min) / range : null))
}

/**
 * Normaliza uma série de valores usando Z-Score.
 * Representa quantos desvios padrão um valor está da média.
 * 
 * @param {Array<number|null>} values - Array de valores numéricos ou null.
 * @returns {Array<number|null>} - Array normalizado em Z-Score.
 */
export const normalizeZScore = (values) => {
  if (!Array.isArray(values) || values.length === 0) return values
  const validValues = values.filter(v => v !== null && v !== undefined)
  if (validValues.length === 0) return values
  
  const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length
  const variance = validValues.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / validValues.length
  const stdDev = Math.sqrt(variance)
  
  if (stdDev === 0) return values.map(v => (v !== null && v !== undefined ? 0 : null))
  return values.map(v => (v !== null && v !== undefined ? (v - mean) / stdDev : null))
}

/**
 * Formata um valor numérico para moeda (USD por padrão).
 * 
 * @param {number|string} value - Valor a ser formatado.
 * @param {string} [currency='USD'] - Símbolo da moeda.
 * @returns {string} - Valor formatado (ex: $1.234,56).
 */
export const formatCurrency = (value, currency = 'USD') => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (isNaN(num)) return '-'
  return num.toLocaleString('en-US', { 
    style: 'currency', 
    currency 
  })
}

/**
 * Formata um valor numérico para percentual com ou sem sinal.
 * 
 * @param {number|string} value - Valor percentual (ex: 5.2).
 * @param {number} [precision=2] - Casas decimais.
 * @param {boolean} [includeSign=true] - Se deve incluir o sinal de + para positivos.
 * @returns {string} - Valor formatado (ex: +5.20% ou 5.20%).
 */
export const formatPercent = (value, precision = 2, includeSign = true) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (isNaN(num)) return '-'
  const sign = (includeSign && num >= 0) ? '+' : ''
  return `${sign}${num.toFixed(precision)}%`
}

/**
 * Formata um número para formato compacto (ex: 1.2K, 2.5M, 1.2B).
 * 
 * @param {number|string} value - O número a ser formatado.
 * @param {number} [precision=2] - Casas decimais.
 * @returns {string} - O número formatado de forma compacta.
 */
export const formatCompact = (value, precision = 2) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (isNaN(num)) return '-'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: precision
  }).format(num)
}

/**
 * Formata um número decimal com precisão fixa.
 * 
 * @param {number|string} value - O número a ser formatado.
 * @param {number} [precision=2] - Casas decimais.
 * @returns {string} - O número formatado.
 */
export const formatNumber = (value, precision = 2) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (isNaN(num)) return '-'
  return num.toFixed(precision)
}
