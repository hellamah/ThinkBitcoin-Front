import React from 'react'
import { Link } from 'react-router-dom'
import { MdArrowForward, MdPlayCircleOutline } from 'react-icons/md'

import { enderecoDaSimulacao } from '../../utils/parametrosSimulacao'

/**
 * Atalho para a simulação, no lugar onde o painel dela ficava.
 *
 * A simulação saiu do dashboard para uma tela própria, e quem a encontrava
 * rolando até aqui continua encontrando — agora sem pagar, a cada visita, os
 * 180 dias de candles e o worker que ela põe para rodar. Abre na moeda que está
 * selecionada aqui.
 *
 * @param {object} props
 * @param {string} props.sigla - A moeda selecionada no dashboard.
 * @param {Function} props.t
 */
export default function SimulacaoAtalho({ sigla, t }) {
  return (
    <section className="panel simulation-atalho">
      <div>
        <h2>
          <MdPlayCircleOutline style={{ verticalAlign: 'middle', marginRight: '10px' }} />
          {t('simulation')}
        </h2>
        <p className="correlation-hint">{t('simulationShortcutHint')}</p>
      </div>
      <Link className="simulation-atalho-link" to={enderecoDaSimulacao(sigla)}>
        {t('simulationShortcutOpen', { moeda: sigla })}
        <MdArrowForward aria-hidden="true" />
      </Link>
    </section>
  )
}
