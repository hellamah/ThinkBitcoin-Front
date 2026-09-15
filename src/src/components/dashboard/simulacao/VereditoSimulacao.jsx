import React, { useState } from 'react'
import {
  MdCheckCircleOutline,
  MdErrorOutline,
  MdExpandLess,
  MdExpandMore,
  MdHighlightOff,
  MdWarningAmber,
} from 'react-icons/md'

import RotuloComAjuda from '../RotuloComAjuda'
import * as mathUtils from '../../../utils/mathUtils'
import { TomVeredito } from './veredito'
import { classeSinal, pct } from './formatacao'

const ICONE_DO_TOM = {
  [TomVeredito.BOM]: MdCheckCircleOutline,
  [TomVeredito.ALERTA]: MdErrorOutline,
  [TomVeredito.RUIM]: MdHighlightOff,
}

/**
 * A resposta principal: o retorno em destaque e, ao lado, a leitura em uma
 * frase.
 *
 * O retorno nunca aparece sozinho. O buy & hold vem na mesma linha — um
 * retorno de 12% não significa nada sem saber que segurar rendeu 15% —, e o
 * custo total também: é o número que transforma "rendeu 3%" em "rendeu 3% e
 * pagou 4% de taxa". Os dois eram cards de primeira linha; continuam na
 * primeira linha, só que junto do número que qualificam.
 *
 * As ressalvas (janela curta, buracos na coleta, validação com poucas
 * operações) ficam contadas no veredito e abrem numa lista. Antes eram avisos
 * empilhados acima do resultado, e empurravam a resposta para baixo da tela.
 */
export default function VereditoSimulacao({ metricas, veredito, ressalvas, fraco, desatualizado, t }) {
  const [ressalvasAbertas, setRessalvasAbertas] = useState(false)
  const Icone = ICONE_DO_TOM[veredito.tom] ?? MdErrorOutline

  return (
    <div className="simulation-heroi">
      <div className={`simulation-heroi-numero ${fraco ? 'simulation-fraco' : ''}`}>
        <span className="intel-label">{t('simulationReturnLabel')}</span>
        <span className={`simulation-heroi-valor ${classeSinal(metricas.retornoTotal) || ''}`}>
          {pct(metricas.retornoTotal)}
        </span>
        <div className="simulation-heroi-comparacao">
          <span>
            <RotuloComAjuda texto={t('simulationBuyHold')} ajuda={t('ajuda.simBuyHold')} />{' '}
            <strong className={classeSinal(metricas.buyAndHold)}>{pct(metricas.buyAndHold)}</strong>
          </span>
          <span>
            {t('simulationAlpha')}{' '}
            <strong className={classeSinal(metricas.alfa)}>{pct(metricas.alfa)}</strong>
          </span>
          <span>
            <RotuloComAjuda texto={t('simulationTotalCost')} ajuda={t('ajuda.simCustoTotal')} />{' '}
            <strong className="down">{mathUtils.formatCurrency(metricas.custoTotal)}</strong>
          </span>
        </div>
      </div>

      <section
        className={[
          'simulation-veredito-caixa',
          `simulation-veredito-${veredito.tom}`,
          desatualizado ? 'simulation-desatualizado' : '',
        ].filter(Boolean).join(' ')}
        aria-label={t('simulationVerdict')}
      >
        <div className="simulation-veredito-titulo">
          <Icone aria-hidden="true" />
          {t(veredito.titulo.chave, veredito.titulo.valores)}
        </div>
        <p className="simulation-veredito-texto">
          {veredito.frases.map((f) => t(f.chave, f.valores)).join(' ')}
        </p>

        {ressalvas.length > 0 && (
          <div className="simulation-ressalvas">
            <button
              type="button"
              className="botao-nu simulation-ressalvas-botao"
              aria-expanded={ressalvasAbertas}
              onClick={() => setRessalvasAbertas((atual) => !atual)}
            >
              <MdWarningAmber aria-hidden="true" />
              {t('simulationCaveats', { count: ressalvas.length })}
              {ressalvasAbertas ? <MdExpandLess aria-hidden="true" /> : <MdExpandMore aria-hidden="true" />}
            </button>
            {ressalvasAbertas && (
              <ul>
                {ressalvas.map((r) => (
                  <li key={r.chave}>{t(r.chave, r.valores)}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
