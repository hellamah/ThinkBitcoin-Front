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
  ESTRATEGIA_MOTOR,
  MOEDA_MOTOR,
  chaveDaAcao,
  estadoDeHoje,
  executouAoReligar,
  instanteUtc,
  noitesDoRobo,
  seriesDaRegra,
  seriesDoPlacar,
  situacaoDoGatilho,
  ultimaHoraDoRobo,
  ultimoDiaDoPlacar,
} from '../utils/roboAoVivo'
import { BUY_HOLD } from '../utils/zooEstrategia'

// Robô ao vivo (só administrador): o motor de risco que decide no BTC, com
// dinheiro de mentira, desde 23/10/2026 (docs/motor-de-risco.md do
// Back-Python). Até esta tela, nada mostrava as decisões ao vivo: a rota
// historicoDecisoes existia e nenhum componente a chamava. Primeiro veio a
// versão mínima da proposta 2 do Estrategista (ronda de 25/10/2026); em
// 28/10 entraram a curva do robô refeita pelas operações, o critério
// registrado antes de ligar e o diário das noites. No mesmo dia a conta foi
// para o .NET (GET api/RoboAoVivo/placar), que a confere todo dia às 01:30
// UTC, grava cada fechamento e avisa os administradores por email quando o
// critério muda. Em 02/11 a tela passou a dizer também o que vem a seguir: o
// fechamento que faz a regra mudar de lado, o preço contra a média e o que o
// histórico dela diz sobre pausas e entradas (GET api/RoboAoVivo/regra).
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
function EstadoDeHoje({ estado, dose, patrimonio, ultimaHora, operacoes, noites, carregando }) {
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
          <Linha rotulo={t('robo.patrimonio')}>
            <Box component="span" data-testid="robo-patrimonio">{num(patrimonio)}</Box>
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
          <Linha rotulo={t('robo.ultimaHoraRobo')}>
            <Box component="span" data-testid="robo-ultima-hora">
              {ultimaHora === null ? '–' : formatarInstante(new Date(ultimaHora).toISOString(), idioma.intl)}
            </Box>
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

// O preço contra a média de 50 dias: triângulos onde a regra mudou de lado e
// losangos no que o robô executou. Só entram na legenda as marcas que existem.
function GraficoDaRegra({ regra, operacoes }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])
  const series = useMemo(() => seriesDaRegra(regra, operacoes), [regra, operacoes])
  const rotulos = useMemo(() => ({
    preco: t('robo.gatilho.preco'),
    media: t('robo.gatilho.media'),
    regraComprou: t('robo.gatilho.regraComprou'),
    regraVendeu: t('robo.gatilho.regraVendeu'),
    roboComprou: t('robo.gatilho.roboComprou'),
    roboVendeu: t('robo.gatilho.roboVendeu'),
  }), [t])

  const dados = useMemo(() => {
    const alta = readToken('--perf-up')
    const baixa = readToken('--perf-down')
    const borda = readToken('--text-primary')
    const marca = (rotulo, pontos, cor, extra) => ({
      label: rotulo, data: pontos, showLine: false, backgroundColor: cor, borderColor: cor, pointBorderColor: cor, ...extra,
    })
    const daRegra = { pointStyle: 'triangle', pointRadius: 6, pointHoverRadius: 8, order: 1 }
    const doRobo = { pointStyle: 'rectRot', pointRadius: 8, pointHoverRadius: 10, pointBorderColor: borda, pointBorderWidth: 2, order: 0 }
    return {
      datasets: [
        {
          label: rotulos.preco, data: series.preco, borderColor: readToken('--accent-ink'), backgroundColor: readToken('--accent-ink'),
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 3, order: 3,
        },
        {
          label: rotulos.media, data: series.media, borderColor: readToken('--text-muted'), backgroundColor: readToken('--text-muted'),
          borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, pointStyle: 'line', order: 2,
        },
        marca(rotulos.regraComprou, series.regraComprou, alta, daRegra),
        marca(rotulos.regraVendeu, series.regraVendeu, baixa, { ...daRegra, rotation: 180 }),
        marca(rotulos.roboComprou, series.roboComprou, alta, doRobo),
        marca(rotulos.roboVendeu, series.roboVendeu, baixa, doRobo),
      ].filter((conjunto) => conjunto.data.length > 0),
    }
  // `escuro` entra para reler os tokens quando o tema muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, rotulos, escuro])

  const opcoes = useMemo(() => {
    const base = eixoDeTempo(escuro, idioma, dataCurta)
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      // As marcas têm menos pontos que o preço: 'index' pegaria o ponto errado delas.
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: corDaLegenda(escuro),
            usePointStyle: true,
            boxWidth: 8,
            padding: 14,
            // A ordem de desenho põe as marcas por cima; a legenda segue a da lista.
            sort: (a, b) => a.datasetIndex - b.datasetIndex,
          },
        },
        tooltip: { ...tooltipBase(escuro), callbacks: { label: (ctx) => `${ctx.dataset.label}: ${num(ctx.parsed.y)}` } },
      },
      scales: comBordaDeEixo({
        x: { ...base, time: { ...base.time, unit: 'month', tooltipFormat: `${dataCurta}/yyyy` } },
        y: { ticks: { color: corDoTique(escuro), callback: (v) => num(v, 0), maxTicksLimit: 6 }, grid: { color: corDaGrade(escuro) } },
      }, escuro),
    }
  }, [escuro, idioma, dataCurta])

  return (
    <Box>
      <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 600, mt: 2 }}>{t('robo.gatilho.graficoTitle')}</Typography>
      <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)', mb: 1 }}>{t('robo.gatilho.graficoSub')}</Typography>
      <Box sx={{ height: { xs: 280, md: 320 } }}>
        <Line
          data={dados}
          options={opcoes}
          aria-label={t('robo.gatilho.resumo', { preco: num(regra?.precoFechamento), media: num(regra?.media) })}
        />
      </Box>
    </Box>
  )
}

