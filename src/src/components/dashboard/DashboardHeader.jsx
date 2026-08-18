import React from 'react'
import Badge from '@mui/material/Badge'
import Tooltip from '@mui/material/Tooltip'
import { MdRefresh, MdNotificationsActive, MdLock } from 'react-icons/md'
import { useDashboard } from '../../context/DashboardContext'

export default function DashboardHeader({
  t,
  prefs,
  usuario,
  title,
  // O sino só aparece para quem passar o handler. A alternativa — renderizar
  // sempre — deixaria um botão inerte no heatmap, que não tem o modal montado.
  onAbrirAlertas,
  alertasAtivos = 0,
  alertasBloqueados = false,
}) {
  const { forceRefresh } = useDashboard()

  // Consultor vê o sino com cadeado: o mesmo evento que o apiClient dispara em
  // 403 abre o convite de assinatura no Layout, sem precisar bater na API para
  // levar a recusa.
  const abrirUpsell = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('subscription-required', { detail: { endpoint: '/ThinkBitcoin/alertas-preco' } }))
    }
  }

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
      <div>
        <h1 className="page-title" style={{ margin: 0 }}>{title || t('dashboard')}</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          {t('welcome', { name: (prefs?.nome || usuario?.nome || '') })}
        </p>
      </div>

      <div className="dashboard-actions-top">
        {onAbrirAlertas && (
          <Tooltip title={alertasBloqueados ? t('alertas.recursoPago') : t('alertas.titulo')}>
            <button
              type="button"
              className="btn-primary"
              onClick={alertasBloqueados ? abrirUpsell : onAbrirAlertas}
              aria-label={alertasBloqueados ? t('alertas.recursoPago') : t('alertas.titulo')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {alertasBloqueados ? (
                <MdLock />
              ) : (
                <Badge
                  badgeContent={alertasAtivos}
                  color="primary"
                  overlap="circular"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
                >
                  <MdNotificationsActive />
                </Badge>
              )}
              {t('alertas.botao')}
            </button>
          </Tooltip>
        )}

        <button
          className="btn-primary"
          onClick={forceRefresh}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <MdRefresh /> {t('refreshData')}
        </button>
      </div>
    </header>
  )
}
