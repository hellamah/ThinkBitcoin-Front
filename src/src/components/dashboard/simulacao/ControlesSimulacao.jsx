import React, { useState } from 'react'
import { MdExpandLess, MdExpandMore, MdTune } from 'react-icons/md'

import RotuloComAjuda from '../RotuloComAjuda'
import { HORIZONTES_SIMULACAO } from '../../../utils/parametrosSimulacao'
import { StopMode, TradeDirection, TrendFilter } from '../../../utils/enums'
import { pct, rotuloHorizonte, rotuloTendencia, semUnidade } from './formatacao'

const numeroOuNulo = (texto) => (texto === '' ? null : Number(texto))

const Pilulas = ({ opcoes, valor, onEscolher, rotulo }) => (
  <div className="simulation-pills" role="group" aria-label={rotulo}>
    {opcoes.map(([v, texto]) => (
      <button
        key={String(v)}
        type="button"
        className={`pill-toggle ${valor === v ? 'ativo' : ''}`}
        aria-pressed={valor === v}
        onClick={() => onEscolher(v)}
      >
        {texto}
      </button>
    ))}
  </div>
)

/**
 * Controles da simulação, em dois níveis.
 *
 * Os cinco que definem uma regra — sinal, direção, quanto segurar, stop e alvo
 * — ficam sempre à vista. Os outros cinco (tendência, confirmação, saída por
 * sinal, custo e risco) refinam uma regra que já existe, e ficam atrás de "Mais
 * regras". Onze controles numa fila faziam a pergunta simples ("e se eu
 * operasse este sinal?") parecer um formulário.
 *
 * Fechado, o botão diz o que está lá dentro e em que estado: o custo sempre, e
 * cada regra avançada ligada. Uma regra que muda o resultado não pode ficar
 * escondida sem aviso — por isso o bloco também abre sozinho quando a
 * configuração chega com alguma delas ligada (pela URL ou pelo diário).
 */
