import { describe, expect, it } from 'vitest'
import {
  DOCUMENTOS_OBRIGATORIOS,
  OrigemConsentimento,
  TipoConsentimento,
  aceitesCompletos,
  consentimentosAtuais,
  estaConcedido,
  montarAceite,
  temIntegridadeComprometida,
  tipoDoSlug,
} from '../src/utils/consentimento'

const registro = (over = {}) => ({
  idConsentimentoUsuarioTB: crypto.randomUUID(),
  tipo: TipoConsentimento.PRIVACIDADE,
  concedido: true,
  origem: 'CADASTRO',
  dataRegistro: '2026-08-01T10:00:00Z',
  idDocumentoLegal: crypto.randomUUID(),
  versaoDocumento: '1.0',
  conteudoIntegro: true,
  ...over,
})

describe('tipoDoSlug', () => {
  it('traduz os caminhos públicos para o tipo da API', () => {
    expect(tipoDoSlug('privacidade')).toBe(TipoConsentimento.PRIVACIDADE)
    expect(tipoDoSlug('termos')).toBe(TipoConsentimento.TERMOS)
  })

  it('devolve nulo para caminho desconhecido', () => {
    expect(tipoDoSlug('cookies')).toBeNull()
    expect(tipoDoSlug(undefined)).toBeNull()
  })
})

describe('montarAceite', () => {
  it('leva a versão junto com o aceite', () => {
    expect(montarAceite(TipoConsentimento.TERMOS, 'abc')).toEqual({
      tipo: TipoConsentimento.TERMOS,
      idDocumentoLegal: 'abc',
      concedido: true,
    })
  })

  it('normaliza versão ausente para nulo em vez de undefined', () => {
    expect(montarAceite(TipoConsentimento.COOKIES).idDocumentoLegal).toBeNull()
  })
})

describe('aceitesCompletos', () => {
  it('exige os dois documentos obrigatórios com versão', () => {
    const aceites = DOCUMENTOS_OBRIGATORIOS.map((tipo) => montarAceite(tipo, 'v1'))
    expect(aceitesCompletos(aceites)).toBe(true)
  })

  // O botão de cadastro depende disto: sem a versão, a API recusa o aceite e o
  // usuário só descobriria depois de preencher o formulário inteiro.
  it('recusa aceite sem versão do documento', () => {
    const aceites = DOCUMENTOS_OBRIGATORIOS.map((tipo) => montarAceite(tipo, null))
    expect(aceitesCompletos(aceites)).toBe(false)
  })

  it('recusa quando falta um dos documentos', () => {
    expect(aceitesCompletos([montarAceite(TipoConsentimento.PRIVACIDADE, 'v1')])).toBe(false)
  })

  it('recusa entrada que não é lista', () => {
    expect(aceitesCompletos(null)).toBe(false)
    expect(aceitesCompletos([])).toBe(false)
  })
})

describe('consentimentosAtuais', () => {
  it('mantém o registro mais recente de cada tipo', () => {
    const historico = [
      registro({ dataRegistro: '2026-08-01T10:00:00Z', concedido: true }),
      registro({ dataRegistro: '2026-08-10T10:00:00Z', concedido: false }),
      registro({ tipo: TipoConsentimento.TERMOS, dataRegistro: '2026-08-02T10:00:00Z' }),
    ]

    const atuais = consentimentosAtuais(historico)

    expect(atuais[TipoConsentimento.PRIVACIDADE].concedido).toBe(false)
    expect(atuais[TipoConsentimento.TERMOS].concedido).toBe(true)
  })

  it('não depende da ordem em que o histórico chega', () => {
    const antigo = registro({ dataRegistro: '2026-08-01T10:00:00Z', concedido: true })
    const recente = registro({ dataRegistro: '2026-08-10T10:00:00Z', concedido: false })

    expect(consentimentosAtuais([recente, antigo])).toEqual(consentimentosAtuais([antigo, recente]))
  })

  it('devolve objeto vazio para histórico ausente', () => {
    expect(consentimentosAtuais(null)).toEqual({})
  })
})

describe('estaConcedido', () => {
  it('segue o último registro do tipo', () => {
    const historico = [
      registro({ dataRegistro: '2026-08-01T10:00:00Z', concedido: true }),
      registro({ dataRegistro: '2026-08-10T10:00:00Z', concedido: false }),
    ]
    expect(estaConcedido(historico, TipoConsentimento.PRIVACIDADE)).toBe(false)
  })

  // Nega por omissão: tratar ausência de registro como consentimento seria
  // presumir exatamente o que a LGPD manda provar.
  it('trata ausência de registro como não concedido', () => {
    expect(estaConcedido([], TipoConsentimento.COOKIES)).toBe(false)
    expect(estaConcedido(null, TipoConsentimento.COOKIES)).toBe(false)
  })
})

describe('temIntegridadeComprometida', () => {
  it('acusa quando algum registro aponta para texto alterado depois do aceite', () => {
    expect(temIntegridadeComprometida([registro(), registro({ conteudoIntegro: false })])).toBe(true)
  })

  it('não acusa quando todos conferem', () => {
    expect(temIntegridadeComprometida([registro(), registro()])).toBe(false)
    expect(temIntegridadeComprometida([])).toBe(false)
  })
})

describe('OrigemConsentimento', () => {
  // CADASTRO é carimbado pelo servidor no fluxo de criação de conta. Expor a
  // constante aqui abriria caminho para o front declarar um aceite como se
  // tivesse vindo do cadastro.
  it('não expõe a origem CADASTRO ao cliente', () => {
    expect(Object.values(OrigemConsentimento)).not.toContain('CADASTRO')
  })
})
