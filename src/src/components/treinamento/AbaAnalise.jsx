import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useTheme } from '@mui/material/styles'
import { Line } from 'react-chartjs-2'
import useTranslation from '../../hooks/useTranslation'
import { padraoDeDataCurta } from '../../utils/dateUtils'
import {
  PERIODOS_ANALISE,
  detectarCiclos,
  filtrarJanela,
  instanteDe,
  janelaDoPeriodo,
  limiarDeLacuna,
  resumirCiclos,
  resumirPorMoeda,
  resumirVersoes,
  serieSuavizada,
} from '../../utils/treinamento'
import {
  comBordaDeEixo,
  corDaGrade,
  corDaLegenda,
  corDoTique,
  eixoDeTempo,
  formatarMetrica,
  pluginFaixasDeCiclo,
  rotuloDaMetrica,
  tooltipBase,
} from './graficos'
import { EstadoVazio, Painel } from './Painel'
import SeletorDePeriodo from './SeletorDePeriodo'
import TabelaEpisodios from './TabelaEpisodios'
import TabelaMoedas from './TabelaMoedas'
import { TabelaCiclos, TabelaVersoes } from './TabelasDeCiclos'
import { corDaMoeda, formaDaMoeda } from './formato'

// Aba "Análise": o modelo está aprendendo? Em quais moedas, em quais ciclos,
// em qual versão? Horizonte maior que o da aba ao vivo, e tudo separado por
// moeda — misturar as moedas numa série só era o que produzia o serrote.

const METRICAS_DA_CURVA = ['rewardMedio', 'winRate', 'lossMedia']
const JANELA_POR_MOEDA = 5

const estiloDoGrupo = {
  '& .MuiToggleButton-root': {
    color: 'var(--text-muted)',
    borderColor: 'var(--border-strong)',
    px: 1.25,
    py: 0.25,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'none',
    '&.Mui-selected': { color: 'var(--text-primary)', background: 'var(--surface-fill-strong)' },
  },
}

export default function AbaAnalise({ timeline, resumo, periodo, onPeriodo, maisRecenteMs, carregando, carregandoPeriodo, garantirPeriodo, onAbrir, onSelecionarMoeda }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const [metrica, setMetrica] = useState('rewardMedio')

  const janela = useMemo(() => janelaDoPeriodo(periodo, maisRecenteMs), [periodo, maisRecenteMs])
  // Espera a carga inicial, pelo mesmo motivo da aba ao vivo.
  useEffect(() => {
    if (janela && !carregando) garantirPeriodo(janela.inicio, janela.fim)
  }, [janela, carregando, garantirPeriodo])

  const itens = useMemo(() => (janela ? filtrarJanela(timeline, janela.inicio, janela.fim) : []), [timeline, janela])
  const limiar = useMemo(() => limiarDeLacuna(itens), [itens])
  const ciclos = useMemo(() => detectarCiclos(itens), [itens])
  const resumoCiclos = useMemo(() => resumirCiclos(itens, ciclos), [itens, ciclos])
  const porMoeda = useMemo(() => resumirPorMoeda(itens, JANELA_POR_MOEDA), [itens])
  const versoes = useMemo(() => resumirVersoes(itens), [itens])

  const itensPorMoeda = useMemo(() => {
    const grupos = new Map()
    for (const r of itens) {
      if (!r.moeda) continue
      if (!grupos.has(r.moeda)) grupos.set(r.moeda, [])
      grupos.get(r.moeda).push(r)
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [itens])

  const dadosCurva = useMemo(() => ({
    datasets: itensPorMoeda.map(([moeda, eps]) => ({
      label: moeda,
      data: serieSuavizada(eps, metrica, JANELA_POR_MOEDA, limiar),
      borderColor: corDaMoeda(moeda),
      backgroundColor: corDaMoeda(moeda),
      pointStyle: formaDaMoeda(moeda),
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 1.75,
      tension: 0.3,
      spanGaps: false,
    })),
  }), [itensPorMoeda, metrica, limiar])

  const faixas = useMemo(
    () => pluginFaixasDeCiclo(ciclos, (idx, c) => t('treinamento.cycleLabel', { num: idx + 1, count: c.total }), escuro),
    [ciclos, t, escuro]
  )

  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])

  // O eixo começa no primeiro episódio da janela, não no início dela. Numa
  // janela de 3 dias com treino só nas últimas horas, as curvas ficavam
  // espremidas num canto e o resto do gráfico era espaço vazio. (A aba ao vivo
  // mantém a janela inteira de propósito: lá, o vazio É a informação — o
  // treino parou.)
  const inicioDoEixo = itens.length > 0 && janela
    ? Math.max(janela.inicio, instanteDe(itens[0]) - 5 * 60 * 1000)
    : janela?.inicio

  const opcoesCurva = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { color: corDaLegenda(escuro), usePointStyle: true, boxWidth: 8, padding: 12 } },
      tooltip: {
        ...tooltipBase(escuro),
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatarMetrica(metrica, ctx.parsed.y)}` },
      },
    },
    scales: comBordaDeEixo({
      x: eixoDeTempo(escuro, idioma, dataCurta, { min: inicioDoEixo, max: janela?.fim }),
      y: {
        ticks: { color: corDoTique(escuro), callback: (v) => formatarMetrica(metrica, v), maxTicksLimit: 6 },
        grid: { color: corDaGrade(escuro) },
      },
    }, escuro),
  }), [escuro, idioma, dataCurta, inicioDoEixo, janela, metrica])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SeletorDePeriodo
        opcoes={PERIODOS_ANALISE}
        periodo={periodo}
        onChange={onPeriodo}
        janela={janela}
        maisRecenteMs={maisRecenteMs}
        carregando={carregandoPeriodo}
      />

      {itens.length === 0 ? (
        <Painel>
          <EstadoVazio mensagem={t('treinamento.emptyWindow')} />
        </Painel>
      ) : (
        <>
          <Painel
            titulo={t('treinamento.learningByCoin')}
            subtitulo={t('treinamento.learningByCoinSub', { n: JANELA_POR_MOEDA })}
            acao={
              <ToggleButtonGroup
                size="small"
                exclusive
                value={metrica}
                onChange={(_, v) => { if (v) setMetrica(v) }}
                aria-label={t('treinamento.metricLabel')}
                sx={estiloDoGrupo}
              >
                {METRICAS_DA_CURVA.map((id) => (
                  <ToggleButton key={id} value={id}>{rotuloDaMetrica(t, id)}</ToggleButton>
                ))}
              </ToggleButtonGroup>
            }
            sx={{ height: { xs: 380, md: 440 } }}
          >
            <Line data={dadosCurva} options={opcoesCurva} plugins={[faixas]} />
          </Painel>

          <TabelaMoedas linhas={porMoeda} resumo={resumo} onSelecionarMoeda={onSelecionarMoeda} onAbrir={onAbrir} />

          {resumoCiclos.length > 0 && <TabelaCiclos ciclos={resumoCiclos} />}
          {versoes.length > 1 && <TabelaVersoes versoes={versoes} />}

          <TabelaEpisodios itens={itens} onAbrir={onAbrir} />
        </>
      )}
    </Box>
  )
}