// O que vem a seguir: o fechamento que faz a regra mudar de lado na próxima
// decisão, diante do preço de agora, e o gráfico que mostra isso acontecendo.
function ProximoPasso({ regra, operacoes, erro }) {
  const { t, idioma } = useTranslation()
  if (erro) return <ErrorMessage message={t('robo.gatilho.erro')} />
  const situacao = situacaoDoGatilho(regra)
  const dentro = regra?.dentro === true
  const carregando = regra === undefined
  const dose = dentro ? regra?.dose : regra?.doseNoGatilho
  return (
    <Painel titulo={t(dentro ? 'robo.gatilho.titleDentro' : 'robo.gatilho.titleFora')} subtitulo={t('robo.gatilho.sub')}>
      {carregando ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: 'var(--accent-ink)' }} /></Box>
      ) : !situacao ? (
        <EstadoVazio mensagem={t('robo.gatilho.semDados')} />
      ) : (
        <>
          <Typography variant="body1" data-testid="robo-gatilho" sx={{ fontWeight: 600, mb: 1 }}>
            {t(`robo.gatilho.${situacao}`, {
              gatilho: num(regra.gatilho),
              falta: pctSemSinal(Math.abs(regra.faltaParaOGatilho)),
            })}
          </Typography>
          <Box sx={{ display: 'grid', columnGap: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Linha rotulo={t('robo.gatilho.precoAgora')}>
              {`${num(regra.precoAtual)} · ${formatarInstante(regra.ultimaHora, idioma.intl)}`}
            </Linha>
            <Linha rotulo={t('robo.gatilho.proximaDecisao')}>
              <Box component="span" data-testid="robo-proxima-decisao">
                {t('robo.gatilho.proximaDecisaoValor', { data: formatarInstante(regra.proximaVela, idioma.intl) })}
              </Box>
            </Linha>
            <Linha rotulo={t('robo.gatilho.ultimoFechamento')}>
              {`${num(regra.precoFechamento)} · ${formatarDia(instanteUtc(regra.ultimoFechamento), idioma.intl)}`}
            </Linha>
            <Linha rotulo={t('robo.gatilho.media')}>
              {`${num(regra.media)} · ${pct(regra.distanciaDaMedia)}`}
            </Linha>
            <Linha rotulo={t('robo.gatilho.volatilidade')}>{pctSemSinal(regra.volatilidade)}</Linha>
            <Linha rotulo={t(dentro ? 'robo.gatilho.doseHoje' : 'robo.gatilho.doseAoEntrar')}>
              <Box component="span" data-testid="robo-dose-gatilho">{pctSemSinal(dose, 0)}</Box>
            </Linha>
          </Box>
          <GraficoDaRegra regra={regra} operacoes={operacoes} />
        </>
      )}
    </Painel>
  )
}

