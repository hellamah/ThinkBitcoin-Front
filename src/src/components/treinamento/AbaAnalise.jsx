import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useTheme } from '@mui/material/styles'
import { Line } from 'react-chartjs-2'
import useTranslation from '../../hooks/useTranslation'
import { padraoDeDataCurta } from '../../utils/dateUtils'
import { comportamentoDeRolagem } from '../../utils/movimento'
import { readToken } from '../../utils/themeTokens'
import {
  PERIODOS_ANALISE,
  cicloQueContem,
  cortesEntreCiclos,
  detectarCiclos,
  enquadrarCiclo,
  evolucaoPorMoeda,
  filtrarJanela,
  instanteDe,
  janelaDoPeriodo,
  janelaParaMistura,
  pisoDoEpsilon,
  resumirCiclos,
  resumirPorMoeda,
  resumirVersoes,
  serieSuavizada,
} from '../../utils/treinamento'
import {
  comAlfa,
  comBordaDeEixo,
  corDaGrade,
  corDaLegenda,
  corDoTique,
  eixoDeTempo,
  formatarMetrica,
  opcoesDasFaixas,
  pluginFaixasDeCiclo,
  rotuloDaMetrica,
  tooltipBase,
} from './graficos'
import { EstadoVazio, Painel } from './Painel'
import SeletorDePeriodo from './SeletorDePeriodo'
import TabelaEpisodios from './TabelaEpisodios'
import TabelaMoedas from './TabelaMoedas'
import { TabelaCiclos, TabelaVersoes } from './TabelasDeCiclos'
import { corDaMoeda, formaDaMoeda, formatarHora, formatarIntervalo } from './formato'

// Aba "Análise": o modelo está aprendendo? Em quais moedas, em quais ciclos,
// em qual versão? Horizonte maior que o da aba ao vivo, e tudo separado por
// moeda — misturar as moedas numa série só era o que produzia o serrote.

// Sem loss: é da rede, não da moeda, e as dez curvas saíam idênticas.
const METRICAS_DA_CURVA = ['rewardMedio', 'acertoTrades']
const JANELA_POR_MOEDA = 5
const PLUGINS = [pluginFaixasDeCiclo]

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

