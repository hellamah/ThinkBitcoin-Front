import { useEffect, useMemo, useState } from 'react'
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
import { MdArrowDropDown, MdArrowDropUp, MdCheckCircle, MdErrorOutline, MdRefresh } from 'react-icons/md'
import ErrorMessage from '../components/ErrorMessage'
import {
  BarraDeEntradas,
  ChaveDaSerie,
  EscalaDeDuracao,
  Indicador,
  LegendaDoGrafico,
  MedidorDoLimite,
  PontoDeEstado,
  ReguaDoGatilho,
  TabelaDoGrafico,
} from '../components/robo/Instrumentos'
import { FONTE_DOS_NUMEROS, FONTE_DOS_TITULOS, entradaEmOrdem } from '../components/robo/estilo'
import { miraVertical, rotulosFinais } from '../components/robo/pluginsDoGrafico'
import { comAlfa, comBordaDeEixo, corDaGrade, corDoTique, eixoDeTempo, tooltipBase } from '../components/treinamento/graficos'
import { EstadoVazio, MoedaChip, Painel } from '../components/treinamento/Painel'
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
  chaveDaAcao,
  estadoDeHoje,
  executouAoReligar,
  formatarEspera,
  instanteUtc,
  linhasDoRadar,
  noitesDoRobo,
  saudeDoRobo,
  seriesDaRegra,
  seriesDoPlacar,
  situacaoDoGatilho,
  tempoAteADecisao,
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
// Em 04/11/2026 saíram o painel "Registro" e a tabela "Operações" como painel
// próprio: repetiam a primeira linha das noites e a coluna Operação delas. A
// regra em palavras subiu para o topo, e as operações, com quantidade, preço e
// taxa, viraram a tabela que abre dentro das noites.
//
// A tela é um painel de instrumentos: o painel de cima responde de relance onde o
// robô está e quanto falta para ele agir, e o resto explica e prova. Por isso os
// gráficos ficam na coluna larga, à esquerda, e o contexto de cada um ao lado dele.
//
// A curva do robô usa o caixa gravado depois de cada operação. Até o
// Back-Python e523b78c (28/10), esse caixa voltava a 1.000 quando o worker
// reiniciava; desde a ativação, isso não afetou nenhuma operação, porque a
// única foi a primeira.

const estiloDoBotao = { color: 'var(--accent-ink)', textTransform: 'none', fontWeight: 600 }
const COLUNAS_DA_TELA = { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(300px, 1fr)' }

const pct = (v, casas = 2) => (v === null || v === undefined ? '–' : comSinal(formatarPercentual(v === 0 ? 0 : v, casas), v))
const pctSemSinal = (v, casas = 2) => (v === null || v === undefined ? '–' : formatarPercentual(v, casas))
const num = (v, casas = 2) => (v === null || v === undefined ? '–' : formatarNumero(v, casas))
const MINUTO_MS = 60 * 1000

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

function nomeDaAcao(t, acao) {
  const chave = chaveDaAcao(acao)
  return chave ? t(chave) : (acao || '–')
}

const Carregando = ({ py = 3, tamanho = 28 }) => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py }}><CircularProgress size={tamanho} sx={{ color: 'var(--accent-ink)' }} /></Box>
)

// A hora que passa na tela: a espera até a decisão anda sem pedir nada à API.
function useAgora() {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), MINUTO_MS)
    return () => clearInterval(relogio)
  }, [])
  return agora
}

