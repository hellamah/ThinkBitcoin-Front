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
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { Line } from 'react-chartjs-2'
import { MdCheck, MdCheckCircle, MdClose } from 'react-icons/md'
import ErrorMessage from '../ErrorMessage'
import useAvaliacoesSessao from '../../hooks/useAvaliacoesSessao'
import useTranslation from '../../hooks/useTranslation'
import { padraoDeDataCurta } from '../../utils/dateUtils'
import { readToken } from '../../utils/themeTokens'
import {
  CRITERIOS_DO_MELHOR,
  JANELAS_DA_REGUA,
  avaliacoesDoCriterio,
  criteriosDasAvaliacoes,
  decisaoDaAvaliacao,
  janelaDaRegua,
  resumoDasAvaliacoes,
  serieDasAvaliacoes,
} from '../../utils/treinamento'
import { comAlfa, comBordaDeEixo, corDaGrade, corDaLegenda, corDoTique, eixoDeTempo, tooltipBase } from './graficos'
import { EstadoVazio, Painel } from './Painel'
import { comSinal, estiloDeTabela, formatarDataCurta, formatarNumero, formatarPercentual } from './formato'

// Aba "Validação": o modelo presta? As outras abas mostram o reward de TREINO,
// medido nos próprios dados de treino e contaminado pela exploração. Aqui está
// a avaliação que o treinador faz ao fim de cada sessão, no trecho do histórico
// que o treino nunca viu.
//
// Dois critérios, um por vez (não cabem no mesmo eixo):
// - v8: a mediana do retorno acima do passivo (%), contra ficar parado e contra
//   o buy-and-hold. O teste é registrado e nunca entra na escolha.
// - v9: o Calmar mediano na régua do zoo, contra a média de 200 dias em três
//   partes da validação e na inteira, com o piso de acaso. O teste não é medido
//   nas sessões: ele é medido uma vez, com o _melhor final.

const pct = (v) => (v === null || v === undefined ? '–' : comSinal(formatarPercentual(v, 2), v))
const calmar = (v) => (v === null || v === undefined ? '–' : comSinal(formatarNumero(v, 2), v))
const corDoSinal = (v) => (v === null || v === undefined ? 'var(--text-muted)' : v > 0 ? 'var(--perf-up)' : 'var(--perf-down)')
const formatoDo = (criterio) => (criterio === CRITERIOS_DO_MELHOR.REGUA ? calmar : pct)

const textoDaDecisao = (avaliacao, t, formatar) => {
  const decisao = decisaoDaAvaliacao(avaliacao)
  if (!decisao) return '–'
  if (decisao.texto) return decisao.texto
  return t(decisao.chave, { campeao: formatar(decisao.campeao) })
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

function Decisao({ avaliacao, formatar }) {
  const { t } = useTranslation()
  if (avaliacao.promovido) {
    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'var(--perf-up)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        <MdCheckCircle aria-hidden="true" /> {t(decisaoDaAvaliacao(avaliacao).chave)}
      </Box>
    )
  }
  return <Box component="span" sx={{ color: 'var(--text-muted)' }}>{textoDaDecisao(avaliacao, t, formatar)}</Box>
}

// Uma janela da régua: o Calmar do agente e se ele bate a média de 200 dias ali
// (a forma do ícone diz, além da cor). A dica traz os dois lados da comparação.
function CelulaDaJanela({ janela }) {
  const { t } = useTranslation()
  if (!janela) return <TableCell align="right">–</TableCell>
  const Icone = janela.bate ? MdCheck : MdClose
  return (
    <TableCell
      align="right"
      title={t('treinamento.partCellHint', {
        agente: calmar(janela.calmarAgente),
        regra: calmar(janela.calmarRegra),
        aprovadasAgente: janela.aprovadasAgente,
        aprovadasRegra: janela.aprovadasRegra,
      })}
      sx={{ whiteSpace: 'nowrap', color: `${janela.bate ? 'var(--perf-up)' : 'var(--perf-down)'} !important` }}
    >
      {calmar(janela.calmarAgente)}{' '}
      <Icone
        aria-label={t(janela.bate ? 'treinamento.partBeats' : 'treinamento.partMisses')}
        style={{ verticalAlign: '-2px' }}
      />
    </TableCell>
  )
}

