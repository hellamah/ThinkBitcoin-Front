// Cores das moedas e formatação de números e datas, compartilhadas pelas telas de
// dados (robô ao vivo, estratégias, Pregão). Nasceu na tela de treino do agente,
// que saiu em 04/11/2026.

// Paleta categórica validada (OKLCH L 0,48–0,67, croma ≥ 0,10, ΔE ≥ piso entre
// vizinhos sob simulação de daltonismo, contraste ≥ 3:1 no tema escuro). As cores
// de marca originais eram ilegíveis no fundo escuro: XRP quase preto, ADA/LINK/LTC
// azuis-escuros iguais e BNB/DOGE/PAXG dourados iguais.
const CORES_DAS_MOEDAS = {
  BTC: '#A35303', ETH: '#7C8AE1', BNB: '#A89207', SOL: '#17A478',
  XRP: '#0E8BA8', ADA: '#966CD7', DOGE: '#79953E', LTC: '#419BD4',
  LINK: '#3065CC', PAXG: '#8E710F',
}

// Escurece uma cor hex por um fator (0-1). As cores de marca das moedas são
// tons médios: ótimas como preenchimento, mas reprovam em contraste quando
// viram texto sobre fundo claro (LTC #419BD4 sobre o chip dá 2.2:1).
export const escurecer = (hex, fator) => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const canal = (shift) => Math.round(((n >> shift) & 0xff) * fator)
  const dois = (v) => v.toString(16).padStart(2, '0')
  return `#${dois(canal(16))}${dois(canal(8))}${dois(canal(0))}`
}

// Cor da moeda: a da paleta quando existe; senão um HEX estável gerado do nome
// (moedas que só aparecem em janelas antigas). Sempre HEX de 6 dígitos, para
// aceitar sufixo de alpha (ex.: +'33').
export const corDaMoeda = (moeda) => {
  if (CORES_DAS_MOEDAS[moeda]) return CORES_DAS_MOEDAS[moeda]
  if (!moeda) return '#888888'
  let h = 0
  for (let i = 0; i < moeda.length; i++) h = (h * 31 + moeda.charCodeAt(i)) >>> 0
  const canal = (shift) => 80 + ((h >> shift) % 150) // faixa 80–229: nem escuro, nem estourado
  const hex = (n) => n.toString(16).padStart(2, '0')
  return `#${hex(canal(0))}${hex(canal(8))}${hex(canal(16))}`
}

// ── Contraste (WCAG 2) ──────────────────────────────────────────────────────

