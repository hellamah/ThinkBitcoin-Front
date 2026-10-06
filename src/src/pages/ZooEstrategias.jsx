import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { Chart as ChartJS, LogarithmicScale } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { MdCheckCircle } from 'react-icons/md'
import ErrorMessage from '../components/ErrorMessage'
import { comBordaDeEixo, corDaGrade, corDaLegenda, corDoTique, comAlfa, eixoDeTempo, tooltipBase } from '../components/treinamento/graficos'
import { EstadoVazio, MoedaChip, Painel } from '../components/treinamento/Painel'
import {
  comSinal,
  definirIdiomaDosNumeros,
  estiloDeTabela,
  formatarDataCurta,
  formatarNumero,
  formatarPercentual,
} from '../components/treinamento/formato'
import useZooEstrategia, { useCurvaZoo } from '../hooks/useZooEstrategia'
import useTranslation from '../hooks/useTranslation'
import { padraoDeDataCurta } from '../utils/dateUtils'
import { readToken } from '../utils/themeTokens'
import {
  BUY_HOLD,
  estrategiaPadrao,
  formatarDiaUtc,
  linhaDaMoeda,
  moedaPadrao,
  moedasDaRodada,
  noDiaLocal,
  nomeDaEstrategia,
  piorQueda,
  pontosDaCurva,
  quedaDaCurva,
  resultadoDoAno,
} from '../utils/zooEstrategia'

// Zoo de estratégias (recurso pago). A pergunta desta tela é a do objetivo de
// 06/10/2026: alguma regra simples rende parecido com o buy & hold com bem
// menos queda? Cada estratégia é medida contra o buy & hold da mesma moeda, no
// mesmo período e com a taxa real; o critério exige isso no período inteiro e
// em cada ano, porque cada ano é um regime.

// Oito anos de cripto vão de 1 a 100: em escala linear, tudo antes de 2020 vira
// uma linha no chão.
ChartJS.register(LogarithmicScale)

// -0 (a mediana de zeros com sinal) sairia "-0%".
const semZeroNegativo = (v) => (v === 0 ? 0 : v)
const pct = (v, casas = 1) => (v === null || v === undefined ? '–' : comSinal(formatarPercentual(semZeroNegativo(v), casas), v))
const pctSemSinal = (v, casas = 0) => (v === null || v === undefined ? '–' : formatarPercentual(semZeroNegativo(v), casas))
const num = (v, casas = 2) => (v === null || v === undefined ? '–' : formatarNumero(v, casas))
const corDoSinal = (v) => (v === null || v === undefined ? 'var(--text-muted)' : v >= 0 ? 'var(--perf-up)' : 'var(--perf-down)')
const corDoOk = (ok) => (ok ? 'var(--perf-up)' : 'var(--perf-down)')

const estiloNumerico = { ...estiloDeTabela, '& td': { ...estiloDeTabela['& td, & th'], fontVariantNumeric: 'tabular-nums' } }

// Linha de tabela que escolhe algo: clicável e acionável pelo teclado.
const propsDeLinhaEscolhivel = (selecionada, onEscolher) => ({
  hover: true,
  selected: selecionada,
  tabIndex: 0,
  'aria-selected': selecionada,
  onClick: onEscolher,
  onKeyDown: (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onEscolher()
    }
  },
  sx: {
    cursor: 'pointer',
    '&:hover': { background: 'var(--surface-hover)' },
    '&.Mui-selected, &.Mui-selected:hover': { background: 'var(--surface-hover)', boxShadow: 'inset 3px 0 0 var(--accent)' },
    '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: -2 },
  },
})

