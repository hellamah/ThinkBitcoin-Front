import { useMemo, useState } from 'react'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useTheme } from '@mui/material/styles'
import { Line } from 'react-chartjs-2'
import useTranslation from '../../hooks/useTranslation'
import { readToken } from '../../utils/themeTokens'
import { mediaDaMetrica } from '../../utils/treinamento'
import {
  comAlfa,
  comBordaDeEixo,
  corDaGrade,
  corDaLegenda,
  corDoTique,
  formatarMetrica,
  rotuloDaMetrica,
  tooltipBase,
} from './graficos'
import { Painel } from './Painel'
import { corDaMoeda, formatarHora } from './formato'

const METRICAS = ['rewardMedio', 'winRate', 'lossMedia']

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

/**
 * O episódio no meio dos vizinhos da mesma moeda. Cada ponto é clicável e abre
 * aquele episódio — é o jeito de andar pela vizinhança sem voltar à lista.
 * (Para o teclado, os botões Anterior/Próximo e as setas fazem o mesmo.)
 */
export default function GraficoDeVizinhos({ item, trecho, vizinhos, onNavegar }) {
  const { t, idioma } = useTranslation()
  const escuro = useTheme().palette.mode === 'dark'
  const [metrica, setMetrica] = useState('rewardMedio')

  const mediaDosVizinhos = useMemo(() => mediaDaMetrica(vizinhos, metrica), [vizinhos, metrica])

  const dados = useMemo(() => {
    const corMoeda = corDaMoeda(item.moeda)
    const destaque = readToken('--accent-ink')
    const eAtual = (r) => r.idTreinamentoEpisodio === item.idTreinamentoEpisodio
    return {
      labels: trecho.map((r) => `#${r.episodio}`),
      datasets: [
        {
          label: rotuloDaMetrica(t, metrica),
          data: trecho.map((r) => r[metrica] ?? null),
          borderColor: comAlfa(corMoeda, 0.7),
          backgroundColor: corMoeda,
          pointBackgroundColor: trecho.map((r) => (eAtual(r) ? destaque : corMoeda)),
          pointBorderColor: trecho.map((r) => (eAtual(r) ? destaque : corMoeda)),
          pointRadius: trecho.map((r) => (eAtual(r) ? 7 : 3.5)),
          pointHoverRadius: trecho.map((r) => (eAtual(r) ? 8 : 6)),
          pointStyle: trecho.map((r) => (eAtual(r) ? 'rectRot' : 'circle')),
          borderWidth: 1.75,
          tension: 0.3,
        },
        ...(mediaDosVizinhos !== null ? [{
          label: t('treinamento.neighborsAvg'),
          data: trecho.map(() => mediaDosVizinhos),
          borderColor: readToken('--text-muted'),
          backgroundColor: readToken('--text-muted'),
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
        }] : []),
      ],
    }
  // `escuro` entra para reler os tokens quando o tema muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trecho, item, metrica, mediaDosVizinhos, t, escuro])

  const opcoes = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    onClick: (_, elementos) => {
      const alvo = trecho[elementos?.[0]?.index]
      if (alvo && alvo.idTreinamentoEpisodio !== item.idTreinamentoEpisodio) onNavegar(alvo.idTreinamentoEpisodio)
    },
    onHover: (evento, elementos) => {
      const alvo = evento?.native?.target
      if (alvo) alvo.style.cursor = elementos?.length ? 'pointer' : 'default'
    },
    plugins: {
      legend: { position: 'bottom', labels: { color: corDaLegenda(escuro), usePointStyle: true, boxWidth: 8, padding: 14 } },
      tooltip: {
        ...tooltipBase(escuro),
        callbacks: {
          title: (its) => {
            const r = trecho[its?.[0]?.dataIndex]
            return r ? `#${r.episodio} · ${formatarHora(r.dataHora, idioma.intl, true)}` : ''
          },
          label: (ctx) => ` ${ctx.dataset.label}: ${formatarMetrica(metrica, ctx.parsed.y)}`,
        },
      },
    },
    scales: comBordaDeEixo({
      x: { ticks: { color: corDoTique(escuro), maxRotation: 0, autoSkip: true, maxTicksLimit: 11 }, grid: { color: corDaGrade(escuro) } },
      y: { ticks: { color: corDoTique(escuro), callback: (v) => formatarMetrica(metrica, v), maxTicksLimit: 6 }, grid: { color: corDaGrade(escuro) } },
    }, escuro),
  }), [trecho, item, metrica, escuro, idioma, onNavegar])

  return (
    <Painel
      titulo={t('treinamento.neighborsTitle', { moeda: item.moeda })}
      subtitulo={t('treinamento.neighborsSub')}
      acao={
        <ToggleButtonGroup
          size="small"
          exclusive
          value={metrica}
          onChange={(_, v) => { if (v) setMetrica(v) }}
          aria-label={t('treinamento.metricLabel')}
          sx={estiloDoGrupo}
        >
          {METRICAS.map((id) => <ToggleButton key={id} value={id}>{rotuloDaMetrica(t, id)}</ToggleButton>)}
        </ToggleButtonGroup>
      }
      sx={{ height: { xs: 340, md: 360 } }}
    >
      <Line data={dados} options={opcoes} />
    </Painel>
  )
}
