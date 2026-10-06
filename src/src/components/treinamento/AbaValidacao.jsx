import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { Line } from 'react-chartjs-2'
import { MdCheckCircle } from 'react-icons/md'
import ErrorMessage from '../ErrorMessage'
import useAvaliacoesSessao from '../../hooks/useAvaliacoesSessao'
import useTranslation from '../../hooks/useTranslation'
import { padraoDeDataCurta } from '../../utils/dateUtils'
import { readToken } from '../../utils/themeTokens'
import { decisaoDaAvaliacao, resumoDasAvaliacoes, serieDasAvaliacoes } from '../../utils/treinamento'
import { comAlfa, comBordaDeEixo, corDaGrade, corDaLegenda, corDoTique, eixoDeTempo, tooltipBase } from './graficos'
import { EstadoVazio, Painel } from './Painel'
import { comSinal, estiloDeTabela, formatarDataCurta, formatarPercentual } from './formato'

// Aba "Validação": o modelo presta? As outras abas mostram o reward de TREINO,
// medido nos próprios dados de treino e contaminado pela exploração. Aqui está
// a avaliação que o treinador faz ao fim de cada sessão: a política gulosa no
// trecho do histórico que o treino nunca viu, contra ficar parado e contra o
// buy-and-hold. É a validação que decide se a sessão vira o modelo ao vivo; o
// teste é registrado e nunca entra na escolha — é o número honesto.

const pct = (v) => (v === null || v === undefined ? '–' : comSinal(formatarPercentual(v, 2), v))
const corDoSinal = (v) => (v === null || v === undefined ? 'var(--text-muted)' : v > 0 ? 'var(--perf-up)' : 'var(--perf-down)')

const textoDaDecisao = (avaliacao, t) => {
  const decisao = decisaoDaAvaliacao(avaliacao)
  if (!decisao) return '–'
  if (decisao.texto) return decisao.texto
  return t(decisao.chave, { campeao: pct(decisao.campeao) })
}

