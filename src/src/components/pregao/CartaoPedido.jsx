import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { MdCheck, MdClose } from 'react-icons/md'
import ErrorMessage from '../ErrorMessage'
import CartaoBase from './CartaoBase'
import useTranslation from '../../hooks/useTranslation'
import {
  DECISOES,
  STATUS,
  TAMANHO_MOTIVO,
  conferirMotivo,
  podeDecidir,
} from '../../utils/pedidoAlteracao'

// Um pedido de alteração do Pregão na tela do administrador: o essencial para
// decidir (CartaoBase) e os botões. Aprovar vai direto; descartar abre o campo
// do motivo, que é obrigatório.

const estiloDoBotao = { textTransform: 'none', fontWeight: 600 }

export default function CartaoPedido({ pedido, onDecidir }) {
  const { t } = useTranslation()
  const [descartando, setDescartando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const decidivel = podeDecidir(pedido)
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
    <CartaoBase pedido={pedido}>
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
    </CartaoBase>
  )
}
