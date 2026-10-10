import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import useTranslation from '../../hooks/useTranslation'

// Os chips de status dos pedidos do Pregão, na tela do administrador e na
// página aberta. Cada um mostra o total quando a lista já chegou. Chip de
// alternância, como os filtros da tela de treino: `aria-pressed` diz ao leitor
// de tela o que a cor diz a quem enxerga.

function ChipDeFiltro({ rotulo, ativo, onClick }) {
  return (
    <Chip
      label={rotulo}
      size="small"
      onClick={onClick}
      aria-pressed={ativo}
      sx={{
        cursor: 'pointer',
        background: ativo ? 'var(--accent)' : 'var(--surface-fill-strong)',
        color: ativo ? 'var(--text-on-accent)' : 'var(--text-primary)',
        fontWeight: ativo ? 700 : 500,
        border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border-strong)'}`,
        '&:hover': { background: ativo ? 'var(--accent)' : 'var(--border-strong)' },
      }}
    />
  )
}

/**
 * @param {Array<{id: string}>} filtros - FILTROS ou FILTROS_PUBLICOS
 * @param {string} filtro - o escolhido
 * @param {Object<string, number>|null} contagem - total por filtro; nulo enquanto a lista não chegou
 */
export default function FiltroDeStatus({ filtros, filtro, contagem, onTrocar }) {
  const { t } = useTranslation()
  return (
    <Box role="group" aria-label={t('pregao.filtroRotulo')} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {filtros.map((f) => (
        <ChipDeFiltro
          key={f.id}
          rotulo={contagem
            ? t('pregao.filtroComTotal', { filtro: t(`pregao.filtros.${f.id}`), total: contagem[f.id] })
            : t(`pregao.filtros.${f.id}`)}
          ativo={f.id === filtro}
          onClick={() => onTrocar(f.id)}
        />
      ))}
    </Box>
  )
}
