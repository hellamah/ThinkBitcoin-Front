// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  apiRequest,
  DocumentoLegalEndpoint,
  HttpMethod,
  UserEndpoint,
} from '../src/utils/apiClient'
import { TipoConsentimento } from '../src/utils/consentimento'
import { CargoTipo } from '../src/utils/authentication'
import CadastroConviteOverlay from '../src/components/CadastroConviteOverlay'

// O `cargo` do cadastro é o número do CargoTipoEnum do DotNet
// (ThinkBitcoin.Utils/Enum/CargoTipoEnum.cs), sem conversor de enum por nome,
// e só o administrador escolhe: o que ele marca aqui é o cargo que a conta nova
// recebe. O convite mandava 0 para "Acesso completo" e 1 para "Consultor";
// 0 é Administrador e 1 é Minerador. Estes testes travam o número que sai em
// cada opção, escrito por extenso, para que a constante não se corrija sozinha
// junto com o erro.
//
// Sem provider de tradução, `t` devolve a própria chave: as opções aparecem
// como "miner" e "consultant".

vi.mock('../src/utils/apiClient', async (importOriginal) => ({
  ...(await importOriginal()),
  apiRequest: vi.fn(),
}))

const DOCUMENTOS = {
  [DocumentoLegalEndpoint.VIGENTE(TipoConsentimento.PRIVACIDADE)]: { idDocumentoLegal: 12, versao: '3.1' },
  [DocumentoLegalEndpoint.VIGENTE(TipoConsentimento.TERMOS)]: { idDocumentoLegal: 11, versao: '2.0' },
}

const botaoEnviar = (container) => container.querySelector('button[type="submit"]')

const caixaCargo = () => screen.getByRole('combobox', { name: /^cargo\b/ })

const abrirCargo = () => {
  fireEvent.mouseDown(caixaCargo())
  return screen.getByRole('listbox')
}

const escolherCargo = (rotulo) => {
  fireEvent.click(within(abrirCargo()).getByRole('option', { name: rotulo }))
}

const preencherEEnviar = async (container) => {
  fireEvent.change(screen.getByLabelText(/^name\b/), { target: { value: 'Pessoa Convidada' } })
  fireEvent.change(screen.getByLabelText(/^email\b/), { target: { value: 'convidada@teste.local' } })
  fireEvent.change(screen.getByLabelText(/^password\b/), { target: { value: 'senha-de-teste' } })
  screen.getAllByRole('checkbox').forEach((caixa) => fireEvent.click(caixa))

  // O botão espera os dois documentos legais chegarem da API.
  await waitFor(() => expect(botaoEnviar(container).disabled).toBe(false))
  fireEvent.click(botaoEnviar(container))

  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith(UserEndpoint.CREATE, expect.objectContaining({ method: HttpMethod.POST })),
  )
  const [, opcoes] = apiRequest.mock.calls.find(([endpoint]) => endpoint === UserEndpoint.CREATE)
  return opcoes.body
}

describe('CadastroConviteOverlay — cargo enviado', () => {
  beforeEach(() => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (DOCUMENTOS[endpoint]) return { resultado: DOCUMENTOS[endpoint] }
      return { resultado: [] }
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('CargoTipo segue a ordem do CargoTipoEnum do DotNet', () => {
    expect(CargoTipo).toEqual({ ADMINISTRADOR: 0, MINERADOR: 1, CONSULTOR: 2, SISTEMA: 3 })
  })

  it('sem mexer no cargo, o convite cria um Minerador (1)', async () => {
    const { container } = render(<CadastroConviteOverlay onFechar={vi.fn()} />)

    const corpo = await preencherEEnviar(container)

    expect(corpo.cargo).toBe(1)
  })

  it.each([
    ['miner', 1, 'Minerador'],
    ['consultant', 2, 'Consultor'],
  ])('a opção "%s" manda cargo %i (%s)', async (rotulo, numero) => {
    const { container } = render(<CadastroConviteOverlay onFechar={vi.fn()} />)

    escolherCargo(rotulo)
    const corpo = await preencherEEnviar(container)

    expect(corpo.cargo).toBe(numero)
  })

  it('nenhuma opção do convite cria Administrador nem Sistema', () => {
    render(<CadastroConviteOverlay onFechar={vi.fn()} />)

    const valores = within(abrirCargo())
      .getAllByRole('option')
      .map((opcao) => Number(opcao.getAttribute('data-value')))

    expect(valores).toEqual([1, 2])
  })
})
