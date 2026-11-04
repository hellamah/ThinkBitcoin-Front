// Chart.js das telas de dados (robô ao vivo, estratégias): registro, cores do
// tema e opções comuns. Nasceu na tela de treino do agente, que saiu em
// 04/11/2026 levando junto as métricas e as faixas de ciclo que só ela usava.
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
// O eixo de tempo estava cravado em pt-BR: o mês vinha em português e a data em
// ordem brasileira, independentemente do idioma escolhido na tela. Os cinco
// entram estaticamente porque são ~2 KB cada e o gráfico não pode esperar um
// import dinâmico para desenhar o primeiro quadro.
import { ptBR, enUS, es, fr, it } from 'date-fns/locale'
import { readToken } from '../../utils/themeTokens'

// Só linhas. Sem o plugin de zoom de propósito: o zoom pela roda do mouse
// sequestrava a rolagem da página toda vez que o ponteiro passava por cima de
// um gráfico.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, TimeScale, Tooltip, Legend, Filler)

// Locale do date-fns por código de idioma, para o adaptador de tempo. Fica
// aqui, e não no registro de idiomas, porque é dependência de biblioteca de
// gráfico: o lang/index.js não deve importar date-fns por causa de um eixo.
export const LOCALE_DATE_FNS = Object.freeze({ pt: ptBR, en: enUS, es, fr, it })

// Canvas não resolve var(); estas são as cores já computadas no tema vigente.
// Chame dentro de um useMemo que dependa do modo do tema.
export const corDaGrade = (escuro) => (escuro ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)')
export const corDoTique = (escuro) => (escuro ? '#aaa' : '#666')
export const corDaLegenda = (escuro) => (escuro ? '#e0e0e0' : '#333')
export const fundoDoTooltip = (escuro) => (escuro ? 'rgba(15,15,20,0.95)' : 'rgba(255,255,255,0.95)')
export const textoDoTooltip = (escuro) => (escuro ? '#fff' : '#333')

// Linha do próprio eixo. O Chart.js a desenha separada do grid e, sem cor
// explícita, cai no `defaults.borderColor` global — que era cravado no import
// do Dashboard e vazava para cá conforme a ordem de navegação.
export const comBordaDeEixo = (escalas, escuro) =>
  Object.fromEntries(
    Object.entries(escalas).map(([nome, cfg]) => [
      nome,
      { border: { color: escuro ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }, ...cfg },
    ])
  )

export const tooltipBase = (escuro) => ({
  backgroundColor: fundoDoTooltip(escuro),
  borderColor: readToken('--accent-a40'),
  borderWidth: 1,
  // --accent-ink e não o dourado puro: #ffd700 sobre o tooltip branco do tema
  // claro fica perto de 1,4:1.
  titleColor: readToken('--accent-ink'),
  bodyColor: textoDoTooltip(escuro),
  padding: 10,
})

/** Rgba a partir de um hex (#rgb ou #rrggbb); outra notação volta como veio. */
export const comAlfa = (cor, alfa) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(cor).trim())
  if (!m) return cor
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  const n = parseInt(h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`
}

/** Eixo X temporal no idioma da tela, preso ao intervalo da janela. */
export const eixoDeTempo = (escuro, idioma, dataCurta, { min, max } = {}) => ({
  type: 'time',
  min,
  max,
  adapters: { date: { locale: LOCALE_DATE_FNS[idioma.codigo] ?? enUS } },
  time: {
    tooltipFormat: `${dataCurta} HH:mm:ss`,
    displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: dataCurta },
  },
  ticks: { color: corDoTique(escuro), maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
  grid: { color: corDaGrade(escuro) },
})
