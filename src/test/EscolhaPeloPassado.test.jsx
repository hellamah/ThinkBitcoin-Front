// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import EscolhaPeloPassado from '../src/components/dashboard/simulacao/EscolhaPeloPassado'
import useSerieLonga from '../src/hooks/useSerieLonga'
import useEscolhaPeloPassado from '../src/hooks/useEscolhaPeloPassado'
import { PARAMETROS_PADRAO } from '../src/utils/parametrosSimulacao'

// A conta tem teste próprio (escolhaPeloPassado.test.js); aqui só se trava o
// que a aba mostra em cada estado. Sem provider, `t` devolve a chave.

vi.mock('../src/hooks/useSerieLonga', () => ({ default: vi.fn() }))
vi.mock('../src/hooks/useEscolhaPeloPassado', () => ({ default: vi.fn() }))

afterEach(cleanup)

const t = (chave) => chave
const DESCRITOR = { token: 'x', sigla: 'BTC', regra: {}, ate: '2026-08-21T17:00:00Z' }
const desenhar = () =>
  render(<EscolhaPeloPassado descritor={DESCRITOR} parametros={{ ...PARAMETROS_PADRAO }} t={t} locale="pt-BR" />)

const periodo = (k, escolhido, controle) => ({
  inicio: new Date(Date.UTC(2025, k, 1)).toISOString(),
  fim: new Date(Date.UTC(2025, k + 1, 1)).toISOString(),
  escolhido: { sinal: 'martelo', retorno: escolhido, operacoes: 5, posicao: 0.8 },
  controle: { sinal: 'doji', retorno: controle, operacoes: 1, posicao: 0.3 },
  buyAndHold: 1,
})

const resultado = (extra = {}) => ({
  periodos: [0, 1, 2, 3, 4, 5].map((k) => periodo(k, 2, -1)),
  escolhido: { retorno: 12, operacoes: 30, posicaoMedia: 0.8 },
  controle: { retorno: -6, operacoes: 6, posicaoMedia: 0.3 },
  buyAndHold: 6,
  suficiente: true,
  diasTreino: 90,
  diasTeste: 30,
  ...extra,
})

beforeEach(() => {
  useSerieLonga.mockReturnValue({ registros: [{}], aPartirDe: '2024-09-20T00:00:00Z', carregando: false, erro: '' })
  useEscolhaPeloPassado.mockReturnValue({ resultado: resultado(), calculando: false, feitos: 6, total: 6 })
})

describe('EscolhaPeloPassado', () => {
  it('deve buscar a própria série, só para a moeda da tela', () => {
    desenhar()
    expect(useSerieLonga).toHaveBeenCalledWith({ token: 'x', sigla: 'BTC', ativo: true })
  })

  it('deve dizer que está carregando o histórico longo', () => {
    useSerieLonga.mockReturnValue({ registros: null, aPartirDe: null, carregando: true, erro: '' })
    desenhar()
    expect(screen.getByText('simulationPastLoading')).toBeTruthy()
  })

  it('deve dizer em que período a conta está', () => {
    useEscolhaPeloPassado.mockReturnValue({ resultado: null, calculando: true, feitos: 4, total: 21 })
    desenhar()
    expect(screen.getByText('simulationPastCalculating')).toBeTruthy()
  })

  it('não deve mostrar números com períodos de menos', () => {
    useEscolhaPeloPassado.mockReturnValue({
      resultado: resultado({ suficiente: false, periodos: [periodo(0, 2, -1)] }),
      calculando: false,
      feitos: 1,
      total: 1,
    })
    desenhar()
    expect(screen.getByText('simulationPastShort')).toBeTruthy()
    expect(screen.queryByText('simulationPastChosen')).toBeNull()
  })

  it('deve pôr o escolhido ao lado do controle e do buy & hold, com a leitura', () => {
    desenhar()
    expect(screen.getAllByText('simulationPastChosen').length).toBeGreaterThan(0)
    expect(screen.getAllByText('simulationPastControl').length).toBeGreaterThan(0)
    expect(screen.getByText('simulationPastWorks')).toBeTruthy()
    // Um período por linha, mais o cabeçalho.
    expect(screen.getAllByRole('row')).toHaveLength(7)
  })

  it('não deve dizer que funcionou quando o controle vence em posição', () => {
    // Retorno composto maior, mas posição pior: um período extremo pode decidir
    // o composto sozinho. A leitura exige as duas.
    useEscolhaPeloPassado.mockReturnValue({
      resultado: resultado({
        escolhido: { retorno: 12, operacoes: 30, posicaoMedia: 0.4 },
        controle: { retorno: -6, operacoes: 6, posicaoMedia: 0.6 },
      }),
      calculando: false,
      feitos: 6,
      total: 6,
    })
    desenhar()
    expect(screen.getByText('simulationPastFails')).toBeTruthy()
  })

  it('deve avisar que os períodos param antes do trecho reservado', () => {
    desenhar()
    expect(screen.getByText('simulationPastUntil')).toBeTruthy()
  })
})
