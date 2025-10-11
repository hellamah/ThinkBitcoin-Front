import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../api'

const COINS = [
  { simbolo: 'BTC', nome: 'Bitcoin' },
  { simbolo: 'ETH', nome: 'Ethereum' },
  { simbolo: 'ADA', nome: 'Cardano' },
  { simbolo: 'XRP', nome: 'Ripple' },
  { simbolo: 'SOL', nome: 'Solana' },
  { simbolo: 'LINK', nome: 'Chainlink' },
  { simbolo: 'BNB', nome: 'Binance Coin' },
  { simbolo: 'LTC', nome: 'Litecoin' },
  { simbolo: 'DOGE', nome: 'Dogecoin' },
  { simbolo: 'PAXG', nome: 'PAX Gold' },
];

export default function useCoinPrices() {
  const [moedas, setMoedas] = useState(
    COINS.map((c) => ({ ...c, valor: 0, dados: [], variacao: 0 }))
  )
  const moedasRef = useRef(moedas)

  useEffect(() => {
    moedasRef.current = moedas
  }, [moedas])

  useEffect(() => {
    let ativo = true

    const obterValores = async () => {
      const atualizadas = await Promise.all(
        moedasRef.current.map(async (m) => {
          try {
            const resp = await fetch(
              `${API_URL}/ThinkBitcoin/moeda/${m.simbolo}/valor`
            )
            if (!resp.ok) throw new Error()
            const json = await resp.json()
            const valor = json.resultado.valor
            const historico = [...m.dados.slice(-6), valor]
            const anterior = m.dados[m.dados.length - 1] ?? valor
            const variacao = ((valor - anterior) / anterior) * 100
            return { ...m, valor, dados: historico, variacao }
          } catch {
            return m
          }
        })
      )
      if (ativo) setMoedas(atualizadas)
    }

    obterValores()
    const id = setInterval(obterValores, 30000)
    return () => {
      ativo = false
      clearInterval(id)
    }
  }, [])

  return moedas;
}
