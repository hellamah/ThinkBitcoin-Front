// Registro único dos idiomas suportados.
//
// Antes desta lista, o conjunto de idiomas vivia duplicado em seis lugares: o
// enum Language, o normalizeLanguage, o mapa do useTranslation, dois <MenuItem>
// escritos à mão e o mapa do teste de paridade — além de um ternário binário no
// heatmap que fazia todo idioma novo cair calado em português. Acrescentar um
// idioma significava lembrar de todos. Agora significa acrescentar uma linha
// aqui e um arquivo ao lado.

import pt from './pt.json'

/**
 * @typedef {Object} Idioma
 * @property {string} codigo   - Chave usada nas preferências e no nome do JSON
 * @property {string} rotulo   - Nome do idioma NELE MESMO (endônimo). Quem
 *   procura "Français" numa lista não procura por "Francês": o rótulo não é
 *   traduzido de propósito.
 * @property {string} htmlLang - Valor do atributo lang do <html>, para leitor
 *   de tela e para busca
 * @property {string} intl     - Locale BCP 47 para Intl (nomes de país, datas)
 */

/** @type {ReadonlyArray<Idioma>} */
export const LANGUAGES = Object.freeze([
  { codigo: 'pt', rotulo: 'Português', htmlLang: 'pt-BR', intl: 'pt-BR' },
  { codigo: 'en', rotulo: 'English', htmlLang: 'en', intl: 'en-US' },
  { codigo: 'es', rotulo: 'Español', htmlLang: 'es', intl: 'es-ES' },
  { codigo: 'fr', rotulo: 'Français', htmlLang: 'fr', intl: 'fr-FR' },
  { codigo: 'it', rotulo: 'Italiano', htmlLang: 'it', intl: 'it-IT' },
])

export const LANGUAGE_CODES = Object.freeze(LANGUAGES.map((l) => l.codigo))

export const IDIOMA_PADRAO = 'pt'

// O português é o único importado estaticamente. Ele é o fallback: enquanto o
// dicionário escolhido não chega, `t()` responde em português em vez de
// devolver o nome cru da chave ("nav.dashboard") na tela.
export const dicionarioPadrao = pt

/** Devolve os metadados do idioma, caindo no padrão quando o código é inválido. */
export const idiomaDe = (codigo) =>
  LANGUAGES.find((l) => l.codigo === codigo) ??
  LANGUAGES.find((l) => l.codigo === IDIOMA_PADRAO)

// Os dicionários entram por import dinâmico: cada um pesa ~10 KB gzip e o
// usuário precisa exatamente de um. Estaticamente, os cinco viajariam no chunk
// principal para todo visitante.
//
// O pt.json fica de fora do glob de propósito: ele já é estático logo acima, e
// incluí-lo aqui faria o Rollup avisar que o import dinâmico não consegue
// movê-lo de chunk — verdade, e intencional, já que ele é o fallback.
const carregadores = import.meta.glob(['./*.json', '!./pt.json'])

/**
 * Carrega o dicionário de um idioma sob demanda.
 * @param {string} codigo
 * @returns {Promise<object|null>} O dicionário, ou null se não houver arquivo
 */
export const carregarDicionario = async (codigo) => {
  if (codigo === IDIOMA_PADRAO) return dicionarioPadrao
  const carregar = carregadores[`./${codigo}.json`]
  if (!carregar) return null
  const modulo = await carregar()
  return modulo.default ?? modulo
}
