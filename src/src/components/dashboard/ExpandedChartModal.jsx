import React, { useMemo, useState, useRef } from 'react';
import { Bar, Line, getElementAtEvent } from 'react-chartjs-2';
import { MdClose, MdAnalytics, MdTimeline, MdSpeed, MdUpdate, MdPublic } from 'react-icons/md';
import { ChartType } from '../../utils/enums';
import { readToken } from '../../utils/themeTokens';

/**
 * Modal expandido para exibir o gráfico selecionado junto a um painel de inteligência
 * que pode ser preenchido dinamicamente a partir dos dados do gráfico ou, caso
 * disponíveis, pelos dados de `trendAtual` já calculados.
 *
 * @param {{
 *   expandedChart: string|null,
 *   setExpandedChart: (value: string|null) => void,
 *   dadosNegociados: object,
 *   dadosVariacao: object,
 *   opcoesPreco: object,
 *   opcoesVariacao: object,
 *   trendAtual?: object,
 *   t: (key: string, options?: object) => string
 * }} props
 */
const ExpandedChartModal = ({
  expandedChart,
  setExpandedChart,
  dadosNegociados,
  dadosVariacao,
  dadosVolume,
  opcoesPreco,
  opcoesVariacao,
  opcoesVolume,
  trendAtual,
  mostraVolume,
  t,
}) => {
  const isTraded = expandedChart === ChartType.TRADED_VALUE;
  // O assunto do segundo painel vem do seletor "Painel", igual à versão
  // reduzida — abrir o modal não muda o que está sendo mostrado.
  const isBarra = !isTraded && Boolean(mostraVolume);
  const ChartComp = isBarra ? Bar : Line;

  const chartData = isTraded ? dadosNegociados : (isBarra ? dadosVolume : dadosVariacao);
  const chartOptions = isTraded ? opcoesPreco : (isBarra ? opcoesVolume : opcoesVariacao);

  const chartRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(null);

  // Inteligência derivada dos próprios dados do gráfico (último valor e variação)
  const intelFromChart = useMemo(() => {
    if (!chartData?.datasets || chartData.datasets.length === 0) return null;
    
    // Determinamos o index baseado no primeiro dataset
    const baseData = chartData.datasets[0].data;
    if (!baseData || baseData.length < 2) return null;
    
    // Se um ponto não foi clicado, usa o último
    const index = selectedIndex !== null ? selectedIndex : baseData.length - 1;
    
    // Pega o ponto anterior para calcular variação (se for o primeiro ponto, previousIndex é 0)
    const previousIndex = index > 0 ? index - 1 : 0;
    
    const datasetsInfo = chartData.datasets.map(dataset => {
      const data = dataset.data;
      const last = data[index];
      const previous = data[previousIndex];
      
      let changePercent = null;
      if (typeof last === 'number' && typeof previous === 'number') {
        if (previous !== 0) {
          changePercent = ((last - previous) / previous) * 100;
        } else if (last !== 0) {
          changePercent = 100; // de 0 para algo > 0
        } else {
          changePercent = 0;
        }
      }

      return {
        label: dataset.label || 'Moeda',
        color: dataset.borderColor || dataset.backgroundColor || '#fff',
        lastValue: last !== undefined ? last : null,
        changePercent: Number.isFinite(changePercent) ? changePercent : null,
      };
    });

    const label = chartData.labels?.[index] || t('lastValue');

    return {
      label,
      datasets: datasetsInfo,
    };
  }, [chartData, selectedIndex, t]);

  // Processa os datasets para garantir um visual 'Premium Terminal'
  // Escondemos os pontos por padrão para limpar o visual e destacamos apenas o selecionado
  const processedData = useMemo(() => {
    if (!chartData?.datasets) return null;
    // Barra não tem ponto nem tensão de linha para estilizar; o dataset já sai
    // do hook com a cor por direção.
    if (isBarra) return chartData;
    return {
      ...chartData,
      datasets: chartData.datasets.map((ds) => ({
        ...ds,
        // Visual da Linha
        borderWidth: 3,
        tension: 0.4,
        
        // Visual dos Pontos (Estilo 'Beacon')
        pointRadius: (context) => (context.dataIndex === selectedIndex ? 8 : 0),
        pointBackgroundColor: (context) => (context.dataIndex === selectedIndex ? '#fff' : ds.borderColor),
        pointBorderColor: (context) => (context.dataIndex === selectedIndex ? ds.borderColor : 'transparent'),
        pointBorderWidth: (context) => (context.dataIndex === selectedIndex ? 4 : 0),
        
        // Hover
        pointHoverRadius: 6,
        pointHoverBackgroundColor: ds.borderColor,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        
        hitRadius: 25, // Área generosa para facilitar o clique
      })),
    };
  }, [chartData, isBarra, selectedIndex]);

  const handleChartClick = (event) => {
    if (!chartRef.current) return;
    
    // getElementAtEvent retorna os elementos do chart interceptados pelo evento de clique
    const elements = getElementAtEvent(chartRef.current, event);
    
    if (elements && elements.length > 0) {
      const clickedIndex = elements[0].index;
      setSelectedIndex(clickedIndex);
    } else {
      // Se clicar no fundo, volta para o padrão (último ponto)
      setSelectedIndex(null);
    }
  };

  const handleClose = () => setExpandedChart(null);

  // A guarda fica DEPOIS dos hooks, e nao no topo. Com ela la em cima, o
  // componente — que o DashboardCharts mantem sempre montado — renderizava com
  // zero hooks enquanto nenhum grafico estava expandido e com quatro depois de
  // abrir. React exige a mesma ordem em todo render, e o que segurava isso de pe
  // era sorte, nao desenho.
  //
  // Nada acima depende de `expandedChart` estar preenchido: `isTraded` vira
  // false, os dados vem das props, e os dois useMemo ja se protegem sozinhos.
  if (!expandedChart) return null;

  return (
    <div className="expanded-chart-overlay" onClick={handleClose}>
      <div className="expanded-chart-content" onClick={(e) => e.stopPropagation()}>
        <button className="btn-close-premium" onClick={handleClose} aria-label={t('close')}>
          <MdClose size={32} />
        </button>
        <h2>{isTraded ? t('tradedValue') : (isBarra ? t('volume') : t('percentVariation'))}</h2>
        <div className="chart-container">
          <ChartComp
            ref={chartRef}
            data={processedData || chartData}
            options={{
              ...chartOptions,
              maintainAspectRatio: false,
              responsive: true,
              plugins: {
                ...chartOptions.plugins,
                tooltip: {
                  ...chartOptions.plugins?.tooltip,
                  enabled: true,
                  backgroundColor: readToken('--scrim-strong'),
                  titleFont: { size: 14, weight: 'bold' },
                  padding: 12,
                  cornerRadius: 8,
                }
              },
              interaction: {
                mode: 'index',
                intersect: false,
              },
              scales: {
                ...chartOptions.scales,
                x: {
                  ...chartOptions.scales?.x,
                  grid: {
                    display: true,
                    color: 'var(--text-faint)',
                  }
                },
                y: {
                  ...chartOptions.scales?.y,
                  grid: {
                    display: true,
                    color: 'var(--text-faint)',
                  }
                }
              }
            }}
            onClick={handleChartClick}
          />
        </div>
        {(intelFromChart || trendAtual) && (
          <div className="chart-intel-tooltip">
            <div className="chart-intel-tooltip-header">
              <MdAnalytics />
              <span>{t('marketIntelligence')}</span>
            </div>
            <div className="chart-intel-tooltip-grid">
              {/* Inteligência dinâmica baseada no gráfico */}
              {intelFromChart && (
                <>
                  <div className="chart-intel-tooltip-item">
                    <MdTimeline className="chart-intel-tip-icon" />
                    <div>
                      <div className="chart-intel-tip-label">{t('valueAt')}: {intelFromChart.label}</div>
                      <div className="chart-intel-tip-value" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', fontSize: '0.9em' }}>
                        {intelFromChart.datasets.map((ds, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: ds.color }}></div>
                            <span style={{ color: 'var(--text-muted)', minWidth: '40px' }}>{ds.label}:</span>
                            <span>{ds.lastValue != null ? Number(ds.lastValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '-'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="chart-intel-tooltip-item">
                    <MdSpeed className="chart-intel-tip-icon" />
                    <div>
                      <div className="chart-intel-tip-label">{t('percentChange')}</div>
                      <div className="chart-intel-tip-value" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', fontSize: '0.9em' }}>
                        {intelFromChart.datasets.map((ds, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: ds.color }}></div>
                            <span style={{ color: 'var(--text-muted)', minWidth: '40px' }}>{ds.label}:</span>
                            <span className={ds.changePercent !== null && ds.changePercent >= 0 ? 'up' : 'down'}>
                              {ds.changePercent !== null ? `${ds.changePercent > 0 ? '+' : ''}${ds.changePercent.toFixed(2)}%` : '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {/* Fallback: exibe trendAtual quando disponível */}
              {trendAtual && (
                <>
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
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpandedChartModal;