function ItemComDetalhe({ rotulo, valor, detalhe, testId, semQuebra = false }) {
  return (
    <Box sx={{ py: 0.75, borderBottom: '1px solid var(--border)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>{rotulo}</Typography>
        <Typography
          variant="body2"
          component="div"
          data-testid={testId}
          sx={{ fontWeight: 600, textAlign: 'right', ...(semQuebra ? { whiteSpace: 'nowrap' } : {}) }}
        >
          {valor}
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>{detalhe}</Typography>
    </Box>
  )
}

// A regra refeita em todos os fechamentos: o que esperar dela. A tela só informa;
// o critério registrado é que diz quando o motor é desligado.
function IssoENormal({ regra, erro }) {
  const { t, idioma } = useTranslation()
  if (erro) return <ErrorMessage message={t('robo.normal.erro')} />
  const h = regra?.historico
  const dentro = regra?.dentro === true
  const dias = (n) => (n === 1 ? t('robo.normal.umDia') : t('robo.normal.dias', { n }))
  const duracao = dentro ? h?.periodosComprados : h?.pausas
  const entradas = h?.entradas
  return (
    <Painel
      titulo={t('robo.normal.title')}
      subtitulo={h ? t('robo.normal.sub', { inicio: formatarDia(instanteUtc(h.inicio), idioma.intl) }) : undefined}
    >
      {regra === undefined ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} sx={{ color: 'var(--accent-ink)' }} /></Box>
      ) : !h || regra.dentro === null || regra.dentro === undefined ? (
        <EstadoVazio mensagem={t('robo.normal.semDados')} />
      ) : (
        <Box>
          <ItemComDetalhe
            rotulo={t(dentro ? 'robo.normal.periodoAtual' : 'robo.normal.pausaAtual')}
            valor={dias(h.diasNoEstadoAtual)}
            detalhe={t(dentro ? 'robo.normal.periodoAtualDetalhe' : 'robo.normal.pausaAtualDetalhe', {
              iguais: h.iguaisOuMaioresQueOAtual,
              total: duracao?.quantidade ?? 0,
            })}
            testId="robo-normal-atual"
          />
          {duracao?.quantidade > 0 && (
            <ItemComDetalhe
              rotulo={t(dentro ? 'robo.normal.duracaoPeriodo' : 'robo.normal.duracaoPausa')}
              valor={t('robo.normal.ateDias', { dias: dias(duracao.mediana) })}
              detalhe={t('robo.normal.duracaoDetalhe', { p90: dias(duracao.percentil90), maior: dias(duracao.maior) })}
              testId="robo-normal-duracao"
            />
          )}
          <ItemComDetalhe
            rotulo={t('robo.normal.tempoFora')}
            valor={pctSemSinal(h.fracaoFora, 0)}
            detalhe={t('robo.normal.tempoForaDetalhe', { dias: formatarNumero(h.dias, 0) })}
            testId="robo-normal-fora"
          />
          {entradas?.quantidade > 0 && (
            <ItemComDetalhe
              rotulo={t('robo.normal.entradas')}
              valor={t('robo.normal.entradasValor', {
                comGanho: entradas.comGanho,
                total: entradas.quantidade,
                fracao: pctSemSinal(entradas.comGanho / entradas.quantidade, 0),
              })}
              detalhe={t('robo.normal.entradasDetalhe', { ganho: pct(entradas.ganhoMedio, 1), perda: pct(entradas.perdaMedia, 1) })}
              testId="robo-normal-entradas"
            />
          )}
          {entradas?.curtas > 0 && (
            <ItemComDetalhe
              rotulo={t('robo.normal.curtas', { dias: entradas.limiteDeCurta })}
              valor={t('robo.normal.curtasValor', { perdas: entradas.curtasComPerda, total: entradas.curtas })}
              detalhe={t('robo.normal.curtasDetalhe')}
              testId="robo-normal-curtas"
            />
          )}
          <Typography variant="body2" data-testid="robo-normal-conclusao" sx={{ mt: 1.5, fontWeight: 600 }}>
            {t('robo.normal.conclusao')}
          </Typography>
        </Box>
      )}
    </Painel>
  )
}

