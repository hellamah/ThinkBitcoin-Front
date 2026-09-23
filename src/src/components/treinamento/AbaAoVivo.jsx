import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { Line } from 'react-chartjs-2'
import useTranslation from '../../hooks/useTranslation'
import { padraoDeDataCurta } from '../../utils/dateUtils'
import { readToken } from '../../utils/themeTokens'
import {
  PERIODOS_AO_VIVO,
  cicloDoEpisodio,
  detectarCiclos,
  estatisticas,
  filtrarJanela,
  janelaDoPeriodo,
  janelaParaMistura,
  limiarDeLacuna,
  pontosBrutos,
  reduzirPontos,
  resumirPorMoeda,
  serieSuavizada,
  variacao,
} from '../../utils/treinamento'
import {
  METRICAS,
  comAlfa,
  comBordaDeEixo,
  corDaGrade,
  corDaLegenda,
  corDaMetrica,
  corDaMetricaNoCanvas,
  corDaVariacao,
  corDoTique,
  eixoDeTempo,
  formatarMetrica,
  formatarVariacaoDaMetrica,
  pluginFaixasDeCiclo,
  rotuloDaMetrica,
  setaDaVariacao,
  tooltipBase,
} from './graficos'
import { Sparkline } from './Miniaturas'
import { EstadoVazio, MoedaChip, Painel, Variacao } from './Painel'
import SeletorDePeriodo from './SeletorDePeriodo'
import { corDaMoeda, formatarHora, formatarNumero, formatarPercentual, tintaDaMoeda } from './formato'

// Aba "Ao vivo": o treino está andando, e está melhorando AGORA? Tudo aqui
// compara a janela recente com a janela imediatamente anterior, do mesmo
// tamanho — é a pergunta de quem abre a tela com um treino rodando.

// Cartão de métrica. É também o seletor do gráfico principal: clicar num
// cartão põe aquela métrica no gráfico, e `aria-pressed` diz qual está nele.
// Por dentro, só <span>: o cartão é um <button>, que não aceita <div>.
function CartaoMetrica({ id, valor, delta, serie, selecionado, onSelecionar, rotuloComparacao, extra }) {
  const { t } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const cor = corDaMetrica(id, escuro)
  return (
    <Box
      component="button"
      type="button"
      className="botao-nu"
      aria-pressed={selecionado}
      onClick={onSelecionar}
      sx={{
        width: '100%',
        height: '100%',
        p: 1.75,
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        background: selecionado ? 'var(--accent-a08)' : 'var(--surface-subtle)',
        border: '1px solid',
        borderColor: selecionado ? 'var(--accent-a50)' : 'var(--border)',
        transition: 'border-color .15s, background-color .15s',
        '&:hover': { borderColor: selecionado ? 'var(--accent-a50)' : 'var(--border-interactive)' },
      }}
    >
      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />
        <Typography component="span" variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11, color: 'var(--text-secondary)' }}>
          {rotuloDaMetrica(t, id)}
        </Typography>
      </Box>
      <Box component="span" sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1 }}>
        <Typography component="span" sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 700, lineHeight: 1.15, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {formatarMetrica(id, valor)}
        </Typography>
        <Sparkline valores={serie} cor={cor} largura={64} altura={24} />
      </Box>
      <Typography component="span" variant="caption" sx={{ color: corDaVariacao(id, delta), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {delta === null ? (
          <Box component="span" sx={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('treinamento.noPrevious')}</Box>
        ) : (
          <>
            <span aria-hidden="true">{setaDaVariacao(delta)} </span>
            {formatarVariacaoDaMetrica(id, delta)}{' '}
            <Box component="span" sx={{ color: 'var(--text-muted)', fontWeight: 400 }}>{rotuloComparacao}</Box>
          </>
        )}
      </Typography>
      {extra && (
        <Typography component="span" variant="caption" sx={{ color: 'var(--text-muted)' }}>{extra}</Typography>
      )}
    </Box>
  )
}

