import { describe, it, expect } from 'vitest'
import { getMarketSentiment, formatTooltipData, getRegionForCountry, filterCoinsByCountry } from '../src/utils/mapUtils'
import { MapRegion } from '../src/utils/enums'

describe('Utilitários do Mapa (mapUtils)', () => {
  describe('getMarketSentiment', () => {
    it('deve retornar sentimento correto baseado na dominância', () => {
      expect(getMarketSentiment(80)).toContain('🔥')
      expect(getMarketSentiment(50)).toContain('🚀')
      expect(getMarketSentiment(20)).toContain('📈')
      expect(getMarketSentiment(5)).toContain('⏳')
      expect(getMarketSentiment(0)).toContain('❄️')
    })
  })

  describe('formatTooltipData', () => {
    it('deve gerar string HTML contendo o país, símbolo da moeda e valor', () => {
      const html = formatTooltipData('Brasil', 'BTC', 70)
      expect(html).toContain('Brasil')
      expect(html).toContain('BTC')
      expect(html).toContain('70%')
      expect(html).toContain('🚀')
    })
  })

  describe('getRegionForCountry', () => {
    it('deve mapear países corretos para suas respectivas regiões', () => {
      expect(getRegionForCountry('BR')).toBe(MapRegion.AMERICAS)
      expect(getRegionForCountry('US')).toBe(MapRegion.AMERICAS)
      expect(getRegionForCountry('DE')).toBe(MapRegion.EUROPE)
      expect(getRegionForCountry('JP')).toBe(MapRegion.ASIA)
      expect(getRegionForCountry('AU')).toBe(MapRegion.OCEANIA)
      expect(getRegionForCountry('ZA')).toBe(MapRegion.AFRICA)
      expect(getRegionForCountry('XYZ')).toBe(MapRegion.WORLD)
    })
  })

  describe('filterCoinsByCountry', () => {
    const mockCoins = [
      { simbolo: 'BTC' },
      { simbolo: 'ETH' },
      { simbolo: 'SOL' },
      { simbolo: 'ADA' },
      { simbolo: 'XRP' }
    ]

    it('deve retornar todas as moedas se país for US ou vazio', () => {
      expect(filterCoinsByCountry(null, mockCoins)).toEqual(mockCoins)
      expect(filterCoinsByCountry('US', mockCoins)).toEqual(mockCoins)
    })

    it('deve filtrar moedas corretas para o Brasil', () => {
      const brCoins = filterCoinsByCountry('BR', mockCoins).map(c => c.simbolo)
      expect(brCoins).toContain('BTC')
      expect(brCoins).toContain('ETH')
      expect(brCoins).toContain('SOL')
      expect(brCoins).not.toContain('ADA')
    })

    it('deve sempre incluir BTC como fallback', () => {
      const filtered = filterCoinsByCountry('DE', mockCoins).map(c => c.simbolo)
      expect(filtered).toContain('BTC')
    })
  })
})
