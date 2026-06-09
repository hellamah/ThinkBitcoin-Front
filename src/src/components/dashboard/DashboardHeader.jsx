import React from 'react'
import { MdRefresh } from 'react-icons/md'
import { useDashboard } from '../../context/DashboardContext'

export default function DashboardHeader({ t, prefs, usuario }) {
  const { forceRefresh } = useDashboard()

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
      <div>
        <h1 className="page-title" style={{ margin: 0 }}>{t('dashboard')}</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          {t('welcome', { name: (prefs?.nome || usuario?.nome || '') })}
        </p>
      </div>

      <div className="dashboard-actions-top">
        <button 
          className="btn-primary" 
          onClick={forceRefresh}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <MdRefresh /> Atualizar Dados
        </button>
      </div>
    </header>
  )
}
