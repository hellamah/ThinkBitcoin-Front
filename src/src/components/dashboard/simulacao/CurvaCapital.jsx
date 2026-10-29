import React, { useMemo } from 'react'
import { Line } from 'react-chartjs-2'

import * as mathUtils from '../../../utils/mathUtils'
import { montarPontosDaCurva, folgaDoEixo } from '../../../utils/equityChart'
import { toLocalChartLabel } from '../../../utils/dateUtils'
import { opcoesBaseGrafico } from './formatacao'

/**
 * Curva de capital com a régua do buy & hold no mesmo eixo.
 *
 * Fica logo abaixo da resposta principal porque é o elemento maior e o mais
 * olhado do painel: desenhar só a estratégia ali desfaria no desenho o que o
 * número em destaque faz questão de dizer. A distância do pico, que é a mesma
 * série lida de outro jeito, foi para "Dá para confiar?" — responde uma
 * pergunta que só aparece depois desta.
 */
export default function CurvaCapital({ resultado, cores, t, locale }) {
  const pontos = useMemo(
    () => montarPontosDaCurva(resultado.curva, resultado.parametros.capitalInicial),
    [resultado]
  )

  // `locale` entra nas dependências porque os rótulos do eixo são montados
  // aqui dentro: sem ele, trocar de idioma deixaria o gráfico no formato
  // anterior.
  const dados = useMemo(() => {
    if (!pontos) return null
    return {
      labels: pontos.rotulos.map((r) => (r ? toLocalChartLabel(r, locale) : '')),
      datasets: [
        {
          label: t('simulationEquity'),
          data: pontos.capital,
          borderColor: cores.accent,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
        },
        {
          // Sobreposto ao anterior: destaca só os trechos com posição aberta.
          label: t('simulationExposure'),
          data: pontos.emPosicao,
          borderColor: cores.alta,
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.1,
          spanGaps: false,
        },
        {
          // A régua. Tracejada, fina e dessaturada de propósito: ela é o fundo
          // contra o qual a estratégia se mede, não uma segunda estratégia
          // competindo por atenção. `tick` e não `tickSubtle`: a 0,4 de
          // opacidade a linha existia mas não dava para seguir.
          label: t('simulationBuyHold'),
          data: pontos.buyAndHold,
          borderColor: cores.tick,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0.1,
        },
      ],
    }
  }, [pontos, cores, t, locale])

  const opcoes = useMemo(() => {
    if (!pontos) return null
    const base = opcoesBaseGrafico(cores, { formatarY: (v) => mathUtils.formatCurrency(v) })
    const folga = folgaDoEixo(pontos.minimo, pontos.maximo)
    return {
      ...base,
      scales: {
        ...base.scales,
        y: { ...base.scales.y, min: pontos.minimo - folga, max: pontos.maximo + folga },
      },
    }
  }, [pontos, cores])

  if (!dados) return null

  return (
    <div className="simulation-curva">
      <h3>{t('simulationEquity')}</h3>
      <div className="simulation-curva-container">
        <Line data={dados} options={opcoes} />
      </div>
    </div>
  )
}
