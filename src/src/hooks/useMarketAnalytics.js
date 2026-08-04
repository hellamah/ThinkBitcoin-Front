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
}) {
  return useMemo(
    () => derivarAnalytics({ historicosPorMoeda, fearGreedPorMoeda, moedasFiltro }),
    [historicosPorMoeda, fearGreedPorMoeda, moedasFiltro]
  )
}
