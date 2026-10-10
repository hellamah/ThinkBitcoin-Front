import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import useTranslation from '../../hooks/useTranslation'
import { formatarDataCurta } from '../treinamento/formato'
import { STATUS, frequenciaDoPedido, rotuloOuCru } from '../../utils/pedidoAlteracao'

// A parte comum do cartão de um pedido do Pregão, na tela do administrador e na
// página aberta: o tipo, as telas, o status, o problema, o trecho da tela que o
// Trader citou, em quantos dias e rodadas ele apareceu e quando foi visto pela
// última vez. O que cada tela acrescenta (os botões de decisão, a linha do
// tempo) vem como `children`.

// A cor diz a gravidade, na ordem da lista: o errado antes do que falta.
const COR_DO_TIPO = Object.freeze({
  errado: 'var(--danger-ink)',
  automatico: 'var(--perf-warn)',
  confuso: 'var(--accent-ink)',
  falta: 'var(--text-secondary)',
})

const COR_DO_STATUS = Object.freeze({
  [STATUS.ABERTO]: 'var(--accent-ink)',
  [STATUS.REABERTO]: 'var(--perf-warn)',
  [STATUS.APROVADO]: 'var(--success-ink)',
  [STATUS.EM_CORRECAO]: 'var(--success-ink)',
  [STATUS.CORRIGIDO]: 'var(--success-ink)',
  [STATUS.VALIDADO]: 'var(--success-ink)',
  [STATUS.DESCARTADO]: 'var(--text-muted)',
})

function Etiqueta({ cor, children }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        borderRadius: 1,
        border: `1px solid ${cor}`,
        color: cor,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.7,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
  )
}

const dataCurta = (valor, locale) => {
  const ms = Date.parse(valor)
  return Number.isFinite(ms) ? formatarDataCurta(ms, locale) : '–'
}

export default function CartaoBase({ pedido, children }) {
  const { t, idioma } = useTranslation()
  const idTitulo = `pedido-${pedido.idPedidoAlteracao}`

  return (
    <Box
      component="article"
      aria-labelledby={idTitulo}
      sx={{
        p: { xs: 2, md: 2.5 },
        background: 'var(--surface-subtle)',
        border: '1px solid var(--border)',
        borderRadius: 1,
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        minWidth: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Etiqueta cor={COR_DO_TIPO[pedido.tipo] ?? 'var(--text-secondary)'}>
          {rotuloOuCru(t, `pregao.tipos.${pedido.tipo}`, pedido.tipo)}
        </Etiqueta>
        {/* No celular as telas descem para a linha de baixo, em vez de
            espremidas entre as duas etiquetas. */}
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', flex: { xs: '1 1 100%', sm: 1 }, order: { xs: 1, sm: 0 }, minWidth: 0 }}>
          {pedido.telas}
        </Typography>
        <Box component="span" sx={{ ml: 'auto', display: 'inline-flex' }}>
          <Etiqueta cor={COR_DO_STATUS[pedido.status] ?? 'var(--text-muted)'}>
            {rotuloOuCru(t, `pregao.status.${pedido.status}`, pedido.status)}
          </Etiqueta>
        </Box>
      </Box>

      <Typography id={idTitulo} variant="subtitle1" component="h2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
        {pedido.problema}
      </Typography>

      {pedido.trecho && (
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          {t('pregao.trecho')}{' '}
          <Box component="q" sx={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>{pedido.trecho}</Box>
        </Typography>
      )}

      <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)' }}>
        {frequenciaDoPedido(t, pedido)}
        {' · '}
        {t('pregao.ultimaVez', { data: dataCurta(pedido.ultimaVez, idioma.intl) })}
      </Typography>

      {children}
    </Box>
  )
}
