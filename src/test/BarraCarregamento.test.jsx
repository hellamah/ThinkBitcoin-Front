// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import BarraCarregamento, {
  ATRASO_PARA_APARECER_MS,
  DURACAO_DA_SAIDA_MS,
  TOLERANCIA_NO_FIM_MS,
} from '../src/components/BarraCarregamento'
import { iniciarCarregamento } from '../src/utils/carregamentoGlobal'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const montar = () => {
  const { container } = render(<BarraCarregamento />)
  const barra = container.querySelector('.barra-carregamento')
  const preenchimento = container.querySelector('.barra-carregamento-preenchimento')
  return {
    fase: () => barra.dataset.fase,
    escala: () => Number(preenchimento.style.transform.match(/scaleX\(([\d.]+)\)/)[1]),
    barra,
  }
}

const avancar = (ms) => act(() => { vi.advanceTimersByTime(ms) })

it('carga rápida não chega a aparecer', () => {
  // Quase toda troca de filtro volta antes do atraso. Piscar a cada clique
  // ensinaria a ignorar a barra justo quando ela importa.
  const tela = montar()

  let encerrar
  act(() => { encerrar = iniciarCarregamento() })
  avancar(ATRASO_PARA_APARECER_MS - 50)
  act(() => encerrar())
  avancar(1000)

  expect(tela.fase()).toBe('oculta')
})

it('carga demorada aparece, avança sem completar e completa ao terminar', () => {
  const tela = montar()

  let encerrar
  act(() => { encerrar = iniciarCarregamento() })
  avancar(ATRASO_PARA_APARECER_MS)
  expect(tela.fase()).toBe('correndo')
  expect(tela.barra.getAttribute('role')).toBe('progressbar')

  const noInicio = tela.escala()
  avancar(2000)
  const depoisDeDoisSegundos = tela.escala()
  expect(depoisDeDoisSegundos).toBeGreaterThan(noInicio)

  // Por mais que demore, não enche: chegar a 100% com a carga em andamento
  // faria a barra parecer travada.
  avancar(60_000)
  expect(tela.escala()).toBeLessThan(0.91)

  act(() => encerrar())
  avancar(TOLERANCIA_NO_FIM_MS)
  expect(tela.fase()).toBe('saindo')
  expect(tela.escala()).toBe(1)

  avancar(DURACAO_DA_SAIDA_MS)
  expect(tela.fase()).toBe('oculta')
  expect(tela.barra.getAttribute('role')).toBeNull()
})

it('não completa entre duas requisições encadeadas', () => {
  // `await` de uma para disparar a outra deixa um instante com o contador em
  // zero. A barra completar ali, e recomeçar logo depois, pareceria duas
  // cargas — ou uma que terminou e voltou atrás.
  const tela = montar()

  let encerrar
  act(() => { encerrar = iniciarCarregamento() })
  avancar(ATRASO_PARA_APARECER_MS + 400)

  act(() => encerrar())
  avancar(TOLERANCIA_NO_FIM_MS - 50)
  act(() => { encerrar = iniciarCarregamento() })
  avancar(1000)

  expect(tela.fase()).toBe('correndo')
  expect(tela.escala()).toBeLessThan(1)

  // Em dois passos: o timer da saída só é agendado depois que o React aplica
  // a fase nova, o que o act faz ao fim de cada avanço.
  act(() => encerrar())
  avancar(TOLERANCIA_NO_FIM_MS)
  avancar(DURACAO_DA_SAIDA_MS)
  expect(tela.fase()).toBe('oculta')
})