function TabelaRanking({ estrategias, selecionada, onSelecionar }) {
  const { t } = useTranslation()
  const colunas = [
    { id: 'estrategia', rotulo: t('zoo.colStrategy') },
    { id: 'aprovada', rotulo: t('zoo.colApproved'), dica: t('zoo.colApprovedHint'), numerica: true },
    { id: 'periodo', rotulo: t('zoo.colPeriodOk'), dica: t('zoo.colPeriodOkHint'), numerica: true },
    { id: 'cagr', rotulo: t('zoo.colCagr'), numerica: true },
    { id: 'cagrBh', rotulo: t('zoo.colCagrBh'), numerica: true },
    { id: 'queda', rotulo: t('zoo.colDrawdown'), numerica: true },
    { id: 'quedaBh', rotulo: t('zoo.colDrawdownBh'), numerica: true },
    { id: 'calmar', rotulo: t('zoo.colCalmar'), dica: t('zoo.colCalmarHint'), numerica: true },
    { id: 'alta', rotulo: t('zoo.colUpCapture'), dica: t('zoo.colUpCaptureHint'), numerica: true },
    { id: 'quedaCap', rotulo: t('zoo.colDownCapture'), dica: t('zoo.colDownCaptureHint'), numerica: true },
    { id: 'exposicao', rotulo: t('zoo.colExposure'), dica: t('zoo.colExposureHint'), numerica: true },
    { id: 'taxa', rotulo: t('zoo.colFees'), dica: t('zoo.colFeesHint'), numerica: true },
  ]

  return (
    <Painel titulo={t('zoo.rankingTitle')} subtitulo={t('zoo.rankingSub')} corpoSx={{ mx: { xs: -2, md: -2.5 }, mb: { xs: -2, md: -2.5 } }}>
      <TableContainer>
        <Table size="small" sx={estiloNumerico}>
          <TableHead>
            <TableRow>
              {colunas.map((c) => (
                <TableCell key={c.id} align={c.numerica ? 'right' : 'left'} title={c.dica}>{c.rotulo}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {estrategias.map((e) => (
              <TableRow key={e.estrategia} {...propsDeLinhaEscolhivel(e.estrategia === selecionada, () => onSelecionar(e.estrategia))}>
                <TableCell sx={{ minWidth: 220 }}>
                  <Box sx={{ fontWeight: 600 }}>{nomeDaEstrategia(t, e.estrategia, e.descricao)}</Box>
                </TableCell>
                <TableCell align="right">
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: e.aprovada ? 'var(--perf-up)' : 'inherit', fontWeight: e.aprovada ? 700 : 400 }}>
                    {e.aprovada && <MdCheckCircle aria-label={t('zoo.approved')} />}
                    {`${e.moedasAprovadas}/${e.moedas}`}
                  </Box>
                </TableCell>
                <TableCell align="right">{`${e.moedasPeriodoOk}/${e.moedas}`}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: `${corDoSinal(e.medianaCagr)} !important` }}>{pct(e.medianaCagr)}</TableCell>
                <TableCell align="right" sx={{ color: 'var(--text-secondary) !important' }}>{pct(e.medianaCagrBuyHold)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{pct(e.medianaQuedaMaxima)}</TableCell>
                <TableCell align="right" sx={{ color: 'var(--text-secondary) !important' }}>{pct(e.medianaQuedaMaximaBuyHold)}</TableCell>
                <TableCell align="right">{num(e.medianaCalmar)}</TableCell>
                <TableCell align="right">{pctSemSinal(e.medianaCapturaAlta)}</TableCell>
                <TableCell align="right">{pctSemSinal(e.medianaCapturaQueda)}</TableCell>
                <TableCell align="right">{pctSemSinal(e.medianaExposicao)}</TableCell>
                <TableCell align="right">{pctSemSinal(e.medianaTaxaPaga, 1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Painel>
  )
}

function GraficosDaCurva({ moeda, estrategia, nome, linha, versaoZoo }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])
  const pedidas = useMemo(() => (estrategia === BUY_HOLD ? [BUY_HOLD] : [estrategia, BUY_HOLD]), [estrategia])
  const { curvas, carregando, erro } = useCurvaZoo({ moeda, estrategias: pedidas, versaoZoo })

  const series = useMemo(() => {
    const da = (nomeDaCurva) => pontosDaCurva((curvas ?? []).find((c) => c.estrategia === nomeDaCurva))
      .map((p) => ({ ...p, x: noDiaLocal(p.x) }))
    const propria = da(estrategia)
    const bh = estrategia === BUY_HOLD ? [] : da(BUY_HOLD)
    return { propria, bh, quedaPropria: quedaDaCurva(propria), quedaBh: quedaDaCurva(bh) }
  }, [curvas, estrategia])

  const eixoX = useMemo(() => {
    const base = eixoDeTempo(escuro, idioma, dataCurta)
    // Pontos diários e semanais ao longo de anos: o tooltip leva o ano, e não a hora.
    return { ...base, time: { ...base.time, tooltipFormat: `${dataCurta}/yyyy` } }
  }, [escuro, idioma, dataCurta])

  const dados = useMemo(() => {
    const destaque = readToken('--accent-ink')
    const neutro = readToken('--text-muted')
    const conjunto = (rotulo, pontos, cor, extra = {}) => ({
      label: rotulo, data: pontos, borderColor: cor, backgroundColor: cor, borderWidth: 2, pointRadius: 0, pointHoverRadius: 3, ...extra,
    })
    return {
      patrimonio: {
        datasets: [
          conjunto(nome, series.propria, destaque),
          ...(series.bh.length ? [conjunto(t('zoo.nomes.buy_hold'), series.bh, neutro, { borderWidth: 1.5 })] : []),
        ],
      },
      queda: {
        datasets: [
          conjunto(nome, series.quedaPropria, destaque, { fill: 'origin', backgroundColor: comAlfa(destaque, 0.18) }),
          ...(series.quedaBh.length ? [conjunto(t('zoo.nomes.buy_hold'), series.quedaBh, neutro, { borderWidth: 1.5 })] : []),
        ],
      },
    }
  // `escuro` entra para reler os tokens quando o tema muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, nome, t, escuro])

  const opcoes = useMemo(() => {
    const comum = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { color: corDaLegenda(escuro), usePointStyle: true, boxWidth: 8, padding: 14 } } },
    }
    return {
      patrimonio: {
        ...comum,
        plugins: {
          ...comum.plugins,
          tooltip: { ...tooltipBase(escuro), callbacks: { label: (ctx) => `${ctx.dataset.label}: ${num(ctx.parsed.y)}` } },
        },
        scales: comBordaDeEixo({
          x: eixoX,
          y: { type: 'logarithmic', ticks: { color: corDoTique(escuro), callback: (v) => num(v, v < 10 ? 1 : 0), maxTicksLimit: 6 }, grid: { color: corDaGrade(escuro) } },
        }, escuro),
      },
      queda: {
        ...comum,
        plugins: {
          ...comum.plugins,
          tooltip: { ...tooltipBase(escuro), callbacks: { label: (ctx) => `${ctx.dataset.label}: ${pct(ctx.parsed.y)}` } },
        },
        scales: comBordaDeEixo({
          x: eixoX,
          y: { max: 0, ticks: { color: corDoTique(escuro), callback: (v) => pctSemSinal(v), maxTicksLimit: 5 }, grid: { color: corDaGrade(escuro) } },
        }, escuro),
      },
    }
  }, [escuro, eixoX])

  if (erro) return <ErrorMessage message={t('zoo.curveLoadError')} />

  const final = series.propria.at(-1)?.y
  const finalBh = series.bh.at(-1)?.y
  return (
    <>
      <Painel
        titulo={t('zoo.curveTitle', { estrategia: nome, moeda })}
        subtitulo={linha ? t('zoo.curveSub', { desde: formatarDiaUtc(linha.inicio, idioma.intl) }) : undefined}
        sx={{ height: { xs: 360, md: 420 } }}
      >
        {carregando && !curvas ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: 'var(--accent-ink)' }} /></Box>
        ) : series.propria.length === 0 ? (
          <EstadoVazio mensagem={t('zoo.curveEmpty')} />
        ) : (
          <Line
            data={dados.patrimonio}
            options={opcoes.patrimonio}
            aria-label={t('zoo.curveSummary', { estrategia: nome, moeda, final: num(final), finalBh: num(finalBh) })}
          />
        )}
      </Painel>
      {series.propria.length > 0 && (
        <Painel
          titulo={t('zoo.drawdownTitle')}
          subtitulo={t('zoo.drawdownSub', { pior: pct(piorQueda(series.quedaPropria)), piorBh: pct(piorQueda(series.quedaBh)) })}
          sx={{ height: { xs: 260, md: 280 } }}
        >
          <Line data={dados.queda} options={opcoes.queda} aria-label={t('zoo.drawdownTitle')} />
        </Painel>
      )}
    </>
  )
}

