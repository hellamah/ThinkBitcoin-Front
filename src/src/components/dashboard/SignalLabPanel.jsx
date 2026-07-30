import React from 'react'
import { MdScience, MdWarningAmber } from 'react-icons/md'
import * as mathUtils from '../../utils/mathUtils'

const HORIZONTES = [1, 3, 5]

const estiloHorizonte = (ativo) => ({
  padding: '3px 10px',
  fontSize: '0.75rem',
  borderRadius: '20px',
  border: ativo ? '1px solid #FFD700' : '1px solid #444',
  background: ativo ? 'rgba(255,215,0,0.12)' : 'transparent',
  color: ativo ? 'var(--accent-ink)' : 'var(--text-muted)',
  cursor: 'pointer',
  fontWeight: ativo ? 600 : 400,
})

// O delta é a única coluna que responde "esse sinal serve para alguma coisa?".
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
          <span>{t('signalHorizon')}:</span>
          {HORIZONTES.map((h) => (
            <button key={h} onClick={() => setHorizonte(h)} style={estiloHorizonte(horizonte === h)}>
              {t('signalHorizonUnit', { count: h })}
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
              <td>{mathUtils.formatPercent(base.retornoMedio)}</td>
            </tr>

            {sinais.map((s) => (
              <tr key={s.chave} className={s.confiavel ? undefined : 'signal-lab-fraco'}>
                <th scope="row">
                  {t(`signal_${s.chave}`)}
                  {!s.confiavel && (
                    <MdWarningAmber
                      className="signal-lab-alerta"
                      title={t('signalLowSample')}
                    />
                  )}
                </th>
                <td>{s.ocorrencias}</td>
                <td>{s.taxaAlta.toFixed(1)}%</td>
                <td className={classeDelta(s.deltaTaxa)}>
                  {sinal(s.deltaTaxa)}{s.deltaTaxa.toFixed(1)} p.p.
                </td>
                <td className={classeDelta(s.retornoMedio)}>
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
