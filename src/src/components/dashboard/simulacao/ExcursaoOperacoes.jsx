import React, { useMemo, useState } from 'react'
import { Scatter } from 'react-chartjs-2'

import RotuloComAjuda from '../RotuloComAjuda'
import { FRACAO_VENCEDORAS_EXCURSAO } from '../../../utils/robustez'
import { opcoesBaseGrafico, pct } from './formatacao'

const Eixo = Object.freeze({ ADVERSA: 'adversa', FAVORAVEL: 'favoravel' })

/**
 * Excursão das operações: quanto cada uma andou contra e a favor antes de
 * fechar, contra como terminou.
 *
 * É a forma de olhar para stop e alvo a partir do que as operações FIZERAM, e
 * não testando distâncias até uma dar certo. As frases embaixo descrevem as
 * nuvens de pontos; nenhuma sugere uma distância — escolher o stop por este
 * gráfico ainda é escolher sobre o passado.
 */
export default function ExcursaoOperacoes({ excursoes, onFocarEntrada, cores, t }) {
  const [eixo, setEixo] = useState(Eixo.ADVERSA)

  const dados = useMemo(() => {
    if (!excursoes) return null
    const ponto = (p) => ({ x: p[eixo], y: p.resultado, indiceEntrada: p.indiceEntrada })
    return {
      datasets: [
        {
          label: t('simulationWinners'),
          data: excursoes.pontos.filter((p) => p.resultado > 0).map(ponto),
          backgroundColor: cores.alta,
          borderColor: cores.alta,
          pointRadius: 3.5,
          pointHoverRadius: 6,
        },
        {
          label: t('simulationLosers'),
          data: excursoes.pontos.filter((p) => p.resultado <= 0).map(ponto),
          backgroundColor: cores.baixa,
          borderColor: cores.baixa,
          pointRadius: 3.5,
          pointHoverRadius: 6,
        },
      ],
    }
  }, [excursoes, eixo, cores, t])

  const opcoes = useMemo(() => {
    const base = opcoesBaseGrafico(cores)
    const tituloEixo = (texto) => ({ display: true, text: texto, color: cores.tick })
    return {
      ...base,
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        ...base.plugins,
        tooltip: {
          backgroundColor: cores.tooltipBg,
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${pct(ctx.parsed.y)} · ${
                eixo === Eixo.ADVERSA ? 'MAE' : 'MFE'
              } ${pct(ctx.parsed.x, 2, false)}`,
          },
        },
      },
      scales: {
        x: {
          ...base.scales.x,
          type: 'linear',
          min: 0,
          grid: { color: cores.grid },
          title: tituloEixo(eixo === Eixo.ADVERSA ? t('simulationMae') : t('simulationMfe')),
        },
        y: { ...base.scales.y, title: tituloEixo(t('simulationResultPct')) },
      },
      onClick: (_evento, elementos) => {
        const alvo = elementos?.[0]
        if (!alvo || !dados) return
        const p = dados.datasets[alvo.datasetIndex]?.data?.[alvo.index]
        if (p) onFocarEntrada(p.indiceEntrada)
      },
    }
  }, [cores, eixo, t, dados, onFocarEntrada])

  if (!excursoes) return <p className="simulation-vazio">{t('simulationNoTrades')}</p>

  return (
    <div className="simulation-excursao">
      <div className="simulation-foco-cabecalho">
        <h3>
          <RotuloComAjuda texto={t('simulationExcursion')} ajuda={t('ajuda.simExcursao')} />
        </h3>
        <div className="simulation-pills" role="group" aria-label={t('simulationExcursion')}>
          {[
            [Eixo.ADVERSA, t('simulationExcursionAdverse')],
            [Eixo.FAVORAVEL, t('simulationExcursionFavorable')],
          ].map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              className={`pill-toggle ${eixo === valor ? 'ativo' : ''}`}
              aria-pressed={eixo === valor}
              onClick={() => setEixo(valor)}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>
      <p className="correlation-hint">{t('simulationExcursionHint')}</p>

      <div className="simulation-excursao-container">
        <Scatter data={dados} options={opcoes} />
      </div>

      <ul className="simulation-leituras">
        {excursoes.adversaVencedoras !== null && (
          <li>
            {t('simulationExcursionWinners', {
              fracao: Math.round(FRACAO_VENCEDORAS_EXCURSAO * 100),
              // Sem sinal: "recuaram no máximo 1,6%" — o verbo já diz a direção.
              valor: pct(excursoes.adversaVencedoras, 2, false),
              count: excursoes.vencedoras,
            })}
          </li>
        )}
        {excursoes.favoravelPerdedoras !== null && (
          <li>
            {t('simulationExcursionLosers', {
              valor: pct(excursoes.favoravelPerdedoras, 2, true),
              count: excursoes.perdedoras,
            })}
          </li>
        )}
      </ul>
    </div>
  )
}
