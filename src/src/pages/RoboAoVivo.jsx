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
import { comAlfa, comBordaDeEixo, corDaGrade, corDaLegenda, corDoTique, eixoDeTempo, tooltipBase } from '../components/treinamento/graficos'
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
  CRITERIO,
  ESTRATEGIA_MOTOR,
  MOEDA_MOTOR,
  chaveDaAcao,
  criterioDoMotor,
  curvaDoRobo,
  curvaNoPeriodo,
  estadoDeHoje,
  executouAoReligar,
  instanteUtc,
  noitesDoRobo,
  retornoDoPeriodo,
  ultimoDiaDaCurva,
} from '../utils/roboAoVivo'
import { BUY_HOLD } from '../utils/zooEstrategia'

// Robô ao vivo (só administrador): o motor de risco que decide no BTC, com
// dinheiro de mentira, desde 23/10/2026 (docs/motor-de-risco.md do
// Back-Python). Até esta tela, nada mostrava as decisões ao vivo: a rota
// historicoDecisoes existia e nenhum componente a chamava. Primeiro veio a
// versão mínima da proposta 2 do Estrategista (ronda de 25/10/2026); em
// 28/10 entraram a curva do robô refeita pelas operações, o critério
// registrado antes de ligar e o diário das noites, ainda só com o que a API
// já serve. A conta do critério no backend, com aviso, ficou para depois.
//
// A curva do robô usa o caixa gravado depois de cada operação. Até o
// Back-Python e523b78c (28/10), esse caixa voltava a 1.000 quando o worker
// reiniciava; desde a ativação, isso não afetou nenhuma operação, porque a
// única foi a primeira.

const estiloDoBotao = { color: 'var(--accent-ink)', textTransform: 'none', fontWeight: 600 }

const pct = (v, casas = 2) => (v === null || v === undefined ? '–' : comSinal(formatarPercentual(v === 0 ? 0 : v, casas), v))
const pctSemSinal = (v, casas = 2) => (v === null || v === undefined ? '–' : formatarPercentual(v, casas))
const num = (v, casas = 2) => (v === null || v === undefined ? '–' : formatarNumero(v, casas))
const corDoSinal = (v) => (v === null || v === undefined ? 'var(--text-muted)' : v >= 0 ? 'var(--perf-up)' : 'var(--perf-down)')
const HORA_MS = 60 * 60 * 1000

// Data e hora em UTC, como a regra decide (a vela das 23h UTC).
const formatarInstante = (valor, locale) => {
  const ms = instanteUtc(valor)
  if (Number.isNaN(ms)) return '–'
  return `${new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }).format(ms)} UTC`
}

const formatarDia = (ms, locale) => new Intl.DateTimeFormat(locale, {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
}).format(ms)

// A decisão de uma noite em palavras, com o estado em que o robô ficou.
const textoDaDecisao = (t, noite) => {
  if (!noite.rodou) return t('robo.noites.naoRodou')
  const decisao = noite.decisao ? t(`robo.noites.${noite.decisao}`) : '–'
  return noite.depois ? `${decisao} · ${t(`robo.${noite.depois}`)}` : decisao
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
function EstadoDeHoje({ estado, dose, operacoes, noites, carregando }) {
  const ultima = operacoes?.[0]
  const ultimaNoite = noites?.[0]
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
          <Linha rotulo={t('robo.ultimaDecisao')}>
            <Box component="span" data-testid="robo-ultima-decisao">
              {ultimaNoite
                ? `${textoDaDecisao(t, ultimaNoite)} · ${formatarInstante(new Date(ultimaNoite.dia + 23 * HORA_MS).toISOString(), idioma.intl)}`
                : '–'}
            </Box>
          </Linha>
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

function CurvaDoPlacar({ series, curvas, erro }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])
  const nomeDoRobo = t('robo.nomeRobo')
  const nomeDaRegra = t(`zoo.nomes.${ESTRATEGIA_MOTOR}`)
  const nomeDoBh = t(`zoo.nomes.${BUY_HOLD}`)

  const dados = useMemo(() => {
    const conjunto = (rotulo, pontos, cor, extra = {}) => ({
      label: rotulo, data: pontos, borderColor: cor, backgroundColor: cor, borderWidth: 2, pointRadius: 2, pointHoverRadius: 4, ...extra,
    })
    const destaque = readToken('--accent-ink')
    // A regra no papel tracejada, no tom do robô: ele deveria ficar em cima dela.
    return {
      datasets: [
        conjunto(nomeDoRobo, series.robo, destaque, { borderWidth: 2.5 }),
        conjunto(nomeDaRegra, series.regra, comAlfa(destaque, 0.55), {
          borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, pointStyle: 'line',
        }),
        conjunto(nomeDoBh, series.bh, readToken('--text-muted'), { borderWidth: 1.5 }),
      ],
    }
  // `escuro` entra para reler os tokens quando o tema muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, nomeDoRobo, nomeDaRegra, nomeDoBh, escuro])

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
  const retornoRobo = retornoDoPeriodo(series.robo)
  const retornoRegra = retornoDoPeriodo(series.regra)
  const retornoBh = retornoDoPeriodo(series.bh)
  const retorno = (nome, valor) => (
    <Typography variant="body2">
      {`${nome}: `}
      <Box component="span" sx={{ fontWeight: 700, color: corDoSinal(valor) }}>{pct(valor)}</Box>
    </Typography>
  )
  return (
    <Painel
      titulo={t('robo.curvaTitle')}
      subtitulo={t('robo.curvaSub')}
      sx={{ height: { xs: 400, md: 440 } }}
      // O gráfico ocupa a altura que sobra do painel.
      corpoSx={{ display: 'flex', flexDirection: 'column' }}
    >
      {curvas === undefined ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: 'var(--accent-ink)' }} /></Box>
      ) : series.regra.length === 0 ? (
        <EstadoVazio mensagem={t('robo.curvaVazia')} />
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 1 }} data-testid="robo-retornos">
            {retorno(nomeDoRobo, retornoRobo)}
            {retorno(nomeDaRegra, retornoRegra)}
            {retorno(nomeDoBh, retornoBh)}
          </Box>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <Line
              data={dados}
              options={opcoes}
              aria-label={t('robo.curvaResumo', { robo: pct(retornoRobo), regra: pct(retornoRegra), bh: pct(retornoBh) })}
            />
          </Box>
        </>
      )}
    </Painel>
  )
}

