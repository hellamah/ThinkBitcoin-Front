// Chart.js da tela de treinamento: registro, opções comuns e as métricas que
// as duas abas compartilham.
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  TimeScale,
  Title,
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
import { azulEpsilon, comSinal, formatarNumero, formatarPercentual } from './formato'

// Sem o plugin de zoom de propósito. O zoom pela roda do mouse sequestrava a
// rolagem da página toda vez que o ponteiro passava por cima de um gráfico, e
// quem escolhe o período agora é o seletor da aba.
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, RadialLinearScale, TimeScale,
  Title, Tooltip, Legend, Filler,
)

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
export const bordaDoPainel = (escuro) => (escuro ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')

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

// ── Métricas ────────────────────────────────────────────────────────────────

export const METRICAS = ['rewardMedio', 'winRate', 'lossMedia', 'epsilon', 'duracaoSegundos']

// 1 = maior é melhor; −1 = menor é melhor; 0 = sem juízo. Epsilon cai por
// projeto (é o decaimento da exploração) e a duração não diz nada sobre a
// qualidade do modelo, então nenhum dos dois ganha verde ou vermelho.
export const SENTIDO_DA_METRICA = Object.freeze({
  rewardMedio: 1,
  winRate: 1,
  lossMedia: -1,
  epsilon: 0,
  duracaoSegundos: 0,
})

// Chamadas literais a t(), uma por métrica: o teste de idiomas só confere
// chaves escritas por extenso, e um t(`treinamento.${id}`) passaria sem checagem.
export const rotuloDaMetrica = (t, id) => {
  switch (id) {
    case 'rewardMedio': return t('treinamento.avgReward')
    case 'winRate': return t('treinamento.winRate')
    case 'lossMedia': return t('treinamento.lossLabel')
    case 'epsilon': return t('treinamento.epsilon')
    case 'duracaoSegundos': return t('treinamento.duration')
    default: return id
  }
}

export const formatarMetrica = (id, valor) => {
  switch (id) {
    case 'winRate': return formatarPercentual(valor, 1)
    case 'duracaoSegundos': return valor === null || valor === undefined ? '–' : `${formatarNumero(valor, 1)} s`
    default: return formatarNumero(valor, 3)
  }
}

export const formatarVariacaoDaMetrica = (id, d) => {
  if (d === null || d === undefined) return '–'
  switch (id) {
    case 'winRate': return `${comSinal(formatarNumero(d * 100, 1), d)} pp`
    case 'duracaoSegundos': return `${comSinal(formatarNumero(d, 1), d)} s`
    default: return comSinal(formatarNumero(d, 3), d)
  }
}

/** Cor da métrica para DOM (aceita var()). */
export const corDaMetrica = (id, escuro) => {
  switch (id) {
    case 'rewardMedio': return 'var(--accent-ink)'
    case 'winRate': return 'var(--perf-up)'
    case 'lossMedia': return 'var(--perf-down)'
    case 'epsilon': return azulEpsilon(escuro)
    default: return 'var(--perf-warn)'
  }
}

/** Cor da métrica para canvas, já resolvida no tema. */
export const corDaMetricaNoCanvas = (id, escuro) => {
  switch (id) {
    case 'rewardMedio': return readToken('--accent-ink')
    case 'winRate': return readToken('--perf-up', '#14f195')
    case 'lossMedia': return readToken('--perf-down', '#ff5c7c')
    case 'epsilon': return azulEpsilon(escuro)
    default: return readToken('--perf-warn', '#ffb547')
  }
}

/**
 * Cor de uma variação segundo o sentido da métrica. Variação desprezível e
 * métrica sem juízo ficam neutras.
 */
export const corDaVariacao = (id, d) => {
  const sentido = SENTIDO_DA_METRICA[id] ?? 0
  if (d === null || d === undefined || sentido === 0 || Math.abs(d) < 1e-9) return 'var(--text-muted)'
  return d * sentido > 0 ? 'var(--perf-up)' : 'var(--perf-down)'
}

// Seta que acompanha toda variação. Vai marcada aria-hidden: o sinal do número
// já diz a direção, e a seta é o segundo canal para quem não distingue a cor.
export const setaDaVariacao = (d) =>
  (d === null || d === undefined || Math.abs(d) < 1e-9 ? '' : d > 0 ? '▲' : '▼')

/**
 * Faixas de fundo marcando cada ciclo de treino. Recortadas à área de
 * plotagem, com rótulo preso à borda visível e omitido quando não cabe.
 */
export const pluginFaixasDeCiclo = (ciclos, rotular) => ({
  id: 'faixasDeCiclo',
  beforeDatasetsDraw: (chart) => {
    if (ciclos.length <= 1) return
    const { ctx, chartArea, scales } = chart
    if (!chartArea || !scales.x) return
    const { left, right, top, bottom } = chartArea
    ctx.save()
    ctx.beginPath()
    ctx.rect(left, top, right - left, bottom - top)
    ctx.clip()
    ctx.font = 'bold 11px sans-serif'
    ciclos.forEach((c, idx) => {
      const cor = idx % 2 === 0 ? '255,215,0' : '92,184,255'
      const x1 = scales.x.getPixelForValue(c.inicio)
      const x2 = scales.x.getPixelForValue(c.fim)
      if (x2 < left || x1 > right) return
      ctx.fillStyle = `rgba(${cor},0.06)`
      ctx.fillRect(x1, top, Math.max(2, x2 - x1), bottom - top)
      ctx.strokeStyle = `rgba(${cor},0.35)`
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(x1, top)
      ctx.lineTo(x1, bottom)
      ctx.moveTo(x2, top)
      ctx.lineTo(x2, bottom)
      ctx.stroke()
      ctx.setLineDash([])
      const rotulo = rotular(idx, c)
      const lx = Math.max(x1, left) + 6
      if (lx + ctx.measureText(rotulo).width <= Math.min(x2, right) - 6) {
        ctx.fillStyle = `rgba(${cor},0.9)`
        ctx.fillText(rotulo, lx, top + 14)
      }
    })
    ctx.restore()
  },
})
