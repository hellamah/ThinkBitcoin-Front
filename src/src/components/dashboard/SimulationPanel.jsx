import React, { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { useTheme } from '@mui/material/styles'
import {
  MdPlayCircleOutline,
  MdWarningAmber,
  MdContentCut,
  MdLeaderboard,
} from 'react-icons/md'

import * as mathUtils from '../../utils/mathUtils'
import RotuloComAjuda from './RotuloComAjuda'
import { chartPalette } from '../../utils/themeTokens'
import { montarPontosDaCurva, folgaDoEixo } from '../../utils/equityChart'
import { MINIMO_TRADES_CONCLUSIVO, FRACAO_VALIDACAO_PADRAO } from '../../utils/backtest'
import { DIAS_JANELA_SIMULACAO } from '../../utils/simulationWindow'
import { ExitReason, StopMode, TradeDirection } from '../../utils/enums'
import { toLocalChartLabel } from '../../utils/dateUtils'

// Quantos candles segurar. Três opções em vez de campo livre: o número aqui não
// é ajuste fino, é a escala do que está sendo testado — intrabarra, algumas
// horas ou um dia inteiro na cadência horária.
const HORIZONTES = [1, 3, 5, 24]

const rotuloHorizonte = (n, t) =>
  t(n === 1 ? 'simulationHoldOne' : 'simulationHoldMany', { count: n })

const classeSinal = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : undefined)

// Percentual que pode ser null sem virar "0,00%" — a diferença entre "mediu e
// deu zero" e "não havia o que medir" é justamente o que esta tela não pode
// borrar.
const pct = (v, casas = 2, comSinal = true) =>
  v === null || v === undefined ? '—' : mathUtils.formatPercent(v, casas, comSinal)

/**
 * Simulação de estratégia sobre a série carregada.
 *
 * O painel existe para responder "e se eu tivesse operado este sinal?" — e para
 * responder de um jeito que não bajule a resposta. Daí três escolhas visuais
 * que não são decorativas:
 *
 * - O buy & hold fica LADO A LADO com o retorno, não escondido num rodapé. Um
 *   retorno de 12% não significa nada sem saber que segurar rendeu 15%.
 * - O custo total é card de primeira linha. É o número que transforma "rendeu
 *   3%" em "rendeu 3% e pagou 4% de taxa".
 * - Abaixo do mínimo de operações concluídas, o bloco inteiro é esmaecido. Os
 *   números continuam lá, mas param de parecer conclusão. Mesmo tratamento que
 *   o laboratório de sinais dá à linha sem significância.
 *
 * @param {object} props
 * @param {object|null} props.resultado - Retorno de `simular` na janela cheia.
 * @param {object|null} props.validacao - Resultado no trecho reservado (holdout).
 * @param {object|null} props.ajuste - Resultado no trecho de ajuste.
 * @param {object} props.parametros - Estado dos controles.
 * @param {Function} props.onParametro - Altera um parâmetro: (nome, valor).
 * @param {Array<string>} props.sinaisDisponiveis - Chaves oferecidas no seletor.
 * @param {object|null} props.comparativo - Retorno de `compararEstrategias`.
 * @param {boolean} props.carregando - A série de 180 dias ainda está vindo.
 * @param {string} props.erro - Mensagem de falha na busca da série.
 * @param {number} props.candlesAnalisados - Tamanho da série recebida.
 * @param {Function} props.t - Função de tradução.
 */
