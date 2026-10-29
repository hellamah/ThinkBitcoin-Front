// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import SimulationPanel from '../src/components/dashboard/SimulationPanel'
import { simular, compararEstrategias, dividirParaValidacao, ultimoDisparo } from '../src/utils/backtest'
import { montarSerieDeSinais } from '../src/utils/signalLab'
import {
  bootstrapRetorno,
  retornoSemMelhores,
  custoDeEquilibrio,
  resumirExcursoes,
  resultadoPorMes,
  serieSubmersa,
} from '../src/utils/robustez'
import { compararComAcaso } from '../src/utils/acaso'
import { mapaDeSensibilidade } from '../src/utils/sensibilidade'
import { PARAMETROS_PADRAO, impressaoDaConfiguracao } from '../src/utils/parametrosSimulacao'
import { CandlePattern } from '../src/utils/candlePatterns'
import { serie } from './fixtures/candlesSimulacao'

// O painel é renderizado com uma simulação DE VERDADE — motor, robustez, régua
// aleatória e mapa rodando sobre candles sintéticos —, para que um campo que o
// motor deixou de devolver quebre o teste, e não a tela.
//
// O que se trava aqui é a hierarquia: o que aparece de cara, o que espera um
// clique. Canvas não existe no jsdom: os gráficos viram um div com o nome das
// séries. Sem provider de tradução, `t` devolve a própria chave.

vi.mock('react-chartjs-2', () => ({
  Line: ({ data }) => <div data-testid="grafico-linha">{data?.datasets?.map((d) => d.label).join('|')}</div>,
  Scatter: ({ data }) => <div data-testid="grafico-dispersao">{data?.datasets?.map((d) => d.label).join('|')}</div>,
}))

afterEach(cleanup)

const t = (chave) => chave

// 160 candles que oscilam, com martelos e estrelas espalhados: operações dos
// dois lados, e mais de um sinal para o ranking existir. Curta de propósito:
// 160 horas ficam abaixo da janela de 180 dias, e isso vira uma ressalva.
const registros = () => {
  const defs = []
  for (let i = 0; i < 160; i++) {
    const p = 100 + Math.sin(i / 5) * 8
    defs.push({
      abertura: p,
      maior: p + 3,
      menor: p - 3,
      fechamento: p + (i % 2 ? 1 : -1),
      martelo: i % 4 === 0,
      estrela: i % 9 === 0 && i % 4 !== 0,
    })
  }
  return serie(defs, { inicio: '2026-01-28T00:00:00Z' })
}

const montarProps = (sobrescrever = {}) => {
  const lista = registros()
  const serieDeSinais = montarSerieDeSinais(lista)
  const parametros = {
    ...PARAMETROS_PADRAO,
    sinalEntrada: CandlePattern.MARTELO,
    custoPercentual: 0,
    ...(sobrescrever.parametros ?? {}),
  }
  const opcoes = { ...parametros, serieDeSinais }
  const resultado = simular(lista, opcoes)
  const corte = dividirParaValidacao(lista)

  const presentes = new Set()
  serieDeSinais.forEach(({ sinais }) => sinais.forEach((s) => presentes.add(s)))

  return {
    resultado,
    ajuste: resultado ? simular(corte.registrosAjuste, parametros) : null,
    validacao: resultado
      ? simular(corte.registrosValidacao, { ...opcoes, aPartirDe: corte.aPartirDeValidacao })
      : null,
    comparativo: compararEstrategias(lista, opcoes),
    parametros,
    onParametro: vi.fn(),
    onRestaurar: vi.fn(),
    sinaisDisponiveis: [...presentes],
    carregando: false,
    erro: '',
    serie: serieDeSinais,
    robustez: {
      acaso: resultado ? compararComAcaso(lista, opcoes, { iteracoes: 30 }) : null,
      mapa: mapaDeSensibilidade(corte.registrosAjuste, parametros),
      sorte: { mediana: 1.2, p95: 4.5, iteracoes: 10, sinais: presentes.size },
      calculando: false,
    },
    analises: resultado
      ? {
          bootstrap: bootstrapRetorno(resultado.trades),
          semMelhores: retornoSemMelhores(resultado.trades),
          equilibrio: custoDeEquilibrio(resultado.trades, {
            direcao: parametros.direcao,
            buyAndHold: resultado.metricas.buyAndHold,
          }),
          excursoes: resumirExcursoes(resultado.trades),
          porMes: resultadoPorMes(resultado.curva, resultado.trades, 1000),
          submersa: serieSubmersa(resultado.curva),
        }
      : null,
    disparo: ultimoDisparo(lista, { sinalEntrada: CandlePattern.MARTELO, serieDeSinais }),
    experimentos: { tentativas: 3, limiar: 98.3, onZerar: vi.fn() },
    diario: { entradas: [], cheio: false, impressaoAtual: '', onGuardar: vi.fn(), onRemover: vi.fn() },
    t,
    locale: 'pt-BR',
    ...sobrescrever,
    ...(sobrescrever.parametros ? { parametros } : {}),
  }
}

