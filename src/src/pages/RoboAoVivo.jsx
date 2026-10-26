import { useMemo } from 'react'
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
import { Line } from 'react-chartjs-2'
import { MdRefresh } from 'react-icons/md'
import ErrorMessage from '../components/ErrorMessage'
import { comBordaDeEixo, corDaGrade, corDaLegenda, corDoTique, eixoDeTempo, tooltipBase } from '../components/treinamento/graficos'
import { EstadoVazio, Painel } from '../components/treinamento/Painel'
import {
  comSinal,
  definirIdiomaDosNumeros,
  estiloDeTabela,
  formatarNumero,
  formatarPercentual,
} from '../components/treinamento/formato'
import useRoboAoVivo from '../hooks/useRoboAoVivo'
import useTranslation from '../hooks/useTranslation'
import { padraoDeDataCurta } from '../utils/dateUtils'
import { readToken } from '../utils/themeTokens'
import {
  ATIVACAO_MOTOR,
  ESTRATEGIA_MOTOR,
  MOEDA_MOTOR,
  chaveDaAcao,
  curvaNoPeriodo,
  estadoDeHoje,
  instanteUtc,
  retornoDoPeriodo,
} from '../utils/roboAoVivo'
import { BUY_HOLD } from '../utils/zooEstrategia'

// Robô ao vivo (só administrador): o motor de risco que decide no BTC, com
// dinheiro de mentira, desde 23/10/2026 (docs/motor-de-risco.md do
// Back-Python). Até esta tela, nada mostrava as decisões ao vivo: a rota
// historicoDecisoes existia e nenhum componente a chamava. É a versão mínima
// da proposta 2 do Estrategista (ronda de 25/10/2026): só o que a API já
// serve. O placar refeito pelas operações e o critério conferido todo dia
// ficaram de fora; o saldo gravado volta a 1.000 quando o worker reinicia, e
// por isso a tela não desenha curva com ele.

const estiloDoBotao = { color: 'var(--accent-ink)', textTransform: 'none', fontWeight: 600 }

const pct = (v, casas = 2) => (v === null || v === undefined ? '–' : comSinal(formatarPercentual(v === 0 ? 0 : v, casas), v))
const num = (v, casas = 2) => (v === null || v === undefined ? '–' : formatarNumero(v, casas))
const corDoSinal = (v) => (v === null || v === undefined ? 'var(--text-muted)' : v >= 0 ? 'var(--perf-up)' : 'var(--perf-down)')

// Data e hora em UTC, como a regra decide (a vela das 23h UTC).
const formatarInstante = (valor, locale) => {
  const ms = instanteUtc(valor)
  if (Number.isNaN(ms)) return '–'
  return `${new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }).format(ms)} UTC`
}

function Linha({ rotulo, children }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5, borderBottom: '1px solid var(--border)' }}>
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>{rotulo}</Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 600, textAlign: 'right' }}>{children}</Typography>
    </Box>
  )
}

function nomeDaAcao(t, acao) {
  const chave = chaveDaAcao(acao)
  return chave ? t(chave) : (acao || '–')
}

// `operacoes`: undefined enquanto carrega ou quando a busca falhou. Só uma
// lista vazia diz "nenhuma operação"; sem lista, não se sabe, e a linha mostra
// "–" (em 26/10/2026 a rota falhava e a tela dizia que não houve operação,
// com o fechamento de 24/10 no banco).
function EstadoDeHoje({ estado, dose, operacoes, carregando }) {
  const ultima = operacoes?.[0]
  const { t, idioma } = useTranslation()
  const texto = estado === 'dentro' ? t('robo.dentro') : estado === 'fora' ? t('robo.fora') : '–'
  return (
    <Painel titulo={t('robo.estadoTitle')} subtitulo={t('robo.regra')}>
      {carregando && estado === undefined ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} sx={{ color: 'var(--accent-ink)' }} /></Box>
      ) : (
        <Box>
          <Linha rotulo={t('robo.estado')}>
            <Box component="span" data-testid="robo-estado" sx={{ color: estado === 'dentro' ? 'var(--perf-up)' : 'var(--text-primary)' }}>{texto}</Box>
          </Linha>
          <Linha rotulo={t('robo.dose')}>{dose === null ? '–' : formatarPercentual(dose, 0)}</Linha>
          <Linha rotulo={t('robo.moeda')}>{MOEDA_MOTOR}</Linha>
          <Linha rotulo={t('robo.desde')}>{formatarInstante(ATIVACAO_MOTOR, idioma.intl)}</Linha>
          <Linha rotulo={t('robo.ultima')}>
            {ultima
              ? `${nomeDaAcao(t, ultima.acao)} · ${formatarInstante(ultima.dataHora, idioma.intl)}`
              : Array.isArray(operacoes) ? t('robo.semOperacao') : '–'}
          </Linha>
        </Box>
      )}
    </Painel>
  )
}