export default function SimulationPanel({
  resultado,
  validacao,
  ajuste,
  parametros,
  onParametro,
  sinaisDisponiveis,
  comparativo,
  carregando,
  erro,
  candlesAnalisados,
  t,
}) {
  const theme = useTheme()
  const cores = useMemo(() => chartPalette(), [theme.palette.mode])

  const pontos = useMemo(
    () => (resultado ? montarPontosDaCurva(resultado.curva, resultado.parametros.capitalInicial) : null),
    [resultado]
  )

  const dadosCurva = useMemo(() => {
    if (!pontos) return null
    return {
      labels: pontos.rotulos.map((r) => (r ? toLocalChartLabel(r) : '')),
      datasets: [
        {
          label: t('simulationEquity'),
          data: pontos.capital,
          borderColor: cores.accent,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
        },
        {
          // Sobreposto ao anterior: destaca só os trechos com posição aberta.
          label: t('simulationExposure'),
          data: pontos.emPosicao,
          borderColor: cores.alta,
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.1,
          spanGaps: false,
        },
      ],
    }
  }, [pontos, cores, t])

  const opcoesCurva = useMemo(() => {
    if (!pontos) return null
    const folga = folgaDoEixo(pontos.minimo, pontos.maximo)
    return {
      responsive: true,
      maintainAspectRatio: false,
      // Sem animação. A curva tem um ponto por candle — na janela de 180 dias
      // são ~4.300 por série, e são duas séries. Interpolar isso a cada troca
      // de parâmetro é trabalho que não acrescenta leitura nenhuma a uma linha
      // dessa densidade.
      //
      // Não é correção de lentidão: o ciclo completo do painel foi medido em
      // ~40 ms com 2.900 candles e ~55 ms com 4.300, e nenhuma long task
      // aparece no PerformanceObserver. É só não pagar pelo que não serve.
      animation: false,
      // Os dados já vêm ordenados e no formato que o Chart.js espera, então ele
      // pode pular a normalização interna.
      normalized: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: cores.tooltipBg,
          callbacks: {
            label: (ctx) =>
              ctx.parsed.y === null ? null : mathUtils.formatCurrency(ctx.parsed.y),
          },
        },
      },
      scales: {
        x: { ticks: { color: cores.tickSubtle, maxTicksLimit: 8 }, grid: { display: false } },
        y: {
          min: pontos.minimo - folga,
          max: pontos.maximo + folga,
          ticks: { color: cores.tick, maxTicksLimit: 6 },
          grid: { color: cores.grid },
        },
      },
    }
  }, [pontos, cores])

  // O cabeçalho aparece mesmo sem resultado: o painel some inteiro enquanto a
  // série de 180 dias carrega daria a impressão de que a ferramenta não existe.
  const cabecalho = (
    <h2>
      <MdPlayCircleOutline style={{ verticalAlign: 'middle', marginRight: '10px' }} />
      {t('simulation')}
    </h2>
  )

  if (carregando) {
    return (
      <section className="panel simulation-panel">
        {cabecalho}
        <p className="simulation-vazio">{t('simulationLoading')}</p>
      </section>
    )
  }

  if (erro) {
    return (
      <section className="panel simulation-panel">
        {cabecalho}
        <div className="simulation-aviso">
          <MdWarningAmber />
          <span>{t('simulationLoadError')}</span>
        </div>
      </section>
    )
  }

  if (!resultado) {
    return (
      <section className="panel simulation-panel">
        {cabecalho}
        <p className="simulation-vazio">{t('simulationNoTrades')}</p>
      </section>
    )
  }

  const { metricas, trades, descontinuidades } = resultado
  const fraco = metricas.amostraInsuficiente

  return (
    <section className="panel simulation-panel">
      {cabecalho}

      <p className="correlation-hint">{t('simulationHint')}</p>

      {/* Quantos candles a simulação analisou de fato. Sem este número, a
          diferença entre "a estratégia não funciona" e "a janela não tinha
          dado" fica invisível. */}
      <p className="simulation-janela">
        {t('simulationWindow', { dias: DIAS_JANELA_SIMULACAO, candles: candlesAnalisados })}
      </p>

      {/* ---------- Controles ---------- */}
      <div className="simulation-controls">
        <label className="simulation-campo">
          <span className="pill-group-label">{t('simulationSignal')}</span>
          <select
            value={parametros.sinalEntrada}
            onChange={(e) => onParametro('sinalEntrada', e.target.value)}
          >
            {sinaisDisponiveis.map((chave) => (
              <option key={chave} value={chave}>{t(`signal_${chave}`)}</option>
            ))}
          </select>
        </label>

        <div className="simulation-campo">
          <span className="pill-group-label">{t('simulationDirection')}</span>
          <div className="simulation-pills">
            {[
              [TradeDirection.COMPRA, 'simulationLong'],
              [TradeDirection.VENDA, 'simulationShort'],
            ].map(([valor, chave]) => (
              <button
                key={chave}
                type="button"
                className={`pill-toggle ${parametros.direcao === valor ? 'ativo' : ''}`}
                onClick={() => onParametro('direcao', valor)}
              >
                {t(chave)}
              </button>
            ))}
          </div>
        </div>

        <div className="simulation-campo">
          <span className="pill-group-label">{t('simulationHold')}</span>
          <div className="simulation-pills">
            {HORIZONTES.map((n) => (
              <button
                key={n}
                type="button"
                className={`pill-toggle ${parametros.saidaPorTempo === n ? 'ativo' : ''}`}
                onClick={() => onParametro('saidaPorTempo', n)}
              >
                {rotuloHorizonte(n, t)}
              </button>
            ))}
          </div>
        </div>

        <div className="simulation-campo">
          <RotuloComAjuda
            className="pill-group-label"
            texto={t('simulationStopMode')}
            ajuda={t('ajuda.simStopAtr')}
          />
          <div className="simulation-pills">
            {[
              [StopMode.PERCENTUAL, 'simulationStopFixed'],
              [StopMode.ATR, 'simulationStopAtr'],
            ].map(([valor, chave]) => (
              <button
                key={valor}
                type="button"
                className={`pill-toggle ${parametros.modoStop === valor ? 'ativo' : ''}`}
                onClick={() => onParametro('modoStop', valor)}
              >
                {t(chave)}
              </button>
            ))}
          </div>
        </div>

        {/* O campo de distância só existe no modo percentual. No modo ATR a
            distância é calculada por entrada, e deixar um campo editável ali
            faria parecer que ele ainda manda em alguma coisa. */}
        {parametros.modoStop === StopMode.PERCENTUAL && (
          <label className="simulation-campo simulation-campo-num">
            <RotuloComAjuda
              className="pill-group-label"
              texto={t('simulationStop')}
              ajuda={t('ajuda.simStop')}
            />
            <input
              type="number" min="0" step="0.5" placeholder="—"
              value={parametros.stopPercentual ?? ''}
              onChange={(e) =>
                onParametro('stopPercentual', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </label>
        )}

        <label className="simulation-campo simulation-campo-num">
          <RotuloComAjuda
            className="pill-group-label"
            texto={t('simulationTarget')}
            ajuda={t('ajuda.simAlvo')}
          />
          <input
            type="number" min="0" step="0.5" placeholder="—"
            value={parametros.alvoPercentual ?? ''}
            onChange={(e) =>
              onParametro('alvoPercentual', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </label>

        <label className="simulation-campo simulation-campo-num">
          <RotuloComAjuda
            className="pill-group-label"
            texto={t('simulationCost')}
            ajuda={t('ajuda.simCusto')}
          />
          <input
            type="number" min="0" step="0.01"
            value={parametros.custoPercentual}
            onChange={(e) => onParametro('custoPercentual', Number(e.target.value) || 0)}
          />
        </label>
      </div>

      {/* ---------- Avisos ---------- */}
      {descontinuidades.length > 0 && (
        <div className="simulation-aviso">
          <MdWarningAmber />
          <span>{t('simulationGaps', { count: descontinuidades.length })}</span>
        </div>
      )}

      {trades.length === 0 ? (
        <p className="simulation-vazio">{t('simulationNoTrades')}</p>
      ) : (
        <>
          {fraco && (
            <div className="simulation-aviso">
              <MdWarningAmber />
              <span>{t('simulationSmallSample', { count: MINIMO_TRADES_CONCLUSIVO })}</span>
            </div>
          )}

          {/* ---------- Métricas ---------- */}
          <div className={`intelligence-grid ${fraco ? 'simulation-fraco' : ''}`}>
            <div className="intel-card">
              <RotuloComAjuda className="intel-label" texto={t('simulationReturn')} />
              <div className={`intel-value ${classeSinal(metricas.retornoTotal)}`}>
                {pct(metricas.retornoTotal)}
              </div>
              <div className="intel-subvalue" style={{ opacity: 0.7 }}>
                {t('simulationTrades')}: {metricas.tradesConcluidos}
              </div>
            </div>

            <div className="intel-card">
              <RotuloComAjuda
                className="intel-label"
                texto={t('simulationBuyHold')}
                ajuda={t('ajuda.simBuyHold')}
              />
              <div className={`intel-value ${classeSinal(metricas.buyAndHold)}`}>
                {pct(metricas.buyAndHold)}
              </div>
              <div className="intel-subvalue" style={{ opacity: 0.7 }}>
                {t('simulationAlpha')}: {pct(metricas.alfa)}
              </div>
            </div>

            <div className="intel-card">
              <RotuloComAjuda
                className="intel-label"
                texto={t('simulationTotalCost')}
                ajuda={t('ajuda.simCustoTotal')}
              />
              <div className="intel-value down">
                {mathUtils.formatCurrency(metricas.custoTotal)}
              </div>
              <div className="intel-subvalue" style={{ opacity: 0.7 }}>
                {t('simulationExposure')}: {metricas.exposicao.toFixed(0)}%
              </div>
            </div>

            <div className="intel-card">
              <RotuloComAjuda
                className="intel-label"
                texto={t('simulationDrawdown')}
                ajuda={t('ajuda.simDrawdown')}
              />
              {/* Drawdown é sempre ≤ 0; o sinal já vem no número. */}
              <div className="intel-value down">{pct(metricas.drawdownMaximo, 2, false)}</div>
              <div className="intel-subvalue" style={{ opacity: 0.7 }}>
                {t('simulationProfitFactor')}:{' '}
                {metricas.profitFactor === null ? '—' : metricas.profitFactor.toFixed(2)}
              </div>
            </div>

            <div className="intel-card">
              <RotuloComAjuda className="intel-label" texto={t('simulationWinRate')} />
              <div className="intel-value">
                {metricas.winRate === null ? '—' : `${metricas.winRate.toFixed(1)}%`}
              </div>
              <div className="intel-subvalue" style={{ opacity: 0.7 }}>
                {metricas.intervalo
                  ? `${metricas.intervalo.inferior.toFixed(0)}–${metricas.intervalo.superior.toFixed(0)}%`
                  : '—'}
              </div>
            </div>
          </div>

          {/* ---------- Curva de capital ---------- */}
          {dadosCurva && (
            <div className="simulation-curva">
              <h3>{t('simulationEquity')}</h3>
              <div className="simulation-curva-container">
                <Line data={dadosCurva} options={opcoesCurva} />
              </div>
            </div>
          )}

          {/* ---------- Validação fora da amostra ---------- */}
          {ajuste && validacao ? (
            <div className="simulation-holdout">
              <h3>
                <MdContentCut style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                <RotuloComAjuda
                  texto={t('simulationHoldout')}
                  ajuda={t('ajuda.simHoldout')}
                />
              </h3>
              <p className="correlation-hint">
                {t('simulationHoldoutHint', { fracao: Math.round(FRACAO_VALIDACAO_PADRAO * 100) })}
              </p>
              <div className="correlation-scroll">
                <table className="signal-lab-table">
                  <thead>
                    <tr>
                      <th scope="col" />
                      <th scope="col">{t('simulationReturn')}</th>
                      <th scope="col">{t('simulationBuyHold')}</th>
                      <th scope="col">{t('simulationAlpha')}</th>
                      <th scope="col">{t('simulationTrades')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['simulationTuning', ajuste],
                      ['simulationValidation', validacao],
                    ].map(([rotulo, r]) => {
                      // Sem nenhuma operação, retorno e alfa não são resultado
                      // — são a ausência dele. Exibir "+0,00%" e um alfa
                      // positivo faria "não operou" parecer "operou e ficou
                      // estável", que é o oposto do que aconteceu. O buy & hold
                      // continua, porque ele não depende de ter operado.
                      const operou = r.trades.length > 0
                      return (
                        <tr
                          key={rotulo}
                          className={r.metricas.amostraInsuficiente ? 'signal-lab-fraco' : undefined}
                        >
                          <th scope="row">{t(rotulo)}</th>
                          <td className={operou ? classeSinal(r.metricas.retornoTotal) : undefined}>
                            {operou ? pct(r.metricas.retornoTotal) : '—'}
                          </td>
                          <td>{pct(r.metricas.buyAndHold)}</td>
                          <td className={operou ? classeSinal(r.metricas.alfa) : undefined}>
                            {operou ? pct(r.metricas.alfa) : '—'}
                          </td>
                          <td>{r.metricas.tradesConcluidos}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="simulation-vazio">{t('simulationTooShort')}</p>
          )}

          {/* ---------- Ranking de estratégias ---------- */}
          {comparativo && comparativo.linhas.length > 1 && (
            <div className="simulation-ranking">
              <h3>
                <MdLeaderboard style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                <RotuloComAjuda
                  texto={t('simulationRanking')}
                  ajuda={t('ajuda.simRanking')}
                />
              </h3>
              <p className="correlation-hint">
                {t('simulationRankingHint', { total: comparativo.linhas.length })}
              </p>
              <div className="correlation-scroll">
                <table className="signal-lab-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('simulationSignal')}</th>
                      <th scope="col">{t('simulationTrades')}</th>
                      <th scope="col">{t('simulationReturn')}</th>
                      <th scope="col">{t('simulationAlpha')}</th>
                      <th scope="col">
                        <RotuloComAjuda
                          texto={t('simulationValidation')}
                          ajuda={t('ajuda.simHoldout')}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativo.linhas.map((linha) => (
                      <tr
                        key={linha.sinal}
                        className={[
                          linha.metricas.amostraInsuficiente ? 'signal-lab-fraco' : '',
                          linha.sinal === parametros.sinalEntrada ? 'simulation-linha-ativa' : '',
                        ].filter(Boolean).join(' ') || undefined}
                      >
                        <th scope="row">
                          {/* Trocar o sinal simulado a partir da tabela: sem
                              isto, ler o ranking e depois procurar a linha no
                              seletor lá em cima é trabalho manual à toa. */}
                          <button
                            type="button"
                            className="simulation-link-sinal"
                            onClick={() => onParametro('sinalEntrada', linha.sinal)}
                          >
                            {t(`signal_${linha.sinal}`)}
                          </button>
                        </th>
                        <td>{linha.metricas.tradesConcluidos}</td>
                        <td className={classeSinal(linha.metricas.retornoTotal)}>
                          {pct(linha.metricas.retornoTotal)}
                        </td>
                        <td className={classeSinal(linha.metricas.alfa)}>
                          {pct(linha.metricas.alfa)}
                        </td>
                        {/* "Não operou" não é "rendeu zero": a coluna fica
                            vazia em vez de fingir um resultado. */}
                        <td className={classeSinal(linha.alfaValidacao)}>
                          {linha.alfaValidacao === null
                            ? '—'
                            : `${pct(linha.alfaValidacao)} (${linha.tradesValidacao})`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="simulation-alerta-sobreajuste">
                <MdWarningAmber />
                <span>{t('simulationRankingWarning', { total: comparativo.linhas.length })}</span>
              </p>
            </div>
          )}

          {/* ---------- Operações ---------- */}
          <div className="correlation-scroll simulation-trades">
            <table className="signal-lab-table">
              <thead>
                <tr>
                  <th scope="col">{t('simulationTradeEntry')}</th>
                  <th scope="col">{t('simulationTradeExit')}</th>
                  <th scope="col">{t('simulationTradeBars')}</th>
                  <th scope="col">{t('simulationTradeReason')}</th>
                  <th scope="col">{t('simulationTradeResult')}</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((op) => (
                  <tr
                    key={`${op.indiceEntrada}-${op.indiceSaida}`}
                    className={
                      op.motivoSaida === ExitReason.FIM_DA_SERIE ? 'signal-lab-fraco' : undefined
                    }
                  >
                    <td>{mathUtils.formatCurrency(op.precoEntrada)}</td>
                    <td>{mathUtils.formatCurrency(op.precoSaida)}</td>
                    <td>{op.barrasSeguradas}</td>
                    <td>
                      {t(`exit_${op.motivoSaida}`)}
                      {/* No modo ATR a distância muda a cada entrada; sem
                          mostrá-la, "Stop" não diz stop de quanto. */}
                      {op.motivoSaida === ExitReason.STOP &&
                        op.stopPercentualAplicado !== null && (
                          <span className="simulation-stop-aplicado">
                            {' '}({op.stopPercentualAplicado.toFixed(1)}%)
                          </span>
                        )}
                    </td>
                    <td className={classeSinal(op.retornoLiquido)}>
                      {pct(op.retornoLiquido)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
