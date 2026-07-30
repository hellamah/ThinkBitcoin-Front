import React from 'react'
import Box from '@mui/material/Box'
import { Bar, Line } from 'react-chartjs-2'
import { MdFullscreen } from 'react-icons/md'
import { ChartType, PriceChartMode } from '../../utils/enums'
import ExpandedChartModal from './ExpandedChartModal'

// Estilo dos alternadores em pílula do cabeçalho dos gráficos.
const estiloAlternador = (ativo) => ({
  padding: '4px 12px',
  fontSize: '0.78rem',
  borderRadius: '20px',
  border: ativo ? '1px solid #FFD700' : '1px solid #444',
  background: ativo ? 'rgba(255,215,0,0.12)' : 'transparent',
  color: ativo ? 'var(--accent-ink)' : 'var(--text-muted)',
  cursor: 'pointer',
  fontWeight: ativo ? 600 : 400,
  transition: 'all 0.2s',
})

/**
 * Exibe os gráficos do dashboard. Ao expandir um gráfico (modal),
 * utiliza o componente ExpandedChartModal.
 * 
 * @param {object} props
 * @param {boolean} props.multiMoeda - Indica se há múltiplas moedas selecionadas.
 * @param {string} props.normalizacao - Tipo de normalização ativa.
 * @param {Function} props.setNormalizacao - Função para alterar a normalização.
 * @param {string|null} props.expandedChart - Tipo de gráfico expandido.
 * @param {Function} props.setExpandedChart - Função para expandir/fechar gráfico.
 * @param {object} props.dadosNegociados - Dados para o gráfico de valor negociado.
 * @param {object} props.dadosVariacao - Dados para o gráfico de variação percentual.
 * @param {object} props.opcoesPreco - Opções para o gráfico de preço.
 * @param {object} props.opcoesVariacao - Opções para o gráfico de variação.
 * @param {string} props.ultimoNegociado - Último valor negociado formatado.
 * @param {string} props.ultimaVariacao - Última variação formatada.
 * @param {object} props.trendAtual - Dados de tendência atual.
 * @param {Function} props.t - Função de tradução.
 */
export default function DashboardCharts({
  multiMoeda,
  normalizacao,
  setNormalizacao,
  modoPreco,
  setModoPreco,
  temVelas,
  modoVela,
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
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Normalização:</span>
            {[
              { key: 'base100', label: 'Base 100', title: 'Performance relativa — começa em 100 para todas' },
              { key: 'minmax', label: 'Min-Max', title: 'Escala 0 a 1 relativa ao período' },
              { key: 'zscore', label: 'Z-Score', title: 'Volatilidade — desvios em relação à média' },
            ].map(({ key, label, title }) => (
              <button
                key={key}
                title={title}
                onClick={() => setNormalizacao(key)}
                style={estiloAlternador(normalizacao === key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Candles exigem uma única moeda: sobrepor OHLC de ativos diferentes
            não se lê, então o alternador some no modo comparativo. */}
        {!multiMoeda && temVelas && (
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>{t('chartMode')}:</span>
            {[
              { key: PriceChartMode.LINE, label: t('chartModeLine'), title: t('chartModeLineHint') },
              { key: PriceChartMode.CANDLE, label: t('chartModeCandle'), title: t('chartModeCandleHint') },
            ].map(({ key, label, title }) => (
              <button
                key={key}
                title={title}
                onClick={() => setModoPreco(key)}
                style={estiloAlternador(modoPreco === key)}
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
          onClick={() => setExpandedChart(ChartType.TRADED_VALUE)}
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
          onClick={() => setExpandedChart(ChartType.PERCENT_VARIATION)}
        >
          <div className="chart-expand-icon"><MdFullscreen /></div>
          <h2>{t('percentVariation')}</h2>
          <div className="chart-note">{t('lastVariation')}: {ultimaVariacao}</div>
          <div className="chart-container">
            {/* Barras acompanham o modo candle; a linha suavizada esconderia
                justamente a leitura candle a candle que o modo propõe. */}
            {modoVela
              ? <Bar data={dadosVariacao} options={opcoesVariacao} />
              : <Line data={dadosVariacao} options={opcoesVariacao} />}
          </div>
        </Box>
      </div>

      {/* Modal de Gráfico Expandido */}
      <ExpandedChartModal 
        expandedChart={expandedChart}
        setExpandedChart={setExpandedChart}
        dadosNegociados={dadosNegociados}
        dadosVariacao={dadosVariacao}
        opcoesPreco={opcoesPreco}
        opcoesVariacao={opcoesVariacao}
        trendAtual={trendAtual}
        modoVela={modoVela}
        t={t}
      />
    </>
  )
}

