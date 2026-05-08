import React from 'react'
import Box from '@mui/material/Box'
import { Line } from 'react-chartjs-2'
import { MdFullscreen, MdClose } from 'react-icons/md'

export default function DashboardCharts({ 
  multiMoeda, 
  normalizacao, 
  setNormalizacao, 
  expandedChart, 
  setExpandedChart, 
  dadosNegociados, 
  dadosVariacao, 
  opcoesPreco, 
  opcoesVariacao, 
  ultimoNegociado, 
  ultimaVariacao, 
  t 
}) {
  return (
    <>
      <div style={{ marginTop: '40px', marginBottom: '16px', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{t('sequence')}</h2>
        {multiMoeda && (
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#888', alignSelf: 'center' }}>Normalização:</span>
            {[
              { key: 'base100', label: 'Base 100', title: 'Performance relativa — começa em 100 para todas' },
              { key: 'minmax', label: 'Min-Max', title: 'Escala 0 a 1 relativa ao período' },
              { key: 'zscore', label: 'Z-Score', title: 'Volatilidade — desvios em relação à média' },
            ].map(({ key, label, title }) => (
              <button
                key={key}
                title={title}
                onClick={() => setNormalizacao(key)}
                style={{
                  padding: '4px 12px',
                  fontSize: '0.78rem',
                  borderRadius: '20px',
                  border: normalizacao === key ? '1px solid #FFD700' : '1px solid #444',
                  background: normalizacao === key ? 'rgba(255,215,0,0.12)' : 'transparent',
                  color: normalizacao === key ? '#FFD700' : '#888',
                  cursor: 'pointer',
                  fontWeight: normalizacao === key ? 600 : 400,
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-charts">
        <Box
          className="panel chart-panel chart-panel-clickable"
          onClick={() => setExpandedChart('tradedValue')}
        >
          <div className="chart-expand-icon"><MdFullscreen /></div>
          <h2>{t('tradedValue')}</h2>
          <div className="chart-note">{t('lastValue')}: {ultimoNegociado}</div>
          <div className="chart-container">
            <Line data={dadosNegociados} options={opcoesPreco} />
          </div>
        </Box>
        <Box
          className="panel chart-panel chart-panel-clickable"
          onClick={() => setExpandedChart('percentVariation')}
        >
          <div className="chart-expand-icon"><MdFullscreen /></div>
          <h2>{t('percentVariation')}</h2>
          <div className="chart-note">{t('lastVariation')}: {ultimaVariacao}</div>
          <div className="chart-container">
            <Line data={dadosVariacao} options={opcoesVariacao} />
          </div>
        </Box>
      </div>

      {/* Modal de Gráfico Expandido */}
      {expandedChart && (
        <div className="expanded-chart-overlay" onClick={() => setExpandedChart(null)}>
          <div className="expanded-chart-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-expanded-chart" onClick={() => setExpandedChart(null)}>
              <MdClose size={32} />
            </button>
            <h2>{expandedChart === 'tradedValue' ? t('tradedValue') : t('percentVariation')}</h2>
            <div className="chart-container">
              <Line
                data={expandedChart === 'tradedValue' ? dadosNegociados : dadosVariacao}
                options={{
                  ...(expandedChart === 'tradedValue' ? opcoesPreco : opcoesVariacao),
                  maintainAspectRatio: false,
                  responsive: true,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
