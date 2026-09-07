// Leitura dos tokens de tema em tempo de execução.
//
// Canvas (Chart.js, Google GeoChart) não resolve `var(--x)`: precisa da cor já
// computada. Este helper lê o valor atual do token direto do <html>, que é onde
// a classe `light` é aplicada — então o valor acompanha o tema sem duplicar a
// paleta em JS.
//
// Para qualquer coisa que renderize em DOM, use `var(--token)` no CSS/sx: é mais
// barato e não precisa de re-render para atualizar.

const FALLBACKS = {
  '--text-body': '#e0e0e0',
  '--text-muted': 'rgba(255,255,255,0.6)',
  '--text-faint': 'rgba(255,255,255,0.4)',
  '--border-subtle': 'rgba(255,255,255,0.03)',
  '--border-strong': 'rgba(255,255,255,0.15)',
  '--accent': '#ffd700',
  '--accent-ink': '#ffd700',
  '--surface-overlay': 'rgba(15,15,15,0.9)',
  '--success': '#4caf50',
  '--danger': '#f44336',
}

/**
 * Valor atual de um custom property do tema.
 * @param {string} nome ex.: '--text-muted'
 * @param {string} [fallback] usado em SSR/teste ou se o token não existir
 */
export const readToken = (nome, fallback) => {
  const padrao = fallback ?? FALLBACKS[nome] ?? 'transparent'
  if (typeof document === 'undefined') return padrao
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
  return v || padrao
}

/**
 * Paleta para gráficos em canvas, resolvida no tema vigente.
 * Chame dentro de um useMemo que dependa do modo do tema para os gráficos
 * serem reconstruídos ao alternar claro/escuro.
 */
export const chartPalette = () => ({
  legend: readToken('--text-body'),
  tick: readToken('--text-muted'),
  tickSubtle: readToken('--text-faint'),
  grid: readToken('--border-subtle'),
  // Linha do próprio eixo (`scales.*.border`), que o Chart.js desenha separada
  // do grid. Mais forte que a grade de propósito: é a moldura do gráfico, não
  // uma das divisões internas.
  borda: readToken('--border-strong'),
  accent: readToken('--accent-ink'),
  tooltipBg: readToken('--surface-overlay'),
  alta: readToken('--success'),
  baixa: readToken('--danger'),
})