// A parte de cima do painel que depende da regra: a frase, a régua e os números dela.
function OQueFalta({ regra, erro, placar, agora }) {
  const { t, idioma } = useTranslation()
  if (erro) return <ErrorMessage message={t('robo.gatilho.erro')} />
  if (regra === undefined) return <Carregando py={5} tamanho={32} />
  const situacao = situacaoDoGatilho(regra)
  if (!situacao) return <EstadoVazio mensagem={t('robo.gatilho.semDados')} />

  const dentro = regra.dentro === true
  const falta = Math.abs(regra.faltaParaOGatilho)
  const espera = formatarEspera(tempoAteADecisao(regra.proximaVela, agora))
  const frase = t(`robo.gatilho.${situacao}`, { gatilho: num(regra.gatilho), falta: pctSemSinal(falta) })
  return (
    <>
      <Box sx={{ display: 'grid', gap: { xs: 2, md: 4 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' }, alignItems: 'end' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" component="div" sx={{ color: 'var(--accent-ink)', fontWeight: 600, letterSpacing: '0.04em', mb: 0.25 }}>
            {t(dentro ? 'robo.gatilho.titleDentro' : 'robo.gatilho.titleFora')}
          </Typography>
          <Typography data-testid="robo-gatilho" sx={{ fontFamily: FONTE_DOS_TITULOS, fontWeight: 500, fontSize: { xs: '1.05rem', md: '1.3rem' }, lineHeight: 1.3, maxWidth: 640 }}>
            {frase}
          </Typography>
          <Box sx={{ mt: 0.75, display: 'flex', flexWrap: 'wrap', columnGap: 1, alignItems: 'baseline' }}>
            <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>{t('robo.gatilho.proximaDecisao')}</Typography>
            <Typography variant="body2" data-testid="robo-proxima-decisao" sx={{ fontWeight: 600 }}>
              {t('robo.gatilho.proximaDecisaoValor', { data: formatarInstante(regra.proximaVela, idioma.intl) })}
            </Typography>
            <Typography variant="body2" data-testid="robo-espera" sx={{ color: 'var(--text-secondary)' }}>
              {espera ? t('robo.gatilho.emTempo', { tempo: espera }) : t('robo.gatilho.aguardando')}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ textAlign: { xs: 'left', md: 'right' }, whiteSpace: 'nowrap' }}>
          <Typography variant="caption" component="div" sx={{ color: 'var(--text-muted)' }}>{t(`robo.gatilho.distancia.${situacao}`)}</Typography>
          <Typography component="div" data-testid="robo-falta" sx={{ fontFamily: FONTE_DOS_NUMEROS, fontSize: { xs: '3rem', md: '4rem' }, lineHeight: 1, color: 'var(--text-primary)' }}>
            {pctSemSinal(falta)}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 2.5 }}>
        <ReguaDoGatilho
          preco={regra.precoAtual}
          gatilho={regra.gatilho}
          rotuloPreco={t('robo.estado')}
          rotuloGatilho={t('robo.gatilho.rotuloGatilho')}
          valorPreco={num(regra.precoAtual)}
          valorGatilho={num(regra.gatilho)}
          resumo={frase}
        />
        <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)', mt: 1, mb: 0 }}>
          {`${t('robo.estado')}: ${formatarInstante(regra.ultimaHora, idioma.intl)}. ${t('robo.gatilho.sub')}`}
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: { xs: 1.5, md: 2.5 }, mt: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' } }}>
        <Indicador rotulo={t('robo.patrimonio')} testId="robo-patrimonio">{num(placar?.patrimonioRobo)}</Indicador>
        <Indicador rotulo={t('robo.nomeRobo')}>{pct(placar?.retornoRobo)}</Indicador>
        <Indicador rotulo={t('robo.gatilho.ultimoFechamento')} detalhe={formatarDia(instanteUtc(regra.ultimoFechamento), idioma.intl)}>{num(regra.precoFechamento)}</Indicador>
        <Indicador rotulo={t('robo.gatilho.media')} detalhe={pct(regra.distanciaDaMedia)}>{num(regra.media)}</Indicador>
        <Indicador rotulo={t('robo.gatilho.volatilidade')}>{pctSemSinal(regra.volatilidade)}</Indicador>
        <Indicador rotulo={t(dentro ? 'robo.gatilho.doseHoje' : 'robo.gatilho.doseAoEntrar')} testId="robo-dose-gatilho">
          {pctSemSinal(dentro ? regra.dose : regra.doseNoGatilho, 0)}
        </Indicador>
      </Box>
    </>
  )
}

// O painel de instrumentos: onde o robô está, se está registrando e o que falta.
function PainelDeInstrumentos({ estado, regra, erroRegra, placar, ultimaHora, carregando, ordem }) {
  const { t, idioma } = useTranslation()
  const agora = useAgora()
  const texto = estado === 'dentro' ? t('robo.dentro') : estado === 'fora' ? t('robo.fora') : '–'
  const saude = saudeDoRobo(ultimaHora, agora)
  const diasDaRegra = regra?.historico?.diasNoEstadoAtual
  const dias = (n) => (n === 1 ? t('robo.normal.umDia') : t('robo.normal.dias', { n }))
  return (
    <Painel
      sx={{
        ...entradaEmOrdem(ordem),
        p: { xs: 2, md: 3 },
        borderColor: 'var(--accent-a30)',
        background: 'radial-gradient(circle at 100% 0%, var(--accent-a10), transparent 48%), var(--surface-subtle)',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" component="div" sx={{ color: 'var(--text-muted)' }}>{t('robo.estado')}</Typography>
          {carregando && estado === undefined ? (
            <Carregando py={1} />
          ) : (
            <Typography
              component="div"
              data-testid="robo-estado"
              sx={{ fontFamily: FONTE_DOS_TITULOS, fontWeight: 800, fontSize: { xs: '1.75rem', md: '2.25rem' }, lineHeight: 1.1, color: estado === 'dentro' ? 'var(--perf-up)' : 'var(--text-primary)' }}
            >
              {texto}
            </Typography>
          )}
          {diasDaRegra !== undefined && (
            <Typography variant="body2" data-testid="robo-dias-estado" sx={{ color: 'var(--text-secondary)', mt: 0.25 }}>
              {t(regra?.dentro ? 'robo.diasDentro' : 'robo.diasFora', { dias: dias(diasDaRegra) })}
            </Typography>
          )}
        </Box>
        {saude && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1, px: 1.25, py: 0.5, borderRadius: '999px', border: '1px solid var(--border)' }}>
            <PontoDeEstado ativo={saude.ativo} />
            <Typography variant="caption" data-testid="robo-saude" sx={{ color: 'var(--text-secondary)' }}>
              {saude.ativo
                ? t('robo.saude.ativo')
                : t('robo.saude.parado', { tempo: saude.dias >= 2 ? dias(saude.dias) : `${saude.horas} h` })}
            </Typography>
            <Typography variant="caption" data-testid="robo-ultima-hora" sx={{ color: 'var(--text-muted)' }}>
              {formatarInstante(new Date(ultimaHora).toISOString(), idioma.intl)}
            </Typography>
          </Box>
        )}
      </Box>
      <OQueFalta regra={regra} erro={erroRegra} placar={placar} agora={agora} />
    </Painel>
  )
}