function TabelaDeOperacoes({ operacoes, erro }) {
  const { t, idioma } = useTranslation()
  if (erro) return <ErrorMessage message={t('robo.operacoesErro')} />
  return (
    <Painel titulo={t('robo.operacoesTitle')} subtitulo={t('robo.operacoesSub')} corpoSx={{ mx: { xs: -2, md: -2.5 }, mb: { xs: -2, md: -2.5 } }}>
      {operacoes === undefined ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} sx={{ color: 'var(--accent-ink)' }} /></Box>
      ) : operacoes.length === 0 ? (
        <EstadoVazio mensagem={t('robo.semOperacao')} />
      ) : (
        <TableContainer>
          <Table size="small" sx={estiloDeTabela}>
            <TableHead>
              <TableRow>
                <TableCell>{t('robo.colData')}</TableCell>
                <TableCell>{t('robo.colAcao')}</TableCell>
                <TableCell align="right">{t('robo.colQuantidade')}</TableCell>
                <TableCell align="right">{t('robo.colPreco')}</TableCell>
                <TableCell align="right">{t('robo.colValor')}</TableCell>
                <TableCell align="right">{t('robo.colTaxa')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {operacoes.map((op) => (
                <TableRow key={op.idHistoricoDecisao}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatarInstante(op.dataHora, idioma.intl)}</TableCell>
                  <TableCell>{nomeDaAcao(t, op.acao)}</TableCell>
                  <TableCell align="right">{num(op.quantidade, 5)}</TableCell>
                  <TableCell align="right">{num(op.precoMercado)}</TableCell>
                  <TableCell align="right">{num(op.valorOperacao)}</TableCell>
                  <TableCell align="right">{num(op.taxa)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Painel>
  )
}

function CurvaDaRegra({ curvas, erro }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])
  const series = useMemo(() => {
    const da = (nome) => curvaNoPeriodo((curvas ?? []).find((c) => c.estrategia === nome))
    return { regra: da(ESTRATEGIA_MOTOR), bh: da(BUY_HOLD) }
  }, [curvas])
  const nomeDaRegra = t(`zoo.nomes.${ESTRATEGIA_MOTOR}`)
  const nomeDoBh = t(`zoo.nomes.${BUY_HOLD}`)

  const dados = useMemo(() => {
    const conjunto = (rotulo, pontos, cor, extra = {}) => ({
      label: rotulo, data: pontos, borderColor: cor, backgroundColor: cor, borderWidth: 2, pointRadius: 2, pointHoverRadius: 4, ...extra,
    })
    return {
      datasets: [
        conjunto(nomeDaRegra, series.regra, readToken('--accent-ink')),
        conjunto(nomeDoBh, series.bh, readToken('--text-muted'), { borderWidth: 1.5 }),
      ],
    }
  // `escuro` entra para reler os tokens quando o tema muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, nomeDaRegra, nomeDoBh, escuro])

  const opcoes = useMemo(() => {
    const base = eixoDeTempo(escuro, idioma, dataCurta)
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: corDaLegenda(escuro), usePointStyle: true, boxWidth: 8, padding: 14 } },
        tooltip: { ...tooltipBase(escuro), callbacks: { label: (ctx) => `${ctx.dataset.label}: ${pct(ctx.parsed.y - 1)}` } },
      },
      scales: comBordaDeEixo({
        x: { ...base, time: { ...base.time, unit: 'day', tooltipFormat: `${dataCurta}/yyyy` } },
        y: { ticks: { color: corDoTique(escuro), callback: (v) => pct(v - 1, 1), maxTicksLimit: 6 }, grid: { color: corDaGrade(escuro) } },
      }, escuro),
    }
  }, [escuro, idioma, dataCurta])

  if (erro) return <ErrorMessage message={t('robo.curvaErro')} />
  const retornoRegra = retornoDoPeriodo(series.regra)
  const retornoBh = retornoDoPeriodo(series.bh)
  return (
    <Painel
      titulo={t('robo.curvaTitle')}
      subtitulo={t('robo.curvaSub')}
      sx={{ height: { xs: 380, md: 420 } }}
    >
      {curvas === undefined ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: 'var(--accent-ink)' }} /></Box>
      ) : series.regra.length === 0 ? (
        <EstadoVazio mensagem={t('robo.curvaVazia')} />
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 1 }} data-testid="robo-retornos">
            <Typography variant="body2">
              {`${nomeDaRegra}: `}
              <Box component="span" sx={{ fontWeight: 700, color: corDoSinal(retornoRegra) }}>{pct(retornoRegra)}</Box>
            </Typography>
            <Typography variant="body2">
              {`${nomeDoBh}: `}
              <Box component="span" sx={{ fontWeight: 700, color: corDoSinal(retornoBh) }}>{pct(retornoBh)}</Box>
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <Line data={dados} options={opcoes} aria-label={t('robo.curvaResumo', { regra: pct(retornoRegra), bh: pct(retornoBh) })} />
          </Box>
        </>
      )}
    </Painel>
  )
}

export default function RoboAoVivo() {
  const { t, idioma } = useTranslation()
  definirIdiomaDosNumeros(idioma.intl)
  const { operacoes, curvas, erroOperacoes, erroCurva, carregando, recarregar } = useRoboAoVivo()

  const hoje = useMemo(() => {
    const curvaDaRegra = (curvas ?? []).find((c) => c.estrategia === ESTRATEGIA_MOTOR)
    if (operacoes === undefined && curvas === undefined) return { estado: undefined, dose: null }
    return estadoDeHoje(operacoes ?? [], curvaDaRegra)
  }, [operacoes, curvas])

  return (
    <div className="dashboard-container">
      <Box sx={{ p: { xs: 2, md: 4 }, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>{t('robo.title')}</Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', maxWidth: 900, mt: 0.5 }}>{t('robo.intro')}</Typography>
          </Box>
          <Button size="small" startIcon={<MdRefresh />} onClick={recarregar} disabled={carregando} sx={estiloDoBotao}>
            {t('robo.atualizar')}
          </Button>
        </Box>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 1fr) 2fr' }, alignItems: 'start' }}>
          <EstadoDeHoje estado={hoje.estado} dose={hoje.dose} operacoes={operacoes} carregando={carregando} />
          <CurvaDaRegra curvas={curvas} erro={erroCurva} />
        </Box>
        <TabelaDeOperacoes operacoes={operacoes} erro={erroOperacoes} />
      </Box>
    </div>
  )
}
