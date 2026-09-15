import React from 'react'

import RotuloComAjuda from '../RotuloComAjuda'
import { vizinhancaDe } from '../../../utils/sensibilidade'
import { StopMode } from '../../../utils/enums'
import { pct } from './formatacao'

// Intensidade máxima do fundo de uma célula, em %. Acima disso o número em cima
// deixa de ser legível nos dois temas.
const INTENSIDADE_MAXIMA = 55

/**
 * A mesma entrada sob uma grade de stops e alvos, no trecho de ajuste.
 *
 * Cada célula é clicável e aplica aquele stop e aquele alvo. A validação não
 * aparece aqui de propósito — ver utils/sensibilidade.js: escolhe-se no
 * ajuste, e a tabela de validação continua sendo o único lugar que julga.
 */
export default function MapaSensibilidade({ mapa, calculando, parametros, onParametro, t }) {
  if (!mapa) {
    return (
      <p className="simulation-vazio">
        {calculando ? t('simulationCalculating') : t('simulationTooShort')}
      </p>
    )
  }

  const noModoFixo = parametros.modoStop === StopMode.PERCENTUAL
  const maiorAbsoluto = Math.max(
    ...mapa.celulas.flat().map((c) => (c.alfa === null ? 0 : Math.abs(c.alfa))),
    1e-9
  )
  const vizinhanca = noModoFixo
    ? vizinhancaDe(mapa, parametros.stopPercentual, parametros.alvoPercentual)
    : null

  const rotuloStop = (v) => (v === null ? t('simulationNoStop') : pct(v, 0, false))
  const rotuloAlvo = (v) => (v === null ? t('simulationNoTarget') : pct(v, 0, false))

  const fundo = (alfa) => {
    if (alfa === null) return undefined
    const intensidade = Math.round((Math.abs(alfa) / maiorAbsoluto) * INTENSIDADE_MAXIMA)
    const token = alfa >= 0 ? '--success' : '--danger'
    return `color-mix(in srgb, var(${token}) ${intensidade}%, transparent)`
  }

  const aplicar = (stop, alvo) => {
    if (!noModoFixo) onParametro('modoStop', StopMode.PERCENTUAL)
    onParametro('stopPercentual', stop)
    onParametro('alvoPercentual', alvo)
  }

  return (
    <div className={`simulation-mapa ${calculando ? 'simulation-desatualizado' : ''}`}>
      <h3>
        <RotuloComAjuda texto={t('simulationSensitivity')} ajuda={t('ajuda.simSensibilidade')} />
      </h3>
      <p className="correlation-hint">{t('simulationSensitivityHint')}</p>
      {!noModoFixo && <p className="simulation-regra-saida">{t('simulationSensitivityAtr')}</p>}

      <div className="correlation-scroll">
        <table className="simulation-mapa-tabela">
          <thead>
            <tr>
              <th scope="col" className="simulation-mapa-canto">{t('simulationSensitivityAxes')}</th>
              {mapa.alvos.map((alvo) => (
                <th key={String(alvo)} scope="col">{rotuloAlvo(alvo)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mapa.celulas.map((linha, i) => (
              <tr key={String(mapa.stops[i])}>
                <th scope="row">{rotuloStop(mapa.stops[i])}</th>
                {linha.map((c) => {
                  const atual =
                    noModoFixo &&
                    c.stop === parametros.stopPercentual &&
                    c.alvo === parametros.alvoPercentual
                  return (
                    <td key={String(c.alvo)}>
                      <button
                        type="button"
                        className={`botao-nu simulation-mapa-celula ${atual ? 'simulation-mapa-atual' : ''}`}
                        style={{ background: fundo(c.alfa) }}
                        disabled={c.alfa === null}
                        aria-label={t('simulationSensitivityCell', {
                          stop: rotuloStop(c.stop),
                          alvo: rotuloAlvo(c.alvo),
                          alfa: pct(c.alfa),
                          trades: c.operacoes ?? 0,
                        })}
                        title={c.alfa === null ? undefined : t('simulationTrades') + `: ${c.operacoes}`}
                        onClick={() => aplicar(c.stop, c.alvo)}
                      >
                        {pct(c.alfa, 1)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {vizinhanca && vizinhanca.total > 0 && (
        <p className="simulation-regra-saida">
          {t('simulationSensitivityNeighbors', vizinhanca)}
        </p>
      )}
    </div>
  )
}
