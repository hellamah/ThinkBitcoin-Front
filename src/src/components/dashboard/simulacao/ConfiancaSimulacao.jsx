import React, { useState } from 'react'
import { MdExpandLess, MdExpandMore, MdShield } from 'react-icons/md'

import RotuloComAjuda from '../RotuloComAjuda'
import * as mathUtils from '../../../utils/mathUtils'
import { EquilibrioCusto, MELHORES_A_RETIRAR } from '../../../utils/robustez'
import DistanciaDoPico from './DistanciaDoPico'
import ValidacaoForaDaAmostra from './ValidacaoForaDaAmostra'
import { classeSinal, formatarLimiar, pct } from './formatacao'

const Par = ({ rotulo, ajuda, valor, classe, nota, children }) => (
  <div className="simulation-par">
    <RotuloComAjuda className="simulation-par-rotulo" texto={rotulo} ajuda={ajuda} />
    <span className={`simulation-par-valor ${classe || ''}`}>{valor}</span>
    {nota && <span className="simulation-par-nota">{nota}</span>}
    {children}
  </div>
)

/**
 * "Dá para confiar?" — o segundo nível do painel.
 *
 * Tudo que julga o resultado sem ser a resposta principal: se ele resiste a
 * outra amostra, a três operações a menos, a uma taxa maior e ao número de
 * configurações já testadas; quanto risco e custo ele carregou; como ficou
 * abaixo do pico; e a tabela de validação completa.
 *
 * Começa fechado, e fechado ainda mostra o intervalo do retorno: é a leitura
 * que mais muda a interpretação do número em destaque, e quem não abrir nada
 * ainda sai sabendo se ele se distingue de zero. Os onze cards de antes viram
 * pares compactos agrupados pela pergunta que respondem — o número continua
 * lá, sem disputar a atenção com a resposta.
 */
export default function ConfiancaSimulacao({
  resultado,
  analises,
  ajuste,
  validacao,
  experimentos,
  cores,
  t,
  locale,
}) {
  const [aberto, setAberto] = useState(false)
  const m = resultado.metricas
  const { bootstrap, semMelhores, equilibrio, submersa } = analises ?? {}

  const valorEquilibrio = () => {
    if (!equilibrio) return '—'
    if (equilibrio.situacao === EquilibrioCusto.NUNCA) return t('simulationBreakEvenNever')
    if (equilibrio.situacao === EquilibrioCusto.ACIMA) {
      return t('simulationBreakEvenAbove', { valor: pct(equilibrio.custo, 0, false) })
    }
    return pct(equilibrio.custo, 3, false)
  }

  const intervalo = bootstrap
    ? t('simulationCiRange', { inferior: pct(bootstrap.inferior, 1), superior: pct(bootstrap.superior, 1) })
    : '—'

  return (
    <div className="simulation-confianca">
      <button
        type="button"
        className="botao-nu simulation-confianca-botao"
        aria-expanded={aberto}
        aria-controls="simulacao-confianca-conteudo"
        onClick={() => setAberto((atual) => !atual)}
      >
        <span className="simulation-confianca-titulo">
          <MdShield aria-hidden="true" />
          {t('simulationTrust')}
        </span>
        <span className="simulation-confianca-resumo">
          {bootstrap && t('simulationCiShort', {
            inferior: pct(bootstrap.inferior, 1),
            superior: pct(bootstrap.superior, 1),
          })}
          {aberto ? <MdExpandLess aria-hidden="true" /> : <MdExpandMore aria-hidden="true" />}
        </span>
        {!aberto && <span className="simulation-confianca-dica">{t('simulationTrustHint')}</span>}
      </button>

      {aberto && (
        <div id="simulacao-confianca-conteudo" className="simulation-confianca-conteudo">
          <div>
            <h4 className="simulation-subtitulo">{t('simulationTrustPush')}</h4>
            <div className="simulation-pares">
              <Par
                rotulo={t('simulationCi')}
                ajuda={t('ajuda.simIc')}
                valor={intervalo}
                nota={bootstrap ? t('simulationCiSub', { prob: Math.round(bootstrap.probabilidadePositivo) }) : null}
              />
              <Par
                rotulo={t('simulationWithoutBest', { count: MELHORES_A_RETIRAR })}
                ajuda={t('ajuda.simSemMelhores')}
                valor={semMelhores ? pct(semMelhores.retorno) : '—'}
                classe={semMelhores ? classeSinal(semMelhores.retorno) : ''}
                nota={t('simulationWithoutBestSub', { retorno: pct(m.retornoTotal) })}
              />
              <Par
                rotulo={t('simulationBreakEven')}
                ajuda={t('ajuda.simEquilibrio')}
                valor={valorEquilibrio()}
                nota={t('simulationBreakEvenSub', { atual: pct(resultado.parametros.custoPercentual, 2, false) })}
              />
              <Par
                rotulo={t('simulationAttempts')}
                ajuda={t('ajuda.simTentativas')}
                valor={experimentos.tentativas}
                nota={t('simulationAttemptsSub', { limiar: formatarLimiar(experimentos.limiar) })}
              >
                <button type="button" className="botao-nu simulation-botao-texto" onClick={experimentos.onZerar}>
                  {t('simulationAttemptsReset')}
                </button>
              </Par>
            </div>
          </div>

          <div>
            <h4 className="simulation-subtitulo">{t('simulationTrustRisk')}</h4>
            <div className="simulation-pares">
              <Par
                rotulo={t('simulationDrawdown')}
                ajuda={t('ajuda.simDrawdown')}
                valor={pct(m.drawdownMaximo, 2, false)}
                classe="down"
              />
              <Par
                rotulo={t('simulationSharpe')}
                ajuda={t('ajuda.simSharpe')}
                valor={m.sharpe === null ? '—' : m.sharpe.toFixed(2)}
                classe={classeSinal(m.sharpe)}
              />
              <Par
                rotulo={t('simulationVolatility')}
                valor={m.volatilidade === null ? '—' : mathUtils.formatPercent(m.volatilidade, 1, false)}
              />
              <Par
                rotulo={t('simulationProfitFactor')}
                valor={m.profitFactor === null ? '—' : m.profitFactor.toFixed(2)}
              />
              <Par
                rotulo={t('simulationTotalCost')}
                ajuda={t('ajuda.simCustoTotal')}
                valor={mathUtils.formatCurrency(m.custoTotal)}
                classe="down"
              />
              <Par rotulo={t('simulationExposure')} valor={`${m.exposicao.toFixed(0)}%`} />
            </div>
          </div>

          <DistanciaDoPico curva={resultado.curva} submersa={submersa} cores={cores} t={t} locale={locale} />

          <ValidacaoForaDaAmostra ajuste={ajuste} validacao={validacao} t={t} />
        </div>
      )}
    </div>
  )
}