// Marcas com o anel da superfície, para continuarem legíveis ao cruzar a linha.
const marcaDoGrafico = (rotulo, pontos, cor, superficie, extra) => ({
  label: rotulo,
  data: pontos,
  showLine: false,
  backgroundColor: cor,
  borderColor: cor,
  pointBorderColor: superficie,
  pointBorderWidth: 2,
  pointHitRadius: 12,
  ...extra,
})

const opcoesDoEixoY = (escuro, formato, marcarValor) => ({
  border: { display: false },
  ticks: { color: corDoTique(escuro), callback: formato, maxTicksLimit: 6, font: { family: FONTE_DOS_NUMEROS } },
  grid: {
    color: marcarValor === undefined
      ? corDaGrade(escuro)
      : (ctx) => (ctx.tick?.value === marcarValor ? (escuro ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.32)') : corDaGrade(escuro)),
  },
})

// O preço contra a média de 50 dias, com o gatilho que a próxima decisão usa, o preço
// de agora, os triângulos onde a regra mudou de lado e os losangos do que o robô fez.
function GraficoDaRegra({ regra, operacoes, ordem }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])
  const series = useMemo(() => seriesDaRegra(regra, operacoes), [regra, operacoes])
  const rotulos = useMemo(() => ({
    preco: t('robo.gatilho.preco'),
    media: t('robo.gatilho.media'),
    gatilho: t('robo.gatilho.rotuloGatilho'),
    agora: t('robo.estado'),
    regraComprou: t('robo.gatilho.regraComprou'),
    regraVendeu: t('robo.gatilho.regraVendeu'),
    roboComprou: t('robo.gatilho.roboComprou'),
    roboVendeu: t('robo.gatilho.roboVendeu'),
  }), [t])

  const dados = useMemo(() => {
    const destaque = readToken('--accent-ink')
    const alta = readToken('--perf-up')
    const baixa = readToken('--perf-down')
    const superficie = readToken('--surface-panel-solid')
    const precoAcimaDoGatilho = regra?.precoAtual > regra?.gatilho
    const daRegra = { pointStyle: 'triangle', pointRadius: 6, pointHoverRadius: 8, order: 1 }
    const doRobo = { pointStyle: 'rectRot', pointRadius: 8, pointHoverRadius: 10, order: 0 }
    return {
      datasets: [
        {
          label: rotulos.preco, data: series.preco, borderColor: destaque, backgroundColor: destaque,
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 8, order: 4,
        },
        {
          label: rotulos.media, data: series.media, borderColor: readToken('--text-muted'), backgroundColor: readToken('--text-muted'),
          borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, pointHitRadius: 8, order: 5,
        },
        {
          label: rotulos.gatilho, data: series.gatilho, borderColor: readToken('--text-primary'), backgroundColor: readToken('--text-primary'),
          borderDash: [2, 3], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, order: 3,
          rotuloFinal: `${rotulos.gatilho} ${num(regra?.gatilho, 0)}`, rotuloAcima: !precoAcimaDoGatilho,
        },
        marcaDoGrafico(rotulos.agora, series.agora, destaque, superficie, {
          pointRadius: 5, pointHoverRadius: 7, order: 2,
          rotuloFinal: `${rotulos.agora} ${num(regra?.precoAtual, 0)}`, rotuloAcima: precoAcimaDoGatilho,
        }),
        marcaDoGrafico(rotulos.regraComprou, series.regraComprou, alta, superficie, daRegra),
        marcaDoGrafico(rotulos.regraVendeu, series.regraVendeu, baixa, superficie, { ...daRegra, rotation: 180 }),
        marcaDoGrafico(rotulos.roboComprou, series.roboComprou, alta, superficie, doRobo),
        marcaDoGrafico(rotulos.roboVendeu, series.roboVendeu, baixa, superficie, doRobo),
      ].filter((conjunto) => conjunto.data.length > 0),
    }
  // `escuro` entra para reler os tokens quando o tema muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, rotulos, escuro, regra])

  const fim = regra?.proximaVela ? instanteUtc(regra.proximaVela) : undefined
  const opcoes = useMemo(() => {
    const base = eixoDeTempo(escuro, idioma, dataCurta, { max: fim })
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      // As marcas têm menos pontos que o preço: 'index' pegaria o ponto errado delas.
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: { display: false },
        miraVertical: { cor: corDoTique(escuro) },
        rotulosFinais: { cor: readToken('--text-primary'), fundo: readToken('--surface-panel-solid') },
        tooltip: {
          ...tooltipBase(escuro),
          filter: (item) => item.dataset.label !== rotulos.gatilho,
          callbacks: { label: (ctx) => `${num(ctx.parsed.y)}  ${ctx.dataset.label}` },
        },
      },
      scales: comBordaDeEixo({
        x: { ...base, time: { ...base.time, unit: 'month', tooltipFormat: `${dataCurta}/yyyy` }, grid: { display: false } },
        y: opcoesDoEixoY(escuro, (v) => num(v, 0)),
      }, escuro),
    }
  }, [escuro, idioma, dataCurta, fim, rotulos])

  if (regra === undefined) {
    return <Painel titulo={t('robo.gatilho.graficoTitle')} sx={entradaEmOrdem(ordem)}><Carregando py={6} tamanho={32} /></Painel>
  }
  if (!regra?.pontos?.length) return null

  const chaves = [
    { tipo: 'linha', cor: 'var(--accent-ink)', rotulo: rotulos.preco },
    { tipo: 'tracejada', cor: 'var(--text-muted)', rotulo: rotulos.media },
    series.gatilho.length && { tipo: 'tracejada', cor: 'var(--text-primary)', rotulo: rotulos.gatilho },
    series.regraComprou.length && { tipo: 'sobe', cor: 'var(--perf-up)', rotulo: rotulos.regraComprou },
    series.regraVendeu.length && { tipo: 'desce', cor: 'var(--perf-down)', rotulo: rotulos.regraVendeu },
    series.roboComprou.length && { tipo: 'losango', cor: 'var(--perf-up)', rotulo: rotulos.roboComprou },
    series.roboVendeu.length && { tipo: 'losango', cor: 'var(--perf-down)', rotulo: rotulos.roboVendeu },
  ].filter(Boolean)
  const linhasDaTabela = [
    ...(regra.mudancas ?? []).map((m) => ({
      ms: instanteUtc(m.data),
      chave: `regra-${m.data}`,
      valores: [formatarDia(instanteUtc(m.data), idioma.intl), m.tipo === 'entrada' ? rotulos.regraComprou : rotulos.regraVendeu, num(m.preco)],
    })),
    ...series.roboComprou.map((p) => ({ ms: p.x, chave: `compra-${p.x}`, valores: [formatarDia(p.x, idioma.intl), rotulos.roboComprou, num(p.y)] })),
    ...series.roboVendeu.map((p) => ({ ms: p.x, chave: `venda-${p.x}`, valores: [formatarDia(p.x, idioma.intl), rotulos.roboVendeu, num(p.y)] })),
  ].sort((a, b) => b.ms - a.ms)
  return (
    <Painel titulo={t('robo.gatilho.graficoTitle')} subtitulo={t('robo.gatilho.graficoSub')} sx={entradaEmOrdem(ordem)} corpoSx={{ display: 'flex', flexDirection: 'column' }}>
      <LegendaDoGrafico itens={chaves} />
      {/* O gráfico preenche o que a coluna ao lado deixa, sem empurrar a altura dela. */}
      <Box sx={{ position: 'relative', flex: '1 1 320px', minHeight: { xs: 280, md: 320 } }}>
        <Box sx={{ position: 'absolute', inset: 0 }}>
          <Line
            data={dados}
            options={opcoes}
            plugins={[miraVertical, rotulosFinais]}
            aria-label={t('robo.gatilho.resumo', { preco: num(regra.precoFechamento), media: num(regra.media) })}
          />
        </Box>
      </Box>
      <TabelaDoGrafico
        rotulo={t('robo.gatilho.verMudancas')}
        colunas={[t('robo.noites.colDia'), t('robo.gatilho.colMudanca'), t('robo.colPreco')]}
        linhas={linhasDaTabela}
      />
    </Painel>
  )
}