export default function AbaAnalise({ timeline, resumo, periodo, onPeriodo, maisRecenteMs, carregando, carregandoPeriodo, garantirPeriodo, falhouEntre, onAbrir, onSelecionarMoeda }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const [metrica, setMetrica] = useState('rewardMedio')
  const graficoRef = useRef(null)

  const janela = useMemo(() => janelaDoPeriodo(periodo, maisRecenteMs), [periodo, maisRecenteMs])
  // Espera a carga inicial, pelo mesmo motivo da aba ao vivo.
  const garantir = useCallback(() => {
    if (janela) garantirPeriodo(janela.inicio, janela.fim)
  }, [janela, garantirPeriodo])
  useEffect(() => {
    if (!carregando) garantir()
  }, [carregando, garantir])
  const falhou = janela ? falhouEntre(janela.inicio, janela.fim) : false

  // Enquadrar um ciclo: o período passa a ser o ciclo, e tudo na aba — curva,
  // tabela de moedas, episódios — responde só por ele. Numa janela de 24h com
  // vários treinos, a tendência por moeda atravessava reinícios; dentro de um
  // ciclo ela volta a dizer se aquele treino aprendeu. A tabela de ciclos fica
  // embaixo da curva, então a tela sobe até a curva, que é o que mudou.
  const focarCiclo = useCallback((ciclo) => {
    onPeriodo(enquadrarCiclo(periodo, ciclo))
    graficoRef.current?.scrollIntoView?.({ behavior: comportamentoDeRolagem(), block: 'center' })
  }, [onPeriodo, periodo])

  const itens = useMemo(() => (janela ? filtrarJanela(timeline, janela.inicio, janela.fim) : []), [timeline, janela])
  const ciclos = useMemo(() => detectarCiclos(itens), [itens])
  const cortes = useMemo(() => cortesEntreCiclos(ciclos), [ciclos])

  // Cada ciclo da janela ao lado do ciclo inteiro, entre tudo o que está
  // carregado: a janela corta o ciclo da borda, e é pelo início do inteiro que
  // ele se identifica — e é o inteiro que o enquadramento mostra.
  const ciclosCarregados = useMemo(() => detectarCiclos(timeline), [timeline])
  const inteiro = useCallback((c) => cicloQueContem(ciclosCarregados, c.inicio) ?? c, [ciclosCarregados])
  const resumoCiclos = useMemo(
    () => resumirCiclos(itens, ciclos).map((c) => ({ ...c, inteiro: inteiro(c) })),
    [itens, ciclos, inteiro]
  )
  const versoes = useMemo(() => resumirVersoes(itens), [itens])

  // Por moeda. Num treino só, a curva e a tendência da própria janela dizem
  // como ele foi. Com vários, a mesma conta atravessava reinícios — uma reta
  // por um serrote, que mudava conforme onde a janela cortava os ciclos —, e o
  // que conta é o patamar de cada treino (ver patamaresDosCiclos): curva de um
  // ponto por treino, tendência entre eles. O "atual" do desde-o-início é o
  // último patamar entre tudo o que está carregado: o último episódio, que a
  // API devolve, podia ser o primeiro de um treino novo, ainda sorteando ações.
  const piso = useMemo(() => pisoDoEpsilon(timeline), [timeline])
  const porMoeda = useMemo(() => {
    const linhas = resumirPorMoeda(itens, JANELA_POR_MOEDA)
    const entreTreinos = ciclos.length > 1 ? evolucaoPorMoeda(itens, ciclos, piso) : null
    const atual = evolucaoPorMoeda(timeline, ciclosCarregados, piso)
    return linhas.map((m) => {
      const entre = entreTreinos?.get(m.moeda)
      return {
        ...m,
        ...(entreTreinos && { tendencia: entre?.tendencia ?? null, curva: entre?.patamares ?? [] }),
        patamarAtual: atual.get(m.moeda)?.ultimo ?? null,
      }
    })
  }, [itens, ciclos, timeline, ciclosCarregados, piso])

  const itensPorMoeda = useMemo(() => {
    const grupos = new Map()
    for (const r of itens) {
      if (!r.moeda) continue
      if (!grupos.has(r.moeda)) grupos.set(r.moeda, [])
      grupos.get(r.moeda).push(r)
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [itens])

  // Com dados reais as dez curvas se sobrepõem numa faixa estreita, e a
  // tendência geral sumia no emaranhado. A linha "todas as moedas", grossa e
  // por cima, carrega a leitura; as moedas ficam finas e translúcidas, como
  // contexto — e seguem destacáveis pela legenda.
  const dadosCurva = useMemo(() => {
    const porMoeda = itensPorMoeda.map(([moeda, eps]) => ({
      label: moeda,
      data: serieSuavizada(eps, metrica, JANELA_POR_MOEDA, cortes),
      borderColor: comAlfa(corDaMoeda(moeda), 0.6),
      backgroundColor: corDaMoeda(moeda),
      pointStyle: formaDaMoeda(moeda),
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 1.25,
      tension: 0.3,
      spanGaps: false,
      order: 1,
    }))
    if (itensPorMoeda.length < 2) return { datasets: porMoeda }
    const cor = readToken('--accent-ink')
    return {
      datasets: [
        {
          label: t('treinamento.allCoins'),
          data: serieSuavizada(itens, metrica, janelaParaMistura(itensPorMoeda.length), cortes),
          borderColor: cor,
          backgroundColor: cor,
          pointStyle: 'line',
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 3,
          tension: 0.3,
          spanGaps: false,
          order: 0,
        },
        ...porMoeda,
      ],
    }
  // `escuro` entra para reler o token do destaque quando o tema muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itensPorMoeda, itens, metrica, cortes, t, escuro])

  const faixas = useMemo(
    () => opcoesDasFaixas(
      ciclos,
      (_, c) => t('treinamento.cycleLabel', { inicio: formatarHora(inteiro(c).inicio, idioma.intl), count: inteiro(c).total }),
      escuro
    ),
    [ciclos, inteiro, t, idioma.intl, escuro]
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
      faixasDeCiclo: faixas,
    },
    scales: comBordaDeEixo({
      x: eixoDeTempo(escuro, idioma, dataCurta, { min: inicioDoEixo, max: janela?.fim }),
      y: {
        ticks: { color: corDoTique(escuro), callback: (v) => formatarMetrica(metrica, v), maxTicksLimit: 6 },
        grid: { color: corDaGrade(escuro) },
      },
    }, escuro),
  }), [escuro, idioma, dataCurta, inicioDoEixo, janela, metrica, faixas])

  const resumoDaCurva = janela
    ? t('treinamento.learningChartSummary', {
      metrica: rotuloDaMetrica(t, metrica),
      intervalo: formatarIntervalo(janela.inicio, janela.fim, idioma.intl),
      moedas: itensPorMoeda.length,
      ciclos: ciclos.length,
    })
    : undefined

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SeletorDePeriodo
        opcoes={PERIODOS_ANALISE}
        periodo={periodo}
        onChange={onPeriodo}
        janela={janela}
        maisRecenteMs={maisRecenteMs}
        carregando={carregandoPeriodo}
        falhou={falhou}
        onTentarDeNovo={garantir}
      />

      {itens.length === 0 ? (
        <Painel>
          <EstadoVazio mensagem={t('treinamento.emptyWindow')} />
        </Painel>
      ) : (
        <>
          <Painel
            ref={graficoRef}
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
            <Line data={dadosCurva} options={opcoesCurva} plugins={PLUGINS} aria-label={resumoDaCurva} />
          </Painel>

          <TabelaMoedas linhas={porMoeda} resumo={resumo} onSelecionarMoeda={onSelecionarMoeda} onAbrir={onAbrir} />

          {resumoCiclos.length > 0 && <TabelaCiclos ciclos={resumoCiclos} onFocar={focarCiclo} />}
          {versoes.length > 1 && <TabelaVersoes versoes={versoes} />}

          <TabelaEpisodios itens={itens} janela={janela} onAbrir={onAbrir} />
        </>
      )}
    </Box>
  )
}
