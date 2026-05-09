import React from 'react'

export default function DashboardHeader({ t, prefs, usuario }) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
      <div>
        <h1 className="page-title" style={{ margin: 0 }}>{t('dashboard')}</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          {t('welcome', { name: (prefs?.nome || usuario?.nome || '') })}
        </p>
      </div>

      <div className="dashboard-actions-top">
        {/* Botão de atualização de sinal reservado */}
      </div>
    </header>
  )
}
