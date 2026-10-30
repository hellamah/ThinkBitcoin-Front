import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ErrorMessage from '../ErrorMessage'
import { Painel } from '../treinamento/Painel'
import useTranslation from '../../hooks/useTranslation'
import { DECISOES, TAMANHO_MOTIVO, conferirMotivo, gruposDeDescarte } from '../../utils/pedidoAlteracao'

// Descartar de uma vez os pedidos que uma decisão do dono já responde
// (utils/pedidoAlteracao, GRUPOS_DE_DESCARTE). A tela reúne e sugere o motivo;
// quem confere a lista e descarta é o administrador. O descarte não volta atrás:
// por isso a lista vem aberta, com cada pedido marcado, antes do botão.

const estiloDoBotao = { textTransform: 'none', fontWeight: 600 }

export default function DescartePorGrupo({ pedidos, onDescartar }) {
  const { t } = useTranslation()
  const grupos = useMemo(() => gruposDeDescarte(pedidos), [pedidos])
  const [aberto, setAberto] = useState(null)
  const [desmarcados, setDesmarcados] = useState(() => new Set())
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  if (grupos.length === 0) return null

  const grupo = grupos.find((g) => g.id === aberto)
  const selecionados = grupo ? grupo.pedidos.filter((p) => !desmarcados.has(p.idPedidoAlteracao)) : []
  const motivoValido = !conferirMotivo(DECISOES.DESCARTADO, motivo).erro

  const abrir = (id) => {
    setErro('')
    setDesmarcados(new Set())
    setMotivo(id ? t(`pregao.grupos.${id}.motivo`) : '')
    setAberto(id)
  }

  const alternar = (id) => {
    setDesmarcados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const descartar = async (e) => {
    e.preventDefault()
    const conferido = conferirMotivo(DECISOES.DESCARTADO, motivo)
    if (conferido.erro) {
      setErro(t(conferido.erro, { max: TAMANHO_MOTIVO }))
      return
    }
    setErro('')
    setEnviando(true)
    try {
      const falhas = await onDescartar(selecionados.map((p) => p.idPedidoAlteracao), conferido.motivo)
      if (falhas.length > 0) {
        const primeira = falhas[0].erro
        setErro(t('pregao.grupos.falhas', {
          n: falhas.length,
          erro: primeira?.hasBackendMessage ? primeira.message : t('pregao.erroDecisao'),
        }))
      } else {
        abrir(null)
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel titulo={t('pregao.grupos.titulo')} subtitulo={t('pregao.grupos.sub')}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {grupos.map((g) => (
          <Box key={g.id} sx={{ borderTop: '1px solid var(--border)', pt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t(`pregao.grupos.${g.id}.titulo`)}</Typography>
              <Button size="small" onClick={() => abrir(aberto === g.id ? null : g.id)} sx={{ ...estiloDoBotao, color: 'var(--accent-ink)' }}>
                {aberto === g.id ? t('pregao.grupos.fechar') : t('pregao.grupos.revisar', { n: g.pedidos.length })}
              </Button>
            </Box>

            {aberto === g.id && (
              <Box component="form" noValidate onSubmit={descartar} sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: 320, overflowY: 'auto' }}>
                  {g.pedidos.map((p) => (
                    <FormControlLabel
                      key={p.idPedidoAlteracao}
                      sx={{ alignItems: 'flex-start', m: 0 }}
                      control={(
                        <Checkbox
                          size="small"
                          sx={{ py: 0.25 }}
                          checked={!desmarcados.has(p.idPedidoAlteracao)}
                          onChange={() => alternar(p.idPedidoAlteracao)}
                          disabled={enviando}
                        />
                      )}
                      label={(
                        <Typography variant="body2" component="span">
                          {p.problema}
                          <Typography variant="caption" component="span" sx={{ color: 'var(--text-muted)', ml: 1 }}>{p.telas}</Typography>
                        </Typography>
                      )}
                    />
                  ))}
                </Box>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  size="small"
                  label={t('pregao.motivoRotulo')}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  disabled={enviando}
                  required
                  helperText={`${motivo.length}/${TAMANHO_MOTIVO}`}
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
                <Box>
                  <Button
                    type="submit"
                    variant="contained"
                    size="small"
                    disabled={enviando || !motivoValido || selecionados.length === 0}
                    sx={{
                      ...estiloDoBotao,
                      backgroundColor: 'var(--danger)',
                      color: '#fff',
                      '&:hover': { backgroundColor: 'var(--danger)', filter: 'brightness(1.1)' },
                      '&.Mui-disabled': { backgroundColor: 'var(--danger-a10)', color: 'var(--text-faint)' },
                    }}
                  >
                    {enviando ? t('pregao.enviando') : t('pregao.grupos.descartarN', { n: selecionados.length })}
                  </Button>
                </Box>
                {erro && (
                  <Box sx={{ '& .MuiAlert-root': { mb: 0 } }}>
                    <ErrorMessage message={erro} onClose={() => setErro('')} />
                  </Box>
                )}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Painel>
  )
}
