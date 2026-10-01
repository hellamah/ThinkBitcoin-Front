import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { Line } from 'react-chartjs-2'
import useTranslation from '../../hooks/useTranslation'
import { apiRequest, MarketEndpoint, VariavelExternaEndpoint } from '../../utils/apiClient'
import { padraoDeDataCurta, toUTCISO } from '../../utils/dateUtils'
import { comBordaDeEixo, corDaGrade, corDoTique, eixoDeTempo, tooltipBase } from './graficos'
import { EstadoVazio, Painel } from './Painel'
import { corDaMoeda, formatarDiaComAno, formatarNumero } from './formato'

// O mercado que o episódio NEGOCIOU: as velas do lote de dados dele
// (dataInicioDados → dataFimDados; 1000 velas horárias no treinador). O treino
// percorre o histórico do dataset de trás para a frente, e o episódio que roda
// hoje pode estar negociando um mês de 2023.
//
// Este painel mostrava o preço em volta da hora em que o episódio RODOU — um
// mercado que o agente nunca viu. Episódio gravado antes de o treinador mandar
// a janela não tem contexto a mostrar, e o painel diz isso em vez de inventar um.

const TTL_DA_LISTA_DE_MOEDAS_MS = 30 * 60 * 1000
// O lote tem 1000 velas horárias; a folga evita que a API corte a ponta da
// janela. Vale também para o Fear & Greed, que tem uma linha por hora.
const VELAS_A_PEDIR = 1200

const instante = (r) => new Date(r.horaReferencia).getTime()

function useMercadoDaJanela(moeda, inicioMs, fimMs) {
  // null = carregando; { registros: [] } = carregou e não há dados.
  const [mercado, setMercado] = useState(null)
  const [medoMedio, setMedoMedio] = useState(null)
  const valida = Boolean(moeda) && Number.isFinite(inicioMs) && Number.isFinite(fimMs)

  useEffect(() => {
    if (!valida) return undefined
    let cancelado = false
    setMercado(null)
    setMedoMedio(null)
    const dataInicio = toUTCISO(new Date(inicioMs))
    const dataFim = toUTCISO(new Date(fimMs))

    apiRequest(MarketEndpoint.COIN_VALUE(moeda.toLowerCase(), {
      dataInicio,
      dataFim,
      quantidade: VELAS_A_PEDIR,
      ordemAsc: true,
    }))
      .then((resp) => {
        const regs = resp?.resultado?.registros
        // Ordena aqui em vez de confiar no `ordemAsc`: a variação do período
        // lê o primeiro e o último fechamento, e com a resposta vindo do mais
        // recente para o mais antigo (é o que o modo demo faz) o sinal saía
        // invertido — alta virava queda.
        const ordenados = Array.isArray(regs) ? [...regs].sort((a, b) => instante(a) - instante(b)) : []
        if (!cancelado) setMercado({ registros: ordenados })
      })
      .catch(() => { if (!cancelado) setMercado({ registros: [] }) })

    // Fear & Greed médio na janela. Exige idMoeda, resolvido via /moedas (em
    // cache: a lista não muda numa sessão, e andar pelo detalhe com as setas
    // pedia uma por tecla). Complementar: qualquer falha só oculta o
    // indicador — e em boa parte do histórico (2020–2023) não há coleta. A
    // fonte é diária, mas cada coleta horária grava uma linha: pedir menos que
    // a janela inteira fazia a "média" ser só dos últimos dias dela.
    apiRequest(MarketEndpoint.COIN_LIST, { useCache: true, ttl: TTL_DA_LISTA_DE_MOEDAS_MS })
      .then((resp) => {
        const moedas = Array.isArray(resp?.resultado) ? resp.resultado : []
        const idMoeda = moedas.find((m) => (m.sigla || '').toUpperCase() === moeda.toUpperCase())?.id
        if (!idMoeda) return null
        const qs = `idMoeda=${idMoeda}&dataInicio=${encodeURIComponent(dataInicio)}&dataFim=${encodeURIComponent(dataFim)}&quantidade=${VELAS_A_PEDIR}&ordemAsc=false`
        return apiRequest(`${VariavelExternaEndpoint.FEAR_GREED}?${qs}`).catch(() => null)
      })
      .then((resp) => {
        if (cancelado || !resp) return
        const valores = (resp?.resultado?.registros ?? []).map((r) => Number(r.valor)).filter(Number.isFinite)
        setMedoMedio(valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : null)
      })
      .catch(() => {})

    return () => { cancelado = true }
  }, [moeda, inicioMs, fimMs, valida])

  return { valida, mercado, medoMedio }
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

export default function ContextoDeMercado({ item }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const inicioDados = item.dataInicioDados ? new Date(item.dataInicioDados).getTime() : NaN
  const fimDados = item.dataFimDados ? new Date(item.dataFimDados).getTime() : NaN
  const { valida, mercado, medoMedio } = useMercadoDaJanela(item.moeda, inicioDados, fimDados)
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
      // Do primeiro ao último fechamento do lote: é o buy-and-hold do episódio.
      variacao: primeiro > 0 ? (ultimo - primeiro) / primeiro : 0,
      min: Math.min(...fechamentos),
      max: Math.max(...fechamentos),
      // Casas suficientes para moeda de preço baixo (DOGE ~0,16).
      casas: ultimo >= 100 ? 2 : ultimo >= 1 ? 3 : 5,
      dominancia: mediaDe('dominanciaCompradoraPercentual'),
      longShort: mediaDe('longShortRatio'),
    }
  }, [registros])

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
      borderWidth: 1.5,
    }],
  }), [registros, item.moeda, t])

  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])
  const opcoes = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
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
      x: eixoDeTempo(escuro, idioma, dataCurta, { min: inicioDados, max: fimDados }),
      y: { ticks: { color: corDoTique(escuro), maxTicksLimit: 6 }, grid: { color: corDaGrade(escuro) } },
    }, escuro),
  }), [escuro, idioma, dataCurta, resumo, inicioDados, fimDados])

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
    ...(medoMedio !== null
      ? [{ rotulo: t('treinamento.fearGreedAvg'), valor: formatarNumero(medoMedio, 0), cor: corDoMedo(medoMedio) }]
      : []),
  ] : []

  const subtitulo = valida
    ? t('treinamento.marketSubtitle', {
      coin: item.moeda,
      inicio: formatarDiaComAno(inicioDados, idioma.intl),
      fim: formatarDiaComAno(fimDados, idioma.intl),
      velas: Math.round((fimDados - inicioDados) / 3_600_000) + 1,
    })
    : undefined

  return (
    <Painel titulo={t('treinamento.marketContext')} subtitulo={subtitulo} sx={{ height: '100%' }}>
      {!valida ? (
        <EstadoVazio mensagem={t('treinamento.marketNoWindow')} />
      ) : mercado === null ? (
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
            <Line data={dados} options={opcoes} />
          </Box>
        </>
      )}
    </Painel>
  )
}