export default function ControlesSimulacao({ parametros: p, onParametro, sinaisDisponiveis, t }) {
  const avancadasAtivas = [
    p.filtroTendencia ? rotuloTendencia(p.filtroTendencia, t) : null,
    p.sinalConfirmacao ? `${t('simulationConfirm')}: ${t(`signal_${p.sinalConfirmacao}`)}` : null,
    p.sinalSaida ? `${t('simulationExitSignal')}: ${t(`signal_${p.sinalSaida}`)}` : null,
    p.riscoPorOperacao ? `${semUnidade(t, 'simulationRisk')}: ${pct(p.riscoPorOperacao, 2, false)}` : null,
  ].filter(Boolean)

  const [aberto, setAberto] = useState(avancadasAtivas.length > 0)

  // O dimensionamento divide o risco pela distância do stop. Sem stop não há
  // distância, e o campo fica desligado em vez de aceitar um número que o motor
  // ignoraria em silêncio.
  const temStop = p.modoStop !== StopMode.PERCENTUAL || (p.stopPercentual ?? 0) > 0

  const seletorDeSinal = (campo, rotuloVazio) => (
    <select
      value={p[campo] ?? ''}
      onChange={(e) => onParametro(campo, e.target.value === '' ? null : e.target.value)}
    >
      {rotuloVazio !== null && <option value="">{rotuloVazio}</option>}
      {sinaisDisponiveis.map((chave) => (
        <option key={chave} value={chave}>{t(`signal_${chave}`)}</option>
      ))}
    </select>
  )

  return (
    <div className="simulation-controles">
      <div className="simulation-controles-basicos">
        <label className="simulation-campo">
          <span className="pill-group-label">{t('simulationSignal')}</span>
          {seletorDeSinal('sinalEntrada', null)}
        </label>

        <div className="simulation-campo">
          <span className="pill-group-label">{t('simulationDirection')}</span>
          <Pilulas
            rotulo={t('simulationDirection')}
            valor={p.direcao}
            onEscolher={(v) => onParametro('direcao', v)}
            opcoes={[
              [TradeDirection.COMPRA, t('simulationLong')],
              [TradeDirection.VENDA, t('simulationShort')],
            ]}
          />
        </div>

        <div className="simulation-campo">
          <span className="pill-group-label">{t('simulationHold')}</span>
          <Pilulas
            rotulo={t('simulationHold')}
            valor={p.saidaPorTempo}
            onEscolher={(v) => onParametro('saidaPorTempo', v)}
            opcoes={[...HORIZONTES_SIMULACAO, null].map((n) => [n, rotuloHorizonte(n, t)])}
          />
        </div>

        <div className="simulation-campo">
          <RotuloComAjuda className="pill-group-label" texto={t('simulationStopMode')} ajuda={t('ajuda.simStopAtr')} />
          <Pilulas
            rotulo={t('simulationStopMode')}
            valor={p.modoStop}
            onEscolher={(v) => onParametro('modoStop', v)}
            opcoes={[
              [StopMode.PERCENTUAL, t('simulationStopFixed')],
              [StopMode.ATR, t('simulationStopAtr')],
              [StopMode.ATR_MOVEL, t('simulationStopTrailing')],
            ]}
          />
        </div>

        {/* O campo de distância só existe no modo percentual. Nos modos por
            ATR a distância é calculada por entrada, e deixar um campo editável
            ali faria parecer que ele ainda manda em alguma coisa. */}
        {p.modoStop === StopMode.PERCENTUAL && (
          <label className="simulation-campo simulation-campo-num">
            <RotuloComAjuda className="pill-group-label" texto={t('simulationStop')} ajuda={t('ajuda.simStop')} />
            <input
              type="number" min="0" step="0.5" placeholder="—"
              value={p.stopPercentual ?? ''}
              onChange={(e) => onParametro('stopPercentual', numeroOuNulo(e.target.value))}
            />
          </label>
        )}

        <label className="simulation-campo simulation-campo-num">
          <RotuloComAjuda className="pill-group-label" texto={t('simulationTarget')} ajuda={t('ajuda.simAlvo')} />
          <input
            type="number" min="0" step="0.5" placeholder="—"
            value={p.alvoPercentual ?? ''}
            onChange={(e) => onParametro('alvoPercentual', numeroOuNulo(e.target.value))}
          />
        </label>
      </div>

      <button
        type="button"
        className="botao-nu simulation-mais-regras"
        aria-expanded={aberto}
        aria-controls="simulacao-regras-avancadas"
        onClick={() => setAberto((atual) => !atual)}
      >
        <span className="simulation-mais-regras-rotulo">
          <MdTune aria-hidden="true" />
          {t('simulationMoreRules')}
          {aberto ? <MdExpandLess aria-hidden="true" /> : <MdExpandMore aria-hidden="true" />}
        </span>
        <span className="simulation-mais-regras-dica">{t('simulationMoreRulesHint')}</span>
        <span className="simulation-mais-regras-resumo">
          {[t('simulationPerLeg', { valor: pct(p.custoPercentual, 2, false) }), ...avancadasAtivas].join(' · ')}
        </span>
      </button>

      {aberto && (
        <div id="simulacao-regras-avancadas" className="simulation-avancado">
          <div className="simulation-campo">
            <RotuloComAjuda className="pill-group-label" texto={t('simulationTrendFilter')} ajuda={t('ajuda.simTendencia')} />
            <Pilulas
              rotulo={t('simulationTrendFilter')}
              valor={p.filtroTendencia}
              onEscolher={(v) => onParametro('filtroTendencia', v)}
              opcoes={[null, TrendFilter.ALTA, TrendFilter.BAIXA].map((f) => [f, rotuloTendencia(f, t)])}
            />
          </div>

          <label className="simulation-campo">
            <RotuloComAjuda className="pill-group-label" texto={t('simulationConfirm')} ajuda={t('ajuda.simConfirmacao')} />
            {seletorDeSinal('sinalConfirmacao', t('simulationNone'))}
          </label>

          <label className="simulation-campo">
            <RotuloComAjuda className="pill-group-label" texto={t('simulationExitSignal')} ajuda={t('ajuda.simSaidaSinal')} />
            {seletorDeSinal('sinalSaida', t('simulationNone'))}
          </label>

          <label className="simulation-campo simulation-campo-num">
            <RotuloComAjuda className="pill-group-label" texto={t('simulationCost')} ajuda={t('ajuda.simCusto')} />
            <input
              type="number" min="0" step="0.01"
              value={p.custoPercentual}
              onChange={(e) => onParametro('custoPercentual', Number(e.target.value) || 0)}
            />
          </label>

          <label className="simulation-campo simulation-campo-num">
            <RotuloComAjuda className="pill-group-label" texto={t('simulationRisk')} ajuda={t('ajuda.simRisco')} />
            <input
              type="number" min="0" step="0.25" placeholder="—"
              value={p.riscoPorOperacao ?? ''}
              disabled={!temStop}
              title={temStop ? undefined : t('simulationRiskNeedsStop')}
              onChange={(e) => onParametro('riscoPorOperacao', numeroOuNulo(e.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  )
}
