// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { apiRequest } from '../src/utils/apiClient'
import { MotivoPendencia, OrigemConsentimento, TipoConsentimento } from '../src/utils/consentimento'
import ConsentimentoLGPD from '../src/components/ConsentimentoLGPD'

// O modal de re-consentimento bloqueia a navegação até o aceite, e o que ele
// envia é prova jurídica: qual documento, qual versão, por qual caminho. Estes
// testes travam as regras que a tela promete — aceitar tudo ou nada, ler sem
// aceitar por acidente, dizer o que mudou, e não fingir que registrou quando
// a API recusou.
//
// Sem provider de tradução, `t` devolve a própria chave.

vi.mock('../src/utils/apiClient', async (importOriginal) => ({
  ...(await importOriginal()),
  apiRequest: vi.fn(),
}))

const PENDENCIAS = [
  {
    idDocumentoLegal: 11,
    tipo: TipoConsentimento.TERMOS,
    titulo: 'Termos de Uso',
    versao: '2.0',
    motivo: MotivoPendencia.VERSAO_NOVA,
    resumoAlteracoes: 'Alertas por e-mail passam a exigir aceite.',
    versaoAceitaAnteriormente: '1.0',
  },
  {
    idDocumentoLegal: 12,
    tipo: TipoConsentimento.PRIVACIDADE,
    titulo: 'Política de Privacidade',
    versao: '3.1',
    motivo: MotivoPendencia.NUNCA_ACEITO,
  },
]

const TEXTO = {
  11: 'Texto integral dos termos.',
  12: 'Texto integral da política.',
}

const botaoDeAceite = () =>
  screen.getByRole('button', { name: /^consentimento\.(leiaParaContinuar|aceitarEContinuar|registrando)$/ })

const abrir = async (onConcluir = vi.fn()) => {
  render(<ConsentimentoLGPD pendencias={PENDENCIAS} onConcluir={onConcluir} />)
  await screen.findByText(TEXTO[11])
  return onConcluir
}

const marcarTudo = () => screen.getAllByRole('checkbox').forEach((caixa) => fireEvent.click(caixa))

describe('ConsentimentoLGPD', () => {
  beforeEach(() => {
    apiRequest.mockImplementation(async (endpoint) => {
      const id = Number(endpoint.split('/').pop())
      return { resultado: { conteudo: TEXTO[id] } }
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('o aceite só libera com todos os documentos marcados', async () => {
    await abrir()
    const [termos, privacidade] = screen.getAllByRole('checkbox')

    expect(botaoDeAceite().disabled).toBe(true)
    fireEvent.click(termos)
    // Aceitar um e adiar o outro deixaria a conta num estado que a API recusa.
    expect(botaoDeAceite().disabled).toBe(true)
    fireEvent.click(privacidade)
    expect(botaoDeAceite().disabled).toBe(false)
    expect(botaoDeAceite().textContent).toBe('consentimento.aceitarEContinuar')
  })

  it('clicar no título do documento abre a leitura dele sem marcar o aceite', async () => {
    await abrir()

    // O título mora dentro do <label> da caixa: ir ler o documento não pode
    // marcar o aceite no caminho.
    //
    // Este teste trava o COMPORTAMENTO, não a guarda do componente. No jsdom o
    // próprio HTML já impede — o label não repassa clique vindo de conteúdo
    // interativo, e um <button> é —, então tirar o preventDefault/stopPropagation
    // do título não o faz falhar (conferido). A guarda continua lá pelo motivo
    // que o componente explica: não depender do tratamento de clique do MUI.
    fireEvent.click(screen.getByRole('button', { name: 'Política de Privacidade' }))

    expect(await screen.findByText(TEXTO[12])).toBeTruthy()
    screen.getAllByRole('checkbox').forEach((caixa) => expect(caixa.checked).toBe(false))
  })

  it('diz o que mudou quando a pendência é uma versão nova', async () => {
    await abrir()

    expect(screen.getByText('consentimento.tituloAtualizado')).toBeTruthy()
    expect(screen.getByText('Alertas por e-mail passam a exigir aceite.')).toBeTruthy()
  })

  it('envia todos os documentos, concedidos, com a origem de atualização de versão', async () => {
    const onConcluir = await abrir(vi.fn().mockResolvedValue(undefined))

    marcarTudo()
    fireEvent.click(botaoDeAceite())
    await screen.findByText('consentimento.aceitarEContinuar')

    expect(onConcluir).toHaveBeenCalledTimes(1)
    expect(onConcluir).toHaveBeenCalledWith(
      [
        { tipo: TipoConsentimento.TERMOS, idDocumentoLegal: 11, concedido: true },
        { tipo: TipoConsentimento.PRIVACIDADE, idDocumentoLegal: 12, concedido: true },
      ],
      OrigemConsentimento.ATUALIZACAO_VERSAO
    )
  })

  it('se o registro falha, avisa e deixa tentar de novo', async () => {
    const onConcluir = await abrir(
      vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(undefined)
    )

    marcarTudo()
    fireEvent.click(botaoDeAceite())

    expect(await screen.findByText('consentimento.erroAceite')).toBeTruthy()
    expect(botaoDeAceite().disabled).toBe(false)

    fireEvent.click(botaoDeAceite())
    await screen.findByText('consentimento.aceitarEContinuar')
    expect(onConcluir).toHaveBeenCalledTimes(2)
  })

  it('a recusa explicada pelo servidor aparece como veio', async () => {
    const recusa = Object.assign(new Error('Esta versão foi substituída. Recarregue para ler a atual.'), {
      hasBackendMessage: true,
    })
    await abrir(vi.fn().mockRejectedValue(recusa))

    marcarTudo()
    fireEvent.click(botaoDeAceite())

    expect(await screen.findByText('Esta versão foi substituída. Recarregue para ler a atual.')).toBeTruthy()
  })
})
