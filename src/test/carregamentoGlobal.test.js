import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  haCarregamento,
  iniciarCarregamento,
  inscreverCarregamento,
} from '../src/utils/carregamentoGlobal'
import { apiRequest } from '../src/utils/apiClient'

// O contador vive no módulo e atravessa os testes deste arquivo. Cada teste
// encerra o que abriu; se algum esquecer, este guarda acusa no seguinte.
afterEach(() => {
  expect(haCarregamento(), 'um teste anterior deixou carregamento aberto').toBe(false)
})

describe('carregamentoGlobal › contador', () => {
  it('só apaga quando a última espera termina', () => {
    // O dashboard dispara três requisições por moeda juntas; a primeira que
    // volta não pode apagar a barra com as outras ainda no caminho.
    const encerrarA = iniciarCarregamento()
    const encerrarB = iniciarCarregamento()

    encerrarA()
    expect(haCarregamento()).toBe(true)

    encerrarB()
    expect(haCarregamento()).toBe(false)
  })

  it('encerrar a mesma espera duas vezes conta uma só', () => {
    // Sem isto, um `finally` e um cleanup encerrando a mesma espera tirariam
    // do contador uma que ainda está em andamento.
    const encerrarA = iniciarCarregamento()
    const encerrarB = iniciarCarregamento()

    encerrarA()
    encerrarA()
    expect(haCarregamento()).toBe(true)

    encerrarB()
  })

  it('avisa os inscritos só nas viradas, não a cada requisição', () => {
    const avisar = vi.fn()
    const desinscrever = inscreverCarregamento(avisar)

    const encerrarA = iniciarCarregamento()
    const encerrarB = iniciarCarregamento()
    encerrarA()
    expect(avisar).toHaveBeenCalledTimes(1)

    encerrarB()
    expect(avisar).toHaveBeenCalledTimes(2)

    desinscrever()
    iniciarCarregamento()()
    expect(avisar).toHaveBeenCalledTimes(2)
  })
})

describe('carregamentoGlobal › apiRequest', () => {
  const respostaOk = () => ({ ok: true, status: 200, json: () => Promise.resolve({ ok: 1 }) })

  it('acende durante a requisição e apaga quando ela volta', async () => {
    let responder
    fetch.mockReturnValue(new Promise((resolve) => { responder = resolve }))

    const pedido = apiRequest('/lento')
    expect(haCarregamento()).toBe(true)

    responder(respostaOk())
    await pedido
    expect(haCarregamento()).toBe(false)
  })

  it('apaga também quando a requisição falha', async () => {
    // Um erro que deixasse o contador preso manteria a barra na tela para
    // sempre, bem na hora em que a pessoa precisa ver a mensagem de falha.
    fetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error()) })
    await expect(apiRequest('/quebra')).rejects.toThrow()
    expect(haCarregamento()).toBe(false)

    fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiRequest('/sem-rede')).rejects.toThrow()
    expect(haCarregamento()).toBe(false)
  })

  it('não acende para polling marcado como segundo plano', async () => {
    let responder
    fetch.mockReturnValue(new Promise((resolve) => { responder = resolve }))

    const pedido = apiRequest('/polling', { emSegundoPlano: true })
    expect(haCarregamento()).toBe(false)

    responder(respostaOk())
    await pedido
  })

  it('não acende para o que vem do cache', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ dados: { guardado: true }, expira: Date.now() + 60_000 }),
      setItem: () => {},
      removeItem: () => {},
    })
    try {
      const pedido = apiRequest('/guardado', { useCache: true })
      expect(haCarregamento()).toBe(false)
      expect(await pedido).toEqual({ guardado: true })
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