function TabelaMoedas({ estrategia, nome, moedaSelecionada, onSelecionar }) {
  const { t, idioma } = useTranslation()
  return (
    <Painel titulo={t('zoo.coinsTitle')} subtitulo={t('zoo.coinsSub', { estrategia: nome })} corpoSx={{ mx: { xs: -2, md: -2.5 }, mb: { xs: -2, md: -2.5 } }}>
      <TableContainer>
        <Table size="small" sx={estiloNumerico}>
          <TableHead>
            <TableRow>
              <TableCell>{t('zoo.colCoin')}</TableCell>
              <TableCell>{t('zoo.colSince')}</TableCell>
              <TableCell align="right">{t('zoo.colCagr')}</TableCell>
              <TableCell align="right">{t('zoo.colCagrBh')}</TableCell>
              <TableCell align="right">{t('zoo.colDrawdown')}</TableCell>
              <TableCell align="right">{t('zoo.colDrawdownBh')}</TableCell>
              <TableCell align="right" title={t('zoo.colCalmarHint')}>{t('zoo.colCalmar')}</TableCell>
              <TableCell align="right" title={t('zoo.colYearsOkHint')}>{t('zoo.colYearsOk')}</TableCell>
              <TableCell align="right">{t('zoo.colApproved')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(estrategia?.porMoeda ?? []).map((m) => (
              <TableRow key={m.moeda} {...propsDeLinhaEscolhivel(m.moeda === moedaSelecionada, () => onSelecionar(m.moeda))}>
                <TableCell><MoedaChip moeda={m.moeda} /></TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatarDiaUtc(m.inicio, idioma.intl)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: `${corDoOk(m.retornoOk)} !important` }}>{pct(m.cagr)}</TableCell>
                <TableCell align="right" sx={{ color: 'var(--text-secondary) !important' }}>{pct(m.cagrBuyHold)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: `${corDoOk(m.quedaOk)} !important` }}>{pct(m.quedaMaxima)}</TableCell>
                <TableCell align="right" sx={{ color: 'var(--text-secondary) !important' }}>{pct(m.quedaMaximaBuyHold)}</TableCell>
                <TableCell align="right">{num(m.calmar)}</TableCell>
                <TableCell align="right">{`${m.anosOk}/${m.anosAvaliados}`}</TableCell>
                <TableCell align="right">
                  {m.aprovada
                    ? <Box component="span" sx={{ color: 'var(--perf-up)', fontWeight: 700 }}>{t('zoo.yes')}</Box>
                    : <Box component="span" sx={{ color: 'var(--text-muted)' }}>{t('zoo.no')}</Box>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Painel>
  )
}

function TabelaAnos({ linha, moeda }) {
  const { t } = useTranslation()
  const anos = linha?.porAno ?? []
  return (
    <Painel titulo={t('zoo.yearsTitle', { moeda })} subtitulo={t('zoo.yearsSub')} corpoSx={{ mx: { xs: -2, md: -2.5 }, mb: { xs: -2, md: -2.5 } }}>
      {anos.length === 0 ? (
        <EstadoVazio mensagem={t('zoo.yearsEmpty')} />
      ) : (
        <TableContainer>
          <Table size="small" sx={estiloNumerico}>
            <TableHead>
              <TableRow>
                <TableCell>{t('zoo.colYear')}</TableCell>
                <TableCell align="right">{t('zoo.colReturn')}</TableCell>
                <TableCell align="right">{t('zoo.colReturnBh')}</TableCell>
                <TableCell align="right">{t('zoo.colDrawdown')}</TableCell>
                <TableCell align="right">{t('zoo.colDrawdownBh')}</TableCell>
                <TableCell>{t('zoo.colResult')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {anos.map((a) => {
                const resultado = resultadoDoAno(a)
                return (
                  <TableRow key={a.ano}>
                    <TableCell>{a.dias < 365 ? t('zoo.partialYear', { ano: a.ano, dias: a.dias }) : a.ano}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: `${corDoOk(a.retornoOk)} !important` }}>{pct(a.retorno)}</TableCell>
                    <TableCell align="right" sx={{ color: 'var(--text-secondary) !important' }}>{pct(a.retornoBuyHold)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: `${corDoOk(a.quedaOk)} !important` }}>{pct(a.quedaMaxima)}</TableCell>
                    <TableCell align="right" sx={{ color: 'var(--text-secondary) !important' }}>{pct(a.quedaMaximaBuyHold)}</TableCell>
                    <TableCell sx={{ color: `${resultado === 'ok' ? 'var(--perf-up)' : 'var(--text-muted)'} !important`, fontWeight: resultado === 'ok' ? 700 : 400 }}>
                      {t(`zoo.year_${resultado}`)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Painel>
  )
}

export default function ZooEstrategias() {
  const { t, idioma } = useTranslation()
  // No render, e não num efeito: os filhos formatam números neste mesmo render
  // (ver treinamento/formato.js).
  definirIdiomaDosNumeros(idioma.intl)
  const { rodada, carregando, erro, recarregar } = useZooEstrategia()
  const [escolhida, setEscolhida] = useState(null)
  const [moedaEscolhida, setMoedaEscolhida] = useState(null)

  const moedas = useMemo(() => moedasDaRodada(rodada), [rodada])
  const estrategia = escolhida ?? estrategiaPadrao(rodada)
  const moeda = moedaEscolhida && moedas.includes(moedaEscolhida) ? moedaEscolhida : moedaPadrao(moedas)
  const daRodada = rodada?.estrategias?.find((e) => e.estrategia === estrategia) ?? null
  const nome = daRodada ? nomeDaEstrategia(t, daRodada.estrategia, daRodada.descricao) : ''
  const linha = linhaDaMoeda(rodada, estrategia, moeda)

  return (
    <div className="dashboard-container">
      <Box sx={{ p: { xs: 2, md: 4 }, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>{t('zoo.title')}</Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', maxWidth: 900, mt: 0.5 }}>{t('zoo.intro')}</Typography>
          {rodada && (
            <>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)', maxWidth: 900, mt: 1 }}>
                {t('zoo.criterion', {
                  queda: pctSemSinal(rodada.quedaMaximaRelativa),
                  retorno: pctSemSinal(rodada.retornoMinimoRelativo),
                })}
              </Typography>
              <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)', mt: 0.5 }}>
                {t('zoo.roundInfo', {
                  data: formatarDataCurta(new Date(rodada.dataHora).getTime(), idioma.intl),
                  versao: rodada.versaoZoo,
                  taxa: pctSemSinal(rodada.taxa, 2),
                })}
              </Typography>
            </>
          )}
        </Box>

        {rodada === undefined && carregando ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: 'var(--accent-ink)' }} /></Box>
        ) : rodada === undefined && erro ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
            <ErrorMessage message={t('zoo.loadError')} />
            <Button size="small" onClick={recarregar} sx={{ color: 'var(--accent-ink)', textTransform: 'none', fontWeight: 600 }}>
              {t('zoo.retry')}
            </Button>
          </Box>
        ) : !rodada ? (
          <Painel><EstadoVazio mensagem={t('zoo.empty')} /></Painel>
        ) : (
          <>
            <TabelaRanking estrategias={rodada.estrategias} selecionada={estrategia} onSelecionar={setEscolhida} />

            <Box role="group" aria-label={t('zoo.coinPicker')} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {moedas.map((m) => (
                <MoedaChip
                  key={m}
                  moeda={m}
                  onClick={() => setMoedaEscolhida(m)}
                  rotulo={m === moeda ? t('zoo.coinSelected', { moeda: m }) : m}
                  sx={m === moeda ? { outline: '2px solid var(--accent)', outlineOffset: 1 } : { opacity: 0.75 }}
                />
              ))}
            </Box>

            {estrategia && moeda && (
              <GraficosDaCurva moeda={moeda} estrategia={estrategia} nome={nome} linha={linha} versaoZoo={rodada.versaoZoo} />
            )}

            <TabelaMoedas estrategia={daRodada} nome={nome} moedaSelecionada={moeda} onSelecionar={setMoedaEscolhida} />
            <TabelaAnos linha={linha} moeda={moeda} />
          </>
        )}
      </Box>
    </div>
  )
}
