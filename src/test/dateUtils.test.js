import { describe, expect, it } from 'vitest'
import { toLocal, toLocalChartLabel, toUTCISO } from '../src/utils/dateUtils'

// Estes testes existem por causa de um defeito específico: a guarda que deveria
// anexar `Z` a uma data sem fuso era
//
//   utcString.endsWith('Z') || utcString.includes('+') || utcString.includes('-')
//
// e o `includes('-')` é sempre verdadeiro numa data ISO, por causa dos hífens
// de "2026-04-01". O ramo nunca executou: toda data sem fuso vinda da API era
// lida como hora local, deslocando todo instante do produto pelo fuso do
// usuário.
//
// O que os testes cravam é a EQUIVALÊNCIA entre as duas formas — com e sem `Z`
// —, e não um horário literal. Um horário literal dependeria do fuso da máquina
// que roda a suíte, o que passaria em CI e falharia na mesa de alguém.

const SEM_FUSO = '2026-04-01T00:00:00'
const COM_Z = '2026-04-01T00:00:00Z'

describe('utils/dateUtils › toLocal', () => {
  it('deve tratar data sem fuso como UTC', () => {
    expect(toLocal(SEM_FUSO)).toBe(toLocal(COM_Z))
  })

  it('deve tratar fração de segundo sem fuso como UTC', () => {
    expect(toLocal('2026-04-01T00:00:00.123')).toBe(toLocal('2026-04-01T00:00:00.123Z'))
  })

  it('não deve mexer em data que já traz deslocamento explícito', () => {
    // -03:00 é meia-noite em Brasília, ou seja, 03:00 UTC.
    expect(toLocal('2026-04-01T00:00:00-03:00')).toBe(toLocal('2026-04-01T03:00:00Z'))
  })

  it('deve distinguir dois instantes diferentes', () => {
    // Rede contra uma "correção" que devolvesse sempre a mesma coisa e fizesse
    // os testes de equivalência acima passarem por acidente.
    expect(toLocal(COM_Z)).not.toBe(toLocal('2026-04-01T05:00:00Z'))
  })

  it('deve devolver um traço sem valor', () => {
    expect(toLocal(null)).toBe('-')
    expect(toLocal('')).toBe('-')
  })
})

describe('utils/dateUtils › toLocalChartLabel', () => {
  it('deve tratar data sem fuso como UTC', () => {
    expect(toLocalChartLabel(SEM_FUSO)).toBe(toLocalChartLabel(COM_Z))
  })

  it('deve devolver string vazia sem valor', () => {
    expect(toLocalChartLabel(null)).toBe('')
  })
})

describe('utils/dateUtils › toUTCISO', () => {
  it('deve devolver ISO com Z', () => {
    expect(toUTCISO(COM_Z)).toBe('2026-04-01T00:00:00.000Z')
  })

  it('deve recusar entrada inutilizável', () => {
    expect(toUTCISO(null)).toBeNull()
    expect(toUTCISO('nao e data')).toBeNull()
  })
})
