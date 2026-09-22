import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { MdPsychology, MdRefresh } from 'react-icons/md'
import useTranslation from '../../hooks/useTranslation'
import { statusDoTreino } from '../../utils/treinamento'
import { formatarHaQuanto, formatarHora } from './formato'

// Relógio próprio, para o "há 12 s" andar sem re-renderizar a página inteira
// (e os gráficos junto) a cada tique.
function useAgora(intervaloMs) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])
  return agora
}

// O treino está rodando agora? A tela dizia "atualiza a cada 60s" e nada sobre
// o estado do treino: um treino parado havia horas parecia igual a um vivo.
function StatusDoTreino({ ultimoMs, cadenciaMs }) {
  const { t, idioma } = useTranslation()
  const agora = useAgora(5000)
  const status = statusDoTreino(ultimoMs, agora, cadenciaMs)
  if (!status) return null
  const cor = status.ativo ? 'var(--perf-up)' : 'var(--text-faint)'
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.5,
        borderRadius: 999,
        border: '1px solid var(--border-strong)',
        background: 'var(--surface-fill)',
        fontSize: 12,
      }}
    >
      <Box
        component="span"
        aria-hidden="true"
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: cor,
          ...(status.ativo && {
            boxShadow: `0 0 0 0 ${cor}`,
            animation: 'pulsoTreino 2s ease-out infinite',
            '@keyframes pulsoTreino': {
              '0%': { boxShadow: '0 0 0 0 rgba(20,241,149,0.5)' },
              '100%': { boxShadow: '0 0 0 8px rgba(20,241,149,0)' },
            },
          }),
        }}
      />
      <Typography component="span" variant="caption" sx={{ fontWeight: 700, color: 'var(--text-primary)' }}>
        {status.ativo ? t('treinamento.statusRunning') : t('treinamento.statusStopped')}
      </Typography>
      <Typography component="span" variant="caption" sx={{ color: 'var(--text-muted)' }}>
        {t('treinamento.lastEpisodeAgo', { tempo: formatarHaQuanto(status.desdeMs, idioma.intl) })}
      </Typography>
    </Box>
  )
}

export default function Cabecalho({ ultimoMs, cadenciaMs, atualizadoEm, carregando, onAtualizar }) {
  const { t, idioma } = useTranslation()
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Box sx={{ color: 'var(--accent-ink)', display: 'flex' }}><MdPsychology size={28} /></Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>{t('treinamento.title')}</Typography>
          <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)' }}>{t('treinamento.subtitle')}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <StatusDoTreino ultimoMs={ultimoMs} cadenciaMs={cadenciaMs} />
        {atualizadoEm && (
          <Typography variant="caption" sx={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {t('treinamento.updatedAt', { hora: formatarHora(atualizadoEm, idioma.intl, true) })}
          </Typography>
        )}
        <Button
          variant="outlined"
          size="small"
          startIcon={<MdRefresh />}
          onClick={onAtualizar}
          disabled={carregando}
          sx={{ color: 'var(--text-primary)', borderColor: 'var(--border-strong)' }}
        >
          {t('treinamento.refresh')}
        </Button>
      </Box>
    </Box>
  )
}
