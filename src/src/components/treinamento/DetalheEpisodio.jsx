import { Fragment, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { MdArrowBack, MdArrowForward, MdCheck, MdContentCopy, MdPsychology } from 'react-icons/md'
import useTranslation from '../../hooks/useTranslation'
import {
  RAIO_DE_VIZINHOS,
  cicloDoEpisodio,
  faixaDe,
  instanteDe,
  ordenarPorData,
  posicaoEntre,
  proporcaoDeAcoes,
  variacao,
  vereditoDoEpisodio,
  vizinhosDe,
} from '../../utils/treinamento'
import ContextoDeMercado from './ContextoDeMercado'
import GraficoDeVizinhos from './GraficoDeVizinhos'
import { METRICAS, corDaMetrica, formatarMetrica, rotuloDaMetrica } from './graficos'
import { BarraDeAcoes, FaixaEntreVizinhos } from './Miniaturas'
import { EstadoVazio, MoedaChip, Painel, Variacao } from './Painel'
import { formatarData, formatarDataCurta, formatarNumero, formatarPercentual } from './formato'

// Detalhe de um episódio (/treinamento-episodios/:id). A pergunta é "este
// episódio foi bom?", e a resposta depende de contra o quê. A base é a
// vizinhança: até 10 episódios da mesma moeda de cada lado. Comparava contra a
// média de tudo o que estava carregado, rotulada "média da janela" — e como o
// modelo melhora ao longo do treino, todo episódio antigo parecia ruim e todo
// recente parecia bom, com a conta mudando conforme o histórico buscado.

// O episódio pedido pela URL não existe na lista carregada. Componente à parte
// de propósito: dentro do detalhe, a mensagem ficaria atrás de um `return`
// antecipado, antes dos hooks, e o React exige a mesma ordem de hooks em todo
// render. Quem decide qual dos dois renderizar é quem já tem o item em mãos.
export function EpisodioNaoEncontrado({ onBack }) {
  const { t } = useTranslation()
  return (
    <div className="dashboard-container">
      <Box sx={{ p: { xs: 2, md: 4 }, color: 'var(--text-primary)' }}>
        <Button startIcon={<MdArrowBack />} onClick={onBack} sx={{ color: 'var(--text-primary)', textTransform: 'none', mb: 2 }}>
          {t('treinamento.back')}
        </Button>
        <Painel><EstadoVazio mensagem={t('treinamento.notFound')} /></Painel>
      </Box>
    </div>
  )
}

const COR_DO_VEREDITO = { acima: 'var(--perf-up)', dentro: 'var(--text-secondary)', abaixo: 'var(--perf-down)' }

function Veredito({ veredito, posicao, moeda }) {
  const { t } = useTranslation()
  if (!veredito) {
    return (
      <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
        {t('treinamento.verdictNoBase', { moeda })}
      </Typography>
    )
  }
  const cor = COR_DO_VEREDITO[veredito]
  const titulo = veredito === 'acima'
    ? t('treinamento.verdictAbove')
    : veredito === 'abaixo' ? t('treinamento.verdictBelow') : t('treinamento.verdictWithin')
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: 1.25,
        rowGap: 0.25,
        px: 1.5,
        py: 0.75,
        borderRadius: 2,
        border: '1px solid',
        borderColor: cor,
        background: 'var(--surface-fill)',
        alignSelf: 'flex-start',
      }}
    >
      <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', background: cor }} />
      <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: cor }}>{titulo}</Typography>
      <Typography component="span" variant="caption" sx={{ color: 'var(--text-secondary)' }}>
        {t('treinamento.verdictDetail', { abaixo: posicao.abaixo, total: posicao.total, moeda })}
      </Typography>
    </Box>
  )
}

