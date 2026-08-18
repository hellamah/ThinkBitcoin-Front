import { describe, expect, it } from 'vitest'
import {
  DirecaoAlerta,
  StatusAlerta,
  ErroAlerta,
  LIMITE_ALERTAS_ATIVOS,
  contarAtivos,
  ehAtivo,
  inferirDirecao,
  podeUsarAlertas,
  validarAlerta,
} from '../src/utils/alertaPreco'
import { AuthRole } from '../src/utils/authentication'

const alerta = (over = {}) => ({
  idAlertaPrecoTB: crypto.randomUUID(),
  siglaMoeda: 'BTC',
  valorAlvo: 150,
  direcao: DirecaoAlerta.ACIMA,
  status: StatusAlerta.ATIVO,
  ...over,
})

describe('podeUsarAlertas', () => {
  it('libera para Minerador, Administrador e Sistema', () => {
    for (const cargo of [AuthRole.MINERADOR, AuthRole.ADMINISTRADOR, AuthRole.SISTEMA]) {
      expect(podeUsarAlertas({ cargos: [cargo] })).toBe(true)
    }
  })

  it('bloqueia Consultor', () => {
    expect(podeUsarAlertas({ cargos: [AuthRole.CONSULTOR] })).toBe(false)
  })

  // Nega por omissão: esconder um botão é barato, prometer um recurso que a API
  // vai recusar depois não é.
  it('bloqueia usuário sem cargo, nulo ou com cargos vazios', () => {
    expect(podeUsarAlertas(null)).toBe(false)
    expect(podeUsarAlertas({})).toBe(false)
    expect(podeUsarAlertas({ cargos: [] })).toBe(false)
  })

  it('ignora diferença de caixa no cargo', () => {
    expect(podeUsarAlertas({ cargos: ['minerador'] })).toBe(true)
  })

  it('libera quando o usuário acumula cargos', () => {
    expect(podeUsarAlertas({ cargos: [AuthRole.CONSULTOR, AuthRole.MINERADOR] })).toBe(true)
  })
})

describe('inferirDirecao', () => {
  it('alvo acima do preço vigente sobe', () => {
    expect(inferirDirecao(150, 100)).toBe(DirecaoAlerta.ACIMA)
  })

  it('alvo abaixo do preço vigente desce', () => {
    expect(inferirDirecao(80, 100)).toBe(DirecaoAlerta.ABAIXO)
  })

  // Sem direção não há previsão a mostrar — a tela simplesmente não exibe a
  // linha, em vez de chutar um sentido.
  it('não infere sem sentido possível', () => {
    expect(inferirDirecao(100, 100)).toBeNull()
    expect(inferirDirecao('abc', 100)).toBeNull()
    expect(inferirDirecao(150, 0)).toBeNull()
    expect(inferirDirecao(150, null)).toBeNull()
  })

  // Campo em branco não é alvo zero. Sem esta guarda o modal anunciava
  // "avisamos quando o BTC cair até $0.00" antes de o usuário digitar.
  it('não infere com o campo vazio', () => {
    expect(inferirDirecao('', 100)).toBeNull()
    expect(inferirDirecao('   ', 100)).toBeNull()
    expect(inferirDirecao(null, 100)).toBeNull()
    expect(inferirDirecao(undefined, 100)).toBeNull()
  })

  it('aceita o alvo como string, que é o que o input devolve', () => {
    expect(inferirDirecao('150', 100)).toBe(DirecaoAlerta.ACIMA)
  })
})

describe('contarAtivos', () => {
  it('conta só os ativos', () => {
    const lista = [
      alerta(),
      alerta({ status: StatusAlerta.DISPARADO }),
      alerta({ status: StatusAlerta.CANCELADO }),
      alerta(),
    ]
    expect(contarAtivos(lista)).toBe(2)
  })

  it('tolera lista ausente', () => {
    expect(contarAtivos(undefined)).toBe(0)
    expect(contarAtivos(null)).toBe(0)
  })

  it('ehAtivo reconhece o status da API', () => {
    expect(ehAtivo(alerta())).toBe(true)
    expect(ehAtivo(alerta({ status: StatusAlerta.DISPARADO }))).toBe(false)
  })
})