const clicar = (nome) => fireEvent.click(screen.getByRole('button', { name: nome }))

describe('SimulationPanel › primeiro nível', () => {
  it('deve abrir com a resposta, o veredito, a curva e os três cards', () => {
    render(<SimulationPanel {...montarProps()} />)

    expect(screen.getByText('simulationReturnLabel')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'simulationVerdict' })).toBeTruthy()
    expect(screen.getByText('simulationChance')).toBeTruthy()
    expect(screen.getByText('simulationOutOfSample')).toBeTruthy()
    // Só a curva de capital: o resto dos gráficos espera um clique.
    expect(screen.getAllByTestId('grafico-linha')).toHaveLength(1)
  })

  it('deve manter o custo total na primeira linha, junto do retorno', () => {
    render(<SimulationPanel {...montarProps()} />)
    expect(screen.getByText('simulationTotalCost')).toBeTruthy()
  })

  it('deve deixar fechados o segundo nível, as regras avançadas e as análises', () => {
    render(<SimulationPanel {...montarProps()} />)

    expect(screen.queryByText('simulationUnderwater')).toBeNull()
    expect(screen.queryByText('simulationHoldout')).toBeNull()
    expect(screen.queryByText('simulationConfirm')).toBeNull()
    expect(screen.queryByText('simulationPriceChart')).toBeNull()
  })

  it('deve dizer que está medindo enquanto a régua aleatória não chegou', () => {
    const props = montarProps()
    render(<SimulationPanel {...props} robustez={{ ...props.robustez, acaso: null, calculando: true }} />)
    expect(screen.getByText(/simulationVerdictCalculating/)).toBeTruthy()
  })

  it('deve manter os controles e explicar quando a regra não tem saída', () => {
    render(
      <SimulationPanel
        {...montarProps({
          parametros: { saidaPorTempo: null, stopPercentual: null, alvoPercentual: null, sinalSaida: null },
        })}
      />
    )
    expect(screen.getByText('simulationNoExitRule')).toBeTruthy()
    expect(screen.getByText('simulationHold')).toBeTruthy()
  })
})

describe('SimulationPanel › o que abre com um clique', () => {
  it('deve mostrar as ressalvas agrupadas no veredito', () => {
    render(<SimulationPanel {...montarProps()} />)
    expect(screen.queryByText('simulationWindowShort')).toBeNull()
    clicar(/simulationCaveats/)
    expect(screen.getByText('simulationWindowShort')).toBeTruthy()
  })

  it('deve abrir as regras avançadas', () => {
    render(<SimulationPanel {...montarProps()} />)
    clicar(/simulationMoreRules/)
    expect(screen.getByText('simulationConfirm')).toBeTruthy()
    expect(screen.getByText('simulationRisk')).toBeTruthy()
  })

  it('deve abrir "Dá para confiar?" com robustez, risco, distância do pico e validação', () => {
    render(<SimulationPanel {...montarProps()} />)
    clicar(/simulationTrust/)

    expect(screen.getByText('simulationTrustPush')).toBeTruthy()
    expect(screen.getByText('simulationTrustRisk')).toBeTruthy()
    expect(screen.getByText('simulationUnderwater')).toBeTruthy()
    expect(screen.getByText('simulationHoldout')).toBeTruthy()
  })
})

describe('SimulationPanel › aprofundar', () => {
  it('deve abrir a operação no gráfico e voltar à janela inteira', () => {
    render(<SimulationPanel {...montarProps()} />)
    clicar('simulationTabTrades')

    expect(screen.getByText('simulationPriceChartHint')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'simulationTradeFocus' })[0])
    expect(screen.getByText('simulationFocusTrade')).toBeTruthy()

    clicar('simulationPriceChartBack')
    expect(screen.getByText('simulationPriceChartHint')).toBeTruthy()
  })

  it('deve fechar a análise ao clicar de novo no botão dela', () => {
    render(<SimulationPanel {...montarProps()} />)
    clicar('simulationTabMonthly')
    expect(screen.getByText('simulationMonthlySummary')).toBeTruthy()
    clicar('simulationTabMonthly')
    expect(screen.queryByText('simulationMonthlySummary')).toBeNull()
  })

  it('deve desenhar a excursão das operações', () => {
    render(<SimulationPanel {...montarProps()} />)
    clicar('simulationTabExcursion')
    expect(screen.getByTestId('grafico-dispersao').textContent).toContain('simulationWinners')
  })

  it('deve aplicar stop e alvo ao clicar numa célula do mapa', () => {
    const props = montarProps()
    render(<SimulationPanel {...props} />)
    clicar('simulationTabSensitivity')

    const celula = screen
      .getAllByRole('button', { name: 'simulationSensitivityCell' })
      .find((b) => !b.disabled)
    fireEvent.click(celula)

    const campos = props.onParametro.mock.calls.map(([nome]) => nome)
    expect(campos).toContain('stopPercentual')
    expect(campos).toContain('alvoPercentual')
  })

  it('deve trocar o sinal simulado a partir do ranking', () => {
    const props = montarProps()
    render(<SimulationPanel {...props} />)
    clicar('simulationTabRanking')

    expect(screen.getByText('simulationRankingLuck')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /^signal_/ })[0])
    expect(props.onParametro).toHaveBeenCalledWith('sinalEntrada', expect.any(String))
  })

  it('deve guardar a configuração no diário', () => {
    const props = montarProps()
    render(<SimulationPanel {...props} />)
    clicar('simulationTabJournal')

    clicar('simulationJournalSave')
    expect(props.diario.onGuardar).toHaveBeenCalled()
  })
})