function MetricaDoEpisodio({ id, valor, faixa }) {
  const { t } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const cor = corDaMetrica(id, escuro)
  const d = faixa ? variacao(valor ?? null, faixa.media) : null
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
        gap: 0.75,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11, color: 'var(--text-secondary)' }}>
          {rotuloDaMetrica(t, id)}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 700, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
        {formatarMetrica(id, valor)}
      </Typography>
      <FaixaEntreVizinhos
        faixa={faixa}
        valor={valor}
        cor={cor}
        rotulo={faixa
          ? t('treinamento.rangeLabel', {
            min: formatarMetrica(id, faixa.min),
            media: formatarMetrica(id, faixa.media),
            max: formatarMetrica(id, faixa.max),
            valor: formatarMetrica(id, valor),
          })
          : undefined}
      />
      <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {d === null ? (
          <Box component="span" sx={{ color: 'var(--text-muted)' }}>{t('treinamento.noNeighbors')}</Box>
        ) : (
          <>
            <Variacao id={id} d={d} />{' '}
            <Box component="span" sx={{ color: 'var(--text-muted)' }}>{t('treinamento.vsNeighbors')}</Box>
          </>
        )}
      </Typography>
    </Box>
  )
}

const SEGMENTOS = [
  { chave: 'hold', campo: 'acoesHold', cor: 'rgba(160,160,160,0.85)' },
  { chave: 'compra', campo: 'acoesCompra', cor: 'var(--perf-up)' },
  { chave: 'venda', campo: 'acoesVenda', cor: 'var(--perf-down)' },
]

// O que o agente fez: a proporção deste episódio ao lado da dos vizinhos. O
// gráfico de rosca mostrava só o episódio, sem nada para comparar.
function AcoesDoAgente({ item, vizinhos }) {
  const { t } = useTranslation()
  const doEpisodio = proporcaoDeAcoes([item])
  const dosVizinhos = proporcaoDeAcoes(vizinhos)
  const rotuloDe = (id) => (id === 'hold' ? t('treinamento.hold') : id === 'compra' ? t('treinamento.buy') : t('treinamento.sell'))
  const pct = (v) => formatarPercentual(v, 0)
  const resumoDe = (acoes, comContagem) => t('treinamento.actionsSummary', Object.fromEntries(
    SEGMENTOS.map(({ chave, campo }) => [chave, comContagem ? `${item[campo] ?? 0} (${pct(acoes[chave])})` : pct(acoes[chave])])
  ))
  const linhas = [
    { rotulo: t('treinamento.thisEpisode'), acoes: doEpisodio, comContagem: true },
    { rotulo: t('treinamento.neighborsAvg'), acoes: dosVizinhos, comContagem: false },
  ]
  return (
    <Painel
      titulo={t('treinamento.agentActions')}
      subtitulo={t('treinamento.actionDistTotal', { acoes: doEpisodio?.total ?? 0, steps: item.totalSteps ?? '–' })}
      sx={{ height: '100%' }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: 0.5 }}>
        {linhas.map(({ rotulo, acoes, comContagem }) => (
          <Box key={rotulo} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{rotulo}</Typography>
            <BarraDeAcoes acoes={acoes} largura="100%" altura={14} rotulo={acoes ? resumoDe(acoes, comContagem) : undefined} />
            {acoes && (
              <Box component="ul" aria-hidden="true" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.25 }}>
                {SEGMENTOS.map(({ chave, campo, cor }) => (
                  <Box component="li" key={chave} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    <Box component="span" sx={{ width: 8, height: 8, borderRadius: 0.5, background: cor }} />
                    {rotuloDe(chave)} {comContagem ? `${item[campo] ?? 0} · ` : ''}{pct(acoes[chave])}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Painel>
  )
}

function DadosDoEpisodio({ item, inicioMs, fimMs, ciclo }) {
  const { t, idioma } = useTranslation()
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!copiado) return undefined
    const id = setTimeout(() => setCopiado(false), 2000)
    return () => clearTimeout(id)
  }, [copiado])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(item.idTreinamentoEpisodio)
      setCopiado(true)
    } catch { /* sem permissão de área de transferência: o ID segue selecionável */ }
  }

  const linhas = [
    [t('treinamento.episode'), `#${item.episodio}`],
    [t('treinamento.modelVersionLabel'), item.versaoModelo ?? '–'],
    [t('treinamento.startedAt'), formatarData(inicioMs, idioma.intl)],
    [t('treinamento.endedAt'), formatarData(fimMs, idioma.intl)],
    [t('treinamento.duration'), formatarMetrica('duracaoSegundos', item.duracaoSegundos)],
    [t('treinamento.totalSteps'), item.totalSteps ?? '–'],
    [t('treinamento.rewardTotal'), formatarNumero(item.rewardTotal, 2)],
    ...(ciclo
      ? [[t('treinamento.cycle'), t('treinamento.cyclePosition', { pos: ciclo.posicao, total: ciclo.total, inicio: formatarDataCurta(ciclo.inicio, idioma.intl) })]]
      : []),
  ]

  return (
    <Painel titulo={t('treinamento.episodeData')} sx={{ height: '100%' }}>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1, fontSize: 13 }}>
        {linhas.map(([rotulo, valor]) => (
          <Fragment key={rotulo}>
            <Box component="dt" sx={{ color: 'var(--text-muted)' }}>{rotulo}</Box>
            <Box component="dd" sx={{ m: 0, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{valor}</Box>
          </Fragment>
        ))}
        <Box component="dt" sx={{ color: 'var(--text-muted)', alignSelf: 'center' }}>ID</Box>
        <Box component="dd" sx={{ m: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, minWidth: 0 }}>
          <Box component="code" title={item.idTreinamentoEpisodio} sx={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.idTreinamentoEpisodio}
          </Box>
          <IconButton
            size="small"
            onClick={copiar}
            aria-label={copiado ? t('treinamento.idCopied') : t('treinamento.copyId')}
            title={copiado ? t('treinamento.idCopied') : t('treinamento.copyId')}
            sx={{ color: copiado ? 'var(--perf-up)' : 'var(--text-secondary)' }}
          >
            {copiado ? <MdCheck size={16} /> : <MdContentCopy size={16} />}
          </IconButton>
        </Box>
      </Box>
    </Painel>
  )
}

