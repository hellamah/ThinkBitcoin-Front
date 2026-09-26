import React, { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'
import useCoinPrices from '../hooks/useCoinPrices'
import useStrategySimulation from '../hooks/useStrategySimulation'
import { acharMoedaPreferida } from '../utils/preferences'
import SimulationPanel from '../components/dashboard/SimulationPanel'
import ErrorMessage from '../components/ErrorMessage'

/**
 * Simulação de estratégia, em tela própria.
 *
 * Morava no fim do dashboard, e o custo dela caía sobre toda visita: o
 * dashboard abre com uma moeda selecionada, e isso bastava para buscar 180 dias
 * de candles (3,7 MB) e pôr o worker a rodar a régua aleatória, o mapa e a
 * sorte do ranking — para quem só queria olhar o mercado. Aqui, só paga quem
 * abre a ferramenta.
 *
 * São trabalhos diferentes, e o SIMULACAO.md já os separava: no dashboard se
 * mexe no período para OLHAR; aqui, nos parâmetros para TESTAR uma regra. A
 * simulação nunca dependeu dos filtros de lá — tem série, janela e URL
 * próprias —, e do dashboard só recebia a moeda.
 *
 * A moeda vem do parâmetro `moeda` da URL, o mesmo que o dashboard e o heatmap
 * leem; sem ele, a preferida do usuário. E volta para a URL ao ser escolhida,
 * para o link compartilhado abrir na moeda em que foi montado.
 */
export default function Simulacao() {
  const { token, prefs } = useAuth()
  const { t, idioma } = useTranslation()
  const { moedas, erro: erroMoedas, setErro: setErroMoedas } = useCoinPrices()
  const [searchParams, setSearchParams] = useSearchParams()

  const pedida = searchParams.get('moeda')?.toUpperCase() ?? null

  // A da URL vale se estiver na lista. Uma sigla que não existe mais cai na
  // preferida, em vez de deixar a tela carregando uma moeda que nunca chega.
  const sigla = useMemo(() => {
    if (!moedas?.length) return null
    if (pedida && moedas.some((m) => m.simbolo === pedida)) return pedida
    return acharMoedaPreferida(prefs, moedas)
  }, [moedas, pedida, prefs])

  // `replace`: trocar de moeda não é navegar, como ajustar um parâmetro da
  // simulação também não é. Parte da URL atual para não apagar os `sim.*`.
  const escolher = useCallback(
    (simbolo) =>
      setSearchParams(
        (atual) => {
          const proxima = new URLSearchParams(atual)
          proxima.set('moeda', simbolo)
          return proxima
        },
        { replace: true }
      ),
    [setSearchParams]
  )

  useEffect(() => {
    if (sigla && sigla !== pedida) escolher(sigla)
  }, [sigla, pedida, escolher])

  const simulacao = useStrategySimulation({ token, sigla, t, idioma })

  const seletor =
    moedas?.length > 0 ? (
      <div className="simulation-moedas">
        <span className="pill-group-label">{t('simulationCoin')}</span>
        <div className="simulation-pills" role="group" aria-label={t('simulationCoin')}>
          {moedas.map(({ simbolo }) => (
            <button
              key={simbolo}
              type="button"
              className={`pill-toggle ${simbolo === sigla ? 'ativo' : ''}`}
              aria-pressed={simbolo === sigla}
              onClick={() => escolher(simbolo)}
            >
              {simbolo}
            </button>
          ))}
        </div>
      </div>
    ) : null

  return (
    <div className="dashboard-container">
      <ErrorMessage message={t(erroMoedas)} onClose={() => setErroMoedas('')} />
      <SimulationPanel
        {...simulacao}
        // Sem moeda ainda — a lista chega depois da tela — o painel diz que
        // está carregando. Sem isto ele diria "nenhuma operação", que é outra
        // coisa.
        carregando={simulacao.carregando || !sigla}
        t={t}
        locale={idioma.intl}
        seletor={seletor}
        nivelTitulo="h1"
      />
    </div>
  )
}
