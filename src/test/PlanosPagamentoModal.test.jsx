// @vitest-environment jsdom
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { apiRequest, AuthenticationEndpoint, PlanosPagamentoEndpoint } from '../src/utils/apiClient'
import PlanosPagamentoModal from '../src/components/PlanosPagamentoModal'

// O fluxo de pagamento é onde um erro de front custa dinheiro ou confiança:
// o plano é ativado pelo backend, via webhook, e a tela só reflete o status da
// cobrança por polling. Estes testes travam o que o polling pode e não pode
// fazer — inclusive a regressão que o próprio componente documenta: fechar o
// modal no meio do pagamento deixava a consulta rodando, invisível, e trocava o
// token do usuário com a tela fechada se o Pix caísse nesse intervalo.
//
// Sem provider de tradução, `t` devolve a própria chave: as asserções leem as
// chaves, que não mudam quando alguém revisa a redação.

// O Scheduler do React roda cada tarefa — inclusive os efeitos passivos, onde
// o polling é registrado — num setImmediate. Aqui ele espera 5 ms, de
// propósito. É a ordem que um CI carregado produz de vez em quando e que numa
// máquina rápida quase nunca acontece: o findBy devolve o controle ao teste
// ANTES de o efeito rodar, o teste avança o relógio, e o avanço cai no vazio
// porque o intervalo ainda não existe. Foi assim que o deploy quebrou uma vez
// em tantas, com o teste passando sempre aqui. Com o atraso fixo essa ordem
// acontece sempre, e quem avançar o relógio sem `esperarPolling` falha na hora.
const { setImmediateOriginal } = vi.hoisted(() => {
  const setImmediateOriginal = globalThis.setImmediate
  globalThis.setImmediate = (cb, ...args) => setTimeout(cb, 5, ...args)
  return { setImmediateOriginal }
})
afterAll(() => {
  globalThis.setImmediate = setImmediateOriginal
})

vi.mock('../src/utils/apiClient', async (importOriginal) => ({
  ...(await importOriginal()),
  apiRequest: vi.fn(),
}))

const { login } = vi.hoisted(() => ({ login: vi.fn() }))
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ login }),
}))

const INTERVALO = 4000
const PLANO_PAGO = { idPlanoPagamento: 2, nome: 'ThinkElite', valor: 49.9, duracaoDias: 30, ativo: false }
const COBRANCA = { idCobranca: 'c1', status: 'PENDENTE', tipoPlano: 2, valor: 49.9, pixCopiaECola: '000201PIXCOPIAECOLA' }

// O que cada consulta de status vai responder, em ordem. Vazio = PENDENTE.
let respostasDaCobranca

const configurarApi = () => {
  apiRequest.mockImplementation(async (endpoint) => {
    if (endpoint === PlanosPagamentoEndpoint.LIST) return { resultado: { planos: [PLANO_PAGO] } }
    if (endpoint === PlanosPagamentoEndpoint.COBRANCA_PENDENTE) return { resultado: { cobranca: COBRANCA } }
    if (endpoint === PlanosPagamentoEndpoint.COBRANCA('c1')) {
      const proxima = respostasDaCobranca.shift() ?? 'PENDENTE'
      if (proxima instanceof Error) throw proxima
      return { resultado: { cobranca: { ...COBRANCA, status: proxima } } }
    }
    if (endpoint === AuthenticationEndpoint.RENOVAR) return { resultado: { tokenAutenticado: 'token.renovado.x' } }
    throw new Error(`endpoint inesperado no teste: ${endpoint}`)
  })
}

const consultasDeStatus = () =>
  apiRequest.mock.calls.filter(([endpoint]) => endpoint === PlanosPagamentoEndpoint.COBRANCA('c1')).length

const props = { onClose: () => {}, token: 't', user: { idUsuarioTB: 1 } }

// Espera o polling existir. O QR code aparecer não basta: o intervalo é criado
// num efeito que roda depois do commit (ver o atraso do Scheduler no topo). Só
// o polling usa setInterval nesta árvore, então a contagem de timers falsos diz
// exatamente quando ele está no ar. Espera com setTimeout real — o waitFor da
// Testing Library sonda por setInterval, que aqui é falso e nunca dispararia.
const esperarPolling = async () => {
  const limite = Date.now() + 2000
  while (vi.getTimerCount() === 0) {
    if (Date.now() > limite) throw new Error('o polling da cobrança não foi registrado')
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
}

// Abre o modal com uma cobrança pendente: ele vai direto para o QR code.
const abrirNoPagamento = async (extra = {}) => {
  const tela = render(<PlanosPagamentoModal visible {...props} {...extra} />)
  await screen.findByText('planos.awaitingPayment')
  await esperarPolling()
  return tela
}

const passarIntervalos = (n = 1) =>
  act(async () => {
    vi.advanceTimersByTime(INTERVALO * n)
  })

describe('PlanosPagamentoModal › polling da cobrança Pix', () => {
  beforeEach(() => {
    // Só o intervalo é falso. Promessas e setTimeout seguem reais, que é do
    // que o findBy da Testing Library precisa para esperar a tela.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    respostasDaCobranca = []
    configurarApi()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('retoma a cobrança pendente e, quando o Pix cai, conclui e renova o token', async () => {
    const onRefresh = vi.fn()
    await abrirNoPagamento({ onRefresh })
    expect(screen.getByText('000201PIXCOPIAECOLA')).toBeTruthy()

    respostasDaCobranca.push('PAGO')
    await passarIntervalos()

    await screen.findByText('planos.paymentSuccess')
    expect(onRefresh).toHaveBeenCalled()
    // O cargo novo viaja no token: sem a renovação, as permissões pagas só
    // valeriam no próximo login.
    expect(login).toHaveBeenCalledWith('token.renovado.x')
  })

  it('fechar o modal no meio do pagamento para o polling', async () => {
    const { rerender } = await abrirNoPagamento()
    await passarIntervalos()
    expect(consultasDeStatus()).toBe(1)

    // Se o polling sobrevivesse ao fechamento, esta resposta trocaria o token
    // com a tela fechada, sem nada na interface dizendo que o plano mudou.
    respostasDaCobranca.push('PAGO')
    rerender(<PlanosPagamentoModal visible={false} {...props} />)
    await passarIntervalos(5)

    expect(consultasDeStatus()).toBe(1)
    expect(login).not.toHaveBeenCalled()
  })

  it('cobrança expirada volta para a lista com o aviso e para de consultar', async () => {
    await abrirNoPagamento()

    respostasDaCobranca.push('EXPIRADO')
    await passarIntervalos()

    await screen.findByText('planos.paymentExpired')
    expect(screen.getByText('PLANOS.UPGRADE')).toBeTruthy()

    await passarIntervalos(3)
    expect(consultasDeStatus()).toBe(1)
  })

  it('uma falha de rede numa consulta não interrompe o polling', async () => {
    await abrirNoPagamento()

    respostasDaCobranca.push(new Error('rede oscilou'), 'PAGO')
    await passarIntervalos()
    expect(screen.getByText('planos.awaitingPayment')).toBeTruthy()

    await passarIntervalos()
    await screen.findByText('planos.paymentSuccess')
  })
})