function UltimosEpisodios({ itens, onAbrir }) {
  const { t, idioma } = useTranslation()
  return (
    <Painel titulo={t('treinamento.latestEpisodes')} subtitulo={t('treinamento.latestEpisodesSub')} sx={{ height: '100%' }} corpoSx={{ overflowY: 'auto', mx: -1, px: 1 }}>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {itens.map((r) => (
          <li key={r.idTreinamentoEpisodio}>
            <Box
              component="button"
              type="button"
              className="botao-nu"
              onClick={() => onAbrir(r.idTreinamentoEpisodio)}
              aria-label={t('treinamento.abrirEpisodio', { episodio: r.episodio })}
              sx={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto',
                alignItems: 'center',
                columnGap: 1.25,
                px: 1,
                py: 0.75,
                borderRadius: 1,
                fontSize: 13,
                fontVariantNumeric: 'tabular-nums',
                '&:hover': { background: 'var(--surface-hover)' },
              }}
            >
              <MoedaChip moeda={r.moeda} />
              <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Box component="span" sx={{ fontWeight: 600 }}>#{r.episodio}</Box>
                <Box component="span" sx={{ color: 'var(--text-muted)', ml: 0.75, fontSize: 12 }}>{formatarHora(r.dataHora, idioma.intl, true)}</Box>
              </Box>
              <Box component="span" sx={{ fontWeight: 600, color: 'var(--accent-ink)' }}>{formatarNumero(r.rewardMedio, 3)}</Box>
              <Box component="span" sx={{ color: 'var(--text-secondary)', minWidth: 48, textAlign: 'right' }}>{formatarPercentual(r.winRate, 1)}</Box>
            </Box>
          </li>
        ))}
      </Box>
    </Painel>
  )
}

// Colunas equilibradas entre as linhas. Com nove moedas e espaço para oito, a
// grade automática deixava uma moeda sozinha na segunda linha; aqui nove viram
// 5 + 4, ou 3 × 3, ou uma linha só quando cabe.
const colunasEquilibradas = (n, max) => Math.max(1, Math.ceil(n / Math.ceil(n / max)))
const grade = (n, max) => `repeat(${colunasEquilibradas(n, max)}, minmax(0, 1fr))`

