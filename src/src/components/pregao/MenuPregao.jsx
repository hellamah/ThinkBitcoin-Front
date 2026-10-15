import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import { MdExpandMore, MdFactCheck, MdSmartToy, MdVisibility } from 'react-icons/md'
import useTranslation from '../../hooks/useTranslation'

// A entrada do Pregão no cabeçalho, só para administrador: um menu com as duas
// telas — a fila de decisão (/pedidos-pregao) e a página aberta (/pregao), o
// que o público vê. Antes era um ícone sem rótulo ao lado de Configurações, que
// levava só à fila; a página aberta não tinha caminho fora da Início.
//
// O número no ícone é quantos pedidos esperam decisão: é por ele que se sabe
// que há o que fazer sem abrir a fila.

const ROTA_FILA = '/pedidos-pregao'
const ROTA_ABERTA = '/pregao'

const textoEsperando = (t, n) => {
  if (n === 0) return t('nav.pregaoNenhumEsperando')
  if (n === 1) return t('nav.pregaoUmEsperando')
  return t('nav.pregaoEsperando', { n })
}

/**
 * @param {number|null} esperando pedidos esperando decisão; nulo quando não se sabe
 * @param {boolean} naBarraDeBaixo no celular o menu abre para cima e a seta sai
 */
export default function MenuPregao({ esperando, naBarraDeBaixo = false }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [ancora, setAncora] = useState(null)
  const aberto = Boolean(ancora)
  const fechar = () => setAncora(null)

  const contagem = esperando == null ? null : textoEsperando(t, esperando)
  const rotulo = contagem ? `${t('nav.pregaoMenu')}: ${contagem}` : t('nav.pregaoMenu')
  const ativo = pathname === ROTA_FILA || pathname === ROTA_ABERTA

  const itens = [
    { to: ROTA_FILA, Icone: MdFactCheck, titulo: t('nav.pregaoDecidir'), detalhe: contagem ?? t('nav.pregaoDecidirDica') },
    { to: ROTA_ABERTA, Icone: MdVisibility, titulo: t('nav.pregaoAberta'), detalhe: t('nav.pregaoAbertaDica') },
  ]

  return (
    <>
      <IconButton
        className={`nav-item menu-pregao${ativo ? ' active' : ''}`}
        onClick={(e) => setAncora(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? 'menu-pregao' : undefined}
        aria-label={rotulo}
        title={rotulo}
      >
        <Badge
          badgeContent={esperando}
          color="error"
          sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16, px: 0.5 } }}
        >
          <MdSmartToy />
        </Badge>
        <span className="nav-label">{t('nav.pregaoMenu')}</span>
        {!naBarraDeBaixo && <MdExpandMore className="menu-pregao-seta" aria-hidden="true" />}
      </IconButton>
      <Menu
        id="menu-pregao"
        anchorEl={ancora}
        open={aberto}
        onClose={fechar}
        anchorOrigin={{ vertical: naBarraDeBaixo ? 'top' : 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: naBarraDeBaixo ? 'bottom' : 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: 'var(--surface-overlay)',
              border: '1px solid var(--border-strong)',
              borderRadius: '12px',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 12px 40px var(--scrim-strong)',
              // Na barra de baixo, sobe acima da borda dela.
              mt: naBarraDeBaixo ? -2 : 1,
              minWidth: 260,
            },
          },
        }}
      >
        {itens.map(({ to, Icone, titulo, detalhe }) => (
          <MenuItem
            key={to}
            component={NavLink}
            to={to}
            onClick={fechar}
            selected={pathname === to}
            sx={{
              color: 'var(--text-primary)',
              gap: 1.5,
              py: 1.25,
              '&:hover': { backgroundColor: 'var(--accent-a08)' },
              '&.Mui-selected': { backgroundColor: 'var(--accent-a15)' },
            }}
          >
            <Icone aria-hidden="true" style={{ color: 'var(--accent-ink)', fontSize: '1.25rem', flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ fontWeight: 600, fontSize: 14 }}>{titulo}</Box>
              <Typography variant="caption" component="div" sx={{ color: 'var(--text-muted)' }}>
                {detalhe}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
