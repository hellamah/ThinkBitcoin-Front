import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
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
  correcaoDoPedido,
  grupoDoPedido,
  podeDecidir,
  podeDescartar,
} from '../../utils/pedidoAlteracao'

// Um pedido de alteração do Pregão na tela do administrador: o essencial para
// decidir (CartaoBase) e os botões. As duas decisões abrem o mesmo formulário:
// descartar pede o motivo, que é obrigatório, e aprovar aceita uma nota para quem
// corrige, que é opcional (até 18/11/2026 a aprovação não tinha campo, e a nota, que
// é o que faz a Oficina acertar, só chegava por quem tinha o login da API). Na nova
// tentativa, só descartar: quem corrige já vai tentar de novo sozinho.

const estiloDoBotao = { textTransform: 'none', fontWeight: 600 }

export default function CartaoPedido({ pedido, onDecidir }) {
  const { t } = useTranslation()
  // Qual decisão está com o formulário aberto (aprovar ou descartar), ou nenhuma.
  const [decidindo, setDecidindo] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const decidivel = podeDecidir(pedido)
  const descartavel = podeDescartar(pedido)
  const aprovando = decidindo === DECISOES.APROVADO
  const motivoValido = !!decidindo && !conferirMotivo(decidindo, motivo).erro
  // Antes do botão de aprovar: o que uma decisão do dono já responde (a regra do descarte por grupo).
  const grupo = decidivel ? grupoDoPedido(pedido) : null

  const enviar = async (decisao) => {
    const conferido = conferirMotivo(decisao, motivo)
    if (conferido.erro) {
      setErro(t(conferido.erro, { max: TAMANHO_MOTIVO }))
      return
    }
    setErro('')
    setEnviando(true)
    try {
      await onDecidir(decisao, conferido.motivo)
      setDecidindo(null)
      setMotivo('')
    } catch (e) {
      // A regra recusada pela API (pedido já decidido, motivo faltando) vem com
      // a mensagem dela; falha de rede, com a frase genérica.
      setErro(e?.hasBackendMessage ? e.message : t('pregao.erroDecisao'))
    } finally {
      setEnviando(false)
    }
  }

  const abrir = (decisao) => {
    setErro('')
    setDecidindo(decisao)
  }

  const cancelar = () => {
    setDecidindo(null)
    setMotivo('')
    setErro('')
  }

  const decisao = [
    pedido.decididoPor ? t('pregao.decididoPor', { quem: pedido.decididoPor }) : null,
    pedido.motivoDecisao ? t('pregao.motivoDecisao', { motivo: pedido.motivoDecisao }) : null,
  ].filter(Boolean).join(' · ')
  const correcao = correcaoDoPedido(pedido.referenciaCorrecao)

  return (
    <CartaoBase pedido={pedido}>
      {pedido.status === STATUS.REABERTO && (
        <Typography variant="caption" component="p" sx={{ color: 'var(--perf-warn)' }}>
          {t('pregao.reabertoDica')}
        </Typography>
      )}
      {pedido.status === STATUS.DEVOLVIDO && (
        <Typography variant="caption" component="p" sx={{ color: 'var(--perf-warn)' }}>
          {t('pregao.devolvidoDica')}
        </Typography>
      )}
      {/* A falha foi de quem corrige: o motivo, com o número da tentativa, vem logo abaixo. */}
      {pedido.status === STATUS.NOVA_TENTATIVA && (
        <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)' }}>
          {t('pregao.novaTentativaDica')}
        </Typography>
      )}

      {grupo && (
        <Typography variant="caption" component="p" sx={{ color: 'var(--perf-warn)' }}>
          {t('pregao.grupos.aviso', { motivo: t(`pregao.grupos.${grupo}.motivo`) })}
        </Typography>
      )}

      {decisao && (
        <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)' }}>
          {decisao}
        </Typography>
      )}

      {/* O PR do Agents-Oficina: em correção, ele espera a revisão do dono;
          corrigido, já entrou no Desenv. */}
      {correcao && (
        <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)' }}>
          {t('pregao.correcao')}{' '}
          {correcao.href ? (
            <Link
              href={correcao.href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: 'var(--accent-ink)', fontWeight: 600 }}
            >
              {correcao.texto}
            </Link>
          ) : correcao.texto}
        </Typography>
      )}

      {descartavel && !decidindo && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
          {decidivel && (
            <Button
              variant="contained"
              size="small"
              startIcon={<MdCheck />}
              onClick={() => abrir(DECISOES.APROVADO)}
              sx={estiloDoBotao}
            >
              {t('pregao.aprovar')}
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<MdClose />}
            onClick={() => abrir(DECISOES.DESCARTADO)}
            sx={{ ...estiloDoBotao, color: 'var(--text-primary)', borderColor: 'var(--border-strong)' }}
          >
            {t('pregao.descartar')}
          </Button>
        </Box>
      )}

      {descartavel && decidindo && (
        <Box
          component="form"
          noValidate
          onSubmit={(e) => { e.preventDefault(); enviar(decidindo) }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}
        >
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            size="small"
            label={t(aprovando ? 'pregao.notaRotulo' : 'pregao.motivoRotulo')}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={enviando}
            required={!aprovando}
            helperText={`${motivo.length}/${TAMANHO_MOTIVO} · ${t(aprovando ? 'pregao.notaAjuda' : 'pregao.motivoAjuda')}`}
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
              sx={aprovando ? estiloDoBotao : {
                ...estiloDoBotao,
                backgroundColor: 'var(--danger)',
                color: '#fff',
                '&:hover': { backgroundColor: 'var(--danger)', filter: 'brightness(1.1)' },
                '&.Mui-disabled': { backgroundColor: 'var(--danger-a10)', color: 'var(--text-faint)' },
              }}
            >
              {enviando ? t('pregao.enviando') : t(aprovando ? 'pregao.confirmarAprovacao' : 'pregao.confirmarDescarte')}
            </Button>
            <Button size="small" onClick={cancelar} disabled={enviando} sx={{ ...estiloDoBotao, color: 'var(--text-muted)' }}>
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
