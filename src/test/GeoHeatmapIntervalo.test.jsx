// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import pt from '../src/lang/pt.json'
import { apiRequest } from '../src/utils/apiClient'

import GeoHeatmapView from '../src/pages/GeoHeatmapView'

// Rodada do Pregão de 09/11/2026, a primeira com dados reais: com a BTC em 1D e
// o mapa na tela, o Trader clicou no "1D" já aceso e a tela trocou o mapa por
// "Dados de mapa não disponíveis para o ativo selecionado no período". O
// clique limpava os dados, e como o intervalo era o mesmo, a busca não se
// repetia. Não era falta de coleta: na mesma janela a API tinha os dados.

afterEach(cleanup)

const t = (chave, vars = {}) => {
  const texto = chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave
  return typeof texto === 'string' ? texto.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '') : chave
}

vi.mock('../src/hooks/useTranslation', () => ({
  default: (() => { let valor; return () => (valor ??= { t, idioma: { intl: 'pt-BR' } }) })(),
}))

vi.mock('../src/context/AuthContext', () => {
  const auth = { token: 'token', user: { cargos: ['Minerador'] }, prefs: { idioma: 'pt' } }
  return { useAuth: () => auth }
})

vi.mock('../src/context/DashboardContext', () => {
  const dashboard = { refreshTrigger: 0, moedaSelecionada: 'BTC', setMoedaSelecionada: () => {} }
  return { useDashboard: () => dashboard }
})

vi.mock('../src/hooks/useCoinPrices', () => {
  const moedas = [{ id: 'id-btc', simbolo: 'BTC', variacao: 0.2 }]
  const valor = { moedas, erro: '', setErro: () => {} }
  return { default: () => valor }
})

vi.mock('../src/hooks/useAlertasPreco', () => {
  const valor = { alertas: [], carregando: false, erro: null, temAcesso: true, criar: () => {}, excluir: () => {} }
  return { default: () => valor }
})

vi.mock('../src/utils/apiClient', async (original) => ({
  ...(await original()),
  apiRequest: vi.fn(),
}))

vi.mock('../src/utils/preferences', async (original) => ({
  ...(await original()),
  getTourHeatmapVisto: () => true,
}))

vi.mock('../src/components/dashboard/DashboardHeader', () => ({ default: () => null }))
vi.mock('../src/components/dashboard/CoinCarousel', () => ({ default: () => null }))
vi.mock('../src/components/dashboard/AlertaPrecoModal', () => ({ default: () => null }))
vi.mock('../src/components/heatmap/HeatmapInsights', () => ({ default: () => null }))
vi.mock('../src/components/TourGuiadoSobDemanda', () => ({ default: () => null }))

const RESPOSTA = { resultado: { registros: [{ geoTop1Code: 'CH', frequenciaLideranca: 8, mediaIntensidade: 100 }] } }

const abrirEmUmDia = async () => {
  render(
    <MemoryRouter initialEntries={['/heatmap?moeda=BTC&intervalo=24h&regiao=world']}>
      <GeoHeatmapView />
    </MemoryRouter>,
  )
  await screen.findByText(t('heatmap.centralInteligencia'))
}

const botao = (rotulo) => screen.getByRole('button', { name: rotulo })

const janelaDaUltimaBusca = () => {
  const url = apiRequest.mock.calls.at(-1)[0]
  const params = new URLSearchParams(url.split('?')[1])
  return (new Date(params.get('dataFim')) - new Date(params.get('dataInicio'))) / 3_600_000
}

describe('GeoHeatmapView: botões de intervalo', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    apiRequest.mockResolvedValue(RESPOSTA)
  })

  it('clicar no intervalo já aceso mantém o mapa na tela', async () => {
    await abrirEmUmDia()
    expect(botao('1D').getAttribute('aria-pressed')).toBe('true')
    const buscas = apiRequest.mock.calls.length

    fireEvent.click(botao('1D'))

    expect(screen.queryByText(t('heatmap.semDados'))).toBeNull()
    expect(screen.getByText(t('heatmap.centralInteligencia'))).toBeTruthy()
    expect(apiRequest.mock.calls.length).toBe(buscas)
  })

  it('trocar de intervalo busca de novo, na janela do botão', async () => {
    await abrirEmUmDia()
    expect(janelaDaUltimaBusca()).toBeCloseTo(24)

    fireEvent.click(botao('1H'))

    await waitFor(() => expect(janelaDaUltimaBusca()).toBeCloseTo(1))
    await screen.findByText(t('heatmap.centralInteligencia'))
    expect(botao('1H').getAttribute('aria-pressed')).toBe('true')
    expect(botao('1D').getAttribute('aria-pressed')).toBe('false')
  })
})
