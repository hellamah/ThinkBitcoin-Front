import { describe, expect, it } from 'vitest'
import {
  toLocal,
  toLocalChartLabel,
  toLocalTime,
  toUTCISO,
  padraoDeDataCurta,
} from '../src/utils/dateUtils'

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

// ---------------------------------------------------------------------------
// Formato por idioma
// ---------------------------------------------------------------------------
// O fuso continua sendo o da máquina — por isso nada aqui crava um horário
// literal, como no bloco acima. O que se crava é a RELAÇÃO entre os idiomas:
// qualquer que seja o dia local, pt-BR escreve dia antes de mês e en-US escreve
// mês antes de dia. Era essa relação que não existia, e é ela que fazia o mesmo
// candle aparecer como `04/01` no gráfico e `01/04` na tabela.

// 15 de abril ao meio-dia UTC: em qualquer fuso do planeta o dia local fica
// entre 14 e 16, então dia e mês nunca coincidem e a inversão é detectável.
const INSTANTE = '2026-04-15T12:00:00Z'

const doisPrimeirosNumeros = (texto) => (texto.match(/\d+/g) ?? []).slice(0, 2)

describe('utils/dateUtils › formato por idioma', () => {
  it('deve inverter dia e mês entre pt-BR e en-US no rótulo curto', () => {
    const [a, b] = doisPrimeirosNumeros(toLocalChartLabel(INSTANTE, 'pt-BR'))
    const [c, d] = doisPrimeirosNumeros(toLocalChartLabel(INSTANTE, 'en-US'))

    expect(Number(a)).toBe(Number(d))
    expect(Number(b)).toBe(Number(c))
    // Rede contra um dia igual ao mês, que faria a troca passar sem inverter nada.
    expect(Number(a)).not.toBe(Number(b))
  })

  it('deve usar relógio de 12 horas só onde o idioma pede', () => {
    expect(toLocalChartLabel(INSTANTE, 'en-US')).toMatch(/AM|PM/)
    expect(toLocalChartLabel(INSTANTE, 'pt-BR')).not.toMatch(/AM|PM/)
  })

  it('deve aplicar o idioma também na data completa', () => {
    expect(toLocal(INSTANTE, 'en-US')).toMatch(/AM|PM/)
    expect(toLocal(INSTANTE, 'pt-BR')).not.toMatch(/AM|PM/)
  })

  it('deve manter o comportamento antigo quando o idioma não é informado', () => {
    // Omitir o parâmetro cai no padrão do navegador — rede de segurança para
    // chamada esquecida, e o que garante que nenhuma tela ficou sem data.
    expect(toLocal(INSTANTE)).toBe(toLocal(INSTANTE, undefined))
    expect(toLocalChartLabel(INSTANTE)).toBe(toLocalChartLabel(INSTANTE, undefined))
  })
})

describe('utils/dateUtils › toLocalTime', () => {
  it('deve devolver só o relógio, no formato do idioma', () => {
    expect(toLocalTime(INSTANTE, 'pt-BR')).toMatch(/^\d{2}:\d{2}$/)
    expect(toLocalTime(INSTANTE, 'en-US')).toMatch(/AM|PM/)
  })

  it('deve aceitar timestamp numérico sem corromper o instante', () => {
    // `comoUtc` anexava `Z` a qualquer coisa que não casasse com a marca de
    // fuso, e um número vira "1776254400000Z" — data inválida. A guarda de tipo
    // é o que mantém número e Date passando intactos.
    const ms = Date.parse(INSTANTE)
    expect(toLocalTime(ms, 'pt-BR')).toBe(toLocalTime(INSTANTE, 'pt-BR'))
    expect(toLocal(ms, 'pt-BR')).toBe(toLocal(INSTANTE, 'pt-BR'))
  })

  it('deve devolver string vazia sem valor utilizável', () => {
    expect(toLocalTime(null)).toBe('')
    expect(toLocalTime('nao e data')).toBe('')
  })
})

describe('utils/dateUtils › padraoDeDataCurta', () => {
  it('deve pôr o mês na frente só nos idiomas que escrevem assim', () => {
    expect(padraoDeDataCurta('en-US')).toBe('MM/dd')
    expect(padraoDeDataCurta('pt-BR')).toBe('dd/MM')
    expect(padraoDeDataCurta('es-ES')).toBe('dd/MM')
    expect(padraoDeDataCurta('fr-FR')).toBe('dd/MM')
    expect(padraoDeDataCurta('it-IT')).toBe('dd/MM')
  })

  it('deve cair no padrão sem estourar diante de etiqueta inválida', () => {
    // O eixo do gráfico não pode sumir porque alguém digitou um código errado.
    expect(padraoDeDataCurta('nao-e-locale-!!')).toBe('dd/MM')
  })
})
