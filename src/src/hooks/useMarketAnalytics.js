import { useMemo } from 'react'
import { derivarAnalytics } from '../utils/marketAnalytics'

/**
 * Memoiza as leituras derivadas do mercado. A lógica vive em
 * utils/marketAnalytics para poder ser testada sem montar React; aqui só fica
 * a dependência de re-cálculo.
 */
export default function useMarketAnalytics({
  historicosPorMoeda,
  fearGreedPorMoeda,
  moedasFiltro,
  aPartirDe = null,
}) {
  return useMemo(
    () => derivarAnalytics({ historicosPorMoeda, fearGreedPorMoeda, moedasFiltro, aPartirDe }),
    [historicosPorMoeda, fearGreedPorMoeda, moedasFiltro, aPartirDe]
  )
}
