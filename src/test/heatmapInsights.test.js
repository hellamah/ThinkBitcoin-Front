import { describe, it, expect } from 'vitest'
import {
  num,
  normalizarHHI,
  formatarMinutos,
  formatarHora,
  clampInteresse,
  formatarContagem,
  corFearGreed,
} from '../src/components/heatmap/HeatmapInsights'

describe('Helpers do HeatmapInsights', () => {
  describe('num', () => {
    it('converte valores numéricos e rejeita inválidos', () => {
      expect(num(42)).toBe(42)
      expect(num('7.5')).toBe(7.5)
      expect(num(null)).toBeNull()
      expect(num(undefined)).toBeNull()
      expect(num('abc')).toBeNull()
    })
  })

  describe('normalizarHHI', () => {
    it('mantém frações (0-1) como estão', () => {
      expect(normalizarHHI(0.31)).toBe(0.31)
      expect(normalizarHHI(1)).toBe(1)
    })

    it('converte pontos (0-10000) para fração', () => {
      expect(normalizarHHI(3100)).toBe(0.31)
      expect(normalizarHHI(10000)).toBe(1)
    })

    it('retorna null sem valor', () => {
      expect(normalizarHHI(null)).toBeNull()
      expect(normalizarHHI(undefined)).toBeNull()
    })
  })

  describe('formatarMinutos', () => {
    it('formata minutos abaixo de uma hora', () => {
      expect(formatarMinutos(45)).toBe('45 min')
      expect(formatarMinutos(0)).toBe('0 min')
    })

    it('formata horas e minutos', () => {
      expect(formatarMinutos(115)).toBe('1h 55min')
      expect(formatarMinutos(120)).toBe('2h')
    })

    it('retorna null sem valor', () => {
      expect(formatarMinutos(null)).toBeNull()
    })
  })

  describe('formatarHora', () => {
    it('formata ISO válido como HH:mm', () => {
      const resultado = formatarHora('2026-07-15T14:30:00Z')
      expect(resultado).toMatch(/\d{2}:\d{2}/)
    })

    it('retorna null para valores inválidos', () => {
      expect(formatarHora(null)).toBeNull()
      expect(formatarHora('nao-e-data')).toBeNull()
    })
  })

  describe('clampInteresse', () => {
    it('limita a exibição do interesse em 0-100 (registros imputados podem extrapolar)', () => {
      expect(clampInteresse(130)).toBe(100)
      expect(clampInteresse(-5)).toBe(0)
      expect(clampInteresse(75)).toBe(75)
    })

    it('retorna null sem valor', () => {
      expect(clampInteresse(null)).toBeNull()
    })
  })

  describe('formatarContagem', () => {
    it('formata segundos como mm:ss', () => {
      expect(formatarContagem(1800)).toBe('30:00')
      expect(formatarContagem(65)).toBe('01:05')
    })

    it('retorna null para zero, negativo ou ausente', () => {
      expect(formatarContagem(0)).toBeNull()
      expect(formatarContagem(-10)).toBeNull()
      expect(formatarContagem(null)).toBeNull()
    })
  })

  describe('corFearGreed', () => {
    // As cores saem como tokens de tema (definidos em index.css) e não como
    // hex fixo, para a escala acompanhar o modo claro/escuro.
    it('mapeia faixas do índice para cores distintas', () => {
      expect(corFearGreed(80)).toBe('var(--scale-greed)')
      expect(corFearGreed(60)).toBe('var(--scale-greed-mid)')
      expect(corFearGreed(30)).toBe('var(--scale-fear-mid)')
      expect(corFearGreed(10)).toBe('var(--scale-fear)')
    })
  })
})
