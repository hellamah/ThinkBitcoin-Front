import { describe, it, expect } from 'vitest'
import { getMarketSentiment, formatTooltipData, getRegionForCountry, filterCoinsByCountry, getCountryName } from '../src/utils/mapUtils'
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
    it('deve gerar string HTML contendo o país, participação no top 5 e sentimento', () => {
      const html = formatTooltipData('Brasil', 'BTC', 70)
      expect(html).toContain('Brasil')
      expect(html).toContain('Participação no top 5')
      expect(html).toContain('70%')
      expect(html).toContain('🚀')
    })

    it('deve omitir a participação quando o país está fora do top 5 (valor 0)', () => {
      const html = formatTooltipData('Quênia', 'BTC', 0)
      expect(html).toContain('Quênia')
      expect(html).not.toContain('Participação no top 5')
    })

    it('deve exibir os extras reais quando informados (liderança, intensidade e variação)', () => {
      const html = formatTooltipData('Brasil', 'BTC', 70, {
        variacao24h: -2.345,
        lideranca: 12,
        intensidade: 84.6,
      })
      expect(html).toContain('Liderança de buscas')
      expect(html).toContain('12x')
      expect(html).toContain('Intensidade média')
      expect(html).toContain('85/100')
      expect(html).toContain('Variação BTC')
      expect(html).toContain('-2.35%')
    })

    it('não deve renderizar extras ausentes', () => {
      const html = formatTooltipData('Brasil', 'BTC', 70)
      expect(html).not.toContain('Liderança de buscas')
      expect(html).not.toContain('Intensidade média')
      expect(html).not.toContain('Variação')
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
    // O filtro usa o dado real de /trend anexado a cada moeda (geoTop1Code =
    // país que lidera as buscas pelo ativo).
    const mockCoins = [
      { simbolo: 'BTC', trend: { geoTop1Code: 'US' } },
      { simbolo: 'ETH', trend: { geoTop1Code: 'BR' } },
      { simbolo: 'SOL', trend: { geoTop1Code: 'br' } },
      { simbolo: 'ADA', trend: null },
      { simbolo: 'XRP' }
    ]

    it('deve retornar todas as moedas quando não há país selecionado', () => {
      expect(filterCoinsByCountry(null, mockCoins)).toEqual(mockCoins)
      expect(filterCoinsByCountry(undefined, mockCoins)).toEqual(mockCoins)
    })

    it('deve filtrar pelas moedas cujo país líder de buscas é o selecionado (case-insensitive)', () => {
      const brCoins = filterCoinsByCountry('BR', mockCoins).map(c => c.simbolo)
      expect(brCoins).toEqual(['ETH', 'SOL'])

      const usCoins = filterCoinsByCountry('us', mockCoins).map(c => c.simbolo)
      expect(usCoins).toEqual(['BTC'])
    })

    it('deve retornar lista vazia quando nenhum ativo é liderado pelo país', () => {
      expect(filterCoinsByCountry('JP', mockCoins)).toEqual([])
    })

    it('deve ignorar moedas sem dado de trend', () => {
      const filtered = filterCoinsByCountry('BR', mockCoins).map(c => c.simbolo)
      expect(filtered).not.toContain('ADA')
      expect(filtered).not.toContain('XRP')
    })
  })

  describe('getCountryName', () => {
    it('deve resolver nomes localizados via Intl.DisplayNames', () => {
      expect(getCountryName('BR', 'pt')).toBe('Brasil')
      expect(getCountryName('US', 'en')).toBe('United States')
      // País fora do mapa hardcoded antigo agora resolve normalmente
      expect(getCountryName('TR', 'pt')).toBe('Turquia')
    })

    it('deve retornar o próprio código quando inválido', () => {
      expect(getCountryName('XYZ', 'pt')).toBe('XYZ')
      expect(getCountryName('', 'pt')).toBe('')
    })
  })
})
