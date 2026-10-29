import React from 'react'
import { MdLeaderboard, MdWarningAmber } from 'react-icons/md'

import RotuloComAjuda from '../RotuloComAjuda'
import { MINIMO_TRADES_CONCLUSIVO } from '../../../utils/backtest'
import { impressaoDaConfiguracao } from '../../../utils/parametrosSimulacao'
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
 *
 * **Os números são todos do AJUSTE.** A tabela mostrava também a janela cheia,
 * e ela contém o trecho reservado: catorze regras com a validação embutida no
 * retorno, prontas para escolher olhando-a. A validação aparece só na linha
 * cuja regra já foi fixada — a regra da linha é a da tela com aquele sinal.
 * Sem trecho reservado (janela curta demais para cortar), a tabela mostra a
 * janela inteira, que é tudo o que existe.
 */
export default function RankingEstrategias({
  comparativo,
  sorte,
  calculando,
  parametros,
  onParametro,
  impressoesReveladas = null,
  t,
}) {
  if (!comparativo || comparativo.linhas.length < 2) {
    return <p className="simulation-vazio">{t('simulationNoTrades')}</p>
  }

  const temAjuste = comparativo.linhas.some((l) => l.tradesAjuste !== null)
  const numeros = (linha) =>
    temAjuste
      ? { trades: linha.tradesAjuste, retorno: linha.retornoAjuste, alfa: linha.alfaAjuste }
      : { trades: linha.metricas.tradesConcluidos, retorno: linha.metricas.retornoTotal, alfa: linha.metricas.alfa }
  // Sem o conjunto (quem usa o painel sem a tela que reserva a validação),
  // nada está guardado.
  const revelada = (linha) =>
    impressoesReveladas === null ||
    impressoesReveladas.has(impressaoDaConfiguracao({ ...parametros, sinalEntrada: linha.sinal }))

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
      {temAjuste && <p className="correlation-hint">{t('simulationRankingTuningOnly')}</p>}

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
              {/* A validação ao lado do ajuste é o par que mede degradação:
                  eles não se sobrepõem. Mas só nas regras já fixadas. */}
              {temAjuste && (
                <th scope="col">
                  <RotuloComAjuda texto={t('simulationValidation')} ajuda={t('ajuda.simHoldout')} />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {comparativo.linhas.map((linha) => {
              const n = numeros(linha)
              // "Não operou" não é "rendeu zero": as colunas ficam vazias em
              // vez de fingir um resultado.
              const operou = n.alfa !== null && n.alfa !== undefined
              return (
              <tr
                key={linha.sinal}
                className={[
                  (n.trades ?? 0) < MINIMO_TRADES_CONCLUSIVO ? 'signal-lab-fraco' : '',
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
                <td>{n.trades ?? '—'}</td>
                <td className={operou ? classeSinal(n.retorno) : undefined}>{operou ? pct(n.retorno) : '—'}</td>
                <td className={operou ? classeSinal(n.alfa) : undefined}>
                  {operou ? pct(n.alfa) : '—'}
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
                    com frequência mesmo quando o ajuste passa longe dele.
                    Marcar a célula impede a coluna mais importante da tabela de
                    ser também a única cujo tamanho de amostra ninguém confere. */}
                {temAjuste &&
                  (revelada(linha) ? (
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
                  ) : (
                    <td className="simulation-reservada">{t('simulationReservedValue')}</td>
                  ))}
              </tr>
              )
            })}
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
