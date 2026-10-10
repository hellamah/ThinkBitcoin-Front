import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { MdSmartToy } from 'react-icons/md'
import ErrorMessage from '../components/ErrorMessage'
import CartaoPedidoPublico from '../components/pregao/CartaoPedidoPublico'
import FiltroDeStatus from '../components/pregao/FiltroDeStatus'
import { usePedidosPublicos } from '../hooks/usePedidosAlteracao'
import useTranslation from '../hooks/useTranslation'
import {
  FILTROS_PUBLICOS,
  FILTRO_PADRAO_PUBLICO,
  contagemPorFiltro,
  filtroDaUrl,
  pedidosDoFiltro,
} from '../utils/pedidoAlteracao'

// Página aberta /pregao: os pedidos da Equipe Pregão, sem login, só leitura,
// no molde de /privacidade e /termos. Quem chega de fora precisa entender sem
// contexto: o que é a Equipe Pregão, o que cada pedido diz e em que pé está,
// com a linha do tempo de cada um.
//
// Pública de propósito: é a parte do ciclo de melhoria que dá para mostrar.
// Aparecem só os pedidos que um administrador aprovou, e o caminho até a
// correção. O que espera decisão, os descartados, quem decidiu e o motivo ficam
// de fora (a API pública nem os traz): nenhum pedido do Pregão chega ao público
// sem revisão. A decisão continua na tela do administrador, /pedidos-pregao.
// Até o primeiro pedido aprovado, a lista fica vazia, e o estado vazio diz isso.

const estiloDoBotao = { color: 'var(--accent-ink)', textTransform: 'none', fontWeight: 600 }

export default function PregaoPublico() {
  const { t } = useTranslation()
  // O filtro na URL (?status=aprovado): sobrevive a refresh e gera link.
  const [searchParams, setSearchParams] = useSearchParams()
  const filtro = filtroDaUrl(searchParams.get('status'), FILTROS_PUBLICOS, FILTRO_PADRAO_PUBLICO)
  const { pedidos, carregando, erro, recarregar } = usePedidosPublicos()

  const contagem = useMemo(() => contagemPorFiltro(pedidos, FILTROS_PUBLICOS), [pedidos])
  const visiveis = useMemo(() => pedidosDoFiltro(pedidos, filtro, FILTROS_PUBLICOS), [pedidos, filtro])

  const trocarFiltro = (novo) => {
    const proximos = new URLSearchParams(searchParams)
    if (novo === FILTRO_PADRAO_PUBLICO) proximos.delete('status')
    else proximos.set('status', novo)
    setSearchParams(proximos, { replace: true })
  }

  const mensagemDeErro = erro ? (erro.hasBackendMessage ? erro.message : t('pregaoPublico.loadError')) : ''

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', px: { xs: 2, md: 0 }, py: { xs: 3, md: 5 } }}>
      <Paper
        elevation={0}
        sx={{
          backgroundColor: 'var(--surface-panel-solid)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          p: { xs: 2.5, md: 4 },
          color: 'var(--text-primary)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <MdSmartToy aria-hidden="true" style={{ color: 'var(--accent-ink)', fontSize: '1.5rem', flexShrink: 0 }} />
          <Typography component="h1" sx={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('pregaoPublico.title')}
          </Typography>
        </Box>
        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', mb: 3 }}>
          {t('pregaoPublico.subtitulo')}
        </Typography>

        <Typography component="h2" sx={{ fontSize: '1rem', fontWeight: 700, mb: 1 }}>
          {t('pregaoPublico.oQueETitulo')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1.5, lineHeight: 1.6 }}>
          {t('pregaoPublico.oQueE')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 3, lineHeight: 1.6 }}>
          {t('pregaoPublico.comoFunciona')}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <FiltroDeStatus
            filtros={FILTROS_PUBLICOS}
            filtro={filtro}
            contagem={pedidos === undefined ? null : contagem}
            onTrocar={trocarFiltro}
          />
        </Box>

        {pedidos === undefined && carregando ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={26} sx={{ color: 'var(--accent-ink)' }} />
          </Box>
        ) : pedidos === undefined && erro ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
            <ErrorMessage message={mensagemDeErro} />
            <Button size="small" onClick={recarregar} sx={estiloDoBotao}>{t('pregao.retry')}</Button>
          </Box>
        ) : (
          <>
            {erro && <ErrorMessage message={mensagemDeErro} />}
            {visiveis.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'var(--text-muted)', textAlign: 'center', py: 5 }}>
                {t((pedidos ?? []).length === 0 ? 'pregaoPublico.vazio' : 'pregao.vazio')}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {visiveis.map((p) => <CartaoPedidoPublico key={p.idPedidoAlteracao} pedido={p} />)}
              </Box>
            )}
          </>
        )}
      </Paper>
    </Box>
  )
}
