import React from 'react'
import { MdScience, MdWarningAmber } from 'react-icons/md'
import * as mathUtils from '../../utils/mathUtils'

const HORIZONTES = [1, 3, 5]

// t() faz substituição literal de {{var}} e não tem regra de plural, então a
// escolha entre singular e plural é explícita aqui.
const rotuloHorizonte = (h, t) =>
  t(h === 1 ? 'signalHorizonOne' : 'signalHorizonMany', { count: h })

// Só colorimos delta de linha significante: pintar de verde um deslocamento
// que o intervalo não sustenta é dar destaque a ruído.
const classeDelta = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : undefined)

const sinal = (v) => (v > 0 ? '+' : '')

/**
 * Desfecho medido de cada sinal, sempre contra a taxa base do período.
 *
 * @param {object} props
 * @param {object} props.analise - Retorno de analisarSinais.
 * @param {number} props.horizonte - Candles à frente medidos.
 * @param {Function} props.setHorizonte - Troca o horizonte.
 * @param {Function} props.t - Função de tradução.
 */
export default function SignalLabPanel({ analise, horizonte, setHorizonte, t }) {
  if (!analise) return null

  const { base, sinais } = analise

  return (
    <section className="panel signal-lab-panel">
      <h2>
        <MdScience style={{ verticalAlign: 'middle', marginRight: '10px' }} />
        {t('signalLab')}
      </h2>

      <div className="signal-lab-controls">
        <span className="correlation-hint" style={{ margin: 0 }}>{t('signalLabHint')}</span>
        <div className="signal-lab-horizon">
          <span className="pill-group-label">{t('signalHorizon')}:</span>
          {HORIZONTES.map((h) => (
            <button
              key={h}
              onClick={() => setHorizonte(h)}
              className={`pill-toggle ${horizonte === h ? 'ativo' : ''}`}
            >
              {rotuloHorizonte(h, t)}
            </button>
          ))}
        </div>
      </div>

      <div className="correlation-scroll">
        <table className="signal-lab-table">
          <thead>
            <tr>
              <th scope="col">{t('signalName')}</th>
              <th scope="col">{t('signalCount')}</th>
              <th scope="col">{t('signalUpRate')}</th>
              <th scope="col">{t('signalInterval')}</th>
              <th scope="col">{t('signalVsBase')}</th>
              <th scope="col">{t('signalAvgReturn')}</th>
            </tr>
          </thead>
          <tbody>
            {/* A base vem primeiro e fica fixa: é a régua contra a qual todo o
                resto se lê. Sem ela, qualquer taxa parece boa. */}
            <tr className="signal-lab-base">
              <th scope="row">{t('signalBaseline')}</th>
              <td>{base.ocorrencias}</td>
              <td>{base.taxaAlta.toFixed(1)}%</td>
              <td>—</td>
              <td>—</td>
              <td>{mathUtils.formatPercent(base.retornoMedio)}</td>
            </tr>

            {sinais.map((s) => (
              // Sem significância a linha fica esmaecida: o número existe, mas
              // não se distingue da base com esta amostra.
              <tr key={s.chave} className={s.significante ? undefined : 'signal-lab-fraco'}>
                <th scope="row">
                  {t(`signal_${s.chave}`)}
                  {!s.significante && (
                    <MdWarningAmber
                      className="signal-lab-alerta"
                      title={t('signalNotSignificant')}
                    />
                  )}
                </th>
                <td>{s.ocorrencias}</td>
                <td>{s.taxaAlta.toFixed(1)}%</td>
                <td className="signal-lab-intervalo">
                  {s.intervalo
                    ? `${s.intervalo.inferior.toFixed(0)}–${s.intervalo.superior.toFixed(0)}%`
                    : '—'}
                </td>
                <td className={s.significante ? classeDelta(s.deltaTaxa) : undefined}>
                  {sinal(s.deltaTaxa)}{s.deltaTaxa.toFixed(1)} p.p.
                </td>
                <td className={s.significante ? classeDelta(s.retornoMedio) : undefined}>
                  {mathUtils.formatPercent(s.retornoMedio)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
