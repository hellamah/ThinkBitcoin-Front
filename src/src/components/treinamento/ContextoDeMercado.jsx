import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { Line } from 'react-chartjs-2'
import useTranslation from '../../hooks/useTranslation'
import { apiRequest, MarketEndpoint, VariavelExternaEndpoint } from '../../utils/apiClient'
import { padraoDeDataCurta, toUTCISO } from '../../utils/dateUtils'
import { readToken } from '../../utils/themeTokens'
import { comAlfa, comBordaDeEixo, corDaGrade, corDoTique, eixoDeTempo, tooltipBase } from './graficos'
import { EstadoVazio, Painel } from './Painel'
import { corDaMoeda, formatarNumero } from './formato'

// O mercado em volta do episódio: preço da moeda, fluxo e sentimento. Janela
// curta primeiro (±30min); se a base não tiver granularidade para isso, amplia
// para ±12h para ainda dar contexto.
const MARGEM_CURTA_MS = 30 * 60 * 1000
const MARGEM_AMPLA_MS = 12 * 60 * 60 * 1000

const instante = (r) => new Date(r.horaReferencia).getTime()

// Registro de sentimento mais próximo do fim do episódio. Fear & Greed e trend
// costumam ter granularidade maior que o preço.
const maisProximo = (registros, alvoMs) => {
  const lista = Array.isArray(registros) ? registros : []
  const comHora = lista.filter((r) => r.horaReferencia)
  if (comHora.length === 0) return lista[0] ?? null
  return comHora.reduce((melhor, r) =>
    (Math.abs(instante(r) - alvoMs) < Math.abs(instante(melhor) - alvoMs) ? r : melhor))
}