function colunasDoV8(t) {
  // A validação vem logo depois da data: no celular a tabela rola de lado e
  // é o número que precisa aparecer sem rolar. Versão e episódios são contexto.
  return [
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
}

function colunasDaRegua(t) {
  return [
    { id: 'sessao', rotulo: t('treinamento.colSession') },
    { id: 'calmar', rotulo: t('treinamento.colCalmarValidation'), numerica: true, dica: t('treinamento.colCalmarValidationHint') },
    ...[1, 2, 3].map((n) => ({
      id: `parte-${n}`, rotulo: t('treinamento.colPart', { n }), numerica: true, dica: t('treinamento.colPartHint'),
    })),
    { id: 'aprovadas', rotulo: t('treinamento.colApprovedVsRule'), numerica: true, dica: t('treinamento.colApprovedVsRuleHint') },
    { id: 'campeao', rotulo: t('treinamento.colChampionV9'), numerica: true, dica: t('treinamento.colChampionV9Hint') },
    { id: 'versao', rotulo: t('treinamento.colVersion') },
    { id: 'episodios', rotulo: t('treinamento.colEpisodes'), numerica: true },
    { id: 'decisao', rotulo: t('treinamento.colDecision'), larguraMinima: 240 },
  ]
}

function LinhaDoV8({ a }) {
  const { idioma } = useTranslation()
  return (
    <>
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
      <TableCell><Decisao avaliacao={a} formatar={pct} /></TableCell>
    </>
  )
}

function LinhaDaRegua({ a }) {
  const { idioma } = useTranslation()
  const validacao = janelaDaRegua(a, 'validacao')
  return (
    <>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatarDataCurta(a.ms, idioma.intl)}</TableCell>
      <TableCell align="right" sx={{ fontWeight: 700, color: `${corDoSinal(a.score)} !important` }}>{calmar(a.score)}</TableCell>
      {JANELAS_DA_REGUA.slice(0, 3).map((nome) => <CelulaDaJanela key={nome} janela={janelaDaRegua(a, nome)} />)}
      <TableCell align="right">
        {validacao ? `${validacao.aprovadasAgente} × ${validacao.aprovadasRegra}` : '–'}
      </TableCell>
      <TableCell align="right" sx={{ color: 'var(--text-secondary) !important' }}>{calmar(a.scoreCampeao)}</TableCell>
      <TableCell sx={{ color: 'var(--text-secondary) !important' }}>{a.versaoModelo || '–'}</TableCell>
      <TableCell align="right">{a.episodios}</TableCell>
      <TableCell><Decisao avaliacao={a} formatar={calmar} /></TableCell>
    </>
  )
}