// Os três retornos do período, cada um com a chave da sua linha no gráfico.
function RetornoDoPeriodo({ tipo, cor, nome, valor }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <ChaveDaSerie tipo={tipo} cor={cor} />
        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>{nome}</Typography>
      </Box>
      <Typography component="div" sx={{ fontFamily: FONTE_DOS_NUMEROS, fontSize: { xs: '1.15rem', md: '1.4rem' }, lineHeight: 1.3, color: 'var(--text-primary)' }}>
        {pct(valor)}
      </Typography>
    </Box>
  )
}

function CurvaDoPlacar({ series, placar, erro, ordem }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])
  const nomeDoRobo = t('robo.nomeRobo')
  const nomeDaRegra = t(`zoo.nomes.${ESTRATEGIA_MOTOR}`)
  const nomeDoBh = t(`zoo.nomes.${BUY_HOLD}`)

  const dados = useMemo(() => {
    const conjunto = (rotulo, pontos, cor, extra = {}) => ({
      label: rotulo, data: pontos, borderColor: cor, backgroundColor: cor, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 10, ...extra,
    })
    const destaque = readToken('--accent-ink')
    // A regra no papel tracejada, no tom do robô: ele deveria ficar em cima dela.
    return {
      datasets: [
        conjunto(nomeDoRobo, series.robo, destaque, { borderWidth: 2.5 }),
        conjunto(nomeDaRegra, series.regra, comAlfa(destaque, 0.55), { borderDash: [6, 4], borderWidth: 1.5 }),
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
        legend: { display: false },
        miraVertical: { cor: corDoTique(escuro) },
        tooltip: { ...tooltipBase(escuro), callbacks: { label: (ctx) => `${pct(ctx.parsed.y - 1)}  ${ctx.dataset.label}` } },
      },
      scales: comBordaDeEixo({
        x: { ...base, time: { ...base.time, unit: 'day', tooltipFormat: `${dataCurta}/yyyy` }, grid: { display: false } },
        // A linha do zero é a única forte: as três partem dela.
        y: opcoesDoEixoY(escuro, (v) => pct(v - 1, 1), 1),
      }, escuro),
    }
  }, [escuro, idioma, dataCurta])

  if (erro) return <ErrorMessage message={t('robo.curvaErro')} />
  const retornoRobo = placar?.retornoRobo ?? null
  const retornoRegra = placar?.retornoRegra ?? null
  const retornoBh = placar?.retornoBuyHold ?? null
  const linhasDaTabela = [...(placar?.pontos ?? [])].reverse().map((p) => ({
    chave: p.data,
    valores: [
      formatarDia(instanteUtc(p.data), idioma.intl),
      p.robo === null || p.robo === undefined ? '–' : pct(p.robo - 1),
      p.regra === null || p.regra === undefined ? '–' : pct(p.regra - 1),
      p.buyHold === null || p.buyHold === undefined ? '–' : pct(p.buyHold - 1),
    ],
  }))
  return (
    <Painel titulo={t('robo.curvaTitle')} subtitulo={t('robo.curvaSub')} sx={entradaEmOrdem(ordem)} corpoSx={{ display: 'flex', flexDirection: 'column' }}>
      {placar === undefined ? (
        <Carregando py={6} tamanho={32} />
      ) : series.regra.length === 0 ? (
        <EstadoVazio mensagem={t('robo.curvaVazia')} />
      ) : (
        <>
          <Box data-testid="robo-retornos" sx={{ display: 'grid', gap: 2, mb: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' } }}>
            <RetornoDoPeriodo tipo="linha" cor="var(--accent-ink)" nome={nomeDoRobo} valor={retornoRobo} />
            <RetornoDoPeriodo tipo="tracejada" cor="var(--accent-a50)" nome={nomeDaRegra} valor={retornoRegra} />
            <RetornoDoPeriodo tipo="linha" cor="var(--text-muted)" nome={nomeDoBh} valor={retornoBh} />
          </Box>
          <Box sx={{ position: 'relative', flex: '1 1 260px', minHeight: { xs: 240, md: 260 } }}>
            <Box sx={{ position: 'absolute', inset: 0 }}>
              <Line
                data={dados}
                options={opcoes}
                plugins={[miraVertical]}
                aria-label={t('robo.curvaResumo', { robo: pct(retornoRobo), regra: pct(retornoRegra), bh: pct(retornoBh) })}
              />
            </Box>
          </Box>
          <TabelaDoGrafico
            rotulo={t('robo.verEmTabela')}
            colunas={[t('robo.noites.colDia'), nomeDoRobo, nomeDaRegra, nomeDoBh]}
            linhas={linhasDaTabela}
          />
        </>
      )}
    </Painel>
  )
}

// A regra refeita em todos os fechamentos: o que esperar dela. A tela só informa;
// o critério registrado é que diz quando o motor é desligado.
function ItemComDetalhe({ rotulo, valor, detalhe, testId, semQuebra = false, children }) {
  return (
    <Box sx={{ py: 1, borderBottom: '1px solid var(--border)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2 }}>
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
      {children}
      <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>{detalhe}</Typography>
    </Box>
  )
}

function IssoENormal({ regra, erro, ordem }) {
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
      sx={entradaEmOrdem(ordem)}
    >
      {regra === undefined ? (
        <Carregando />
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
          >
            {duracao?.quantidade > 0 && (
              <EscalaDeDuracao
                atual={h.diasNoEstadoAtual}
                marcas={[...new Set([duracao.mediana, duracao.percentil90, duracao.maior])]}
                maior={Math.max(duracao.maior, h.diasNoEstadoAtual)}
                rotuloAtual={t('robo.normal.hoje', { dias: dias(h.diasNoEstadoAtual) })}
                resumo={t('robo.normal.duracaoDetalhe', { p90: dias(duracao.percentil90), maior: dias(duracao.maior) })}
              />
            )}
          </ItemComDetalhe>
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
              detalhe={t('robo.normal.entradasDetalhe')}
              testId="robo-normal-entradas"
            >
              <BarraDeEntradas
                comGanho={entradas.comGanho}
                total={entradas.quantidade}
                rotuloGanho={t('robo.normal.ganharam', { n: entradas.comGanho, media: pct(entradas.ganhoMedio, 1) })}
                rotuloPerda={t('robo.normal.perderam', { n: entradas.quantidade - entradas.comGanho, media: pct(entradas.perdaMedia, 1) })}
              />
            </ItemComDetalhe>
          )}
          {entradas?.curtas > 0 && (
            <ItemComDetalhe
              rotulo={t('robo.normal.curtas', { dias: entradas.limiteDeCurta })}
              valor={t('robo.normal.curtasValor', { perdas: entradas.curtasComPerda, total: entradas.curtas })}
              detalhe={t('robo.normal.curtasDetalhe')}
              testId="robo-normal-curtas"
            />
          )}
          <Typography
            variant="body2"
            data-testid="robo-normal-conclusao"
            sx={{ mt: 1.5, pl: 1.25, fontWeight: 600, borderLeft: '2px solid var(--accent-ink)' }}
          >
            {t('robo.normal.conclusao')}
          </Typography>
        </Box>
      )}
    </Painel>
  )
}

