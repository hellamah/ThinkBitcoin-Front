import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import useTranslation from '../../hooks/useTranslation'
import { corDaMoeda } from './formato'

const ROXO_VERSAO = '#A78BFA'

function LinhaDeFiltro({ rotulo, dica, children, onLimpar, ativo }) {
  const { t } = useTranslation()
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }} role="group" aria-label={rotulo}>
      <Typography variant="caption" title={dica} sx={{ color: 'var(--text-muted)', mr: 0.5, minWidth: { sm: 132 } }}>
        {rotulo}
      </Typography>
      {children}
      {ativo && (
        <Button size="small" onClick={onLimpar} sx={{ color: 'var(--text-secondary)', textTransform: 'none', minWidth: 0 }}>
          {t('treinamento.clear')}
        </Button>
      )}
    </Box>
  )
}

// Chip de alternância. `aria-pressed` diz ao leitor de tela o que a cor diz a
// quem enxerga: se o filtro está ligado.
function ChipDeFiltro({ rotulo, ativo, cor, onClick }) {
  return (
    <Chip
      label={rotulo}
      size="small"
      onClick={onClick}
      aria-pressed={ativo}
      sx={{
        cursor: 'pointer',
        background: ativo ? cor : 'var(--surface-fill-strong)',
        color: ativo ? '#000' : 'var(--text-primary)',
        fontWeight: ativo ? 700 : 500,
        border: `1px solid ${ativo ? cor : 'var(--border-strong)'}`,
        '&:hover': { background: ativo ? cor : 'var(--border-strong)' },
      }}
    />
  )
}

export default function Filtros({ moedas, moedasSelecionadas, onAlternarMoeda, onLimparMoedas, versoes, versao, onVersao }) {
  const { t } = useTranslation()
  if (moedas.length === 0 && versoes.length === 0) return null
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
      {moedas.length > 0 && (
        <LinhaDeFiltro
          rotulo={t('treinamento.filterByCoin')}
          ativo={moedasSelecionadas.length > 0}
          onLimpar={onLimparMoedas}
        >
          {moedas.map((m) => (
            <ChipDeFiltro
              key={m}
              rotulo={m}
              ativo={moedasSelecionadas.includes(m)}
              cor={corDaMoeda(m)}
              onClick={() => onAlternarMoeda(m)}
            />
          ))}
        </LinhaDeFiltro>
      )}
      {versoes.length > 0 && (
        <LinhaDeFiltro
          rotulo={t('treinamento.modelVersion')}
          dica={t('treinamento.modelVersionTooltip')}
          ativo={Boolean(versao)}
          onLimpar={() => onVersao(null)}
        >
          {versoes.map((v) => (
            <ChipDeFiltro
              key={v}
              rotulo={v}
              ativo={versao === v}
              cor={ROXO_VERSAO}
              onClick={() => onVersao(versao === v ? null : v)}
            />
          ))}
        </LinhaDeFiltro>
      )}
    </Box>
  )
}
