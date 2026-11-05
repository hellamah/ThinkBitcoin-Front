import { useCallback, useSyncExternalStore } from 'react'
import { cotacoesCarrossel } from '../utils/cotacoesCarrossel'

// Lista, cotações e polling vivem em utils/cotacoesCarrossel, compartilhados
// entre as telas que exibem o carrossel — ver o comentário lá. Este hook só
// inscreve a tela enquanto ela está montada.
//
// `comSentimento` pede também medo/ganância e tendência de cada moeda. Só o
// Heatmap os mostra; o painel e a simulação ficam só com o preço, e cada um
// desses pedidos a menos alivia a rajada que a API atende ao abrir a tela.
export default function useCoinPrices({ comSentimento = false } = {}) {
  const subscribe = useCallback(
    (avisar) => cotacoesCarrossel.subscribe(avisar, { comSentimento }),
    [comSentimento]
  )
  const { moedas, erro } = useSyncExternalStore(subscribe, cotacoesCarrossel.getSnapshot)
  return { moedas, erro, setErro: cotacoesCarrossel.definirErro }
}