function Cartao({ rotulo, valor, cor, detalhe }) {
  return (
    <Box
      sx={{
        p: 1.75,
        height: '100%',
        borderRadius: 1,
        border: '1px solid var(--border)',
        background: 'var(--surface-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11, color: 'var(--text-secondary)' }}>
        {rotulo}
      </Typography>
      <Typography sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 700, lineHeight: 1.15, color: cor || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </Typography>
      {detalhe && (
        <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>{detalhe}</Typography>
      )}
    </Box>
  )
}

function Decisao({ avaliacao }) {
  const { t } = useTranslation()
  if (avaliacao.promovido) {
    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'var(--perf-up)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        <MdCheckCircle aria-hidden="true" /> {t('treinamento.decisionPromoted')}
      </Box>
    )
  }
  return <Box component="span" sx={{ color: 'var(--text-muted)' }}>{textoDaDecisao(avaliacao, t)}</Box>
}

function TabelaAvaliacoes({ serie }) {
  const { t, idioma } = useTranslation()
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(25)
  const ordenadas = useMemo(() => [...serie].reverse(), [serie])
  const ultimaPagina = Math.max(0, Math.ceil(ordenadas.length / porPagina) - 1)
  const paginaAtual = Math.min(pagina, ultimaPagina)
  const visiveis = ordenadas.slice(paginaAtual * porPagina, (paginaAtual + 1) * porPagina)

  // A validação vem logo depois da data: no celular a tabela rola de lado e
  // é o número que precisa aparecer sem rolar. Versão e episódios são contexto.
  const colunas = [
    { id: 'sessao', rotulo: t('treinamento.colSession') },
    { id: 'validacao', rotulo: t('treinamento.colValidation'), numerica: true, dica: t('treinamento.colValidationHint') },
    { id: 'alfa', rotulo: t('treinamento.colAlphaBuyHold'), numerica: true, dica: t('treinamento.colAlphaBuyHoldHint') },
    { id: 'moedas', rotulo: t('treinamento.colCoinsBeatPassive'), numerica: true, dica: t('treinamento.colCoinsBeatPassiveHint') },
    { id: 'teste', rotulo: t('treinamento.colTest'), numerica: true, dica: t('treinamento.colTestHint') },
    { id: 'campeao', rotulo: t('treinamento.colChampion'), numerica: true, dica: t('treinamento.colChampionHint') },
    { id: 'versao', rotulo: t('treinamento.colVersion') },
    { id: 'episodios', rotulo: t('treinamento.colEpisodes'), numerica: true },
    // Texto que quebra: sem largura mínima, quando a tabela rola de lado a
    // coluna encolhe até a maior palavra e cada linha vira três.
    { id: 'decisao', rotulo: t('treinamento.colDecision'), larguraMinima: 240 },
  ]

  return (
    <Painel
      titulo={t('treinamento.sessionsTitle')}
      subtitulo={t('treinamento.sessionsSub')}
      corpoSx={{ mx: { xs: -2, md: -2.5 }, mb: { xs: -2, md: -2.5 } }}
    >
      <TableContainer>
        <Table size="small" sx={{ ...estiloDeTabela, '& td': { ...estiloDeTabela['& td, & th'], fontVariantNumeric: 'tabular-nums' } }}>
          <TableHead>
            <TableRow>
              {colunas.map((c) => (
                <TableCell key={c.id} align={c.numerica ? 'right' : 'left'} title={c.dica} sx={{ minWidth: c.larguraMinima }}>
                  {c.rotulo}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visiveis.map((a) => (
              <TableRow key={a.idAvaliacaoSessaoTreino} hover sx={{ '&:hover': { background: 'var(--surface-hover)' } }}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatarDataCurta(a.ms, idioma.intl)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: `${corDoSinal(a.score)} !important` }}>{pct(a.score)}</TableCell>
                <TableCell align="right">{pct(a.validacao?.alfa)}</TableCell>
                <TableCell align="right">
                  {a.validacao ? `${a.validacao.moedasBatendoPassivo}/${a.validacao.moedasAvaliadas}` : '–'}
                </TableCell>
                <TableCell align="right" sx={{ color: `${corDoSinal(a.teste?.medianaSobrePassivo)} !important` }}>
                  {pct(a.teste?.medianaSobrePassivo)}
                </TableCell>
                <TableCell align="right" sx={{ color: 'var(--text-secondary) !important' }}>{pct(a.scoreCampeao)}</TableCell>
                <TableCell sx={{ color: 'var(--text-secondary) !important' }}>{a.versaoModelo || '–'}</TableCell>
                <TableCell align="right">{a.episodios}</TableCell>
                <TableCell><Decisao avaliacao={a} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={ordenadas.length}
        page={paginaAtual}
        onPageChange={(_, p) => setPagina(p)}
        rowsPerPage={porPagina}
        onRowsPerPageChange={(e) => { setPorPagina(parseInt(e.target.value, 10)); setPagina(0) }}
        rowsPerPageOptions={[10, 25, 50, 100]}
        labelRowsPerPage={t('treinamento.rowsPerPage')}
        labelDisplayedRows={({ from, to, count }) => t('treinamento.displayedRows', { from, to, count })}
        getItemAriaLabel={(tipo) => (tipo === 'next' || tipo === 'last' ? t('treinamento.nextPage') : t('treinamento.previousPage'))}
        sx={{ color: 'var(--text-primary)', '& .MuiTablePagination-selectIcon, & .MuiIconButton-root': { color: 'var(--text-secondary)' } }}
      />
    </Painel>
  )
}

export default function AbaValidacao({ versao }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const { avaliacoes, carregando, erro, recarregar } = useAvaliacoesSessao({ versao, ativo: true })
  const serie = useMemo(() => serieDasAvaliacoes(avaliacoes), [avaliacoes])
  const resumo = useMemo(() => resumoDasAvaliacoes(avaliacoes), [avaliacoes])

  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])

  const dadosGrafico = useMemo(() => {
    const destaque = readToken('--accent-ink')
    const neutro = readToken('--text-muted')
    const teste = readToken('--text-secondary')
    const bordas = serie.length > 0 ? [serie[0].ms, serie[serie.length - 1].ms] : []
    return {
      datasets: [
        {
          label: t('treinamento.seriesValidation'),
          data: serie.map((a) => ({ x: a.ms, y: a.score })),
          showLine: false,
          // A sessão que virou o modelo ao vivo é o losango cheio; as demais,
          // pontos menores — forma e tamanho, além da cor.
          pointStyle: serie.map((a) => (a.promovido ? 'rectRot' : 'circle')),
          pointRadius: serie.map((a) => (a.promovido ? 6 : 3)),
          pointHoverRadius: serie.map((a) => (a.promovido ? 8 : 5)),
          pointBackgroundColor: serie.map((a) => (a.promovido ? destaque : comAlfa(destaque, 0.45))),
          pointBorderColor: serie.map((a) => (a.promovido ? readToken('--text-primary') : comAlfa(destaque, 0.45))),
          borderColor: destaque,
          backgroundColor: destaque,
          order: 1,
        },
        {
          label: t('treinamento.seriesTest'),
          data: serie.filter((a) => a.teste).map((a) => ({ x: a.ms, y: a.teste.medianaSobrePassivo })),
          showLine: false,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: 'transparent',
          pointBorderColor: teste,
          borderColor: teste,
          backgroundColor: 'transparent',
          order: 2,
        },
        {
          label: t('treinamento.seriesLiveModel'),
          data: serie.filter((a) => a.campeaoVigente !== null).map((a) => ({ x: a.ms, y: a.campeaoVigente })),
          stepped: 'after',
          borderColor: comAlfa(destaque, 0.8),
          backgroundColor: comAlfa(destaque, 0.8),
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          order: 0,
        },
        {
          label: t('treinamento.seriesPassive'),
          data: bordas.map((x) => ({ x, y: 0 })),
          borderColor: neutro,
          backgroundColor: neutro,
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          order: 3,
        },
      ],
    }
  // `escuro` entra para reler os tokens quando o tema muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serie, t, escuro])

  const opcoesGrafico = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'nearest', intersect: true },
    plugins: {
      legend: { position: 'bottom', labels: { color: corDaLegenda(escuro), usePointStyle: true, boxWidth: 8, padding: 14 } },
      tooltip: {
        ...tooltipBase(escuro),
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${pct(ctx.parsed.y)}`,
          // No ponto da validação, a decisão: virou o modelo ao vivo, ou por que não.
          afterLabel: (ctx) => {
            if (ctx.datasetIndex !== 0) return ''
            const a = serie[ctx.dataIndex]
            if (!a) return ''
            return `${a.versaoModelo || ''} · ${textoDaDecisao(a, t)}`
          },
        },
      },
    },
    scales: comBordaDeEixo({
      x: eixoDeTempo(escuro, idioma, dataCurta),
      y: {
        ticks: { color: corDoTique(escuro), callback: (v) => pct(v), maxTicksLimit: 6 },
        grid: { color: corDaGrade(escuro) },
      },
    }, escuro),
  }), [escuro, idioma, dataCurta, serie, t])

  const aoVivo = resumo?.aoVivo
  const ultima = resumo?.ultima

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', maxWidth: 900 }}>
        {t('treinamento.validationIntro')}
      </Typography>
      {/* O filtro de moeda não vale aqui: a página desliga os chips e diz por
          quê ao lado deles (validationCoinNote). */}

      {avaliacoes === null && carregando ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: 'var(--accent-ink)' }} />
        </Box>
      ) : avaliacoes === null && erro ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
          <ErrorMessage message={t('treinamento.validationLoadError')} />
          <Button size="small" onClick={recarregar} sx={{ color: 'var(--accent-ink)', textTransform: 'none', fontWeight: 600 }}>
            {t('treinamento.retry')}
          </Button>
        </Box>
      ) : !resumo ? (
        <Painel><EstadoVazio mensagem={t('treinamento.validationEmpty')} /></Painel>
      ) : (
        <>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Cartao
                rotulo={t('treinamento.cardLiveModel')}
                valor={aoVivo ? pct(aoVivo.score) : '–'}
                cor={aoVivo ? corDoSinal(aoVivo.score) : undefined}
                detalhe={aoVivo
                  ? t('treinamento.cardLiveModelDetail', {
                    versao: aoVivo.versaoModelo || '–',
                    data: formatarDataCurta(aoVivo.ms, idioma.intl),
                    teste: pct(aoVivo.teste?.medianaSobrePassivo),
                  })
                  : t('treinamento.cardLiveModelUnknown')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Cartao
                rotulo={t('treinamento.cardLastSession')}
                valor={pct(ultima.score)}
                cor={corDoSinal(ultima.score)}
                detalhe={`${formatarDataCurta(ultima.ms, idioma.intl)} · ${textoDaDecisao(ultima, t)}`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Cartao
                rotulo={t('treinamento.cardBeatPassive')}
                valor={`${resumo.batendoPassivo}/${resumo.total}`}
                detalhe={t('treinamento.cardBeatPassiveDetail')}
              />
            </Grid>
          </Grid>

          <Painel
            titulo={t('treinamento.validationChartTitle')}
            subtitulo={t('treinamento.validationChartSub')}
            sx={{ height: { xs: 360, md: 400 } }}
          >
            <Line
              data={dadosGrafico}
              options={opcoesGrafico}
              aria-label={t('treinamento.validationChartSummary', {
                n: resumo.total,
                batendo: resumo.batendoPassivo,
                aoVivo: aoVivo ? pct(aoVivo.score) : '–',
              })}
            />
          </Painel>

          <TabelaAvaliacoes serie={serie} />
        </>
      )}
    </Box>
  )
}
