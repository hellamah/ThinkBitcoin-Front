import React from 'react'
import { MdLeaderboard, MdWarningAmber } from 'react-icons/md'

import RotuloComAjuda from '../RotuloComAjuda'
import { MINIMO_TRADES_CONCLUSIVO } from '../../../utils/backtest'
import { classeSinal, pct, resumoDaRegra } from './formatacao'

/**
 * A validação desta linha repousa sobre menos operações do que o projeto
 * considera conclusivo.
 *
 * Vale a mesma régua que esmaece a linha inteira (`amostraInsuficiente`), só
 * que aplicada ao número que de fato decide a leitura. A linha usa a contagem
 * da janela CHEIA, que é a maior das três e portanto a que menos precisa do
 * aviso.
 */
const validacaoCurta = (linha) =>
  linha.alfaValidacao !== null &&
  linha.tradesValidacao !== null &&
  linha.tradesValidacao < MINIMO_TRADES_CONCLUSIVO

/**
 * Todas as entradas sob a mesma regra comum, ordenadas pelo alfa do ajuste.
 *
 * Ganhou a régua da sorte: o aviso de sobreajuste dizia em texto que o topo de
 * uma tabela de N sinais parece bom por construção; a linha de sorte esperada
 * diz até ONDE — o alfa que o melhor de N sinais sorteados alcança. Linha acima
 * do percentil 95 dessa régua recebe a marca.
 */
export default function RankingEstrategias({ comparativo, sorte, calculando, parametros, onParametro, t }) {
  if (!comparativo || comparativo.linhas.length < 2) {
    return <p className="simulation-vazio">{t('simulationNoTrades')}</p>
  }

  const acimaDaSorte = (linha) =>
    sorte && linha.alfaAjuste !== null && linha.alfaAjuste > sorte.p95

  return (
    <div className="simulation-ranking">
      <h3>
        <MdLeaderboard style={{ verticalAlign: 'middle', marginRight: '8px' }} />
        <RotuloComAjuda texto={t('simulationRanking')} ajuda={t('ajuda.simRanking')} />
      </h3>
      <p className="correlation-hint">
        {t('simulationRankingHint', { total: comparativo.linhas.length })}
      </p>
      {/* Sob qual regra a tabela foi montada. A ordem das linhas é
          inteiramente condicional a isto. */}
      <p className="simulation-regra-saida">{resumoDaRegra(parametros, t)}</p>

      {sorte ? (
        <p className={`simulation-sorte ${calculando ? 'simulation-desatualizado' : ''}`}>
          {t('simulationRankingLuck', {
            total: sorte.sinais,
            mediana: pct(sorte.mediana),
            p95: pct(sorte.p95),
          })}
        </p>
      ) : calculando ? (
        <p className="simulation-sorte">{t('simulationCalculating')}</p>
      ) : null}

      <div className="correlation-scroll">
        <table className="signal-lab-table">
          <thead>
            <tr>
              <th scope="col">{t('simulationSignal')}</th>
              <th scope="col">{t('simulationTrades')}</th>
              <th scope="col">{t('simulationReturn')}</th>
              <th scope="col">{t('simulationAlpha')}</th>
              {/* Ajuste e validação, lado a lado. É o par que mede degradação
                  de verdade: eles não se sobrepõem, enquanto a coluna de alfa
                  (janela cheia) CONTÉM o trecho de validação. */}
              <th scope="col">{t('simulationTuning')}</th>
              <th scope="col">
                <RotuloComAjuda texto={t('simulationValidation')} ajuda={t('ajuda.simHoldout')} />
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
                  {/* Trocar o sinal simulado a partir da tabela: sem isto, ler
                      o ranking e depois procurar a linha no seletor lá em cima
                      é trabalho manual à toa. */}
                  <button
                    type="button"
                    className="botao-nu simulation-link-sinal"
                    onClick={() => onParametro('sinalEntrada', linha.sinal)}
                  >
                    {t(`signal_${linha.sinal}`)}
                  </button>
                </th>
                <td>{linha.metricas.tradesConcluidos}</td>
                <td className={classeSinal(linha.metricas.retornoTotal)}>{pct(linha.metricas.retornoTotal)}</td>
                <td className={classeSinal(linha.metricas.alfa)}>{pct(linha.metricas.alfa)}</td>
                {/* "Não operou" não é "rendeu zero": as colunas ficam vazias em
                    vez de fingir um resultado. */}
                <td className={classeSinal(linha.alfaAjuste)}>
                  {linha.alfaAjuste === null ? '—' : `${pct(linha.alfaAjuste)} (${linha.tradesAjuste})`}
                  {acimaDaSorte(linha) && (
                    <span
                      className="simulation-acima-sorte"
                      title={t('simulationRankingAboveLuck', { total: sorte.sinais })}
                      aria-label={t('simulationRankingAboveLuck', { total: sorte.sinais })}
                    >
                      {' '}▲
                    </span>
                  )}
                </td>
                {/* A validação é 20% da janela, então ela SEMPRE tem cerca de
                    um quinto das operações — e cai abaixo do mínimo conclusivo
                    com frequência mesmo quando a janela cheia passa longe dele.
                    Marcar a célula impede a coluna mais importante da tabela de
                    ser também a única cujo tamanho de amostra ninguém confere. */}
                <td
                  className={[
                    classeSinal(linha.alfaValidacao) || '',
                    validacaoCurta(linha) ? 'simulation-amostra-curta' : '',
                  ].filter(Boolean).join(' ') || undefined}
                  title={
                    validacaoCurta(linha)
                      ? t('simulationHoldoutSmall', { minimo: MINIMO_TRADES_CONCLUSIVO })
                      : undefined
                  }
                >
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
  )
}
