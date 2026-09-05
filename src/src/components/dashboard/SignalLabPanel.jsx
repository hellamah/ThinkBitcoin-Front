import React from 'react'
import { MdScience, MdWarningAmber } from 'react-icons/md'
import * as mathUtils from '../../utils/mathUtils'
import RotuloComAjuda from './RotuloComAjuda'
import { CandlePattern } from '../../utils/candlePatterns'
import { SignalKey } from '../../utils/signalLab'
import { DivergenceKind } from '../../utils/flowDivergence'
import { VwapSignal } from '../../utils/vwap'
import { OscillatorSignal } from '../../utils/oscillators'
import { FRACAO_VALIDACAO_PADRAO } from '../../utils/validacaoJanela'

// Cada sinal da tabela aponta para a frase que explica o que ele é. Os nomes
// — martelo, marubozu, divergência — são justamente os termos mais opacos da
// tela para quem está começando.
const AJUDA_POR_SINAL = Object.freeze({
  [CandlePattern.MARTELO]: 'ajuda.sinalMartelo',
  [CandlePattern.ESTRELA]: 'ajuda.sinalEstrela',
  [CandlePattern.DOJI]: 'ajuda.sinalDoji',
  [CandlePattern.MARUBOZU]: 'ajuda.sinalMarubozu',
  [SignalKey.VOLUME_ATIPICO]: 'ajuda.sinalVolumeAtipico',
  [SignalKey.VARIACAO_ATIPICA]: 'ajuda.sinalVariacaoAtipica',
  [SignalKey.TICKET_ALTO]: 'ajuda.sinalTicketAlto',
  [DivergenceKind.BEARISH]: 'ajuda.sinalDivBaixista',
  [DivergenceKind.BULLISH]: 'ajuda.sinalDivAltista',
  [VwapSignal.CROSS_UP]: 'ajuda.sinalVwapCima',
  [VwapSignal.CROSS_DOWN]: 'ajuda.sinalVwapBaixo',
  [OscillatorSignal.RSI_OVERBOUGHT]: 'ajuda.sinalRsiSobrecompra',
  [OscillatorSignal.RSI_OVERSOLD]: 'ajuda.sinalRsiSobrevenda',
  [OscillatorSignal.BAND_BREAK_UP]: 'ajuda.sinalBandaSuperior',
  [OscillatorSignal.BAND_BREAK_DOWN]: 'ajuda.sinalBandaInferior',
})

const HORIZONTES = [1, 3, 5]

// t() faz substituição literal de {{var}} e não tem regra de plural, então a
// escolha entre singular e plural é explícita aqui.
const rotuloHorizonte = (h, t) =>
  t(h === 1 ? 'signalHorizonOne' : 'signalHorizonMany', { count: h })

// Só colorimos delta de linha significante: pintar de verde um deslocamento
// que o intervalo não sustenta é dar destaque a ruído.
const classeDelta = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : undefined)

const sinal = (v) => (v > 0 ? '+' : '')

// Deslocamento de um trecho, com o número de ocorrências entre parênteses —
// mesma forma das colunas de ajuste e validação do ranking da simulação, porque
// respondem à mesma pergunta. Traço quando o sinal não ocorreu ali: "não
// ocorreu" não é "ficou em zero".
const pontos = (trecho) =>
  trecho ? `${sinal(trecho.deltaTaxa)}${trecho.deltaTaxa.toFixed(1)} p.p. (${trecho.ocorrencias})` : '—'