function useContextoDeMercado(moeda, inicioMs, fimMs, chave) {
  // null = carregando; { registros: [] } = carregou e não há dados.
  const [mercado, setMercado] = useState(null)
  const [sentimento, setSentimento] = useState(null)

  useEffect(() => {
    if (!moeda || Number.isNaN(fimMs)) {
      setMercado({ registros: [], margemHoras: 0.5 })
      setSentimento(null)
      return undefined
    }
    let cancelado = false
    setMercado(null)
    setSentimento(null)

    const buscarPrecos = (margemMs) =>
      apiRequest(MarketEndpoint.COIN_VALUE(moeda.toLowerCase(), {
        dataInicio: toUTCISO(new Date(inicioMs - margemMs)),
        dataFim: toUTCISO(new Date(fimMs + margemMs)),
        quantidade: 500,
        ordemAsc: true,
      })).then((resp) => {
        const regs = resp?.resultado?.registros
        // Ordena aqui em vez de confiar no `ordemAsc`: a variação do período
        // lê o primeiro e o último fechamento, e com a resposta vindo do mais
        // recente para o mais antigo (é o que o modo demo faz) o sinal saía
        // invertido — alta virava queda.
        return Array.isArray(regs) ? [...regs].sort((a, b) => instante(a) - instante(b)) : []
      })

    buscarPrecos(MARGEM_CURTA_MS)
      .then(async (regs) => (regs.length >= 2
        ? { registros: regs, margemHoras: 0.5 }
        : { registros: await buscarPrecos(MARGEM_AMPLA_MS), margemHoras: 12 }))
      .then((res) => { if (!cancelado) setMercado(res) })
      .catch(() => { if (!cancelado) setMercado({ registros: [], margemHoras: 0.5 }) })

    // Fear & Greed e trend exigem idMoeda: a sigla é resolvida via /moedas.
    // São complementares — qualquer falha só oculta os indicadores.
    const dataInicio = toUTCISO(new Date(inicioMs - MARGEM_AMPLA_MS))
    const dataFim = toUTCISO(new Date(fimMs + MARGEM_AMPLA_MS))
    apiRequest(MarketEndpoint.COIN_LIST)
      .then((resp) => {
        const moedas = Array.isArray(resp?.resultado) ? resp.resultado : []
        const idMoeda = moedas.find((m) => (m.sigla || '').toUpperCase() === moeda.toUpperCase())?.id
        if (!idMoeda) return null
        const qs = `idMoeda=${idMoeda}&dataInicio=${encodeURIComponent(dataInicio)}&dataFim=${encodeURIComponent(dataFim)}&quantidade=100&ordemAsc=false`
        return Promise.all([
          apiRequest(`${VariavelExternaEndpoint.FEAR_GREED}?${qs}`).catch(() => null),
          apiRequest(`${VariavelExternaEndpoint.TREND}?${qs}`).catch(() => null),
        ])
      })
      .then((resultados) => {
        if (cancelado || !resultados) return
        const [medo, trend] = resultados
        setSentimento({
          fear: maisProximo(medo?.resultado?.registros, fimMs),
          trend: maisProximo(trend?.resultado?.registros, fimMs),
        })
      })
      .catch(() => { if (!cancelado) setSentimento(null) })

    return () => { cancelado = true }
    // Só a troca de episódio refaz a busca; moeda e instantes vêm dele.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  return { mercado, sentimento }
}

function Indicador({ rotulo, valor, cor }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="p" variant="caption" sx={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
        {rotulo}
      </Typography>
      <Typography component="p" variant="body2" sx={{ fontWeight: 700, color: cor || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </Typography>
    </Box>
  )
}

export default function ContextoDeMercado({ item, inicioMs, fimMs }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const { mercado, sentimento } = useContextoDeMercado(item.moeda, inicioMs, fimMs, item.idTreinamentoEpisodio)
  const registros = useMemo(() => mercado?.registros ?? [], [mercado])

  const resumo = useMemo(() => {
    const fechamentos = registros.map((r) => r.precoFechamento ?? 0).filter((v) => v > 0)
    if (fechamentos.length === 0) return null
    const primeiro = fechamentos[0]
    const ultimo = fechamentos[fechamentos.length - 1]
    const mediaDe = (chave) => {
      const v = registros.map((r) => r[chave]).filter((x) => x !== null && x !== undefined)
      return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null
    }
    return {
      variacao: primeiro > 0 ? (ultimo - primeiro) / primeiro : 0,
      min: Math.min(...fechamentos),
      max: Math.max(...fechamentos),
      // Casas suficientes para moeda de preço baixo (DOGE ~0,16).
      casas: ultimo >= 100 ? 2 : ultimo >= 1 ? 3 : 5,
      dominancia: mediaDe('dominanciaCompradoraPercentual'),
      longShort: mediaDe('longShortRatio'),
    }
  }, [registros])

  // O candle é horário: o último fecha na virada da hora, e um episódio que
  // rodou depois dela ficava além do fim do eixo — a faixa do período do
  // treinamento, que é o ponto do gráfico, simplesmente não aparecia. O eixo
  // cobre os dados E o episódio, com folga dos dois lados.
  const eixo = useMemo(() => {
    const xs = registros.map(instante).filter((x) => Number.isFinite(x))
    if (xs.length === 0 || Number.isNaN(fimMs)) return {}
    const folga = Math.max(5 * 60 * 1000, (fimMs - inicioMs) * 0.5)
    return { min: Math.min(xs[0], inicioMs - folga), max: Math.max(xs[xs.length - 1], fimMs + folga) }
  }, [registros, inicioMs, fimMs])

  const dados = useMemo(() => ({
    datasets: [{
      label: t('treinamento.price', { coin: item.moeda }),
      data: registros
        .filter((r) => r.horaReferencia && r.precoFechamento !== null && r.precoFechamento !== undefined)
        .map((r) => ({ x: instante(r), y: r.precoFechamento })),
      borderColor: corDaMoeda(item.moeda),
      backgroundColor: `${corDaMoeda(item.moeda)}22`,
      fill: true,
      tension: 0.25,
      pointRadius: 0,
      borderWidth: 2,
    }],
  }), [registros, item.moeda, t])

  // Faixa do período em que o episódio rodou. Mínimo de 3px: um episódio de
  // segundos num eixo de horas não teria largura nenhuma.
  const faixaDoEpisodio = useMemo(() => {
    const cor = readToken('--accent-ink')
    return {
      id: 'faixaDoEpisodio',
      beforeDatasetsDraw: (chart) => {
        const { ctx, chartArea, scales } = chart
        if (!chartArea || !scales.x) return
        const x1 = scales.x.getPixelForValue(inicioMs)
        const x2 = scales.x.getPixelForValue(fimMs)
        const largura = Math.max(3, x2 - x1)
        ctx.save()
        ctx.fillStyle = comAlfa(cor, 0.14)
        ctx.fillRect(x1, chartArea.top, largura, chartArea.bottom - chartArea.top)
        ctx.strokeStyle = comAlfa(cor, 0.7)
        ctx.setLineDash([4, 4])
        ctx.strokeRect(x1, chartArea.top, largura, chartArea.bottom - chartArea.top)
        ctx.restore()
      },
    }
  // `escuro` entra para reler o token quando o tema muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicioMs, fimMs, escuro])

  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])
  const opcoes = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    // O eixo de preço não tem formatador próprio: sem isto, o Chart.js
    // separava milhar pelo idioma do navegador, e não pelo do app.
    locale: idioma.intl,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipBase(escuro),
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatarNumero(ctx.parsed.y, resumo?.casas ?? 2)}` },
      },
    },
    scales: comBordaDeEixo({
      x: eixoDeTempo(escuro, idioma, dataCurta, eixo),
      y: { ticks: { color: corDoTique(escuro), maxTicksLimit: 6 }, grid: { color: corDaGrade(escuro) } },
    }, escuro),
  }), [escuro, idioma, dataCurta, eixo, resumo])

  const cheio = (d) => (d >= 0 ? `+${formatarNumero(d * 100, 2)}%` : `${formatarNumero(d * 100, 2)}%`)
  const corDoMedo = (v) => (v >= 55 ? 'var(--perf-up)' : v >= 45 ? 'var(--perf-warn)' : 'var(--perf-down)')

  const indicadores = resumo ? [
    { rotulo: t('treinamento.periodVariation'), valor: cheio(resumo.variacao), cor: resumo.variacao >= 0 ? 'var(--perf-up)' : 'var(--perf-down)' },
    { rotulo: t('treinamento.priceRange'), valor: `${formatarNumero(resumo.min, resumo.casas)} – ${formatarNumero(resumo.max, resumo.casas)}` },
    ...(resumo.dominancia !== null
      ? [{ rotulo: t('treinamento.buyerDominance'), valor: `${formatarNumero(resumo.dominancia, 1)}%`, cor: resumo.dominancia >= 50 ? 'var(--perf-up)' : 'var(--perf-down)' }]
      : []),
    ...(resumo.longShort !== null
      ? [{ rotulo: t('treinamento.longShortAvg'), valor: formatarNumero(resumo.longShort, 2) }]
      : []),
    ...(sentimento?.fear?.valor !== null && sentimento?.fear?.valor !== undefined
      ? [{
          rotulo: t('treinamento.fearGreed'),
          valor: `${sentimento.fear.valor}${sentimento.fear.classificacao ? ` · ${sentimento.fear.classificacao}` : ''}`,
          cor: corDoMedo(sentimento.fear.valor),
        }]
      : []),
    ...(sentimento?.trend?.valorAtual !== null && sentimento?.trend?.valorAtual !== undefined
      ? [{
          rotulo: t('treinamento.trendSearch'),
          valor: `${sentimento.trend.valorAtual}${sentimento.trend.delta15 !== null && sentimento.trend.delta15 !== undefined
            ? ` (${sentimento.trend.delta15 >= 0 ? '▲' : '▼'}${Math.abs(sentimento.trend.delta15)} /15min)`
            : ''}`,
        }]
      : []),
    ...(sentimento?.trend?.geoTop1Code
      ? [{ rotulo: t('treinamento.topRegion'), valor: sentimento.trend.geoTop1Code }]
      : []),
  ] : []

  return (
    <Painel
      titulo={t('treinamento.marketContext')}
      subtitulo={t('treinamento.marketSubtitle', { coin: item.moeda, range: mercado?.margemHoras === 12 ? '12h' : '30min' })}
      sx={{ height: '100%' }}
    >
      {mercado === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }} role="status" aria-label={t('treinamento.loadingMarket')}>
          <CircularProgress size={24} sx={{ color: 'var(--accent-ink)' }} />
        </Box>
      ) : !resumo ? (
        <EstadoVazio mensagem={t('treinamento.noMarketData')} />
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1.5, mb: 2 }}>
            {indicadores.map((i) => <Indicador key={i.rotulo} {...i} />)}
          </Box>
          <Box sx={{ height: { xs: 220, md: 260 }, position: 'relative' }}>
            <Line data={dados} options={opcoes} plugins={[faixaDoEpisodio]} />
          </Box>
        </>
      )}
    </Painel>
  )
}
