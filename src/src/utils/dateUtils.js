/**
 * Utilitários para conversão de datas (UTC <=> Local)
 * Assegura que todas as datas do backend (UTC) sejam exibidas no fuso do usuário
 * e as seleções de data do usuário sejam enviadas como UTC ISO.
 */

/**
 * Converte uma string UTC (com ou sem Z) para o formato local amigável.
 * @param {string} utcString - Data em formato ISO (ex: 2026-04-01T00:00:00)
 * @returns {string} - Data/Hora no formato local (ex: 31/03/2026 21:00:00)
 */
export const toLocal = (utcString) => {
  if (!utcString) return '-'
  try {
    // Garante sufixo Z para que o motor JS trate como UTC absoluto
    const cleanStr = utcString.endsWith('Z') || utcString.includes('+') || utcString.includes('-')
      ? utcString 
      : `${utcString}Z`
    
    return new Date(cleanStr).toLocaleString()
  } catch (err) {
    console.error('Erro ao converter data para local:', err)
    return utcString
  }
}

/**
 * Converte uma string UTC para um label reduzido (HH:mm dd/MM) em fuso local.
 * Útil para labels de gráficos.
 * @param {string} utcString 
 * @returns {string} 
 */
export const toLocalChartLabel = (utcString) => {
  if (!utcString) return ''
  try {
    const cleanStr = utcString.endsWith('Z') || utcString.includes('+') || utcString.includes('-')
      ? utcString 
      : `${utcString}Z`
    
    const d = new Date(cleanStr)
    return d.toLocaleString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      day: '2-digit', 
      month: '2-digit' 
    })
  } catch (err) {
    return utcString
  }
}

/**
 * Garante que uma data/string local seja convertida para UTC ISO string antes do envio à API.
 * @param {Date|string} localInput 
 * @returns {string|null}
 */
export const toUTCISO = (localInput) => {
  if (!localInput) return null
  try {
    const d = new Date(localInput)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  } catch (err) {
    return null
  }
}
