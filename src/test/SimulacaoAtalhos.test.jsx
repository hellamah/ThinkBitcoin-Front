// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SimulacaoAtalho from '../src/components/dashboard/SimulacaoAtalho'
import SignalLabPanel from '../src/components/dashboard/SignalLabPanel'
import { analisarSinais } from '../src/utils/signalLab'
import { lerParametrosDaUrl } from '../src/utils/parametrosSimulacao'

// Os dois caminhos do dashboard para a simulação, que saiu para tela própria:
// o atalho no lugar onde o painel ficava e o link em cada linha do laboratório.
// Sem provider de tradução, `t` devolve a chave com os valores anexados.

afterEach(cleanup)

const t = (chave, valores) => (valores ? `${chave}:${JSON.stringify(valores)}` : chave)

const buscaDe = (link) => new URLSearchParams(link.getAttribute('href').split('?')[1])

describe('SimulacaoAtalho', () => {
  it('deve abrir a simulação na moeda selecionada no dashboard', () => {
    render(
      <MemoryRouter>
        <SimulacaoAtalho sigla="ETH" t={t} />
      </MemoryRouter>
    )
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/simulacao?moeda=ETH')
    expect(link.textContent).toContain('"moeda":"ETH"')
  })
})

describe('SignalLabPanel › atalho para a simulação', () => {
  // Martelos seguidos de alta: o laboratório tem ao menos uma linha de sinal.
  const MARTELO = { corpo: 10, sup: 2, inf: 30 }
  const NEUTRO = { corpo: 50, sup: 25, inf: 25 }
  const reg = (close, forma) => ({
    precoFechamento: close,
    precoCorpoCandle: forma.corpo,
    precoSombraSuperior: forma.sup,
    precoSombraInferior: forma.inf,
    precoAmplitude: forma.corpo + forma.sup + forma.inf,
    precoVolume: 100,
    precoPercentualVariacao: 0,
  })
  const analise = analisarSinais(
    [reg(100, MARTELO), reg(110, NEUTRO), reg(105, MARTELO), reg(115, NEUTRO)].reverse()
  )

  it('deve levar cada sinal para a simulação, na moeda analisada', () => {
    render(
      <MemoryRouter>
        <SignalLabPanel analise={analise} horizonte={1} setHorizonte={() => {}} sigla="SOL" t={t} />
      </MemoryRouter>
    )
    const link = screen.getByRole('link', { name: 'signalSimulate: signal_martelo' })
    const busca = buscaDe(link)
    expect(busca.get('moeda')).toBe('SOL')
    // A mesma leitura que a tela da simulação faz: o sinal chega como entrada.
    expect(lerParametrosDaUrl(busca).sinalEntrada).toBe('martelo')
  })

  it('não deve oferecer o atalho sem uma moeda única', () => {
    render(<SignalLabPanel analise={analise} horizonte={1} setHorizonte={() => {}} t={t} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