// Setas do teclado para andar entre episódios, fora de campos e de controles
// que já usam as setas (abas, listas, diálogos).
const USA_SETAS = 'input, textarea, select, [contenteditable="true"], [role="tablist"], [role="slider"], [role="listbox"], [role="menu"], [role="dialog"]'

export default function DetalheEpisodio({ item, allItems, onBack, onNavigate }) {
  const { t, idioma } = useTranslation()

  const timeline = useMemo(() => ordenarPorData(allItems || []), [allItems])
  const daMoeda = useMemo(() => timeline.filter((r) => r.moeda === item.moeda), [timeline, item.moeda])
  const idx = daMoeda.findIndex((r) => r.idTreinamentoEpisodio === item.idTreinamentoEpisodio)
  const anterior = idx > 0 ? daMoeda[idx - 1] : null
  const proximo = idx >= 0 && idx < daMoeda.length - 1 ? daMoeda[idx + 1] : null

  const ciclo = useMemo(() => cicloDoEpisodio(timeline, item.idTreinamentoEpisodio), [timeline, item.idTreinamentoEpisodio])

  // A vizinhança fica dentro do ciclo do episódio. Cada ciclo é um treino que
  // recomeça do zero (epsilon volta a 1, e às vezes a versão do modelo muda):
  // perto da borda, os vizinhos mais próximos eram do treino anterior, e o
  // episódio era julgado contra outra execução. Anterior/próximo continuam
  // atravessando ciclos — ali a ideia é andar, não comparar.
  const daMoedaNoCiclo = useMemo(
    () => (ciclo ? timeline.slice(ciclo.de, ciclo.ate + 1).filter((r) => r.moeda === item.moeda) : daMoeda),
    [ciclo, timeline, item.moeda, daMoeda]
  )
  const idxNoCiclo = daMoedaNoCiclo.findIndex((r) => r.idTreinamentoEpisodio === item.idTreinamentoEpisodio)

  const vizinhos = useMemo(() => vizinhosDe(daMoedaNoCiclo, idxNoCiclo), [daMoedaNoCiclo, idxNoCiclo])
  const trecho = useMemo(
    () => (idxNoCiclo < 0
      ? [item]
      : daMoedaNoCiclo.slice(Math.max(0, idxNoCiclo - RAIO_DE_VIZINHOS), idxNoCiclo + RAIO_DE_VIZINHOS + 1)),
    [daMoedaNoCiclo, idxNoCiclo, item]
  )
  const faixas = useMemo(
    () => Object.fromEntries(METRICAS.map((id) => [id, faixaDe(vizinhos.map((r) => r[id]))])),
    [vizinhos]
  )
  const posicao = useMemo(
    () => posicaoEntre(item.rewardMedio, vizinhos.map((r) => r.rewardMedio)),
    [item.rewardMedio, vizinhos]
  )
  const veredito = vereditoDoEpisodio(posicao)

  // dataHora marca o FIM do episódio; o início sai da duração.
  const fimMs = instanteDe(item)
  const inicioMs = fimMs - (item.duracaoSegundos ?? 0) * 1000

  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (e.target?.closest?.(USA_SETAS)) return
      const alvo = e.key === 'ArrowLeft' ? anterior : e.key === 'ArrowRight' ? proximo : null
      if (!alvo) return
      e.preventDefault()
      onNavigate(alvo.idTreinamentoEpisodio)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [anterior, proximo, onNavigate])

  const botaoDeNavegacao = { color: 'var(--text-primary)', borderColor: 'var(--border-strong)', textTransform: 'none' }

  return (
    <div className="dashboard-container">
      <Box sx={{ p: { xs: 2, md: 4 }, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Button startIcon={<MdArrowBack />} onClick={onBack} sx={{ color: 'var(--text-primary)', textTransform: 'none', ml: -1 }}>
            {t('treinamento.back')}
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<MdArrowBack size={14} />}
              disabled={!anterior}
              onClick={() => onNavigate(anterior.idTreinamentoEpisodio)}
              aria-keyshortcuts="ArrowLeft"
              title={t('treinamento.previousHint', { moeda: item.moeda })}
              sx={botaoDeNavegacao}
            >
              {t('treinamento.previous')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              endIcon={<MdArrowForward size={14} />}
              disabled={!proximo}
              onClick={() => onNavigate(proximo.idTreinamentoEpisodio)}
              aria-keyshortcuts="ArrowRight"
              title={t('treinamento.nextHint', { moeda: item.moeda })}
              sx={botaoDeNavegacao}
            >
              {t('treinamento.next')}
            </Button>
          </Box>
        </Box>

        <Box component="header" sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            <Box sx={{ color: 'var(--accent-ink)', display: 'flex' }}><MdPsychology size={28} /></Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              {t('treinamento.episodeNum', { num: item.episodio })}
            </Typography>
            <MoedaChip moeda={item.moeda} />
            {item.versaoModelo && (
              <Typography component="span" variant="caption" sx={{ px: 1, py: 0.25, borderRadius: 1, border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {item.versaoModelo}
              </Typography>
            )}
          </Box>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            {formatarData(item.dataHora, idioma.intl)} · {formatarMetrica('duracaoSegundos', item.duracaoSegundos)}
          </Typography>
          <Veredito veredito={veredito} posicao={posicao} moeda={item.moeda} />
        </Box>

        <Box component="section" aria-labelledby="metricas-do-episodio">
          <Typography id="metricas-do-episodio" variant="caption" component="h2" sx={{ display: 'block', color: 'var(--text-muted)', mb: 1 }}>
            {vizinhos.length > 0
              ? t('treinamento.metricsVsNeighbors', { n: vizinhos.length, moeda: item.moeda })
              : t('treinamento.noNeighborsLoaded', { moeda: item.moeda })}
          </Typography>
          <Grid container spacing={1.5}>
            {METRICAS.map((id) => (
              <Grid key={id} size={{ xs: 6, sm: 4, md: 2.4 }}>
                <MetricaDoEpisodio id={id} valor={item[id]} faixa={faixas[id]} />
              </Grid>
            ))}
          </Grid>
        </Box>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            {vizinhos.length > 0 ? (
              <GraficoDeVizinhos item={item} trecho={trecho} vizinhos={vizinhos} onNavegar={onNavigate} />
            ) : (
              <Painel titulo={t('treinamento.neighborsTitle', { moeda: item.moeda })} sx={{ height: '100%' }}>
                <EstadoVazio mensagem={t('treinamento.noNeighborsLoaded', { moeda: item.moeda })} />
              </Painel>
            )}
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <AcoesDoAgente item={item} vizinhos={vizinhos} />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <ContextoDeMercado item={item} inicioMs={inicioMs} fimMs={fimMs} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <DadosDoEpisodio item={item} inicioMs={inicioMs} fimMs={fimMs} ciclo={ciclo} />
          </Grid>
        </Grid>
      </Box>
    </div>
  )
}
