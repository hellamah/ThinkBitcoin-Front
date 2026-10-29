import React from 'react'

import RotuloComAjuda from '../RotuloComAjuda'
import { MAX_DIARIO } from '../../../utils/experimentos'
import { toLocalChartLabel } from '../../../utils/dateUtils'
import { classeSinal, pct, resumoDaRegra } from './formatacao'

/**
 * Configurações guardadas, para comparar lado a lado.
 *
 * Quem testa uma regra testa várias, e sem um lugar para anotá-las a
 * comparação fica na memória — que guarda o melhor número visto e esquece
 * sob que regra ele saiu. Aqui cada linha traz a regra inteira, o resultado
 * e a validação daquele momento.
 *
 * O diário não conta como tentativa nem desconta: a contagem vive à parte, e
 * restaurar uma configuração já testada não a conta de novo.
 */
export default function DiarioExperimentos({ diario, podeGuardar, onRestaurar, t, locale }) {
  const { entradas, cheio, impressaoAtual, onGuardar, onRemover } = diario

  return (
    <div className="simulation-diario">
      <h3>
        <RotuloComAjuda texto={t('simulationJournal')} ajuda={t('ajuda.simDiario')} />
      </h3>
      <p className="correlation-hint">{t('simulationJournalHint')}</p>

      <div className="simulation-diario-acoes">
        <button type="button" className="pill-toggle ativo" onClick={onGuardar} disabled={!podeGuardar}>
          {t('simulationJournalSave')}
        </button>
        {cheio && (
          <span className="simulation-regra-saida">{t('simulationJournalFull', { max: MAX_DIARIO })}</span>
        )}
      </div>

      {entradas.length === 0 ? (
        <p className="simulation-vazio">{t('simulationJournalEmpty')}</p>
      ) : (
        <div className="correlation-scroll">
          <table className="signal-lab-table">
            <thead>
              <tr>
                <th scope="col">{t('simulationJournalRule')}</th>
                <th scope="col">{t('simulationReturn')}</th>
                <th scope="col">{t('simulationAlpha')}</th>
                <th scope="col">{t('simulationValidation')}</th>
                <th scope="col">{t('simulationChance')}</th>
                <th scope="col">{t('simulationTrades')}</th>
                <th scope="col">{t('simulationJournalSaved')}</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {[...entradas].reverse().map((e) => {
                const r = e.resumo ?? {}
                return (
                  <tr
                    key={e.id}
                    className={e.impressao === impressaoAtual ? 'simulation-linha-ativa' : undefined}
                  >
                    <td className="simulation-diario-regra">{resumoDaRegra(e.parametros, t, { comEntrada: true })}</td>
                    <td className={classeSinal(r.retornoTotal)}>{pct(r.retornoTotal)}</td>
                    <td className={classeSinal(r.alfa)}>{pct(r.alfa)}</td>
                    <td className={classeSinal(r.alfaValidacao)}>{pct(r.alfaValidacao)}</td>
                    <td>{Number.isFinite(r.percentilAcaso) ? `${Math.round(r.percentilAcaso)}%` : '—'}</td>
                    <td>{r.tradesConcluidos ?? '—'}</td>
                    <td>{toLocalChartLabel(e.criadoEm, locale)}</td>
                    <td className="simulation-diario-botoes">
                      <button
                        type="button"
                        className="botao-nu simulation-link-sinal"
                        onClick={() => onRestaurar(e.parametros)}
                      >
                        {t('simulationJournalRestore')}
                      </button>
                      <button
                        type="button"
                        className="botao-nu simulation-botao-texto"
                        onClick={() => onRemover(e.id)}
                      >
                        {t('simulationJournalRemove')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
