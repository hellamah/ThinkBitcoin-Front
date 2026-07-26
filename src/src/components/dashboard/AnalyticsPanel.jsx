import React from 'react'
import { MdCompareArrows, MdBarChart, MdShowChart, MdPsychology, MdWaterfallChart } from 'react-icons/md'
import * as mathUtils from '../../utils/mathUtils'

// Classificações vêm em inglês da fonte externa (alternative.me); o dashboard
// já tem as traduções, basta casar a chave.
const CLASSIFICACAO_I18N = Object.freeze({
  'extreme fear': 'extremeFear',
  fear: 'fear',
  neutral: 'neutral',
  greed: 'greed',
  'extreme greed': 'extremeGreed',
})

/**
 * Desenha uma minissérie em SVG. Um Chart.js por card custaria um canvas e um
 * loop de animação cada — aqui é um único path estático.
 */
function Sparkline({ valores, largura = 120, altura = 32 }) {
  if (!Array.isArray(valores) || valores.length < 2) return null

  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const amplitude = max - min || 1
  const passo = largura / (valores.length - 1)

  const pontos = valores
    .map((v, i) => {
      const x = i * passo
      const y = altura - ((v - min) / amplitude) * altura
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${largura} ${altura}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={pontos} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/**
 * Painel de fluxo de ordens, volatilidade e sentimento.
 *
 * @param {object} props
 * @param {object} props.analytics - Retorno de useMarketAnalytics.
 * @param {Function} props.t - Função de tradução.
 */
export default function AnalyticsPanel({ analytics, t }) {
  if (!analytics) return null

  const { fluxo, volatilidade, fearGreed } = analytics

  const compradora = fluxo.dominanciaCompradora
  const vendedora = fluxo.dominanciaVendedora
  // Sem dominância medida a barra não tem o que representar; cair para 50/50
  // sugeriria equilíbrio onde na verdade não há leitura.
  const temDominancia = compradora > 0 || vendedora > 0
  const compradoraLargura = temDominancia
    ? (compradora / (compradora + vendedora)) * 100
    : 0

  const deltaPositivo = fluxo.deltaAcumulado >= 0
  const classificacaoChave = CLASSIFICACAO_I18N[fearGreed?.classificacao?.trim().toLowerCase()]

  return (
    <section className="panel intelligence-panel">
      <h2>
        <MdWaterfallChart style={{ verticalAlign: 'middle', marginRight: '10px' }} /> {t('orderFlow')}
      </h2>
      <div className="intelligence-grid">
        {/* Pressão compradora vs vendedora */}
        <div className="intel-card">
          <div className="intel-icon"><MdCompareArrows /></div>
          <div className="intel-label">{t('buyPressure')}</div>
          <div className="intel-value">
            {temDominancia ? `${compradora.toFixed(1)}%` : '-'}
          </div>
          {temDominancia && (
            <div
              className="pressure-bar"
              role="img"
              aria-label={`${t('buyers')} ${compradora.toFixed(1)}%, ${t('sellers')} ${vendedora.toFixed(1)}%`}
            >
              <span className="pressure-bar-buy" style={{ width: `${compradoraLargura}%` }} />
            </div>
          )}
          <div className="intel-subvalue" style={{ opacity: 0.7 }}>
            {fluxo.dominanciaCompradoraPeriodo !== null
              ? `${t('periodAverage')}: ${fluxo.dominanciaCompradoraPeriodo.toFixed(1)}%`
              : t('noReading')}
          </div>
        </div>

        {/* Delta de volume acumulado */}
        <div className="intel-card">
          <div className="intel-icon"><MdBarChart /></div>
          <div className="intel-label">{t('volumeDelta')}</div>
          <div className="intel-value">
            {deltaPositivo ? '+' : ''}{mathUtils.formatCompact(fluxo.deltaAcumulado)}
          </div>
          <div className={`intel-subvalue ${deltaPositivo ? 'up' : 'down'}`}>
            {deltaPositivo ? t('netBuying') : t('netSelling')}
          </div>
        </div>

        {/* Volatilidade atual contra a mediana do período */}
        <div className="intel-card">
          <div className="intel-icon"><MdShowChart /></div>
          <div className="intel-label">{t('volatility')}</div>
          <div className="intel-value">{volatilidade.atual.toFixed(2)}%</div>
          <div className="intel-subvalue" style={{ opacity: 0.7 }}>
            {volatilidade.razao !== null
              ? t('vsMedian', { value: volatilidade.razao.toFixed(1) })
              : t('noReading')}
          </div>
        </div>

        {/* Fear & Greed com a série do período */}
        <div className="intel-card">
          <div className="intel-icon"><MdPsychology /></div>
          <div className="intel-label">{t('fearGreedIndex')}</div>
          {fearGreed ? (
            <>
              <div className="intel-value">{fearGreed.valor}</div>
              <Sparkline valores={fearGreed.serie} />
              <div className={`intel-subvalue ${fearGreed.valor >= 55 ? 'up' : fearGreed.valor <= 45 ? 'down' : ''}`}>
                {classificacaoChave ? t(classificacaoChave) : fearGreed.classificacao}
              </div>
            </>
          ) : (
            <>
              <div className="intel-value">-</div>
              <div className="intel-subvalue" style={{ opacity: 0.7 }}>{t('noReading')}</div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