function MoedasNaJanela({ linhas, anteriores, onSelecionarMoeda }) {
  const { t } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const n = linhas.length
  return (
    <Painel titulo={t('treinamento.coinsInWindow')} subtitulo={t('treinamento.coinsInWindowSub')}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: grade(n, 2), sm: grade(n, 3), md: grade(n, 5), xl: grade(n, 9) },
          gap: 1,
          // Com uma ou duas moedas filtradas, o ladrilho não estica a tela toda.
          maxWidth: n < 5 ? n * 240 : 'none',
        }}
      >
        {linhas.map((m) => {
          const d = variacao(m.rewardMedio, anteriores.get(m.moeda)?.rewardMedio ?? null)
          return (
            <Box
              key={m.moeda}
              component="button"
              type="button"
              className="botao-nu"
              title={t('treinamento.filterCoin', { moeda: m.moeda })}
              onClick={() => onSelecionarMoeda(m.moeda)}
              sx={{
                p: 1.25,
                borderRadius: 1,
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${corDaMoeda(m.moeda)}`,
                background: 'var(--surface-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.25,
                fontVariantNumeric: 'tabular-nums',
                '&:hover': { background: 'var(--surface-hover)', borderColor: 'var(--border-interactive)', borderLeftColor: corDaMoeda(m.moeda) },
              }}
            >
              <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                <Box component="span" sx={{ fontWeight: 700, color: tintaDaMoeda(m.moeda, escuro) }}>{m.moeda}</Box>
                <Box component="span" sx={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('treinamento.episodesCount', { n: m.total })}</Box>
              </Box>
              <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                <Box component="span" sx={{ fontSize: 18, fontWeight: 700 }}>{formatarNumero(m.rewardMedio, 3)}</Box>
                <Sparkline valores={m.curva} cor={corDaMoeda(m.moeda)} largura={56} altura={20} />
              </Box>
              <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <Variacao d={d} />
                <Box component="span" sx={{ color: 'var(--text-secondary)' }}>{formatarPercentual(m.winRate, 1)}</Box>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Painel>
  )
}

export default function AbaAoVivo({ timeline, periodo, onPeriodo, maisRecenteMs, carregando, carregandoPeriodo, garantirPeriodo, onAbrir, onSelecionarMoeda }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const [metrica, setMetrica] = useState('rewardMedio')

  const janela = useMemo(() => janelaDoPeriodo(periodo, maisRecenteMs), [periodo, maisRecenteMs])

  // A janela anterior também precisa estar carregada: é a base das variações.
  // Espera a carga inicial terminar: ela substitui a lista inteira ao chegar,
  // e um período buscado em paralelo seria descartado junto.
  useEffect(() => {
    if (janela && !carregando) garantirPeriodo(janela.anterior.inicio, janela.fim)
  }, [janela, carregando, garantirPeriodo])

  const itens = useMemo(() => (janela ? filtrarJanela(timeline, janela.inicio, janela.fim) : []), [timeline, janela])
  const anteriores = useMemo(
    () => (janela ? filtrarJanela(timeline, janela.anterior.inicio, janela.anterior.fim) : []),
    [timeline, janela]
  )

  const stats = useMemo(() => estatisticas(itens), [itens])
  const statsAnterior = useMemo(() => estatisticas(anteriores), [anteriores])

  const janelaMM = useMemo(() => janelaParaMistura(new Set(itens.map((r) => r.moeda)).size), [itens])
  const limiar = useMemo(() => limiarDeLacuna(itens), [itens])

  // Uma série suavizada por métrica: alimenta os minigráficos dos cartões e,
  // a da métrica escolhida, o gráfico principal.
  const series = useMemo(
    () => Object.fromEntries(METRICAS.map((id) => [id, serieSuavizada(itens, id, janelaMM, limiar)])),
    [itens, janelaMM, limiar]
  )

  const porMoeda = useMemo(() => resumirPorMoeda(itens), [itens])
  const porMoedaAnterior = useMemo(
    () => new Map(resumirPorMoeda(anteriores).map((m) => [m.moeda, m])),
    [anteriores]
  )

  const ultimos = useMemo(() => itens.slice(-12).reverse(), [itens])

  // Ciclos na janela, para as faixas do gráfico: nos dados reais um treino dura
  // cerca de uma hora e meia, e a janela de 1h ou 4h costuma pegar a virada.
  const ciclosNaJanela = useMemo(() => detectarCiclos(itens), [itens])
  const faixas = useMemo(
    () => pluginFaixasDeCiclo(ciclosNaJanela, (idx, c) => t('treinamento.cycleLabel', { num: idx + 1, count: c.total }), escuro),
    [ciclosNaJanela, t, escuro]
  )

  // O treino em andamento: a versão e desde quando. Calculado sobre tudo o que
  // está carregado, não só a janela, para o início do ciclo não ficar cortado.
  const cicloAtual = useMemo(() => {
    const ultimo = timeline[timeline.length - 1]
    const ciclo = ultimo ? cicloDoEpisodio(timeline, ultimo.idTreinamentoEpisodio) : null
    return ciclo ? { ...ciclo, versao: ultimo.versaoModelo } : null
  }, [timeline])

  // Quando um treino novo começa entre a janela anterior e a atual, as setas
  // dos cartões comparam execuções diferentes: epsilon volta a 1 no começo de
  // cada treino, e o reward do começo é pior por construção. Sem aviso, isso
  // se lia como piora do modelo.
  const viradaDeCiclo = useMemo(() => {
    if (anteriores.length === 0 || itens.length === 0) return null
    const ciclos = detectarCiclos([...anteriores, ...itens])
    return ciclos.length > 1 ? ciclos[ciclos.length - 1].inicio : null
  }, [anteriores, itens])

  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])
  const mediaAnterior = statsAnterior.total > 0 ? statsAnterior[metrica] : null

  const dadosGrafico = useMemo(() => {
    const cor = corDaMetricaNoCanvas(metrica, escuro)
    const datasets = [
      {
        label: t('treinamento.episode'),
        data: pontosBrutos(itens, metrica),
        showLine: false,
        pointRadius: 1.75,
        pointHoverRadius: 4,
        pointBackgroundColor: comAlfa(cor, 0.35),
        borderColor: comAlfa(cor, 0.35),
        order: 2,
      },
      {
        label: t('treinamento.movingAvgN', { n: janelaMM }),
        data: series[metrica],
        borderColor: cor,
        backgroundColor: cor,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.3,
        spanGaps: false,
        order: 1,
      },
    ]
    if (mediaAnterior !== null && janela) {
      datasets.push({
        label: t('treinamento.previousAvg'),
        data: [{ x: janela.inicio, y: mediaAnterior }, { x: janela.fim, y: mediaAnterior }],
        borderColor: readToken('--text-muted'),
        backgroundColor: readToken('--text-muted'),
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 0,
      })
    }
    return { datasets }
  }, [itens, metrica, series, janelaMM, mediaAnterior, janela, escuro, t])

  const opcoesGrafico = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    // Sem animação: o polling redesenha a cada minuto, e cada redesenho
    // animado fazia a linha "respirar" sem que nada tivesse mudado.
    animation: false,
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    plugins: {
      // A legenda segue a ordem dos datasets, e não o `order` (que só decide
      // quem é desenhado por cima): episódio, média móvel, janela anterior.
      legend: { position: 'bottom', labels: { color: corDaLegenda(escuro), usePointStyle: true, boxWidth: 8, padding: 14, sort: (a, b) => a.datasetIndex - b.datasetIndex } },
      tooltip: {
        ...tooltipBase(escuro),
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatarMetrica(metrica, ctx.parsed.y)}` },
      },
    },
    scales: comBordaDeEixo({
      x: eixoDeTempo(escuro, idioma, dataCurta, { min: janela?.inicio, max: janela?.fim }),
      y: {
        ticks: { color: corDoTique(escuro), callback: (v) => formatarMetrica(metrica, v), maxTicksLimit: 6 },
        grid: { color: corDaGrade(escuro) },
      },
    }, escuro),
  }), [escuro, idioma, dataCurta, janela, metrica])

  const rotuloComparacao = t('treinamento.vsPrevious')
  const porHora = stats.total > 0 ? stats.total / (periodo.duracaoMs / 3_600_000) : null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <SeletorDePeriodo
          opcoes={PERIODOS_AO_VIVO}
          periodo={periodo}
          onChange={onPeriodo}
          janela={janela}
          maisRecenteMs={maisRecenteMs}
          carregando={carregandoPeriodo}
        />
        {cicloAtual && (
          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
            {t('treinamento.currentCycle', {
              versao: cicloAtual.versao || '–',
              inicio: formatarHora(cicloAtual.inicio, idioma.intl),
              n: cicloAtual.total,
            })}
          </Typography>
        )}
      </Box>

      {itens.length === 0 ? (
        <Painel>
          <EstadoVazio mensagem={t('treinamento.emptyWindow')} />
        </Painel>
      ) : (
        <>
          <Grid container spacing={1.5}>
            {METRICAS.map((id) => (
              <Grid key={id} size={{ xs: 6, sm: 4, md: 2.4 }}>
                <CartaoMetrica
                  id={id}
                  valor={stats[id]}
                  delta={statsAnterior.total > 0 ? variacao(stats[id], statsAnterior[id]) : null}
                  serie={reduzirPontos(series[id].map((p) => p.y).filter((y) => y !== null), 30)}
                  selecionado={metrica === id}
                  onSelecionar={() => setMetrica(id)}
                  rotuloComparacao={rotuloComparacao}
                  extra={id === 'duracaoSegundos' && porHora !== null
                    ? t('treinamento.perHour', { n: formatarNumero(porHora, 0) })
                    : null}
                />
              </Grid>
            ))}
          </Grid>
          {viradaDeCiclo !== null && statsAnterior.total > 0 && (
            <Typography variant="caption" role="note" sx={{ color: 'var(--text-secondary)', mt: -1 }}>
              {t('treinamento.cycleBoundary', { hora: formatarHora(viradaDeCiclo, idioma.intl) })}
            </Typography>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Painel
                titulo={t('treinamento.liveChartTitle', { metrica: rotuloDaMetrica(t, metrica) })}
                subtitulo={t('treinamento.liveChartSub', { n: janelaMM })}
                sx={{ height: { xs: 340, md: 400 } }}
              >
                <Line data={dadosGrafico} options={opcoesGrafico} plugins={[faixas]} />
              </Painel>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }} sx={{ height: { xs: 'auto', md: 400 }, maxHeight: { xs: 420, md: 'none' } }}>
              <UltimosEpisodios itens={ultimos} onAbrir={onAbrir} />
            </Grid>
          </Grid>

          <MoedasNaJanela linhas={porMoeda} anteriores={porMoedaAnterior} onSelecionarMoeda={onSelecionarMoeda} />
        </>
      )}
    </Box>
  )
}
