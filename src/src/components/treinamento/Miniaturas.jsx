import Box from '@mui/material/Box'

// Minigráficos em SVG puro. Uma tabela com uma linha por moeda teria um
// Chart.js por célula — dezenas de canvas, cada um com o próprio ciclo de
// layout — para desenhar o que um <path> resolve.

/**
 * Linha de tendência sem eixos. `rotulo` descreve a curva para leitor de tela,
 * que não enxerga o desenho.
 */
export function Sparkline({ valores, cor, largura = 96, altura = 28, rotulo }) {
  const pontos = (valores || []).filter((v) => Number.isFinite(v))
  if (pontos.length < 2) {
    return <Box component="span" sx={{ display: 'inline-block', width: largura, height: altura }} aria-hidden="true" />
  }
  const min = Math.min(...pontos)
  const max = Math.max(...pontos)
  const amplitude = max - min || 1
  const margem = 3
  const x = (i) => margem + (i / (pontos.length - 1)) * (largura - 2 * margem)
  const y = (v) => altura - margem - ((v - min) / amplitude) * (altura - 2 * margem)
  const caminho = pontos.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ultimo = pontos.length - 1
  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : 'true'}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Cor por `style`, e não por atributo: a cor pode vir como var(--token),
          e atributo de apresentação do SVG não resolve var() em todo navegador. */}
      <path d={caminho} style={{ fill: 'none', stroke: cor }} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(ultimo)} cy={y(pontos[ultimo])} r="2.25" style={{ fill: cor }} />
    </svg>
  )
}

const SEGMENTOS = [
  { chave: 'hold', cor: 'rgba(160,160,160,0.85)' },
  { chave: 'compra', cor: 'var(--perf-up)' },
  { chave: 'venda', cor: 'var(--perf-down)' },
]

/**
 * Participação de Hold / Compra / Venda numa barra 100%. Em proporção, e não
 * em contagem: as barras absolutas do gráfico antigo saíam quase idênticas,
 * porque o total de ações acompanha o número de episódios, não o comportamento.
 */
export function BarraDeAcoes({ acoes, rotulo, largura = 96 }) {
  if (!acoes) return <span aria-hidden="true">–</span>
  return (
    <Box
      role="img"
      aria-label={rotulo}
      title={rotulo}
      sx={{ display: 'flex', width: largura, height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--surface-fill)' }}
    >
      {SEGMENTOS.map(({ chave, cor }) => (
        <Box key={chave} sx={{ width: `${(acoes[chave] * 100).toFixed(2)}%`, background: cor }} />
      ))}
    </Box>
  )
}