// A mesma regra nas 10 moedas do zoo, da mais perto de mudar de lado para a mais
// longe. Responde se a pausa do BTC é dele ou do mercado. Só informa: o robô opera
// só no BTC, e mudar a moeda dele seria outra tentativa (docs/motor-de-risco.md).
function Radar({ radar, erro, ordem }) {
  const { t, idioma } = useTranslation()
  if (erro) return <ErrorMessage message={t('robo.radar.erro')} />
  const { linhas, medidas, dentro } = linhasDoRadar(radar)
  const ultimo = linhas.map((l) => instanteUtc(l.ultimoFechamento)).filter((ms) => !Number.isNaN(ms)).sort((a, b) => b - a)[0]
  const dias = (n) => (n === 1 ? t('robo.normal.umDia') : t('robo.normal.dias', { n }))
  const quanto = (linha) => {
    if (!linha.situacao) return '–'
    const falta = pctSemSinal(Math.abs(linha.faltaParaOGatilho))
    const [Icone, cor] = linha.situacao === 'paraComprar' ? [MdArrowDropUp, 'var(--perf-up)']
      : linha.situacao === 'paraVender' ? [MdArrowDropDown, 'var(--perf-down)'] : [null, null]
    if (!Icone) return <Box component="span" sx={{ color: 'var(--perf-warn)' }}>{t('robo.radar.jaPassou')}</Box>
    // No celular, a seta e o número bastam: a frase inteira empurrava a coluna para fora.
    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <Icone aria-hidden="true" size={20} color={cor} />
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          {t(linha.situacao === 'paraComprar' ? 'robo.radar.subir' : 'robo.radar.cair', { falta })}
        </Box>
        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{falta}</Box>
      </Box>
    )
  }
  return (
    <Painel
      titulo={t('robo.radar.title')}
      subtitulo={t('robo.radar.sub')}
      sx={entradaEmOrdem(ordem)}
      corpoSx={{ mx: { xs: -2, md: -2.5 }, mb: { xs: -2, md: -2.5 } }}
    >
      {radar === undefined ? (
        <Carregando />
      ) : medidas === 0 ? (
        <EstadoVazio mensagem={t('robo.radar.semDados')} />
      ) : (
        <>
          <Typography variant="body2" data-testid="robo-radar-resumo" sx={{ px: { xs: 2, md: 2.5 }, pb: 1, fontWeight: 600 }}>
            {t('robo.radar.resumo', { dentro, total: medidas, data: ultimo ? formatarDia(ultimo, idioma.intl) : '–' })}
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ ...estiloDeTabela, '& th': { ...estiloDeTabela['& th'], whiteSpace: { xs: 'normal', sm: 'nowrap' } } }} data-testid="robo-radar">
              <TableHead>
                <TableRow>
                  <TableCell>{t('robo.moeda')}</TableCell>
                  <TableCell>{t('robo.radar.colLado')}</TableCell>
                  <TableCell align="right">{t('robo.radar.colMudar')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {linhas.map((linha) => (
                  <TableRow key={linha.moeda} data-moeda={linha.moeda} sx={linha.robo ? { backgroundColor: 'var(--accent-a05)' } : undefined}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <MoedaChip moeda={linha.moeda} />
                      {linha.robo && (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ display: { xs: 'block', sm: 'inline' }, ml: { xs: 0, sm: 0.75 }, color: 'var(--accent-ink)', fontWeight: 600 }}
                        >
                          {t('robo.radar.oRobo')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {!linha.situacao ? '–' : (
                        <>
                          <Box component="span" sx={{ color: linha.dentro ? 'var(--perf-up)' : 'var(--text-primary)', fontWeight: 600 }}>
                            {linha.dentro ? t('robo.radar.dentro', { dose: pctSemSinal(linha.dose, 0) }) : t('robo.radar.fora')}
                          </Box>
                          <Typography component="div" variant="caption" sx={{ color: 'var(--text-muted)' }}>
                            {t(linha.diasNoMinimo ? 'robo.radar.haMaisDe' : 'robo.radar.ha', { dias: dias(linha.diasNoEstadoAtual) })}
                          </Typography>
                        </>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{quanto(linha)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Painel>
  )
}

// Dentro, fora ou sem resposta (sem dados, ou a regra não se aplica). A cor nunca
// vem sozinha: o ícone e a palavra dizem o mesmo.
function Situacao({ ok, testId }) {
  const { t } = useTranslation()
  const [texto, cor, Icone] = ok === true
    ? [t('robo.criterio.dentro'), 'var(--perf-up)', MdCheckCircle]
    : ok === false ? [t('robo.criterio.fora'), 'var(--perf-down)', MdErrorOutline] : ['–', 'var(--text-muted)', null]
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: cor, fontWeight: 700 }}>
      {Icone && <Icone aria-hidden="true" size={14} />}
      <span data-testid={testId}>{texto}</span>
    </Box>
  )
}

function ItemDoCriterio({ rotulo, valor, detalhe, ok, testId, uso }) {
  return (
    <ItemComDetalhe
      rotulo={rotulo}
      valor={<Situacao ok={ok} testId={testId} />}
      detalhe={detalhe}
      semQuebra
    >
      <Typography component="div" sx={{ fontFamily: FONTE_DOS_NUMEROS, fontSize: '1.05rem', lineHeight: 1.4, color: 'var(--text-primary)' }}>{valor}</Typography>
      <MedidorDoLimite fracao={uso} />
    </ItemComDetalhe>
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

function Criterio({ criterio, conferencia, carregando, ordem }) {
  const { t } = useTranslation()
  const vazio = (v) => v === null || v === undefined
  const pontos = (d) => (vazio(d) ? '–' : t('robo.criterio.pontos', { valor: comSinal(formatarNumero(d * 100, 2), d) }))
  const fracao = (v, limite) => (vazio(v) || !limite ? null : v / limite)
  // Os limites vêm do .NET com o critério: a tela não repete os números.
  const relativaAplica = criterio && !vazio(criterio.quedaBuyHold) && criterio.quedaBuyHold >= criterio.gatilhoQuedaBuyHold
  return (
    <Painel titulo={t('robo.criterio.title')} subtitulo={t('robo.criterio.sub')} sx={entradaEmOrdem(ordem)}>
      {carregando && !criterio ? (
        <Carregando />
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
            uso={fracao(criterio.distancia, criterio.limiteFidelidade)}
          />
          <ItemDoCriterio
            rotulo={t('robo.criterio.queda')}
            valor={pctSemSinal(criterio.quedaRobo)}
            detalhe={t('robo.criterio.quedaLimite', { limite: pctSemSinal(criterio.limiteQueda, 0) })}
            ok={criterio.quedaOk}
            testId="robo-criterio-queda"
            uso={fracao(criterio.quedaRobo, criterio.limiteQueda)}
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
            uso={relativaAplica ? fracao(criterio.quedaRobo, criterio.limiteRelativo) : null}
          />
        </Box>
      )}
      {criterio !== undefined && <UltimaConferencia conferencia={conferencia} />}
    </Painel>
  )
}

// As noites e, numa tabela que abre embaixo, cada operação com quantidade, preço,
// valor e taxa. `operacoes`: undefined enquanto carrega ou quando a busca falhou.
// Só a falha da busca vira aviso: sem operação, a tabela simplesmente não aparece,
// e a coluna Operação das noites já diz que nada foi executado.
function Noites({ noites, erro, operacoes, erroOperacoes, ordem }) {
  const { t, idioma } = useTranslation()
  const linhasDasOperacoes = (operacoes ?? []).map((op) => ({
    chave: op.idHistoricoDecisao,
    valores: [
      formatarInstante(op.dataHora, idioma.intl),
      nomeDaAcao(t, op.acao),
      num(op.quantidade, 5),
      num(op.precoMercado),
      num(op.valorOperacao),
      num(op.taxa),
    ],
  }))
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
  // A noite em que ele agiu é a que importa: manter fica em segundo plano.
  const agiu = (noite) => noite.decisao === 'comprar' || noite.decisao === 'vender'
  const corDaDecisao = (noite) => {
    if (!noite.rodou) return 'var(--perf-warn)'
    return agiu(noite) ? 'var(--text-primary)' : 'var(--text-muted)'
  }
  return (
    <Painel titulo={t('robo.noites.title')} subtitulo={t('robo.noites.sub')} sx={entradaEmOrdem(ordem)} corpoSx={{ mx: { xs: -2, md: -2.5 }, mb: { xs: -2, md: -2.5 } }}>
      {/* A falha das velas tira as noites, mas não as operações, que vêm de outra busca. */}
      {erro ? (
        <Box sx={{ px: { xs: 2, md: 2.5 } }}><ErrorMessage message={t('robo.noites.erro')} /></Box>
      ) : noites === undefined ? (
        <Carregando />
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
                <TableRow key={noite.dia} sx={agiu(noite) ? { backgroundColor: 'var(--accent-a05)' } : undefined}>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: agiu(noite) ? 'var(--text-primary)' : 'var(--text-muted)' }}>{formatarDia(noite.dia, idioma.intl)}</TableCell>
                  <TableCell sx={{ color: corDaDecisao(noite), fontWeight: agiu(noite) ? 600 : 400 }}>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                      {noite.decisao === 'comprar' && <MdArrowDropUp aria-hidden="true" size={20} color="var(--perf-up)" />}
                      {noite.decisao === 'vender' && <MdArrowDropDown aria-hidden="true" size={20} color="var(--perf-down)" />}
                      <span>{textoDaDecisao(t, noite)}</span>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: agiu(noite) ? 'var(--text-primary)' : 'var(--text-muted)' }}>{operacao(noite)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Box sx={{ px: { xs: 2, md: 2.5 }, pb: { xs: 2, md: 2.5 } }}>
        {erroOperacoes ? (
          <ErrorMessage message={t('robo.operacoesErro')} />
        ) : (
          <TabelaDoGrafico
            rotulo={t('robo.noites.verOperacoes')}
            colunas={[t('robo.colData'), t('robo.colAcao'), t('robo.colQuantidade'), t('robo.colPreco'), t('robo.colValor'), t('robo.colTaxa')]}
            linhas={linhasDasOperacoes}
          />
        )}
      </Box>
    </Painel>
  )
}

export default function RoboAoVivo() {
  const { t, idioma } = useTranslation()
  definirIdiomaDosNumeros(idioma.intl)
  const {
    operacoes, placar, sequencias, regra, radar, erroOperacoes, erroPlacar, erroSequencias, erroRegra, erroRadar, carregando, recarregar,
  } = useRoboAoVivo()

  const estado = useMemo(() => {
    if (operacoes === undefined && placar === undefined) return undefined
    return estadoDeHoje(operacoes ?? [], placar?.doseRegra ?? null).estado
  }, [operacoes, placar])

  // As três curvas do período, prontas no .NET (GET api/RoboAoVivo/placar).
  const series = useMemo(() => seriesDoPlacar(placar), [placar])

  const noites = useMemo(() => {
    if (sequencias === undefined) return undefined
    return noitesDoRobo(sequencias.registros, operacoes, { ultimoDiaDoZoo: ultimoDiaDoPlacar(placar), desde: sequencias.desde })
  }, [sequencias, operacoes, placar])

  const linhaDaTela = { display: 'grid', gap: 2, gridTemplateColumns: COLUNAS_DA_TELA, alignItems: 'stretch' }
  return (
    <div className="dashboard-container">
      {/* Ao atualizar, a tela anterior fica apagada no lugar: sem pulo de layout nem spinner. */}
      <Box sx={{ p: { xs: 2, md: 4 }, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 2, opacity: carregando && regra !== undefined ? 0.65 : 1, transition: 'opacity 200ms ease' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', ...entradaEmOrdem(0) }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h1" sx={{ fontFamily: FONTE_DOS_TITULOS, fontWeight: 800 }}>{t('robo.title')}</Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', maxWidth: 900, mt: 0.5 }}>{t('robo.intro')}</Typography>
            {/* A regra em palavras e desde quando ela decide: moravam no painel
                "Registro", no fim da tela. */}
            <Typography variant="body2" data-testid="robo-regra" sx={{ color: 'var(--text-secondary)', maxWidth: 900, mt: 0.5 }}>{t('robo.regra')}</Typography>
            <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)', mt: 0.25 }}>
              {`${t('robo.desde')}: ${formatarInstante(ATIVACAO_MOTOR, idioma.intl)}`}
            </Typography>
          </Box>
          <Button size="small" startIcon={<MdRefresh />} onClick={recarregar} disabled={carregando} sx={estiloDoBotao}>
            {t('robo.atualizar')}
          </Button>
        </Box>
        <PainelDeInstrumentos
          estado={estado}
          regra={regra}
          erroRegra={erroRegra}
          placar={placar}
          ultimaHora={ultimaHoraDoRobo(sequencias?.registros)}
          carregando={carregando}
          ordem={1}
        />
        <Box sx={linhaDaTela}>
          <GraficoDaRegra regra={regra} operacoes={operacoes} ordem={2} />
          <IssoENormal regra={regra} erro={erroRegra} ordem={3} />
        </Box>
        <Box sx={linhaDaTela}>
          <CurvaDoPlacar series={series} placar={placar} erro={erroPlacar} ordem={4} />
          <Radar radar={radar} erro={erroRadar} ordem={5} />
        </Box>
        <Box sx={linhaDaTela}>
          <Noites noites={noites} erro={erroSequencias} operacoes={operacoes} erroOperacoes={erroOperacoes} ordem={6} />
          <Criterio
            criterio={placar === undefined ? undefined : (placar?.criterio ?? null)}
            conferencia={placar?.ultimaConferencia ?? null}
            carregando={carregando}
            ordem={7}
          />
        </Box>
      </Box>
    </div>
  )
}
