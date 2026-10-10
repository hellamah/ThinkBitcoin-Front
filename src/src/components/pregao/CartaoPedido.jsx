import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { MdCheck, MdClose } from 'react-icons/md'
import ErrorMessage from '../ErrorMessage'
import useTranslation from '../../hooks/useTranslation'
import { formatarDataCurta } from '../treinamento/formato'
import {
  DECISOES,
  STATUS,
  TAMANHO_MOTIVO,
  conferirMotivo,
  frequenciaDoPedido,
  podeDecidir,
  rotuloOuCru,
} from '../../utils/pedidoAlteracao'

// Um pedido de alteração do Pregão, com o essencial para decidir: o tipo, as
// telas, o problema, o trecho da tela que o Trader citou, em quantos dias e
// rodadas ele apareceu e quando foi visto pela última vez. Aprovar vai direto;
// descartar abre o campo do motivo, que é obrigatório.

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

const estiloDoBotao = { textTransform: 'none', fontWeight: 600 }

export default function CartaoPedido({ pedido, onDecidir }) {
  const { t, idioma } = useTranslation()
  const [descartando, setDescartando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const decidivel = podeDecidir(pedido)
  const idTitulo = `pedido-${pedido.idPedidoAlteracao}`
  const motivoValido = !conferirMotivo(DECISOES.DESCARTADO, motivo).erro

  const enviar = async (decisao) => {
    const conferido = conferirMotivo(decisao, decisao === DECISOES.DESCARTADO ? motivo : '')
    if (conferido.erro) {
      setErro(t(conferido.erro, { max: TAMANHO_MOTIVO }))
      return
    }
    setErro('')
    setEnviando(true)
    try {
      await onDecidir(decisao, conferido.motivo)
      setDescartando(false)
      setMotivo('')
    } catch (e) {
      // A regra recusada pela API (pedido já decidido, motivo faltando) vem com
      // a mensagem dela; falha de rede, com a frase genérica.
      setErro(e?.hasBackendMessage ? e.message : t('pregao.erroDecisao'))
    } finally {
      setEnviando(false)
    }
  }

  const cancelarDescarte = () => {
    setDescartando(false)
    setMotivo('')
    setErro('')
  }

  const decisao = [
    pedido.decididoPor ? t('pregao.decididoPor', { quem: pedido.decididoPor }) : null,
    pedido.motivoDecisao ? t('pregao.motivoDecisao', { motivo: pedido.motivoDecisao }) : null,
  ].filter(Boolean).join(' · ')

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

      {pedido.status === STATUS.REABERTO && (
        <Typography variant="caption" component="p" sx={{ color: 'var(--perf-warn)' }}>
          {t('pregao.reabertoDica')}
        </Typography>
      )}

      {decisao && (
        <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)' }}>
          {decisao}
        </Typography>
      )}

      {decidivel && !descartando && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<MdCheck />}
            disabled={enviando}
            onClick={() => enviar(DECISOES.APROVADO)}
            sx={estiloDoBotao}
          >
            {enviando ? t('pregao.enviando') : t('pregao.aprovar')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<MdClose />}
            disabled={enviando}
            onClick={() => { setErro(''); setDescartando(true) }}
            sx={{ ...estiloDoBotao, color: 'var(--text-primary)', borderColor: 'var(--border-strong)' }}
          >
            {t('pregao.descartar')}
          </Button>
        </Box>
      )}

      {decidivel && descartando && (
        <Box
          component="form"
          noValidate
          onSubmit={(e) => { e.preventDefault(); enviar(DECISOES.DESCARTADO) }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}
        >
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            size="small"
            label={t('pregao.motivoRotulo')}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={enviando}
            required
            helperText={`${motivo.length}/${TAMANHO_MOTIVO} · ${t('pregao.motivoAjuda')}`}
            slotProps={{
              htmlInput: { maxLength: TAMANHO_MOTIVO },
              inputLabel: { sx: { color: 'var(--text-muted)' } },
              formHelperText: { sx: { color: 'var(--text-muted)', mx: 0 } },
            }}
            sx={{
              '& .MuiOutlinedInput-root': { backgroundColor: 'var(--surface-subtle)' },
              '& .MuiInputBase-input': { color: 'var(--text-primary)' },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              type="submit"
              variant="contained"
              size="small"
              disabled={enviando || !motivoValido}
              sx={{
                ...estiloDoBotao,
                backgroundColor: 'var(--danger)',
                color: '#fff',
                '&:hover': { backgroundColor: 'var(--danger)', filter: 'brightness(1.1)' },
                '&.Mui-disabled': { backgroundColor: 'var(--danger-a10)', color: 'var(--text-faint)' },
              }}
            >
              {enviando ? t('pregao.enviando') : t('pregao.confirmarDescarte')}
            </Button>
            <Button size="small" onClick={cancelarDescarte} disabled={enviando} sx={{ ...estiloDoBotao, color: 'var(--text-muted)' }}>
              {t('pregao.cancelar')}
            </Button>
          </Box>
        </Box>
      )}

      {erro && (
        <Box sx={{ mt: 0.5, '& .MuiAlert-root': { mb: 0 } }}>
          <ErrorMessage message={erro} onClose={() => setErro('')} />
        </Box>
      )}
    </Box>
  )
}
