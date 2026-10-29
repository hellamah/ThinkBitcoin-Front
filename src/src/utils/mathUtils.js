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
 * Converte um valor para número, ou null se não houver leitura utilizável.
 *
 * Existe porque Number(null), Number(undefined ?? '') e Number('') valem 0, e
 * 0 passa em Number.isFinite: converter antes de descartar faz uma medição
 * ausente entrar na série como zero — que numa série de mercado é uma
 * afirmação ("não variou", "não negociou"), não uma lacuna.
 *
 * @param {*} valor
 * @returns {number|null}
 */
export const paraNumero = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

/**
 * Extrai os números utilizáveis de uma série.
 *
 * @param {Array<number|null>} values
 * @returns {number[]}
 */
const numerosValidos = (values) => {
  if (!Array.isArray(values)) return []
  return values.map(paraNumero).filter((v) => v !== null)
}

/**
 * Média aritmética de uma série, ignorando valores não numéricos.
 *
 * @param {Array<number|null>} values
 * @returns {number|null} - null se não houver valor válido.
 */
export const mean = (values) => {
  const validos = numerosValidos(values)
  if (validos.length === 0) return null
  return validos.reduce((a, b) => a + b, 0) / validos.length
}

/**
 * Desvio padrão populacional de uma série, ignorando valores não numéricos.
 * Populacional (divide por n) porque a série é o período inteiro observado,
 * não uma amostra dele.
 *
 * @param {Array<number|null>} values
 * @returns {number|null} - null se não houver valor válido.
 */
export const stdDev = (values) => {
  const validos = numerosValidos(values)
  if (validos.length === 0) return null

  const media = validos.reduce((a, b) => a + b, 0) / validos.length
  const variancia =
    validos.reduce((acc, v) => acc + (v - media) ** 2, 0) / validos.length
  return Math.sqrt(variancia)
}

/**
 * Calcula a mediana de uma série numérica, ignorando valores não numéricos.
 * Preferida à média como referência de "normalidade" em séries de mercado,
 * onde um único candle atípico distorce a média.
 *
 * @param {Array<number|null>} values - Array de valores numéricos ou null.
 * @returns {number|null} - A mediana, ou null se não houver valor válido.
 */
export const median = (values) => {
  const validos = numerosValidos(values).sort((a, b) => a - b)

  if (validos.length === 0) return null

  const meio = Math.floor(validos.length / 2)
  return validos.length % 2 === 0
    ? (validos[meio - 1] + validos[meio]) / 2
    : validos[meio]
}

// z de 1,96 corresponde a 95% de confiança na normal padrão.
const Z_95 = 1.96

/**
 * Intervalo de confiança de Wilson para uma proporção.
 *
 * Escolhido em vez da aproximação normal justamente porque as amostras aqui
 * são pequenas: com n baixo ou proporção perto de 0% ou 100%, a aproximação
 * normal produz intervalos que saem de [0, 1] e sugerem precisão que não
 * existe. Wilson é assimétrico e permanece dentro dos limites.
 *
 * @param {number} sucessos
 * @param {number} total
 * @param {number} [z] - Escore normal; 1,96 = 95%.
 * @returns {{inferior: number, superior: number}|null} - Em %, ou null sem amostra.
 */
export const intervaloWilson = (sucessos, total, z = Z_95) => {
  const n = paraNumero(total)
  const k = paraNumero(sucessos)
  if (n === null || k === null || n <= 0 || k < 0 || k > n) return null

  const p = k / n
  const z2 = z * z
  const denominador = 1 + z2 / n
  const centro = (p + z2 / (2 * n)) / denominador
  const margem =
    (z / denominador) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))

  return {
    inferior: Math.max(0, centro - margem) * 100,
    superior: Math.min(1, centro + margem) * 100,
  }
}

/**
 * Quantil de uma série JÁ ORDENADA, com interpolação linear entre vizinhos.
 *
 * Recebe a série ordenada em vez de ordenar por conta própria porque quem pede
 * um quantil quase sempre pede três ou quatro da mesma distribuição — ordenar
 * a cada chamada seria trabalho repetido sobre os mesmos números.
 *
 * @param {number[]} ordenados - Crescente, sem null.
 * @param {number} p - Em [0, 1].
 * @returns {number|null} - null com série vazia.
 */
export const quantil = (ordenados, p) => {
  if (!Array.isArray(ordenados) || ordenados.length === 0) return null
  if (!(p >= 0 && p <= 1)) return null
  const posicao = (ordenados.length - 1) * p
  const base = Math.floor(posicao)
  const resto = posicao - base
  const proximo = ordenados[base + 1]
  return proximo === undefined
    ? ordenados[base]
    : ordenados[base] + resto * (proximo - ordenados[base])
}

/**
 * Gerador pseudoaleatório com semente (mulberry32).
 *
 * `Math.random` não serve para o que a plataforma sorteia: a régua aleatória e
 * o bootstrap são desenhados na tela, e com `Math.random` cada render sortearia
 * de novo — o percentil pularia de 91 para 88 sem que nada tivesse mudado, e
 * quem olhasse concluiria que o número é instável quando o que mudou foi só o
 * sorteio. Com semente, a mesma entrada produz sempre a mesma saída, e os
 * testes conseguem cravar o resultado.
 *
 * Qualidade estatística de sobra para reamostragem; não é criptográfico.
 *
 * @param {number} semente - Inteiro; o mesmo valor reproduz a mesma sequência.
 * @returns {() => number} - Cada chamada devolve um número em [0, 1).
 */
export const geradorAleatorio = (semente = 1) => {
  let estado = semente >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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
