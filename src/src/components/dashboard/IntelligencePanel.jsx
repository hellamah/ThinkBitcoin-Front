import React from 'react'
import { MdAnalytics, MdTimeline, MdSpeed, MdUpdate, MdPublic } from 'react-icons/md'

export default function IntelligencePanel({ trendAtual, t }) {
  if (!trendAtual) return null

  return (
    <section className="panel intelligence-panel">
      <h2><MdAnalytics style={{ verticalAlign: 'middle', marginRight: '10px' }} /> {t('marketIntelligence')}</h2>
      <div className="intelligence-grid">
        {/* Médias Móveis */}
        <div className="intel-card">
          <div className="intel-icon"><MdTimeline /></div>
          <div className="intel-label">{t('movingAverages')}</div>
          <div className="intel-value">MA5 vs MA15</div>
          <div className={`intel-subvalue ${(trendAtual.mA5 || trendAtual.MA5) >= (trendAtual.mA15 || trendAtual.MA15) ? 'up' : 'down'}`}>
            {(trendAtual.mA5 || trendAtual.MA5) >= (trendAtual.mA15 || trendAtual.MA15) ? t('bullishTrend') : t('bearishTrend')}
          </div>
        </div>

        {/* Momentum / Delta */}
        <div className="intel-card">
          <div className="intel-icon"><MdSpeed /></div>
          <div className="intel-label">{t('momentum')}</div>
          <div className="intel-value">Δ15: {trendAtual.delta15 || trendAtual.Delta15 || 0}</div>
          <div className={`intel-subvalue ${(trendAtual.delta5 || trendAtual.Delta5) >= 0 ? 'up' : 'down'}`}>
            Δ5: {trendAtual.delta5 || trendAtual.Delta5 || 0}
          </div>
        </div>

        {/* Volatilidade */}
        <div className="intel-card">
          <div className="intel-icon"><MdUpdate /></div>
          <div className="intel-label">{t('trendVolatility')}</div>
          <div className="intel-value">
            {(trendAtual.volatilidade15 || trendAtual.Volatilidade15 || 0).toFixed(2)}
          </div>
          <div className="intel-subvalue" style={{ opacity: 0.7 }}>
            {t('timeSincePeak')}: {t('minutesShort', { count: trendAtual.minutosDesdePico || trendAtual.MinutosDesdePico || 0 })}
          </div>
        </div>

        {/* Ranking e Hotspot */}
        <div className="intel-card">
          <div className="intel-icon"><MdPublic /></div>
          <div className="intel-label">{t('globalHotspot')}</div>
          <div className="intel-value">
            {trendAtual.geoTop1Code || trendAtual.GeoTop1Code || 'N/A'}
          </div>
          <div className="intel-subvalue">
            {t('trendRank')}: #{trendAtual.rankNoMinuto || trendAtual.RankNoMinuto || '-'}
          </div>
        </div>
      </div>
    </section>
  )
}
