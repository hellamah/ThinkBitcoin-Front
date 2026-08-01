import React from 'react'
import Box from '@mui/material/Box'
import { Bar, Line } from 'react-chartjs-2'
import { MdFullscreen, MdWarningAmber } from 'react-icons/md'
import { ChartType, Normalization, PriceChartMode, SecondaryChart } from '../../utils/enums'
import ExpandedChartModal from './ExpandedChartModal'

// O visual da pílula vive em .pill-toggle no App.css, compartilhado com o
// seletor de horizonte do laboratório.
const classeAlternador = (ativo) => `pill-toggle ${ativo ? 'ativo' : ''}`

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
  painelSecundario,
  setPainelSecundario,
  temVelas,
  modoVela,
  expandedChart,
  setExpandedChart, 
  dadosNegociados,
  dadosVariacao,
  dadosVolume,
  opcoesPreco,
  opcoesVariacao,
  opcoesVolume,
  ultimoNegociado,
  ultimaVariacao,
  volumeAtual,
  trendAtual,
  cobertura,
  t
}) {
  // Volume existe só com moeda única; em modo comparativo o seletor nem
  // aparece, mas a guarda evita render vazio se o filtro mudar por baixo.
  const mostraVolume = painelSecundario === SecondaryChart.VOLUME && Boolean(dadosVolume)

  return (
    <>
      <div style={{ marginTop: '40px', marginBottom: '16px', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{t('sequence')}</h2>

        {/* O período pedido pode ter mais candles do que a requisição traz.
            Sem este aviso o eixo começa depois da data escolhida e nada
            explica por quê. */}
        {cobertura?.truncado && (
          <span className="chart-truncated" title={t('truncatedHint')}>
            <MdWarningAmber />
            {t('truncatedRange', {
              recebidos: cobertura.recebidos,
              disponiveis: cobertura.disponiveis,
            })}
          </span>
        )}
        {multiMoeda && (
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span className="pill-group-label">{t('normalization')}:</span>
            {/* Os rótulos ficam literais de propósito: Base 100, Min-Max e
                Z-Score são nomes de métodos estatísticos, escritos igual nos
                dois idiomas. Só a explicação em prosa passa pelo i18n. */}
            {[
              { key: Normalization.BASE_100, label: 'Base 100', title: t('normalizationBase100Hint') },
              { key: Normalization.MIN_MAX, label: 'Min-Max', title: t('normalizationMinMaxHint') },
              { key: Normalization.Z_SCORE, label: 'Z-Score', title: t('normalizationZScoreHint') },
            ].map(({ key, label, title }) => (
              <button
                key={key}
                title={title}
                onClick={() => setNormalizacao(key)}
                className={classeAlternador(normalizacao === key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Dois controles independentes: "Visualização" muda COMO o preço é
            desenhado, "Painel" muda O QUE o gráfico ao lado mostra. Amarrar os
            dois faria o seletor de visualização trocar o conteúdo da tela.
            Ambos exigem moeda única: candle de vários ativos no mesmo eixo não
            se lê, e volume de moedas diferentes não se soma. */}
        {!multiMoeda && temVelas && (
          <div style={{ display: 'flex', gap: '18px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="pill-group-label">{t('chartMode')}:</span>
              {[
                { key: PriceChartMode.LINE, label: t('chartModeLine'), title: t('chartModeLineHint') },
                { key: PriceChartMode.CANDLE, label: t('chartModeCandle'), title: t('chartModeCandleHint') },
              ].map(({ key, label, title }) => (
                <button
                  key={key}
                  title={title}
                  onClick={() => setModoPreco(key)}
                  className={classeAlternador(modoPreco === key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="pill-group-label">{t('secondaryChart')}:</span>
              {[
                { key: SecondaryChart.VARIATION, label: t('percentVariation') },
                { key: SecondaryChart.VOLUME, label: t('volume') },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setPainelSecundario(key)}
                  className={classeAlternador(painelSecundario === key)}
                >
                  {label}
                </button>
              ))}
            </div>
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
          {/* Em modo comparativo a série está normalizada, então um valor em
              dólar de uma única moeda não descreve o que está desenhado. */}
          <div className="chart-note">
            {multiMoeda
              ? t('comparingCoins', { count: dadosNegociados.datasets.length })
              : `${t('lastValue')}: ${ultimoNegociado}`}
          </div>
          <div className="chart-container">
            <Line data={dadosNegociados} options={opcoesPreco} />
          </div>
        </Box>
        {/* Assunto escolhido no seletor "Painel", não no de visualização.
            Volume é útil como acompanhamento porque diz se o movimento teve
            participação — dimensão que nem a linha nem o candle mostram. */}
        <Box
          className="panel chart-panel chart-panel-clickable"
          onClick={() => setExpandedChart(ChartType.PERCENT_VARIATION)}
        >
          <div className="chart-expand-icon"><MdFullscreen /></div>
          <h2>{mostraVolume ? t('volume') : t('percentVariation')}</h2>
          <div className="chart-note">
            {multiMoeda
              ? t('comparingCoins', { count: dadosVariacao.datasets.length })
              : mostraVolume
                ? `${t('currentVolume')}: ${volumeAtual}`
                : `${t('lastVariation')}: ${ultimaVariacao}`}
          </div>
          <div className="chart-container">
            {mostraVolume
              ? <Bar data={dadosVolume} options={opcoesVolume} />
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
        dadosVolume={dadosVolume}
        opcoesPreco={opcoesPreco}
        opcoesVariacao={opcoesVariacao}
        opcoesVolume={opcoesVolume}
        trendAtual={trendAtual}
        mostraVolume={mostraVolume}
        t={t}
      />
    </>
  )
}

