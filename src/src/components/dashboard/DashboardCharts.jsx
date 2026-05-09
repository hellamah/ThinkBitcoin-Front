import React from 'react'
import Box from '@mui/material/Box'
import { Line } from 'react-chartjs-2'
import { MdFullscreen, MdClose, MdAnalytics, MdTimeline, MdSpeed, MdUpdate, MdPublic } from 'react-icons/md'

/**
 * Exibe os gráficos do dashboard. Ao expandir um gráfico (modal),
 * o painel de inteligência de mercado (trendAtual) é renderizado
 * abaixo do gráfico dentro do modal expanded-chart-content.
 * @param {object} trendAtual - Dados de tendência atual da moeda selecionada.
 */
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
  trendAtual,
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

            {/* Painel de Inteligência de Mercado dentro do modal */}
            {trendAtual && (
              <div className="chart-intel-tooltip">
                <div className="chart-intel-tooltip-header">
                  <MdAnalytics />
                  <span>{t('marketIntelligence')}</span>
                </div>
                <div className="chart-intel-tooltip-grid">
                  <div className="chart-intel-tooltip-item">
                    <MdTimeline className="chart-intel-tip-icon" />
                    <div>
                      <div className="chart-intel-tip-label">{t('movingAverages')}</div>
                      <div className={`chart-intel-tip-value ${
                        (trendAtual.mA5 || trendAtual.MA5) >= (trendAtual.mA15 || trendAtual.MA15) ? 'up' : 'down'
                      }`}>
                        {(trendAtual.mA5 || trendAtual.MA5) >= (trendAtual.mA15 || trendAtual.MA15)
                          ? t('bullishTrend')
                          : t('bearishTrend')}
                      </div>
                      <div className="chart-intel-tip-sub">MA5 vs MA15</div>
                    </div>
                  </div>
                  <div className="chart-intel-tooltip-item">
                    <MdSpeed className="chart-intel-tip-icon" />
                    <div>
                      <div className="chart-intel-tip-label">{t('momentum')}</div>
                      <div className={`chart-intel-tip-value ${
                        (trendAtual.delta5 || trendAtual.Delta5) >= 0 ? 'up' : 'down'
                      }`}>
                        Δ5: {trendAtual.delta5 || trendAtual.Delta5 || 0}
                      </div>
                      <div className="chart-intel-tip-sub">Δ15: {trendAtual.delta15 || trendAtual.Delta15 || 0}</div>
                    </div>
                  </div>
                  <div className="chart-intel-tooltip-item">
                    <MdUpdate className="chart-intel-tip-icon" />
                    <div>
                      <div className="chart-intel-tip-label">{t('trendVolatility')}</div>
                      <div className="chart-intel-tip-value">
                        {(trendAtual.volatilidade15 || trendAtual.Volatilidade15 || 0).toFixed(2)}
                      </div>
                      <div className="chart-intel-tip-sub">
                        {t('timeSincePeak')}: {trendAtual.minutosDesdePico || trendAtual.MinutosDesdePico || 0}min
                      </div>
                    </div>
                  </div>
                  <div className="chart-intel-tooltip-item">
                    <MdPublic className="chart-intel-tip-icon" />
                    <div>
                      <div className="chart-intel-tip-label">{t('globalHotspot')}</div>
                      <div className="chart-intel-tip-value">
                        {trendAtual.geoTop1Code || trendAtual.GeoTop1Code || 'N/A'}
                      </div>
                      <div className="chart-intel-tip-sub">
                        {t('trendRank')}: #{trendAtual.rankNoMinuto || trendAtual.RankNoMinuto || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
