import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { MdQueryStats, MdSensors } from 'react-icons/md'
import ErrorMessage from '../components/ErrorMessage'
import AbaAnalise from '../components/treinamento/AbaAnalise'
import AbaAoVivo from '../components/treinamento/AbaAoVivo'
import Cabecalho from '../components/treinamento/Cabecalho'
import DetalheEpisodio, { EpisodioNaoEncontrado } from '../components/treinamento/DetalheEpisodio'
import Filtros from '../components/treinamento/Filtros'
import { EstadoVazio, Painel } from '../components/treinamento/Painel'
import useTreinamentoEpisodios from '../hooks/useTreinamentoEpisodios'
import useTranslation from '../hooks/useTranslation'
import { UMA_HORA_MS, cadenciaMediana, instanteDe, ordenarPorData } from '../utils/treinamento'

// Treinamento de IA. Duas abas com perguntas diferentes:
//   · Ao vivo — o treino está rodando, e melhorando agora?
//   · Análise — o modelo está aprendendo, em quais moedas, ciclos e versões?
// A página só orquestra: filtros na URL, carga (useTreinamentoEpisodios) e
// qual aba ou detalhe mostrar. Cada parte vive em components/treinamento.

const estiloDasAbas = {
  minHeight: 44,
  borderBottom: '1px solid var(--border)',
  '& .MuiTabs-indicator': { backgroundColor: 'var(--accent)', height: 2 },
  '& .MuiTab-root': {
    color: 'var(--text-muted)',
    minHeight: 44,
    textTransform: 'none',
    fontWeight: 600,
    fontSize: 14,
    '&.Mui-selected': { color: 'var(--accent-ink)' },
  },
}