function TabelaAvaliacoes({ serie, criterio }) {
  const { t } = useTranslation()
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(25)
  const ordenadas = useMemo(() => [...serie].reverse(), [serie])
  const ultimaPagina = Math.max(0, Math.ceil(ordenadas.length / porPagina) - 1)
  const paginaAtual = Math.min(pagina, ultimaPagina)
  const visiveis = ordenadas.slice(paginaAtual * porPagina, (paginaAtual + 1) * porPagina)
  const regua = criterio === CRITERIOS_DO_MELHOR.REGUA
  const colunas = regua ? colunasDaRegua(t) : colunasDoV8(t)
  const Linha = regua ? LinhaDaRegua : LinhaDoV8

  return (
    <Painel
      titulo={t('treinamento.sessionsTitle')}
      subtitulo={t(regua ? 'treinamento.sessionsSubV9' : 'treinamento.sessionsSub')}
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
                <Linha a={a} />
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

// Linha horizontal de referência no gráfico, de ponta a ponta da série.
const linhaDeReferencia = (rotulo, y, bordas, cor, tracos) => ({
  label: rotulo,
  data: y === null || y === undefined ? [] : bordas.map((x) => ({ x, y })),
  borderColor: cor,
  backgroundColor: cor,
  borderDash: tracos,
  borderWidth: 1.5,
  pointRadius: 0,
  pointHoverRadius: 0,
  order: 3,
})

function Cartoes({ resumo, criterio }) {
  const { t, idioma } = useTranslation()
  const aoVivo = resumo.aoVivo
  const ultima = resumo.ultima
  const formatar = formatoDo(criterio)

  if (criterio === CRITERIOS_DO_MELHOR.REGUA) {
    return (
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Cartao
            rotulo={t('treinamento.cardBestV9')}
            valor={aoVivo ? calmar(aoVivo.score) : '–'}
            cor={aoVivo ? corDoSinal(aoVivo.score) : undefined}
            detalhe={aoVivo
              ? t('treinamento.cardBestV9Detail', {
                versao: aoVivo.versaoModelo || '–',
                data: formatarDataCurta(aoVivo.ms, idioma.intl),
              })
              : t('treinamento.cardBestV9None')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Cartao
            rotulo={t('treinamento.cardLastSession')}
            valor={calmar(ultima.score)}
            cor={corDoSinal(ultima.score)}
            detalhe={`${formatarDataCurta(ultima.ms, idioma.intl)} · ${textoDaDecisao(ultima, t, calmar)}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Cartao
            rotulo={t('treinamento.cardEligible')}
            valor={`${resumo.elegiveis}/${resumo.total}`}
            detalhe={t('treinamento.cardEligibleDetail', { piso: formatarNumero(ultima.pisoDeAcaso, 2) })}
          />
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Cartao
          rotulo={t('treinamento.cardLiveModel')}
          valor={aoVivo ? formatar(aoVivo.score) : '–'}
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
          valor={formatar(ultima.score)}
          cor={corDoSinal(ultima.score)}
          detalhe={`${formatarDataCurta(ultima.ms, idioma.intl)} · ${textoDaDecisao(ultima, t, formatar)}`}
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
  )
}

export default function AbaValidacao({ versao }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const { avaliacoes, carregando, erro, recarregar } = useAvaliacoesSessao({ versao, ativo: true })

  // O critério mostrado: o escolhido, se ainda houver sessões dele; senão o da
  // sessão mais recente (o do agente que está treinando).
  const criterios = useMemo(() => criteriosDasAvaliacoes(avaliacoes), [avaliacoes])
  const [escolhido, setEscolhido] = useState(null)
  const criterio = criterios.includes(escolhido) ? escolhido : (criterios[0] ?? CRITERIOS_DO_MELHOR.PASSIVO)
  const regua = criterio === CRITERIOS_DO_MELHOR.REGUA
  const formatar = formatoDo(criterio)

  const doCriterio = useMemo(() => avaliacoesDoCriterio(avaliacoes, criterio), [avaliacoes, criterio])
  const serie = useMemo(() => serieDasAvaliacoes(doCriterio), [doCriterio])
  const resumo = useMemo(() => resumoDasAvaliacoes(doCriterio), [doCriterio])

  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])

  const dadosGrafico = useMemo(() => {
    const destaque = readToken('--accent-ink')
    const neutro = readToken('--text-muted')
    const teste = readToken('--text-secondary')
    const bordas = serie.length > 0 ? [serie[0].ms, serie[serie.length - 1].ms] : []
    const ultima = serie[serie.length - 1]
    const validacao = {
      label: t('treinamento.seriesValidation'),
      data: serie.map((a) => ({ x: a.ms, y: a.score })),
      showLine: false,
      // A sessão que virou o _melhor é o losango cheio; as demais, pontos
      // menores — forma e tamanho, além da cor.
      pointStyle: serie.map((a) => (a.promovido ? 'rectRot' : 'circle')),
      pointRadius: serie.map((a) => (a.promovido ? 6 : 3)),
      pointHoverRadius: serie.map((a) => (a.promovido ? 8 : 5)),
      pointBackgroundColor: serie.map((a) => (a.promovido ? destaque : comAlfa(destaque, 0.45))),
      pointBorderColor: serie.map((a) => (a.promovido ? readToken('--text-primary') : comAlfa(destaque, 0.45))),
      borderColor: destaque,
      backgroundColor: destaque,
      order: 1,
    }
    const campeao = {
      label: t(regua ? 'treinamento.seriesBestV9' : 'treinamento.seriesLiveModel'),
      data: serie.filter((a) => a.campeaoVigente !== null).map((a) => ({ x: a.ms, y: a.campeaoVigente })),
      stepped: 'after',
      borderColor: comAlfa(destaque, 0.8),
      backgroundColor: comAlfa(destaque, 0.8),
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 0,
      order: 0,
    }
    if (regua) {
      // O piso e a regra são da validação congelada: os mesmos em toda sessão.
      return {
        datasets: [
          validacao,
          campeao,
          linhaDeReferencia(t('treinamento.seriesChanceFloor'), ultima?.pisoDeAcaso, bordas, teste, [6, 4]),
          linhaDeReferencia(t('treinamento.seriesRule200'), janelaDaRegua(ultima, 'validacao')?.calmarRegra, bordas, readToken('--perf-down'), [2, 3]),
          linhaDeReferencia(t('treinamento.seriesCash'), 0, bordas, neutro, []),
        ],
      }
    }
    return {
      datasets: [
        validacao,
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
        campeao,
        linhaDeReferencia(t('treinamento.seriesPassive'), 0, bordas, neutro, [6, 4]),
      ],
    }
  // `escuro` entra para reler os tokens quando o tema muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serie, t, escuro, regua])

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
          label: (ctx) => `${ctx.dataset.label}: ${formatar(ctx.parsed.y)}`,
          // No ponto da validação, a decisão: virou o _melhor, ou por que não.
          afterLabel: (ctx) => {
            if (ctx.datasetIndex !== 0) return ''
            const a = serie[ctx.dataIndex]
            if (!a) return ''
            return `${a.versaoModelo || ''} · ${textoDaDecisao(a, t, formatar)}`
          },
        },
      },
    },
    scales: comBordaDeEixo({
      x: eixoDeTempo(escuro, idioma, dataCurta),
      y: {
        ticks: { color: corDoTique(escuro), callback: (v) => formatar(v), maxTicksLimit: 6 },
        grid: { color: corDaGrade(escuro) },
      },
    }, escuro),
  }), [escuro, idioma, dataCurta, serie, t, formatar])

  const aoVivo = resumo?.aoVivo

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {criterios.length > 1 && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={criterio}
          onChange={(_, valor) => { if (valor) setEscolhido(valor) }}
          aria-label={t('treinamento.criterionLabel')}
          sx={{
            alignSelf: 'flex-start',
            '& .MuiToggleButton-root': { textTransform: 'none', color: 'var(--text-secondary)', borderColor: 'var(--border)' },
            '& .Mui-selected': { color: 'var(--accent-ink) !important', fontWeight: 600 },
          }}
        >
          <ToggleButton value={CRITERIOS_DO_MELHOR.REGUA}>{t('treinamento.criterionRegua')}</ToggleButton>
          <ToggleButton value={CRITERIOS_DO_MELHOR.PASSIVO}>{t('treinamento.criterionPassive')}</ToggleButton>
        </ToggleButtonGroup>
      )}
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', maxWidth: 900 }}>
        {t(regua ? 'treinamento.validationIntroV9' : 'treinamento.validationIntro')}
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
          <Cartoes resumo={resumo} criterio={criterio} />

          <Painel
            titulo={t(regua ? 'treinamento.validationChartTitleV9' : 'treinamento.validationChartTitle')}
            subtitulo={t(regua ? 'treinamento.validationChartSubV9' : 'treinamento.validationChartSub')}
            sx={{ height: { xs: 360, md: 400 } }}
          >
            <Line
              data={dadosGrafico}
              options={opcoesGrafico}
              aria-label={regua
                ? t('treinamento.validationChartSummaryV9', {
                  n: resumo.total,
                  elegiveis: resumo.elegiveis,
                  melhor: aoVivo ? calmar(aoVivo.score) : '–',
                })
                : t('treinamento.validationChartSummary', {
                  n: resumo.total,
                  batendo: resumo.batendoPassivo,
                  aoVivo: aoVivo ? pct(aoVivo.score) : '–',
                })}
            />
          </Painel>

          <TabelaAvaliacoes serie={serie} criterio={criterio} />
        </>
      )}
    </Box>
  )
}