describe('SimulationPanel › tela própria', () => {
  const seletor = <div data-testid="seletor-moeda">BTC</div>

  it('deve mostrar o seletor de moeda também enquanto a série carrega', () => {
    // Trocar de moeda enquanto a série carrega é justamente quando se quer: um
    // seletor que só aparece com o resultado prenderia a tela na moeda errada.
    render(<SimulationPanel {...montarProps()} carregando seletor={seletor} />)
    expect(screen.getByTestId('seletor-moeda')).toBeTruthy()
    expect(screen.getByText('simulationLoading')).toBeTruthy()
  })

  it('deve mostrar o seletor com o resultado na tela', () => {
    render(<SimulationPanel {...montarProps()} seletor={seletor} />)
    expect(screen.getByTestId('seletor-moeda')).toBeTruthy()
    expect(screen.getByText('simulationReturnLabel')).toBeTruthy()
  })

  it('deve usar o título como h1 da página, e como h2 dentro de outra tela', () => {
    const { unmount } = render(<SimulationPanel {...montarProps()} nivelTitulo="h1" />)
    expect(screen.getByRole('heading', { level: 1, name: 'simulation' })).toBeTruthy()
    unmount()
    render(<SimulationPanel {...montarProps()} />)
    expect(screen.getByRole('heading', { level: 2, name: 'simulation' })).toBeTruthy()
  })
})

describe('SimulationPanel › validação reservada', () => {
  const reserva = (extra = {}) => ({
    reservada: true,
    revelada: false,
    reveladaEm: null,
    revelacoes: 0,
    impressoesReveladas: new Set(),
    diasJanela: 180,
    diasReservados: 36,
    onRevelar: vi.fn(),
    ...extra,
  })

  it('deve guardar a validação e oferecer fixar a regra', () => {
    const r = reserva()
    render(<SimulationPanel {...montarProps({ validacao: null, ajuste: null })} reserva={r} />)

    expect(screen.getByText('simulationReservedValue')).toBeTruthy()
    expect(screen.queryByText('simulationOutOfSampleSub')).toBeNull()
    clicar('simulationReveal')
    expect(r.onRevelar).toHaveBeenCalledTimes(1)
  })

  it('deve dizer na linha da janela que os números são do ajuste', () => {
    // Sem provider, `t` devolve a chave: basta saber qual chave foi usada.
    render(<SimulationPanel {...montarProps({ validacao: null, ajuste: null })} reserva={reserva()} />)
    expect(screen.getByText('simulationWindowReserved')).toBeTruthy()
    expect(screen.queryByText('simulationWindow')).toBeNull()
  })

  it('não deve mostrar o ajuste contra a validação antes de a regra ser fixada', () => {
    render(<SimulationPanel {...montarProps({ validacao: null, ajuste: null })} reserva={reserva()} />)
    clicar(/simulationTrust/)
    expect(screen.getByText('simulationHoldoutReserved')).toBeTruthy()
    expect(screen.queryByText('simulationHoldout')).toBeNull()
  })

  it('deve guardar a validação do ranking, menos na linha da regra já fixada', () => {
    const props = montarProps()
    const fixada = impressaoDaConfiguracao(props.parametros)
    render(<SimulationPanel {...props} reserva={reserva({ reservada: false, revelada: true, impressoesReveladas: new Set([fixada]) })} />)
    clicar('simulationTabRanking')

    const linhas = screen.getAllByRole('row').slice(1)
    const daRegra = linhas.find((l) => l.textContent.includes(`signal_${props.parametros.sinalEntrada}`))
    const outras = linhas.filter((l) => l !== daRegra)
    expect(daRegra.textContent).not.toContain('simulationReservedValue')
    expect(outras.length).toBeGreaterThan(0)
    outras.forEach((l) => expect(l.textContent).toContain('simulationReservedValue'))
  })
})