export default function TreinamentoEpisodios() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()

  // Filtros e aba na URL (?moedas=BTC,ETH&versao=x&aba=analise): sobrevivem a
  // refresh, geram link compartilhável e atravessam a navegação lista ⇄ detalhe.
  const [searchParams, setSearchParams] = useSearchParams()
  const [moedasSelecionadas, setMoedasSelecionadas] = useState(() =>
    (searchParams.get('moedas') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))
  const [versao, setVersao] = useState(() => searchParams.get('versao') || null)
  const [aba, setAba] = useState(() => (searchParams.get('aba') === 'analise' ? 'analise' : 'ao-vivo'))

  // Um período por aba, guardado aqui e não dentro dela: trocar de aba e
  // voltar mantém o que a pessoa tinha escolhido.
  const [periodoAoVivo, setPeriodoAoVivo] = useState({ duracaoMs: UMA_HORA_MS, fimMs: null })
  const [periodoAnalise, setPeriodoAnalise] = useState({ duracaoMs: 24 * UMA_HORA_MS, fimMs: null })

  // Com exatamente uma moeda o servidor já filtra; com duas ou mais, ele
  // devolve todas e o filtro é feito aqui.
  const moedaServidor = moedasSelecionadas.length === 1 ? moedasSelecionadas[0] : null

  // Deep link de detalhe (?dt=dataHora do episódio): o período do episódio
  // entra na primeira carga, mesmo sendo antigo.
  const dt = searchParams.get('dt')
  const alvoMs = useMemo(() => {
    const ms = dt ? new Date(dt).getTime() : NaN
    return Number.isFinite(ms) ? ms : undefined
  }, [dt])

  const dados = useTreinamentoEpisodios({ moeda: moedaServidor, versao, alvoMs })

  const consulta = useCallback((extra = {}) => {
    const p = new URLSearchParams()
    if (moedasSelecionadas.length > 0) p.set('moedas', moedasSelecionadas.join(','))
    if (versao) p.set('versao', versao)
    if (aba !== 'ao-vivo') p.set('aba', aba)
    Object.entries(extra).forEach(([k, v]) => { if (v) p.set(k, v) })
    return p.toString()
  }, [moedasSelecionadas, versao, aba])

  // A URL da lista espelha os filtros (replace, para não poluir o histórico).
  useEffect(() => {
    if (id) return
    const qs = consulta()
    if (qs !== searchParams.toString()) setSearchParams(qs, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, consulta])

  // Filtra aqui mesmo quando o servidor já filtra (uma moeda só): enquanto a
  // carga do filtro novo não chega, a lista na tela ainda é a do filtro
  // anterior, e sem isto o chip "BTC" aparecia aceso sobre as nove moedas.
  const filtrados = useMemo(() => {
    if (moedasSelecionadas.length === 0) return dados.itens
    return dados.itens.filter((i) => moedasSelecionadas.includes(i.moeda))
  }, [dados.itens, moedasSelecionadas])

  const timeline = useMemo(() => ordenarPorData(filtrados), [filtrados])
  const maisRecenteMs = timeline.length > 0 ? instanteDe(timeline[timeline.length - 1]) : null
  const cadenciaMs = useMemo(() => cadenciaMediana(timeline.slice(-200)), [timeline])

  // Moedas do filtro vêm do resumo (visão global, independente do filtro do
  // servidor); sem resumo, dos episódios carregados.
  const moedasDisponiveis = useMemo(() => {
    if (dados.resumo.length > 0) return dados.resumo.map((r) => r.moeda).filter(Boolean).sort()
    return [...new Set(dados.itens.map((i) => i.moeda).filter(Boolean))].sort()
  }, [dados.resumo, dados.itens])

  // Com filtro de versão ativo o servidor só devolve aquela versão, então ela
  // fica sempre na lista — senão o chip ativo sumiria.
  const versoesDisponiveis = useMemo(() => {
    const set = new Set(dados.itens.map((i) => i.versaoModelo).filter(Boolean))
    if (versao) set.add(versao)
    return [...set].sort()
  }, [dados.itens, versao])

  const alternarMoeda = (moeda) =>
    setMoedasSelecionadas((atuais) => (atuais.includes(moeda) ? atuais.filter((m) => m !== moeda) : [...atuais, moeda]))
  const selecionarMoeda = useCallback((moeda) => setMoedasSelecionadas([moeda]), [])

  // Navegações levam filtros e aba junto e, no detalhe, a data do episódio
  // (?dt=), para o link funcionar recarregado ou compartilhado.
  const abrirEpisodio = useCallback((epId, { substituir = false } = {}) => {
    const alvo = dados.itens.find((i) => i.idTreinamentoEpisodio === epId)
    const qs = consulta({ dt: alvo?.dataHora })
    navigate(`/treinamento-episodios/${epId}${qs ? `?${qs}` : ''}`, { replace: substituir })
  }, [dados.itens, consulta, navigate])

  // Andar entre episódios no detalhe (anterior/próximo, setas, pontos do
  // gráfico) substitui a entrada do histórico: com as setas é fácil passar por
  // vinte episódios, e o voltar do navegador deve levar à lista, não refazer
  // o caminho um por um.
  const andarEntreEpisodios = useCallback((epId) => abrirEpisodio(epId, { substituir: true }), [abrirEpisodio])

  if (id) {
    const item = dados.itens.find((i) => i.idTreinamentoEpisodio === id)
    if (dados.carregando && !item) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: 'var(--accent-ink)' }} />
        </Box>
      )
    }
    const voltarParaLista = () => {
      const qs = consulta()
      navigate(`/treinamento-episodios${qs ? `?${qs}` : ''}`)
    }
    if (!item) return <EpisodioNaoEncontrado onBack={voltarParaLista} />
    return <DetalheEpisodio item={item} allItems={dados.itens} onBack={voltarParaLista} onNavigate={andarEntreEpisodios} />
  }

  const propsDaAba = {
    timeline,
    maisRecenteMs,
    carregando: dados.carregando,
    carregandoPeriodo: dados.carregandoPeriodo,
    garantirPeriodo: dados.garantirPeriodo,
    onAbrir: abrirEpisodio,
    onSelecionarMoeda: selecionarMoeda,
  }

  // Sem dados ainda: spinner. Com dados de um filtro anterior, eles continuam
  // na tela (já refiltrados aqui) e só uma barra fina indica a nova carga —
  // trocar o conteúdo inteiro por um spinner fazia a página encolher e pular
  // a rolagem a cada clique num filtro.
  const semDados = dados.carregando && dados.itens.length === 0

  return (
    <div className="dashboard-container">
      <Box sx={{ p: { xs: 2, md: 4 }, color: 'var(--text-primary)' }}>
        <Cabecalho
          ultimoMs={maisRecenteMs}
          cadenciaMs={cadenciaMs}
          atualizadoEm={dados.atualizadoEm}
          carregando={dados.carregando}
          onAtualizar={dados.recarregar}
        />

        {dados.erro && <ErrorMessage message={dados.erro.message || t('treinamento.loadError')} />}

        <Filtros
          moedas={moedasDisponiveis}
          moedasSelecionadas={moedasSelecionadas}
          onAlternarMoeda={alternarMoeda}
          onLimparMoedas={() => setMoedasSelecionadas([])}
          versoes={versoesDisponiveis}
          versao={versao}
          onVersao={setVersao}
        />

        <Tabs value={aba} onChange={(_, v) => setAba(v)} aria-label={t('treinamento.tabsLabel')} sx={estiloDasAbas}>
          <Tab value="ao-vivo" id="aba-ao-vivo" aria-controls="painel-treinamento" icon={<MdSensors size={18} />} iconPosition="start" label={t('treinamento.tabLive')} />
          <Tab value="analise" id="aba-analise" aria-controls="painel-treinamento" icon={<MdQueryStats size={18} />} iconPosition="start" label={t('treinamento.tabAnalysis')} />
        </Tabs>
        <Box sx={{ height: 2 }}>
          {dados.carregando && !semDados && (
            <LinearProgress sx={{ height: 2, background: 'transparent', '& .MuiLinearProgress-bar': { background: 'var(--accent)' } }} />
          )}
        </Box>

        <Box role="tabpanel" id="painel-treinamento" aria-labelledby={`aba-${aba}`} sx={{ pt: 2 }}>
          {semDados ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: 'var(--accent-ink)' }} />
            </Box>
          ) : dados.erro ? null : timeline.length === 0 ? (
            <Painel><EstadoVazio mensagem={t('treinamento.noEpisodes')} /></Painel>
          ) : aba === 'ao-vivo' ? (
            <AbaAoVivo {...propsDaAba} periodo={periodoAoVivo} onPeriodo={setPeriodoAoVivo} />
          ) : (
            <AbaAnalise {...propsDaAba} resumo={dados.resumo} periodo={periodoAnalise} onPeriodo={setPeriodoAnalise} />
          )}
        </Box>
      </Box>
    </div>
  )
}