function CurvaDoPlacar({ series, placar, erro }) {
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
  const retornoRobo = placar?.retornoRobo ?? null
  const retornoRegra = placar?.retornoRegra ?? null
  const retornoBh = placar?.retornoBuyHold ?? null
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
      {placar === undefined ? (
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
    <ItemComDetalhe
      rotulo={rotulo}
      valor={<>{valor} · <Situacao ok={ok} testId={testId} /></>}
      detalhe={detalhe}
      semQuebra
    />
  )
}

// A conferência diária do servidor: o último fechamento conferido e como ficou.
function UltimaConferencia({ conferencia }) {
  const { t, idioma } = useTranslation()
  const texto = conferencia
    ? t('robo.criterio.conferencia', {
      data: formatarDia(instanteUtc(conferencia.data), idioma.intl),
      situacao: t(conferencia.situacao === 'fora' ? 'robo.criterio.fora' : 'robo.criterio.dentro'),
    })
    : t('robo.criterio.semConferencia')
  return (
    <Typography variant="caption" component="p" data-testid="robo-conferencia" sx={{ color: 'var(--text-muted)', mt: 1 }}>
      {texto}
    </Typography>
  )
}

function Criterio({ criterio, conferencia, carregando }) {
  const { t } = useTranslation()
  const vazio = (v) => v === null || v === undefined
  const pontos = (d) => (vazio(d) ? '–' : t('robo.criterio.pontos', { valor: comSinal(formatarNumero(d * 100, 2), d) }))
  // Os limites vêm do .NET com o critério: a tela não repete os números.
  const relativaAplica = criterio && !vazio(criterio.quedaBuyHold) && criterio.quedaBuyHold >= criterio.gatilhoQuedaBuyHold
  return (
    <Painel titulo={t('robo.criterio.title')} subtitulo={t('robo.criterio.sub')}>
      {carregando && !criterio ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} sx={{ color: 'var(--accent-ink)' }} /></Box>
      ) : !criterio || vazio(criterio.distancia) ? (
        <EstadoVazio mensagem={t('robo.criterio.semDados')} />
      ) : (
        <Box>
          <ItemDoCriterio
            rotulo={t('robo.criterio.fidelidade')}
            valor={pontos(criterio.distancia)}
            detalhe={t('robo.criterio.fidelidadeLimite', { limite: formatarNumero(criterio.limiteFidelidade * 100, 0) })}
            ok={criterio.fidelidadeOk}
            testId="robo-criterio-fidelidade"
          />
          <ItemDoCriterio
            rotulo={t('robo.criterio.queda')}
            valor={pctSemSinal(criterio.quedaRobo)}
            detalhe={t('robo.criterio.quedaLimite', { limite: pctSemSinal(criterio.limiteQueda, 0) })}
            ok={criterio.quedaOk}
            testId="robo-criterio-queda"
          />
          <ItemDoCriterio
            rotulo={t('robo.criterio.relativa')}
            valor={relativaAplica
              ? `${pctSemSinal(criterio.quedaRobo)} / ${pctSemSinal(criterio.limiteRelativo)}`
              : t('robo.criterio.naoSeAplica')}
            detalhe={t('robo.criterio.relativaLimite', {
              queda: pctSemSinal(criterio.quedaBuyHold),
              gatilho: pctSemSinal(criterio.gatilhoQuedaBuyHold, 0),
              fracao: pctSemSinal(criterio.fracaoDaQuedaBuyHold, 0),
            })}
            ok={criterio.relativaOk}
            testId="robo-criterio-relativa"
          />
        </Box>
      )}
      {criterio !== undefined && <UltimaConferencia conferencia={conferencia} />}
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
    operacoes, placar, sequencias, regra, erroOperacoes, erroPlacar, erroSequencias, erroRegra, carregando, recarregar,
  } = useRoboAoVivo()

  const hoje = useMemo(() => {
    if (operacoes === undefined && placar === undefined) return { estado: undefined, dose: null }
    return estadoDeHoje(operacoes ?? [], placar?.doseRegra ?? null)
  }, [operacoes, placar])

  // As três curvas do período, prontas no .NET (GET api/RoboAoVivo/placar).
  const series = useMemo(() => seriesDoPlacar(placar), [placar])

  const noites = useMemo(() => {
    if (sequencias === undefined) return undefined
    return noitesDoRobo(sequencias.registros, operacoes, { ultimoDiaDoZoo: ultimoDiaDoPlacar(placar), desde: sequencias.desde })
  }, [sequencias, operacoes, placar])

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
          <EstadoDeHoje
            estado={hoje.estado}
            dose={hoje.dose}
            patrimonio={placar?.patrimonioRobo}
            ultimaHora={ultimaHoraDoRobo(sequencias?.registros)}
            operacoes={operacoes}
            noites={noites}
            carregando={carregando}
          />
          <ProximoPasso regra={regra} operacoes={operacoes} erro={erroRegra} />
        </Box>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 1fr) 2fr' }, alignItems: 'start' }}>
          <IssoENormal regra={regra} erro={erroRegra} />
          <CurvaDoPlacar series={series} placar={placar} erro={erroPlacar} />
        </Box>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 1fr) 2fr' }, alignItems: 'start' }}>
          <Criterio
            criterio={placar === undefined ? undefined : (placar?.criterio ?? null)}
            conferencia={placar?.ultimaConferencia ?? null}
            carregando={carregando}
          />
          <Noites noites={noites} erro={erroSequencias} />
        </Box>
        <TabelaDeOperacoes operacoes={operacoes} erro={erroOperacoes} />
      </Box>
    </div>
  )
}
