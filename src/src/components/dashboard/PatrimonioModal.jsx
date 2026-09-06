import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import { MdAdd, MdHistory, MdAttachMoney, MdOutlineCalendarToday } from 'react-icons/md'

import Modal from '../Modal'
import { apiRequest, PatrimonioEndpoint, HttpMethod } from '../../utils/apiClient'
import useTranslation from '../../hooks/useTranslation'
import { toLocal } from '../../utils/dateUtils'

export default function PatrimonioModal({ visible, onClose, user, patrimonio, onRefresh }) {
  const { t, idioma } = useTranslation()
  const [valorBRL, setValorBRL] = useState('')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleSalvar = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const valor = parseFloat(valorBRL)
    if (isNaN(valor) || valor <= 0) {
      setErrorMsg(t('patrimonio.amountRequired') || 'Informe um valor maior que zero.')
      return
    }

    setLoading(true)
    try {
      await apiRequest(PatrimonioEndpoint.CREATE, {
        method: HttpMethod.POST,
        body: {
          idUsuarioTB: user?.idUsuarioTB,
          valorBRL: valor,
          observacao: observacao.trim() || 'Aporte manual'
        }
      })

      setSuccessMsg(t('patrimonio.saveSuccess') || 'Patrimônio registrado com sucesso!')
      setValorBRL('')
      setObservacao('')
      if (onRefresh) await onRefresh()
    } catch (err) {
      console.error(err)
      setErrorMsg(t('patrimonio.saveError') || 'Erro ao registrar patrimônio. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const inputSx = {
    width: '100%',
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'var(--surface-subtle)',
      borderRadius: '10px',
      transition: 'all 0.3s ease',
      '&:hover': { backgroundColor: 'var(--surface-fill)' },
      '&.Mui-focused': { backgroundColor: 'var(--surface-fill-strong)' }
    },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-strong)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--accent-a50)' },
    '& .MuiInputBase-input': { color: 'var(--text-primary)', fontWeight: 600 }
  }

  const tableHeaderSx = {
    color: 'rgba(255, 215, 0, 0.9) !important',
    fontWeight: 'bold !important',
    fontFamily: "'Share Tech Mono', monospace !important",
    textTransform: 'uppercase',
    borderBottom: '1px solid var(--border) !important',
    bgcolor: 'rgba(10, 10, 10, 0.8) !important'
  }

  const tableCellSx = {
    color: 'var(--text-primary) !important',
    borderBottom: '1px solid var(--border-subtle) !important',
    fontFamily: "'Share Tech Mono', monospace !important"
  }

  return (
    <Modal visible={visible} onClose={onClose} className="modal-md">
      <Box sx={{ p: 1, maxWidth: '100%' }}>
        <Typography variant="h5" className="patrimonio-title-glow" sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <MdAttachMoney style={{ fontSize: '1.8rem' }} /> {t('patrimonio.manage')}
        </Typography>

        {/* Formulário de Novo Lançamento */}
        <Box component="form" onSubmit={handleSalvar} sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 5 }}>
          <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px' }}>
            // {t('patrimonio.newRecord')}
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 3 }}>
            <TextField
              label={t('patrimonio.valueBRL')}
              type="number"
              required
              disabled={loading}
              value={valorBRL}
              onChange={(e) => setValorBRL(e.target.value)}
              sx={inputSx}
              InputProps={{ startAdornment: <Box sx={{ mr: 1, color: 'var(--accent-ink)', fontWeight: 700 }}>R$</Box> }}
              InputLabelProps={{ sx: { color: 'var(--text-muted)' } }}
            />
            <TextField
              label={t('patrimonio.observation')}
              placeholder={t('patrimonio.observacaoPlaceholder')}
              disabled={loading}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              sx={inputSx}
              InputLabelProps={{ sx: { color: 'var(--text-muted)' } }}
            />
          </Box>

          {errorMsg && <Typography sx={{ color: '#ff5252', fontSize: '0.9rem', fontWeight: 600 }}>{errorMsg}</Typography>}
          {successMsg && <Typography sx={{ color: 'var(--success-ink)', fontSize: '0.9rem', fontWeight: 600 }}>{successMsg}</Typography>}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <MdAdd />}
              sx={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-on-accent)',
                fontWeight: 800,
                px: 4, py: 1.2,
                borderRadius: '10px',
                fontFamily: "'Share Tech Mono', monospace",
                '&:hover': {
                  bgcolor: '#e6c200',
                  boxShadow: '0 0 20px var(--accent-a40)'
                },
                '&.Mui-disabled': {
                  backgroundColor: 'var(--accent-a30)',
                }
              }}
            >
              {loading ? t('saving').toUpperCase() : t('patrimonio.add').toUpperCase()}
            </Button>
          </Box>
        </Box>

        {/* Histórico de Lançamentos */}
        <Box>
          <Typography variant="subtitle2" sx={{ color: 'var(--text-muted)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <MdHistory /> // {t('patrimonio.history')}
          </Typography>

          {!patrimonio?.registros || patrimonio.registros.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', backgroundColor: 'var(--surface-subtle)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
              <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.9rem' }}>{t('patrimonio.noRecords')}</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ backgroundColor: 'var(--surface-panel)', borderRadius: '12px', border: '1px solid var(--border)', maxHeight: '300px', overflowY: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeaderSx}>{t('patrimonio.date')}</TableCell>
                    <TableCell sx={tableHeaderSx} align="right">{t('patrimonio.valueBRL')}</TableCell>
                    <TableCell sx={tableHeaderSx} align="right">{t('patrimonio.valueUSD')}</TableCell>
                    <TableCell sx={tableHeaderSx}>{t('patrimonio.observation')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patrimonio.registros.map((reg) => (
                    <TableRow key={reg.idPatrimonioTB} sx={{ '&:hover': { bgcolor: 'rgba(255, 215, 0, 0.02)' } }}>
                      <TableCell sx={tableCellSx}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'var(--text-muted)' }}>
                          <MdOutlineCalendarToday />
                          {toLocal(reg.dataHora, idioma.intl)}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...tableCellSx, fontWeight: 700 }} align="right">
                        R$ {reg.valorBRL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell sx={{ ...tableCellSx, color: 'var(--accent-ink) !important' }} align="right">
                        $ {reg.valorUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell sx={{ ...tableCellSx, opacity: 0.8, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={reg.observacao}>
                        {reg.observacao}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Box>
    </Modal>
  )
}