// A base de cada trecho vai com o tamanho junto, no mesmo formato das linhas.
// É o número que dimensiona a coluna inteira: uma validação de 33 candles
// sustenta menos que um ajuste de 134, e sem isso à vista um "+62,5 p.p. (1)"
// se lê com a mesma força de um "+6,1 p.p. (22)".
const taxaDaBase = (trecho) =>
  trecho ? `${trecho.taxaAlta.toFixed(1)}% (${trecho.ocorrencias})` : '—'

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

  const { base, sinais, corte } = analise
  // As duas colunas só existem quando a janela deu para dividir. Numa janela
  // curta elas seriam uma parede de traços sugerindo dado faltando, quando o
  // que falta é período.
  const temCorte = corte !== null

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
              <th scope="col">
                <RotuloComAjuda texto={t('signalCount')} ajuda={t('ajuda.colOcorrencias')} />
              </th>
              <th scope="col">
                <RotuloComAjuda texto={t('signalUpRate')} ajuda={t('ajuda.colTaxaAlta')} />
              </th>
              <th scope="col">
                <RotuloComAjuda texto={t('signalInterval')} ajuda={t('ajuda.colIntervalo')} />
              </th>
              <th scope="col">
                <RotuloComAjuda texto={t('signalVsBase')} ajuda={t('ajuda.colVsBase')} />
              </th>
              <th scope="col">
                <RotuloComAjuda texto={t('signalAvgReturn')} ajuda={t('ajuda.colRetornoMedio')} />
              </th>
              {/* Ajuste e validação lado a lado. As duas não se sobrepõem,
                  enquanto a coluna "vs base" — medida na janela cheia, que
                  CONTÉM a validação — compara um número com um pedaço dele
                  mesmo. Os rótulos vêm das mesmas chaves da simulação de
                  propósito: é o mesmo corte, na mesma fração, e as duas telas
                  não podem chamá-lo de nomes diferentes. */}
              {temCorte && (
                <>
                  <th scope="col">
                    <RotuloComAjuda texto={t('simulationTuning')} ajuda={t('ajuda.colAjusteSinal')} />
                  </th>
                  <th scope="col">
                    <RotuloComAjuda
                      texto={t('simulationValidation')}
                      ajuda={t('ajuda.colValidacaoSinal')}
                    />
                  </th>
                </>
              )}
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
              {/* Na linha da base o que interessa é a TAXA de cada trecho, não
                  um deslocamento: é contra estes dois números que os deltas das
                  linhas abaixo se leem, e eles costumam ser bem diferentes
                  entre si. Sem exibi-los, um martelo com +30 p.p. no ajuste e
                  −20 p.p. na validação pareceria contradição em vez do que é:
                  duas réguas distintas. */}
              {temCorte && (
                <>
                  <td>{taxaDaBase(corte.baseAjuste)}</td>
                  <td>{taxaDaBase(corte.baseValidacao)}</td>
                </>
              )}
            </tr>

            {sinais.map((s) => (
              // Sem significância a linha fica esmaecida: o número existe, mas
              // não se distingue da base com esta amostra.
              <tr key={s.chave} className={s.significante ? undefined : 'signal-lab-fraco'}>
                <th scope="row">
                  <RotuloComAjuda
                    texto={t(`signal_${s.chave}`)}
                    ajuda={AJUDA_POR_SINAL[s.chave] ? t(AJUDA_POR_SINAL[s.chave]) : undefined}
                  />
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
                {/* Estas duas são coloridas sempre, e não só quando a linha é
                    significante: a significância foi apurada na janela cheia,
                    que é justamente a medida que estas colunas existem para
                    conferir. Condicioná-las a ela esconderia a inversão nos
                    casos em que ela mais importa. */}
                {temCorte && (
                  <>
                    <td className={s.ajuste ? classeDelta(s.ajuste.deltaTaxa) : undefined}>
                      {pontos(s.ajuste)}
                    </td>
                    <td className={s.validacao ? classeDelta(s.validacao.deltaTaxa) : undefined}>
                      {pontos(s.validacao)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mesma classe do aviso de sobreajuste da simulação: é o mesmo aviso, e
          o painel de lá já empresta a `signal-lab-table` daqui. */}
      {temCorte && (
        <p className="simulation-alerta-sobreajuste">
          <MdWarningAmber />
          <span>
            {t('signalLabHoldoutWarning', {
              total: sinais.length,
              fracao: Math.round(FRACAO_VALIDACAO_PADRAO * 100),
            })}
          </span>
        </p>
      )}
    </section>
  )
}
