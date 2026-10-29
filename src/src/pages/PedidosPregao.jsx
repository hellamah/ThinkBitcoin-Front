import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { MdRefresh } from 'react-icons/md'
import ErrorMessage from '../components/ErrorMessage'
import CartaoPedido from '../components/pregao/CartaoPedido'
import FiltroDeStatus from '../components/pregao/FiltroDeStatus'
import { EstadoVazio, Painel } from '../components/treinamento/Painel'
import usePedidosAlteracao from '../hooks/usePedidosAlteracao'
import useTranslation from '../hooks/useTranslation'
import {
  DECISOES,
  FILTROS,
  FILTRO_PADRAO,
  contagemPorFiltro,
  filtroDaUrl,
  pedidosDoFiltro,
} from '../utils/pedidoAlteracao'

// Pedidos do Pregão (só administrador). O Trader, usuário sintético da Equipe
// Pregão, usa a plataforma três vezes por dia como um day trader; o que ele viu
// se repetir em dias diferentes vira um pedido de alteração. Esta tela é a
// primeira porta humana do ciclo: aprovar manda o pedido para quem corrige,
// descartar pede o motivo. A rota é restrita pelo cargo (ProtectedRoute) e a
// API confere de novo: a lista pede o cargo interno, a decisão, administrador.

const estiloDoBotao = { color: 'var(--accent-ink)', textTransform: 'none', fontWeight: 600 }

export default function PedidosPregao() {
  const { t } = useTranslation()
  // O filtro na URL (?status=aprovado): sobrevive a refresh e gera link.
  const [searchParams, setSearchParams] = useSearchParams()
  const filtro = filtroDaUrl(searchParams.get('status'))
  const { pedidos, carregando, erro, recarregar, decidir } = usePedidosAlteracao()
  // A última decisão: o pedido some da fila, e sem o aviso não se sabe para onde foi.
  const [aviso, setAviso] = useState(null)

  const contagem = useMemo(() => contagemPorFiltro(pedidos), [pedidos])
  const visiveis = useMemo(() => pedidosDoFiltro(pedidos, filtro), [pedidos, filtro])

  const trocarFiltro = (novo) => {
    setAviso(null)
    const proximos = new URLSearchParams(searchParams)
    if (novo === FILTRO_PADRAO) proximos.delete('status')
    else proximos.set('status', novo)
    setSearchParams(proximos, { replace: true })
  }

  // O erro sobe para o cartão, que o mostra junto do pedido.
  const aoDecidir = (pedido) => async (decisao, motivo) => {
    await decidir(pedido.idPedidoAlteracao, decisao, motivo)
    setAviso({ decisao, problema: pedido.problema })
  }

  return (
    <div className="dashboard-container">
      <Box sx={{ p: { xs: 2, md: 4 }, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>{t('pregao.title')}</Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', maxWidth: 900, mt: 0.5 }}>{t('pregao.intro')}</Typography>
          </Box>
          <Button size="small" startIcon={<MdRefresh />} onClick={recarregar} disabled={carregando} sx={estiloDoBotao}>
            {t('pregao.atualizar')}
          </Button>
        </Box>

        <FiltroDeStatus filtros={FILTROS} filtro={filtro} contagem={pedidos === undefined ? null : contagem} onTrocar={trocarFiltro} />

        {aviso && (
          <Box
            role="status"
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, maxWidth: 900,
              border: '1px solid var(--accent-a30)', background: 'var(--accent-a08)', borderRadius: 1,
            }}
          >
            <Typography variant="body2" sx={{ color: 'var(--text-primary)' }}>
              {t(aviso.decisao === DECISOES.APROVADO ? 'pregao.avisoAprovado' : 'pregao.avisoDescartado', { problema: aviso.problema })}
            </Typography>
          </Box>
        )}

        {pedidos === undefined && carregando ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: 'var(--accent-ink)' }} /></Box>
        ) : pedidos === undefined && erro ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
            <ErrorMessage message={erro.hasBackendMessage ? erro.message : t('pregao.loadError')} />
            <Button size="small" onClick={recarregar} sx={estiloDoBotao}>{t('pregao.retry')}</Button>
          </Box>
        ) : (
          <>
            {erro && <ErrorMessage message={erro.hasBackendMessage ? erro.message : t('pregao.loadError')} />}
            {visiveis.length === 0 ? (
              <Painel><EstadoVazio mensagem={t(filtro === FILTRO_PADRAO ? 'pregao.vazioEsperando' : 'pregao.vazio')} /></Painel>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {visiveis.map((p) => (
                  <CartaoPedido key={p.idPedidoAlteracao} pedido={p} onDecidir={aoDecidir(p)} />
                ))}
              </Box>
            )}
          </>
        )}
      </Box>
    </div>
  )
}
