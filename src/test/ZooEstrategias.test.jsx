// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import pt from '../src/lang/pt.json'
import { RODADA_ZOO } from '../src/utils/mockZooEstrategia'
import { BUY_HOLD, estrategiaPadrao, linhaDaMoeda } from '../src/utils/zooEstrategia'
import { comSinal, formatarPercentual } from '../src/components/comum/formato'
import { useAuth } from '../src/context/AuthContext'

import ZooEstrategias from '../src/pages/ZooEstrategias'

// A tela de estratégias depois de 04/11/2026: uma rodada só (o histórico), sem a
// aba da janela do agente, a regra do robô marcada para administrador e a
// tabela por moeda sem o botão que não fazia nada.

afterEach(cleanup)

const t = (chave, vars = {}) => {
  const texto = chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave
  return String(texto).replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

vi.mock('../src/hooks/useTranslation', () => ({
  default: (() => { let valor; return () => (valor ??= { t, idioma: { intl: 'pt-BR' } }) })(),
}))

// A curva que o gráfico recebe; vazia, salvo no teste do subtítulo da queda.
const estadoDaCurva = vi.hoisted(() => ({ atual: { curvas: [], carregando: false, erro: null } }))

vi.mock('../src/hooks/useZooEstrategia', async () => {
  const { RODADA_ZOO: rodada } = await import('../src/utils/mockZooEstrategia')
  const fixo = { rodada, carregando: false, erro: null, recarregar: () => {} }
  return { default: () => fixo, useCurvaZoo: () => estadoDaCurva.atual }
})

vi.mock('../src/context/AuthContext', () => ({ useAuth: vi.fn(() => ({ user: null })) }))
vi.mock('react-chartjs-2', () => ({ Line: () => null }))

const renderizar = (cargos) => {
  useAuth.mockReturnValue({ user: cargos ? { cargos } : null })
  return render(<MemoryRouter><ZooEstrategias /></MemoryRouter>)
}

describe('ZooEstrategias', () => {
  it('mostra uma rodada só, sem as abas da janela do agente', () => {
    renderizar(['Administrador'])
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.queryByText(/janela do agente/i)).toBeNull()
    expect(screen.getByText(t('zoo.rankingTitle'))).toBeTruthy()
  })

  it('mostra os rótulos de mediana na tabela de ranking', () => {
    renderizar(['Administrador'])
    const tabelas = screen.getAllByRole('table')
    const ranking = tabelas[0]
    const cabecalho = within(ranking).getAllByRole('columnheader')
    // O cabeçalho de quedaBh (índice 6) deve conter "(Mediana)"
    expect(cabecalho[6].textContent).toContain('(Mediana)')
  })

  it('marca a regra do robô, com o caminho até a tela dele, para administrador', () => {
    renderizar(['Administrador'])
    const marcas = screen.getAllByTestId('zoo-regra-do-robo')
    expect(marcas).toHaveLength(1)
    expect(marcas[0].getAttribute('href')).toBe('/robo-ao-vivo')
    // Na linha da regra que o motor opera.
    expect(marcas[0].closest('tr').textContent).toContain(t('zoo.nomes.media_50d_vol_alvo_40'))
  })

  it('o cliente não vê a marca: a tela do robô é de administrador', () => {
    renderizar(['Minerador'])
    expect(screen.queryByTestId('zoo-regra-do-robo')).toBeNull()
  })

  it('a tabela por moeda não tem botão e chama o Calmar dela sem "mediana"', () => {
    renderizar(['Minerador'])
    expect(screen.queryByRole('button', { name: /ver moedas/i })).toBeNull()
    const tabelas = screen.getAllByRole('table')
    // A segunda é a das moedas: o cabeçalho tem tantas colunas quanto as linhas.
    const porMoeda = tabelas[1]
    const cabecalho = within(porMoeda).getAllByRole('columnheader')
    const primeiraLinha = within(porMoeda).getAllByRole('row')[1]
    expect(within(primeiraLinha).getAllByRole('cell')).toHaveLength(cabecalho.length)
    const calmar = cabecalho.find((c) => c.textContent === t('zoo.colCalmarMoeda'))
    expect(calmar).toBeTruthy()
    expect(calmar.textContent.toLowerCase()).not.toContain('mediana')
    expect(RODADA_ZOO.estrategias.length).toBeGreaterThan(0)
    // A aprovação é só sim ou não: a contagem dos anos já está em "Anos ok".
    const celulas = within(primeiraLinha).getAllByRole('cell')
    expect([t('zoo.yes'), t('zoo.no')]).toContain(celulas.at(-1).textContent)
  })

  // Rodada do Pregão de 09/11/2026 com dados reais: a SOL tinha -45,7% na tabela
  // (curva diária) e -44,8% no gráfico (pontos de domingo). As duas contas estão
  // certas; o subtítulo é que precisa dizer as duas, e de onde vem cada uma.
  it('o subtítulo da queda mostra a do gráfico e a diária da tabela, quando diferem', () => {
    const estrategia = estrategiaPadrao(RODADA_ZOO)
    const linha = linhaDaMoeda(RODADA_ZOO, estrategia, 'BTC')
    const curva = (nome, valores) => ({
      estrategia: nome,
      pontos: valores.map((patrimonio, i) => ({ data: new Date(Date.UTC(2018, 2, 4 + 7 * i)).toISOString(), patrimonio })),
    })
    estadoDaCurva.atual = {
      curvas: [curva(estrategia, [1, 0.8, 1.2]), curva(BUY_HOLD, [1, 0.5, 1.5])],
      carregando: false,
      erro: null,
    }
    try {
      renderizar(['Minerador'])
    } finally {
      estadoDaCurva.atual = { curvas: [], carregando: false, erro: null }
    }
    const pct = (v) => comSinal(formatarPercentual(v, 1), v)
    expect(pct(linha.quedaMaxima)).not.toBe(pct(-0.2))
    const esperado = t('zoo.drawdownSubDiaria', {
      pior: pct(-0.2),
      piorBh: pct(-0.5),
      piorDiaria: pct(linha.quedaMaxima),
      piorBhDiaria: pct(linha.quedaMaximaBuyHold),
    })
    expect(screen.getByText(esperado)).toBeTruthy()
    expect(esperado).toContain('-20,0%')
    expect(esperado).toContain('dia a dia')
  })

  // O conferente do Pregão (trader/conferente.py, PIOR_QUEDA) acha a pior queda do
  // gráfico por este começo de frase; sem ele, a conferência some sem aviso.
  it('as três versões do subtítulo começam por "Pior queda: X contra Y do buy & hold"', () => {
    const vars = { pior: '-44,8%', piorBh: '-96,0%', piorDiaria: '-45,7%', piorBhDiaria: '-96,3%' }
    for (const chave of ['zoo.drawdownSub', 'zoo.drawdownSubIgual', 'zoo.drawdownSubDiaria']) {
      expect(t(chave, vars)).toMatch(/^Pior queda: -44,8% contra -96,0% do buy & hold/)
    }
  })

  // O robô refaz a mesma regra desde 2017, e o zoo começa o BTC em 2018: sem dizer por quê,
  // os dois históricos pareciam contradizer um ao outro.
  it('o histórico da regra na tela do robô diz por que começa antes do zoo', () => {
    expect(pt.robo.normal.sub).toMatch(/50 dias/)
    expect(pt.robo.normal.sub).toMatch(/200 dias/)
  })
})
