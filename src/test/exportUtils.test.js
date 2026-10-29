import { describe, it, expect } from 'vitest'
import { __test__ } from '../src/utils/exportUtils'

const { paraCSV, paraJSON, celulaCSV, BOM_UTF8 } = __test__

// chartData no formato que o GeoHeatmapView monta: a primeira linha é o
// cabeçalho do Google Charts e a célula de país vem como { v, f }.
const cabecalho = ['Country', 'Valor', { role: 'tooltip' }]
const linha = (codigo, valor) => [{ v: codigo, f: '' }, valor, '<div/>']

// Resolve como o Intl.DisplayNames resolveria em pt.
const nomes = { BR: 'Brasil', US: 'Estados Unidos', KR: 'Coreia do Sul' }
const nomePais = (codigo) => nomes[codigo] ?? codigo

describe('utils/exportUtils › celulaCSV', () => {
  it('deixa passar o que não precisa de escape', () => {
    expect(celulaCSV('Brasil')).toBe('Brasil')
    expect(celulaCSV(12.5)).toBe('12.5')
  })

  it('envolve em aspas o valor com vírgula', () => {
    expect(celulaCSV('Korea, Republic of')).toBe('"Korea, Republic of"')
  })

  it('duplica aspas internas, como pede a RFC 4180', () => {
    expect(celulaCSV('Ilha do "Norte"')).toBe('"Ilha do ""Norte"""')
  })

  it('envolve em aspas o valor com quebra de linha', () => {
    expect(celulaCSV('linha1\nlinha2')).toBe('"linha1\nlinha2"')
  })

  it('trata null e undefined como célula vazia', () => {
    expect(celulaCSV(null)).toBe('')
    expect(celulaCSV(undefined)).toBe('')
  })
})

describe('utils/exportUtils › paraCSV', () => {
  it('devolve vazio quando só existe o cabeçalho', () => {
    expect(paraCSV([cabecalho], 'BTC', nomePais)).toBe('')
    expect(paraCSV(null, 'BTC', nomePais)).toBe('')
  })

  it('traz o nome do país junto do código', () => {
    const csv = paraCSV([cabecalho, linha('BR', 42.5)], 'BTC', nomePais)
    const linhas = csv.split('\r\n')
    expect(linhas[0]).toBe('Código,País,Dominância BTC (%)')
    expect(linhas[1]).toBe('BR,Brasil,42.5')
  })

  it('separa registros com CRLF', () => {
    const csv = paraCSV([cabecalho, linha('BR', 1), linha('US', 2)], 'BTC', nomePais)
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('não parte a linha quando o nome do país tem vírgula', () => {
    const comVirgula = (codigo) => (codigo === 'KR' ? 'Korea, Republic of' : codigo)
    const csv = paraCSV([cabecalho, linha('KR', 7)], 'BTC', comVirgula)
    const registro = csv.split('\r\n')[1]
    expect(registro).toBe('KR,"Korea, Republic of",7')
    // O que de fato importa: continua com três colunas depois do escape.
    expect(registro.match(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g)).toHaveLength(2)
  })

  it('aceita célula de país como string simples, não só como objeto', () => {
    const csv = paraCSV([cabecalho, ['BR', 3, '']], 'BTC', nomePais)
    expect(csv.split('\r\n')[1]).toBe('BR,Brasil,3')
  })
})

describe('utils/exportUtils › paraJSON', () => {
  it('devolve lista vazia quando só existe o cabeçalho', () => {
    expect(paraJSON([cabecalho], 'BTC', nomePais)).toBe('[]')
  })

  it('separa código e nome em campos próprios', () => {
    const registros = JSON.parse(paraJSON([cabecalho, linha('US', 12.5)], 'BTC', nomePais))
    expect(registros).toEqual([
      { codigo: 'US', pais: 'Estados Unidos', simbolo: 'BTC', dominancia: 12.5 },
    ])
  })
})

describe('utils/exportUtils › BOM', () => {
  it('é o caractere U+FEFF, e não o texto "FEFF"', () => {
    // Sem isso o Excel no Windows abre o CSV como ANSI e o cabeçalho
    // "País,Dominância" chega corrompido.
    expect(BOM_UTF8.charCodeAt(0)).toBe(0xfeff)
    expect(BOM_UTF8).toHaveLength(1)
  })
})
