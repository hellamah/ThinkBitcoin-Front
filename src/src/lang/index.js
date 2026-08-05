// Registro único dos idiomas suportados.
//
// Antes desta lista, o conjunto de idiomas vivia duplicado em seis lugares: o
// enum Language, o normalizeLanguage, o mapa do useTranslation, dois <MenuItem>
// escritos à mão e o mapa do teste de paridade — além de um ternário binário no
// heatmap que fazia todo idioma novo cair calado em português. Acrescentar um
// idioma significava lembrar de todos. Agora significa acrescentar uma linha
// aqui e um arquivo ao lado.

import en from './en.json'

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
// O inglês vem primeiro por ser o padrão: é a ordem em que o seletor aparece.
/** @type {ReadonlyArray<Idioma>} */
export const LANGUAGES = Object.freeze([
  { codigo: 'en', rotulo: 'English', htmlLang: 'en', intl: 'en-US' },
  { codigo: 'pt', rotulo: 'Português', htmlLang: 'pt-BR', intl: 'pt-BR' },
  { codigo: 'es', rotulo: 'Español', htmlLang: 'es', intl: 'es-ES' },
  { codigo: 'fr', rotulo: 'Français', htmlLang: 'fr', intl: 'fr-FR' },
  { codigo: 'it', rotulo: 'Italiano', htmlLang: 'it', intl: 'it-IT' },
])

export const LANGUAGE_CODES = Object.freeze(LANGUAGES.map((l) => l.codigo))

export const IDIOMA_PADRAO = 'en'

// O idioma padrão é o único importado estaticamente, e as duas coisas andam
// juntas de propósito: ele é o fallback enquanto o dicionário escolhido não
// chega, e é o que a maioria vê primeiro. Fosse outro o estático, justamente o
// padrão seria o único a esperar uma requisição para renderizar.
export const dicionarioPadrao = en

/**
 * Descobre qual dos idiomas suportados o navegador prefere.
 *
 * Lê `navigator.languages`, que já vem ordenado pela preferência declarada nas
 * configurações do sistema — `navigator.language` sozinho traz só o primeiro e
 * perderia a segunda escolha de quem tem mais de um idioma configurado.
 *
 * A região é descartada: `pt-BR`, `pt-PT` e `pt` compartilham dicionário, e
 * exigir a etiqueta completa faria um navegador em `en-GB` cair no padrão sem
 * necessidade.
 *
 * Lido no momento da chamada, e não na carga do módulo, para que o teste possa
 * trocar o navigator — o Node 22 define um `navigator` real, com o idioma do
 * sistema operacional, e sem isso a suíte passaria na máquina de quem a escreve
 * e falharia num runner configurado em outro idioma.
 *
 * @returns {string|null} Código suportado, ou null se nenhum servir
 */
export const detectarIdiomaDoNavegador = () => {
  const nav = typeof globalThis !== 'undefined' ? globalThis.navigator : undefined
  if (!nav) return null

  const preferidos = Array.isArray(nav.languages) && nav.languages.length > 0
    ? nav.languages
    : [nav.language]

  for (const etiqueta of preferidos) {
    if (typeof etiqueta !== 'string') continue
    const base = etiqueta.toLowerCase().split('-')[0]
    if (LANGUAGE_CODES.includes(base)) return base
  }

  return null
}

/** Devolve os metadados do idioma, caindo no padrão quando o código é inválido. */
export const idiomaDe = (codigo) =>
  LANGUAGES.find((l) => l.codigo === codigo) ??
  LANGUAGES.find((l) => l.codigo === IDIOMA_PADRAO)

// Os dicionários entram por import dinâmico: cada um pesa ~10 KB gzip e o
// usuário precisa exatamente de um. Estaticamente, os cinco viajariam no chunk
// principal para todo visitante.
//
// O en.json fica de fora do glob de propósito: ele já é estático logo acima, e
// incluí-lo aqui faria o Rollup avisar que o import dinâmico não consegue
// movê-lo de chunk — verdade, e intencional, já que ele é o fallback.
const carregadores = import.meta.glob(['./*.json', '!./en.json'])

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