// Dentro, fora ou sem resposta (sem dados, ou a regra não se aplica).
function Situacao({ ok, testId }) {
  const { t } = useTranslation()
  const [texto, cor] = ok === true
    ? [t('robo.criterio.dentro'), 'var(--perf-up)']
    : ok === false ? [t('robo.criterio.fora'), 'var(--perf-down)'] : ['–', 'var(--text-muted)']
  return <Box component="span" data-testid={testId} sx={{ color: cor, fontWeight: 700 }}>{texto}</Box>
}

function ItemDoCriterio({ rotulo, valor, detalhe, ok, testId }) {
  return (
    <Box sx={{ py: 0.75, borderBottom: '1px solid var(--border)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>{rotulo}</Typography>
        <Typography variant="body2" component="div" sx={{ fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {valor} · <Situacao ok={ok} testId={testId} />
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>{detalhe}</Typography>
    </Box>
  )
}

function Criterio({ criterio, carregando }) {
  const { t } = useTranslation()
  const pontos = (d) => (d === null ? '–' : t('robo.criterio.pontos', { valor: comSinal(formatarNumero(d * 100, 2), d) }))
  const relativaAplica = criterio && criterio.quedaBh !== null && criterio.quedaBh >= CRITERIO.QUEDA_DO_BH
  return (
    <Painel titulo={t('robo.criterio.title')} subtitulo={t('robo.criterio.sub')}>
      {carregando && !criterio ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} sx={{ color: 'var(--accent-ink)' }} /></Box>
      ) : !criterio || criterio.distancia === null ? (
        <EstadoVazio mensagem={t('robo.criterio.semDados')} />
      ) : (
        <Box>
          <ItemDoCriterio
            rotulo={t('robo.criterio.fidelidade')}
            valor={pontos(criterio.distancia)}
            detalhe={t('robo.criterio.fidelidadeLimite', { limite: formatarNumero(CRITERIO.FIDELIDADE * 100, 0) })}
            ok={criterio.fidelidadeOk}
            testId="robo-criterio-fidelidade"
          />
          <ItemDoCriterio
            rotulo={t('robo.criterio.queda')}
            valor={pctSemSinal(criterio.quedaRobo)}
            detalhe={t('robo.criterio.quedaLimite', { limite: pctSemSinal(CRITERIO.QUEDA_MAXIMA, 0) })}
            ok={criterio.quedaOk}
            testId="robo-criterio-queda"
          />
          <ItemDoCriterio
            rotulo={t('robo.criterio.relativa')}
            valor={relativaAplica
              ? `${pctSemSinal(criterio.quedaRobo)} / ${pctSemSinal(criterio.limiteRelativo)}`
              : t('robo.criterio.naoSeAplica')}
            detalhe={t('robo.criterio.relativaLimite', {
              queda: pctSemSinal(criterio.quedaBh),
              gatilho: pctSemSinal(CRITERIO.QUEDA_DO_BH, 0),
              fracao: pctSemSinal(CRITERIO.FRACAO_DA_QUEDA_DO_BH, 0),
            })}
            ok={criterio.relativaOk}
            testId="robo-criterio-relativa"
          />
        </Box>
      )}
    </Painel>
  )
}

function Noites({ noites, erro }) {
  const { t, idioma } = useTranslation()
  if (erro) return <ErrorMessage message={t('robo.noites.erro')} />
  const operacao = (noite) => {
    if (noite.operacoes?.length) {
      return noite.operacoes.map((op) => (
        <Box key={op.idHistoricoDecisao} component="span" sx={{ display: 'block' }}>
          {`${nomeDaAcao(t, op.acao)} · ${formatarInstante(op.dataHora, idioma.intl)}`}
          {executouAoReligar(op) ? ` · ${t('robo.noites.aoReligar')}` : ''}
        </Box>
      ))
    }
    if (noite.execucao === 'pendente') return t('robo.noites.pendente')
    if (noite.execucao === 'perdida') {
      return <Box component="span" sx={{ color: 'var(--perf-down)' }}>{t('robo.noites.naoExecutada')}</Box>
    }
    return '–'
  }
  return (
    <Painel titulo={t('robo.noites.title')} subtitulo={t('robo.noites.sub')} corpoSx={{ mx: { xs: -2, md: -2.5 }, mb: { xs: -2, md: -2.5 } }}>
      {noites === undefined ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} sx={{ color: 'var(--accent-ink)' }} /></Box>
      ) : noites.length === 0 ? (
        <EstadoVazio mensagem={t('robo.noites.vazio')} />
      ) : (
        <TableContainer>
          <Table size="small" sx={estiloDeTabela} data-testid="robo-noites">
            <TableHead>
              <TableRow>
                <TableCell>{t('robo.noites.colDia')}</TableCell>
                <TableCell>{t('robo.noites.colDecisao')}</TableCell>
                <TableCell>{t('robo.noites.colOperacao')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {noites.map((noite) => (
                <TableRow key={noite.dia}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatarDia(noite.dia, idioma.intl)}</TableCell>
                  <TableCell sx={{ color: noite.rodou ? 'inherit' : 'var(--perf-warn)' }}>{textoDaDecisao(t, noite)}</TableCell>
                  <TableCell>{operacao(noite)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Painel>
  )
}

export default function RoboAoVivo() {
  const { t, idioma } = useTranslation()
  definirIdiomaDosNumeros(idioma.intl)
  const {
    operacoes, curvas, sequencias, erroOperacoes, erroCurva, erroSequencias, carregando, recarregar,
  } = useRoboAoVivo()

  const hoje = useMemo(() => {
    const curvaDaRegra = (curvas ?? []).find((c) => c.estrategia === ESTRATEGIA_MOTOR)
    if (operacoes === undefined && curvas === undefined) return { estado: undefined, dose: null }
    return estadoDeHoje(operacoes ?? [], curvaDaRegra)
  }, [operacoes, curvas])

  // As três curvas do período. A do robô só sai com a lista de operações: sem
  // ela, não se sabe o caixa nem a posição.
  const series = useMemo(() => {
    const da = (nome) => (curvas ?? []).find((c) => c.estrategia === nome)
    return {
      robo: Array.isArray(operacoes) ? curvaDoRobo(operacoes, da(BUY_HOLD)) : [],
      regra: curvaNoPeriodo(da(ESTRATEGIA_MOTOR)),
      bh: curvaNoPeriodo(da(BUY_HOLD)),
    }
  }, [operacoes, curvas])

  const criterio = useMemo(
    () => (series.robo.length && series.regra.length ? criterioDoMotor(series.robo, series.regra, series.bh) : null),
    [series],
  )

  const noites = useMemo(() => {
    if (sequencias === undefined) return undefined
    const bh = (curvas ?? []).find((c) => c.estrategia === BUY_HOLD)
    return noitesDoRobo(sequencias.registros, operacoes, { ultimoDiaDoZoo: ultimoDiaDaCurva(bh), desde: sequencias.desde })
  }, [sequencias, operacoes, curvas])

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
          <EstadoDeHoje estado={hoje.estado} dose={hoje.dose} operacoes={operacoes} noites={noites} carregando={carregando} />
          <CurvaDoPlacar series={series} curvas={curvas} erro={erroCurva} />
        </Box>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 1fr) 2fr' }, alignItems: 'start' }}>
          <Criterio criterio={criterio} carregando={carregando} />
          <Noites noites={noites} erro={erroSequencias} />
        </Box>
        <TabelaDeOperacoes operacoes={operacoes} erro={erroOperacoes} />
      </Box>
    </div>
  )
}
