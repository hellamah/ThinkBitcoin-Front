import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { MdChevronLeft, MdChevronRight, MdSkipNext } from 'react-icons/md'
import useTranslation from '../../hooks/useTranslation'
import { formatarDuracao, formatarIntervalo } from './formato'

// Substitui o gráfico de dispersão que servia de navegador. Aquele ocupava
// 420px para desenhar uma diagonal (eixo Y = número do episódio), e o fato de
// o zoom nele filtrar a tela inteira só estava escrito num subtítulo. Aqui o
// período é um controle explícito: atalhos de duração e passos para trás.

const estiloDoGrupo = {
  '& .MuiToggleButton-root': {
    color: 'var(--text-muted)',
    borderColor: 'var(--border-strong)',
    px: 1.5,
    py: 0.5,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'none',
    '&.Mui-selected': {
      color: 'var(--text-on-accent)',
      background: 'var(--accent)',
      '&:hover': { background: 'var(--accent-hover)' },
    },
  },
}

export default function SeletorDePeriodo({ opcoes, periodo, onChange, janela, maisRecenteMs, carregando }) {
  const { t, idioma } = useTranslation()
  const podeAvancar = Boolean(janela) && !janela.ancorada

  const voltar = () => onChange({ ...periodo, fimMs: janela.fim - periodo.duracaoMs })

  // Passar do episódio mais recente não mostra nada novo: volta a ancorar, e a
  // janela passa a acompanhar o que chegar.
  const avancar = () => {
    const fim = janela.fim + periodo.duracaoMs
    onChange({ ...periodo, fimMs: fim < maisRecenteMs ? fim : null })
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={periodo.duracaoMs}
        onChange={(_, v) => { if (v) onChange({ duracaoMs: v, fimMs: periodo.fimMs }) }}
        aria-label={t('treinamento.periodLabel')}
        sx={estiloDoGrupo}
      >
        {opcoes.map((ms) => (
          <ToggleButton key={ms} value={ms}>
            {formatarDuracao(ms, idioma.intl)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <IconButton
          size="small"
          onClick={voltar}
          disabled={!janela}
          aria-label={t('treinamento.previousWindow')}
          sx={{ color: 'var(--text-secondary)' }}
        >
          <MdChevronLeft />
        </IconButton>
        <Typography
          variant="caption"
          sx={{ color: 'var(--text-secondary)', minWidth: 120, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
        >
          {janela ? formatarIntervalo(janela.inicio, janela.fim, idioma.intl) : '–'}
        </Typography>
        <IconButton
          size="small"
          onClick={avancar}
          disabled={!podeAvancar}
          aria-label={t('treinamento.nextWindow')}
          sx={{ color: 'var(--text-secondary)' }}
        >
          <MdChevronRight />
        </IconButton>
      </Box>

      {podeAvancar && (
        <Button
          size="small"
          startIcon={<MdSkipNext size={16} />}
          onClick={() => onChange({ ...periodo, fimMs: null })}
          sx={{ color: 'var(--accent-ink)', textTransform: 'none', fontWeight: 600 }}
        >
          {t('treinamento.latestWindow')}
        </Button>
      )}

      {carregando && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }} role="status">
          <CircularProgress size={14} sx={{ color: 'var(--accent-ink)' }} />
          <Typography variant="caption" sx={{ color: 'var(--accent-ink)' }}>{t('treinamento.loadingRange')}</Typography>
        </Box>
      )}
    </Box>
  )
}
