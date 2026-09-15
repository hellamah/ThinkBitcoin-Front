import { useSyncExternalStore } from 'react'
import { cotacoesCarrossel } from '../utils/cotacoesCarrossel'

// Lista, cotações e polling vivem em utils/cotacoesCarrossel, compartilhados
// entre as telas que exibem o carrossel — ver o comentário lá. Este hook só
// inscreve a tela enquanto ela está montada.
export default function useCoinPrices() {
  const { moedas, erro } = useSyncExternalStore(
    cotacoesCarrossel.subscribe,
    cotacoesCarrossel.getSnapshot
  )
  return { moedas, erro, setErro: cotacoesCarrossel.definirErro }
}
