// cache.js
// Utilitários de cache local (localStorage) com suporte a TTL.
// Usado para evitar chamadas desnecessárias à API quando o usuário
// alterna entre regiões ou retorna à mesma moeda dentro do TTL configurado.
//
// API pública:
//   setCache(chave, valor, ttl?)  – persiste com TTL
//   getCache(chave)               – recupera se válido, senão null
//   hasCacheValid(chave)          – retorna boolean sem buscar o dado
//   clearCache(chave)             – remove entrada específica
//   clearCacheByPrefix(prefixo)   – remove todas as entradas com prefixo
//   clearAllCache()               – remove todo o cache tb_cache_*

const PREFIXO_CACHE = 'tb_cache_'
const TTL_PADRAO_MS = 5 * 60 * 1000 // 5 minutos

/**
 * Persiste um valor no localStorage com timestamp de expiração.
 * @param {string} chave - Identificador único do cache (ex: 'heatmap_BTC_24h')
 * @param {*} valor - Qualquer valor serializável em JSON
 * @param {number} [ttl=TTL_PADRAO_MS] - Tempo de vida em milissegundos
 */
export const setCache = (chave, valor, ttl = TTL_PADRAO_MS) => {
  try {
    const entrada = {
      dados: valor,
      expira: Date.now() + ttl,
    }
    localStorage.setItem(`${PREFIXO_CACHE}${chave}`, JSON.stringify(entrada))
  } catch (erro) {
    // Falha silenciosa – localStorage pode estar indisponível (ex: modo privativo)
    console.warn('[Cache] Não foi possível salvar:', chave, erro)
  }
}

/**
 * Recupera um valor do localStorage se ainda estiver dentro do TTL.
 * @param {string} chave - Identificador único do cache
 * @returns {*|null} O valor armazenado ou null se ausente/expirado
 */
export const getCache = (chave) => {
  try {
    const raw = localStorage.getItem(`${PREFIXO_CACHE}${chave}`)
    if (!raw) return null
    const entrada = JSON.parse(raw)
    if (Date.now() > entrada.expira) {
      localStorage.removeItem(`${PREFIXO_CACHE}${chave}`)
      return null
    }
    return entrada.dados
  } catch (erro) {
    console.warn('[Cache] Não foi possível ler:', chave, erro)
    return null
  }
}

/**
 * Verifica se existe uma entrada de cache válida (dentro do TTL) sem retornar o dado.
 * Use este método quando precisar apenas saber se há dado em cache, evitando desserializar
 * o payload completo só para fazer uma checagem visual ou condicional.
 * @param {string} chave - Identificador único do cache
 * @returns {boolean} true se existir entrada não expirada, false caso contrário
 */
export const hasCacheValid = (chave) => {
  try {
    const raw = localStorage.getItem(`${PREFIXO_CACHE}${chave}`)
    if (!raw) return false
    const entrada = JSON.parse(raw)
    return Date.now() <= entrada.expira
  } catch {
    return false
  }
}

/**
 * Remove uma entrada específica do cache.
 * @param {string} chave - Identificador único do cache
 */
export const clearCache = (chave) => {
  try {
    localStorage.removeItem(`${PREFIXO_CACHE}${chave}`)
  } catch (erro) {
    console.warn('[Cache] Não foi possível remover:', chave, erro)
  }
}

/**
 * Remove todas as entradas do cache que começam com determinado prefixo.
 * Útil para invalidar um grupo de entradas relacionadas sem limpar todo o cache.
 * @param {string} prefixo - Prefixo parcial da chave (sem o prefixo global tb_cache_)
 * @example clearCacheByPrefix('heatmap_BTC') // remove heatmap_BTC_24h, heatmap_BTC_7d, etc.
 */
export const clearCacheByPrefix = (prefixo) => {
  try {
    const chaveCompleta = `${PREFIXO_CACHE}${prefixo}`
    Object.keys(localStorage)
      .filter((k) => k.startsWith(chaveCompleta))
      .forEach((k) => localStorage.removeItem(k))
  } catch (erro) {
    console.warn('[Cache] Não foi possível limpar por prefixo:', prefixo, erro)
  }
}

/**
 * Remove todas as entradas do cache do ThinkBitcoin.
 */
export const clearAllCache = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIXO_CACHE))
      .forEach((k) => localStorage.removeItem(k))
  } catch (erro) {
    console.warn('[Cache] Não foi possível limpar o cache:', erro)
  }
}