const rgbDe = (hex) => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const hexDe = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const linear = (c) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const luminancia = (hex) => {
  const [r, g, b] = rgbDe(hex)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** Razão de contraste entre duas cores hex (1 a 21). */
export const contraste = (a, b) => {
  const [maior, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (maior + 0.05) / (menor + 0.05)
}

/** `cor` com opacidade `alfa` sobre `fundo`, já composta, em hex. */
const misturar = (cor, fundo, alfa) => {
  const c = rgbDe(cor)
  const f = rgbDe(fundo)
  return hexDe(c.map((v, i) => v * alfa + f[i] * (1 - alfa)))
}

// Painel de cada tema já composto (página + --surface-subtle): é sobre ele que
// o chip, com a cor da moeda a 20%, aparece.
const SUPERFICIE = { escuro: '#141414', claro: '#eeeff1' }
const MINIMO_TEXTO = 4.5
// Folga sobre o mínimo: a superfície real varia um pouco (linha com hover,
// painel dentro de painel), e 4,5 cravado reprovaria na primeira variação.
const ALVO_TEXTO = 4.7

/** Fundo do chip de uma moeda: a cor dela a 20% (o sufixo '33') sobre o painel. */
export const fundoDoChip = (moeda, escuro) =>
  misturar(corDaMoeda(moeda), SUPERFICIE[escuro ? 'escuro' : 'claro'], 0.2)

const tintas = new Map()

/**
 * Cor da moeda como TEXTO, com contraste de texto garantido sobre o chip.
 * Preenchimentos, bordas e séries de gráfico continuam com corDaMoeda().
 *
 * Era a cor pura no escuro e um escurecimento fixo de 45% no claro. No escuro,
 * nove das dez moedas ficavam abaixo de 4,5:1 — BTC e LINK perto de 2,8:1 —,
 * porque a paleta foi validada para 3:1, que é o mínimo de gráfico, não de
 * texto. No claro passava com sobra, mas à custa de apagar o matiz: tudo virava
 * marrom-escuro. Agora a cor anda em direção ao branco (escuro) ou ao preto
 * (claro) só o necessário para chegar ao alvo, e guarda o máximo do matiz.
 */
export const tintaDaMoeda = (moeda, escuro) => {
  const chave = `${moeda}|${escuro ? 'e' : 'c'}`
  if (tintas.has(chave)) return tintas.get(chave)
  const cor = corDaMoeda(moeda)
  const fundo = fundoDoChip(moeda, escuro)
  const extremo = escuro ? '#ffffff' : '#000000'
  let tinta = cor
  for (let passo = 1; contraste(tinta, fundo) < ALVO_TEXTO && passo <= 20; passo++) {
    tinta = misturar(extremo, cor, passo * 0.05)
  }
  tintas.set(chave, tinta)
  return tinta
}

/**
 * Preto ou branco, o que contrastar mais com `cor` — para texto sobre um
 * preenchimento cheio (o chip de filtro ativo). Preto fixo dava 3,8:1 sobre o
 * BTC e o LINK.
 */
export const textoSobre = (cor) =>
  (contraste('#000000', cor) >= contraste('#ffffff', cor) ? '#000000' : '#ffffff')

export const MOEDAS_DA_PALETA = Object.freeze(Object.keys(CORES_DAS_MOEDAS))
export { MINIMO_TEXTO }

const vazio = (v) => v === null || v === undefined || Number.isNaN(Number(v))

// Idioma dos números da tela. As datas já seguiam o idioma escolhido no app
// (idioma.intl, passado a cada chamada), mas os números iam com `undefined`,
// que é o idioma do navegador: com o app em inglês num navegador em português,
// "9/22/2026, 7:30 PM" aparecia ao lado de "0,612".
//
// Passar o locale pelas ~50 chamadas espalharia um parâmetro por onze
// arquivos, gráficos incluídos. Em vez disso a página o define aqui no próprio
// render: o React renderiza o pai antes dos filhos, então toda formatação da
// tela já o encontra. Não usa o <html lang>, que o TranslationContext escreve
// num efeito — depois do render —, e ficaria um render atrasado a cada troca.
let idiomaDosNumeros

export const definirIdiomaDosNumeros = (locale) => {
  idiomaDosNumeros = locale || undefined
}

export const formatarNumero = (valor, casas = 4) => {
  if (vazio(valor)) return '–'
  return Number(valor).toLocaleString(idiomaDosNumeros, {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

// Pelo toLocaleString, como formatarNumero: com toFixed o percentual saía com
// ponto ("37.45%") ao lado de números com vírgula ("0,399") no mesmo cartão.
export const formatarPercentual = (valor, casas = 2) => {
  if (vazio(valor)) return '–'
  return `${formatarNumero(Number(valor) * 100, casas)}%`
}

export const formatarHora = (ms, locale, comSegundos = false) =>
  new Date(ms).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...(comSegundos ? { second: '2-digit' } : {}),
  })

export const formatarDataCurta = (ms, locale) =>
  new Date(ms).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Só dia e mês ("02/07"), na ordem do idioma. '' se a data não for válida. */
export const formatarDia = (valor, locale) => {
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}

/**
 * Dia, mês e ano ("01/02/2023"). Para a janela de dados de um episódio, que
 * pode ser de outro ano: o treino percorre o histórico do dataset.
 */
// Sinal explícito para variações ("+0,12", "−0,05").
export const comSinal = (texto, valor) => (valor > 0 ? `+${texto}` : texto)

// ── Tabelas ─────────────────────────────────────────────────────────────────

export const estiloDeTabela = {
  '& td, & th': { color: 'var(--text-primary)', borderColor: 'var(--border)' },
  '& th': { color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' },
  '& .MuiTableSortLabel-root, & .MuiTableSortLabel-root:hover, & .MuiTableSortLabel-root.Mui-active': { color: 'inherit' },
  '& .MuiTableSortLabel-icon': { color: 'inherit !important' },
}
