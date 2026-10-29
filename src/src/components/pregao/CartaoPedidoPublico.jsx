import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CartaoBase from './CartaoBase'
import useTranslation from '../../hooks/useTranslation'
import { autorDaAcao, eventosDoPedido, rotuloOuCru } from '../../utils/pedidoAlteracao'

// Um pedido do Pregão na página aberta (/pregao): o resumo comum (CartaoBase),
// o status dito em linguagem simples e a linha do tempo — "a Equipe Pregão
// pediu → um administrador aprovou → … → a Equipe Pregão conferiu". Só
// leitura: nada de quem decidiu nem do motivo, que a API pública nem traz.

// A cor do ponto diz quem deu o passo, a mesma em todo pedido. É só reforço:
// quem fez está escrito no próprio passo.
const COR_DO_AUTOR = Object.freeze({
  pregao: 'var(--accent-ink)',
  administrador: 'var(--success-ink)',
  correcao: 'var(--neon-alt)',
})

// Com ano: a linha do tempo de um pedido pode atravessar meses.
const dataComAno = (valor, locale) => {
  const d = new Date(valor)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function LinhaDoTempo({ eventos }) {
  const { t, idioma } = useTranslation()
  if (eventos.length === 0) return null
  return (
    <Box sx={{ mt: 0.75 }}>
      <Typography variant="caption" component="h3" sx={{ color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {t('pregaoPublico.linhaDoTempo')}
      </Typography>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, mt: 0.75, p: 0 }}>
        {eventos.map((e, i) => {
          const ultimo = i === eventos.length - 1
          return (
            <Box
              component="li"
              // A API não manda id do passo; a posição na ordem cronológica é estável.
              key={`${e.acao}-${e.dataHora}-${i}`}
              sx={{
                position: 'relative',
                pl: 2.5,
                pb: ultimo ? 0 : 1.25,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 6,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: COR_DO_AUTOR[autorDaAcao(e.acao)] ?? 'var(--text-muted)',
                },
                // O traço que liga um passo ao seguinte.
                '&::after': ultimo ? undefined : {
                  content: '""',
                  position: 'absolute',
                  left: '3.5px',
                  top: 18,
                  bottom: 2,
                  width: '2px',
                  background: 'var(--border-interactive)',
                },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.4 }}>
                {rotuloOuCru(t, `pregaoPublico.acoes.${e.acao}`, e.acao)}
              </Typography>
              <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)' }}>
                <time dateTime={e.dataHora}>{dataComAno(e.dataHora, idioma.intl)}</time>
                {/* O detalhe só vem nos passos do Pregão, escrito pelo backend. */}
                {e.detalhe ? ` · ${e.detalhe}` : ''}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

export default function CartaoPedidoPublico({ pedido }) {
  const { t } = useTranslation()
  // Status novo, que o dicionário ainda não explica, fica só com a etiqueta.
  const explicacao = rotuloOuCru(t, `pregaoPublico.statusExplicado.${pedido.status}`, '')
  return (
    <CartaoBase pedido={pedido}>
      {explicacao && (
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          {explicacao}
        </Typography>
      )}
      <LinhaDoTempo eventos={eventosDoPedido(pedido)} />
    </CartaoBase>
  )
}
