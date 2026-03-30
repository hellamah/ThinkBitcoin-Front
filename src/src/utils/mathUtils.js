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
