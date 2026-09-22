import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { corDaVariacao, formatarVariacaoDaMetrica, setaDaVariacao } from './graficos'
import { corDaMoeda, tintaDaMoeda } from './formato'

// Moldura comum dos blocos da tela. As cores vêm dos tokens de tema, então o
// painel acompanha claro/escuro sem receber o modo por prop.
export function Painel({ titulo, subtitulo, acao, children, sx, corpoSx }) {
  return (
    <Paper
      component="section"
      sx={{
        p: { xs: 2, md: 2.5 },
        background: 'var(--surface-subtle)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(10px)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        ...sx,
      }}
    >
      {(titulo || acao) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0 }}>
            {titulo && (
              <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                {titulo}
              </Typography>
            )}
            {subtitulo && (
              <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)' }}>
                {subtitulo}
              </Typography>
            )}
          </Box>
          {acao}
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative', ...corpoSx }}>{children}</Box>
    </Paper>
  )
}

// Chip da moeda. Com `onClick` o Chip do MUI vira botão de verdade, focável e
// ativável por Enter e espaço; sem ele, é só rótulo.
export function MoedaChip({ moeda, onClick, rotulo, sx }) {
  const escuro = useTheme().palette.mode === 'dark'
  const cor = corDaMoeda(moeda)
  return (
    <Chip
      label={moeda}
      size="small"
      clickable={Boolean(onClick)}
      onClick={onClick}
      // Sem ação, o chip vira <span>: ele aparece dentro de botões (lista de
      // episódios), e um <div> ali dentro é HTML inválido.
      component={onClick ? undefined : 'span'}
      aria-label={rotulo}
      sx={{
        background: `${cor}33`,
        color: tintaDaMoeda(moeda, escuro),
        border: `1px solid ${cor}66`,
        fontWeight: 600,
        minWidth: 52,
        ...sx,
      }}
    />
  )
}

export function EstadoVazio({ mensagem, children }) {
  return (
    <Box sx={{ py: 5, textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      <Typography variant="body2">{mensagem}</Typography>
      {children}
    </Box>
  )
}

// Variação colorida pelo sentido da métrica, com seta e sinal. `–` quando não
// há base de comparação.
export function Variacao({ d, id = 'rewardMedio' }) {
  if (d === null || d === undefined) return <span>–</span>
  return (
    <Box component="span" sx={{ color: corDaVariacao(id, d), fontWeight: 600, whiteSpace: 'nowrap' }}>
      <span aria-hidden="true">{setaDaVariacao(d)} </span>{formatarVariacaoDaMetrica(id, d)}
    </Box>
  )
}