describe('validarAlerta', () => {
  it('aceita alvo positivo diferente do preço vigente', () => {
    expect(validarAlerta({ valorAlvo: 150, precoAtual: 100, siglaMoeda: 'BTC' }))
      .toEqual({ valido: true, erro: null })
  })

  it('recusa valor não positivo ou não numérico', () => {
    for (const valorAlvo of [0, -1, '', 'abc', null]) {
      expect(validarAlerta({ valorAlvo, precoAtual: 100 }).erro).toBe(ErroAlerta.VALOR_INVALIDO)
    }
  })

  it('recusa alvo igual ao preço vigente', () => {
    expect(validarAlerta({ valorAlvo: 100, precoAtual: 100 }).erro).toBe(ErroAlerta.VALOR_IGUAL)
  })

  it('recusa quando não há preço para comparar', () => {
    expect(validarAlerta({ valorAlvo: 150, precoAtual: 0 }).erro).toBe(ErroAlerta.SEM_PRECO)
    expect(validarAlerta({ valorAlvo: 150, precoAtual: null }).erro).toBe(ErroAlerta.SEM_PRECO)
  })

  it('recusa duplicata da mesma moeda no mesmo valor', () => {
    const alertas = [alerta({ siglaMoeda: 'BTC', valorAlvo: 150 })]
    expect(validarAlerta({ valorAlvo: 150, precoAtual: 100, alertas, siglaMoeda: 'BTC' }).erro)
      .toBe(ErroAlerta.DUPLICADO)
  })

  it('não confunde duplicata entre moedas diferentes', () => {
    const alertas = [alerta({ siglaMoeda: 'ETH', valorAlvo: 150 })]
    expect(validarAlerta({ valorAlvo: 150, precoAtual: 100, alertas, siglaMoeda: 'BTC' }).valido)
      .toBe(true)
  })

  // Alerta já disparado não ocupa vaga nem bloqueia recriação: é a mesma regra
  // do teto no backend.
  it('não trata alerta disparado como duplicata', () => {
    const alertas = [alerta({ valorAlvo: 150, status: StatusAlerta.DISPARADO })]
    expect(validarAlerta({ valorAlvo: 150, precoAtual: 100, alertas, siglaMoeda: 'BTC' }).valido)
      .toBe(true)
  })

  it('recusa ao atingir o teto de ativos', () => {
    const alertas = Array.from({ length: LIMITE_ALERTAS_ATIVOS }, (_, i) =>
      alerta({ valorAlvo: 1000 + i })
    )
    expect(validarAlerta({ valorAlvo: 150, precoAtual: 100, alertas, siglaMoeda: 'BTC' }).erro)
      .toBe(ErroAlerta.LIMITE)
  })

  it('disparados não contam para o teto', () => {
    const alertas = Array.from({ length: LIMITE_ALERTAS_ATIVOS }, (_, i) =>
      alerta({ valorAlvo: 1000 + i, status: StatusAlerta.DISPARADO })
    )
    expect(validarAlerta({ valorAlvo: 150, precoAtual: 100, alertas, siglaMoeda: 'BTC' }).valido)
      .toBe(true)
  })

  // O teto é verificado antes do preço: quem já está no limite recebe a
  // mensagem útil mesmo que a cotação ainda não tenha carregado.
  it('reporta o teto mesmo sem preço vigente', () => {
    const alertas = Array.from({ length: LIMITE_ALERTAS_ATIVOS }, (_, i) =>
      alerta({ valorAlvo: 1000 + i })
    )
    expect(validarAlerta({ valorAlvo: 150, precoAtual: 0, alertas, siglaMoeda: 'BTC' }).erro)
      .toBe(ErroAlerta.LIMITE)
  })
})
