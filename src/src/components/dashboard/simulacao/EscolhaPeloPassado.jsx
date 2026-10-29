import React from 'react'
import { MdHistory } from 'react-icons/md'

import RotuloComAjuda from '../RotuloComAjuda'
import useSerieLonga from '../../../hooks/useSerieLonga'
import useEscolhaPeloPassado from '../../../hooks/useEscolhaPeloPassado'
import { DIAS_SERIE_LONGA } from '../../../utils/simulationWindow'
import { MINIMO_PERIODOS } from '../../../utils/escolhaPeloPassado'
import { classeSinal, pct, resumoDaRegra } from './formatacao'

/**
 * "Escolher pelo passado funciona?" — o walk-forward do procedimento do
 * ranking, com o controle que não olha resultado (ver utils/escolhaPeloPassado).
 *
 * O ranking responde "qual sinal foi melhor nesta janela"; esta aba responde a
 * pergunta de quem vai usar a resposta: "e se eu escolhesse sempre assim, mês
 * após mês?". A comparação que decide não é com a média dos sinais, e sim com
 * o controle — escolher o que menos operou, sem olhar resultado.
 *
 * Busca a própria série, de dois anos, e só quando a aba abre: é ela que
 * carrega os ~15 MB, não a tela.
 */
export default function EscolhaPeloPassado({ descritor, parametros, t, locale }) {
  const { token, sigla, regra, ate } = descritor
  const serieLonga = useSerieLonga({ token, sigla, ativo: true })
  const { resultado, calculando, feitos, total } = useEscolhaPeloPassado({
    registros: serieLonga.registros,
    aPartirDe: serieLonga.aPartirDe,
    ate,
    regra,
  })

  const data = (iso) =>
    new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
      new Date(iso)
    )
  const posicao = (v) =>
    v === null || v === undefined
      ? '—'
      : new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

  const cabecalho = (
    <>
      <h3>
        <MdHistory style={{ verticalAlign: 'middle', marginRight: '8px' }} />
        <RotuloComAjuda texto={t('simulationPast')} ajuda={t('ajuda.simPassado')} />
      </h3>
      <p className="correlation-hint">
        {t('simulationPastHint', { treino: resultado?.diasTreino ?? 90, teste: resultado?.diasTeste ?? 30 })}
      </p>
      {/* A regra de saída sob a qual os períodos foram operados: o resultado é
          inteiramente condicional a ela, como a ordem do ranking. */}
      <p className="simulation-regra-saida">{resumoDaRegra(parametros, t)}</p>
    </>
  )

  if (serieLonga.erro) {
    return (
      <div className="simulation-passado">
        {cabecalho}
        <p className="simulation-vazio">{t('simulationPastLoadError')}</p>
      </div>
    )
  }

  if (serieLonga.carregando || !serieLonga.registros) {
    return (
      <div className="simulation-passado">
        {cabecalho}
        <p className="simulation-vazio">{t('simulationPastLoading', { dias: DIAS_SERIE_LONGA })}</p>
      </div>
    )
  }

  if (calculando || !resultado) {
    return (
      <div className="simulation-passado">
        {cabecalho}
        <p className="simulation-vazio">
          {total > 0 ? t('simulationPastCalculating', { feitos, total }) : t('simulationCalculating')}
        </p>
      </div>
    )
  }

  if (!resultado.suficiente) {
    return (
      <div className="simulation-passado">
        {cabecalho}
        <p className="simulation-vazio">
          {t('simulationPastShort', { count: resultado.periodos.length, minimo: MINIMO_PERIODOS })}
        </p>
      </div>
    )
  }

  const { escolhido, controle, buyAndHold, periodos } = resultado
  // Superar exige as duas leituras: o retorno composto, que um período
  // extremo pode decidir sozinho, e a posição média, que conta todos iguais.
  const superou =
    escolhido.retorno > controle.retorno && (escolhido.posicaoMedia ?? 0) > (controle.posicaoMedia ?? 0)

  return (
    <div className="simulation-passado">
      {cabecalho}

      <div className="intelligence-grid simulation-essenciais">
        <div className="intel-card">
          <span className="intel-label">{t('simulationPastChosen')}</span>
          <div className={`intel-value ${classeSinal(escolhido.retorno) || ''}`}>{pct(escolhido.retorno)}</div>
          <div className="intel-subvalue" style={{ opacity: 0.7 }}>
            {t('simulationPastTrades', { count: escolhido.operacoes })}
          </div>
          <div className="intel-subvalue" style={{ opacity: 0.7 }}>
            {t('simulationPastPosition', { valor: posicao(escolhido.posicaoMedia) })}
          </div>
        </div>
        <div className="intel-card">
          <span className="intel-label">{t('simulationPastControl')}</span>
          <div className={`intel-value ${classeSinal(controle.retorno) || ''}`}>{pct(controle.retorno)}</div>
          <div className="intel-subvalue" style={{ opacity: 0.7 }}>
            {t('simulationPastTrades', { count: controle.operacoes })}
          </div>
          <div className="intel-subvalue" style={{ opacity: 0.7 }}>
            {t('simulationPastPosition', { valor: posicao(controle.posicaoMedia) })}
          </div>
        </div>
        <div className="intel-card">
          <span className="intel-label">{t('simulationBuyHold')}</span>
          <div className={`intel-value ${classeSinal(buyAndHold) || ''}`}>{pct(buyAndHold)}</div>
          <div className="intel-subvalue" style={{ opacity: 0.7 }}>
            {t('simulationPastPeriods', { count: periodos.length })}
          </div>
        </div>
      </div>

      <p className={`simulation-passado-leitura ${superou ? 'up' : 'down'}`}>
        {t(superou ? 'simulationPastWorks' : 'simulationPastFails')}
      </p>
      <p className="correlation-hint">{t('simulationPastPositionScale')}</p>

      <div className="correlation-scroll">
        <table className="signal-lab-table">
          <thead>
            <tr>
              <th scope="col">{t('simulationPastPeriod')}</th>
              <th scope="col">{t('simulationPastChosen')}</th>
              <th scope="col">{t('simulationReturn')}</th>
              <th scope="col">{t('simulationPastControl')}</th>
              <th scope="col">{t('simulationReturn')}</th>
              <th scope="col">{t('simulationBuyHold')}</th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.inicio}>
                <th scope="row">{data(p.inicio)}</th>
                <td>{p.escolhido ? t(`signal_${p.escolhido.sinal}`) : '—'}</td>
                <td className={classeSinal(p.escolhido?.retorno)}>{p.escolhido ? pct(p.escolhido.retorno) : '—'}</td>
                <td>{p.controle ? t(`signal_${p.controle.sinal}`) : '—'}</td>
                <td className={classeSinal(p.controle?.retorno)}>{p.controle ? pct(p.controle.retorno) : '—'}</td>
                <td className={classeSinal(p.buyAndHold)}>{pct(p.buyAndHold)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Os períodos param antes do trecho reservado: mostrar como o
          procedimento se saiu nele seria mostrar a validação por outro
          caminho (13.5). */}
      {ate && <p className="correlation-hint">{t('simulationPastUntil', { data: data(ate) })}</p>}
    </div>
  )
}
