import React from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import { subDays, subMonths } from 'date-fns'

export default function DashboardFilters({
  dataInicio, setDataInicio,
  dataFim, setDataFim,
  resultadoFiltro, setResultadoFiltro,
  intervalo, setIntervalo,
  setPagina, setQuantidade,
  t
}) {
  return (
    <section className="panel filters-panel">
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 3,
        alignItems: 'flex-end',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <Box sx={{ flex: '1 1 180px', minWidth: '150px' }}>
          <TextField
            fullWidth
            label={t('startDate')}
            type="date"
            value={dataInicio}
            onChange={(e) => {
              setDataInicio(e.target.value)
              setPagina(1)
            }}
            InputLabelProps={{ shrink: true }}
            size="small"
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'rgba(255,255,255,0.02)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
              }
            }}
          />
        </Box>
        <Box sx={{ flex: '1 1 180px', minWidth: '150px' }}>
          <TextField
            fullWidth
            label={t('endDate')}
            type="date"
            value={dataFim}
            onChange={(e) => {
              setDataFim(e.target.value)
              setPagina(1)
            }}
            InputLabelProps={{ shrink: true }}
            size="small"
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'rgba(255,255,255,0.02)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
              }
            }}
          />
        </Box>

        <Box sx={{ flex: '0 1 140px', minWidth: '120px' }}>
          <TextField
            fullWidth
            select
            label={t('result')}
            value={resultadoFiltro}
            onChange={(e) => setResultadoFiltro(e.target.value)}
            size="small"
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'rgba(255,255,255,0.02)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
              }
            }}
          >
            <MenuItem value="ALL">{t('all')}</MenuItem>
            <MenuItem value="WIN">{t('win')}</MenuItem>
            <MenuItem value="LOSS">{t('loss')}</MenuItem>
          </TextField>
        </Box>

        <Box sx={{ flex: '0 1 180px', minWidth: '160px' }}>
          <div className="interval-selector-mini" style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(255,255,255,0.1)', height: '40px', boxSizing: 'border-box' }}>
            {['24h', '7d', '1m'].map((opt) => (
              <button
                key={opt}
                className={`interval-btn-mini ${intervalo === opt ? 'active' : ''}`}
                onClick={() => {
                  const agora = new Date()
                  let inicioDate

                  if (opt === '24h') {
                    inicioDate = subDays(agora, 1)
                  } else if (opt === '7d') {
                    inicioDate = subDays(agora, 7)
                  } else if (opt === '1m') {
                    inicioDate = subMonths(agora, 1)
                  } else {
                    inicioDate = agora
                  }

                  const formattedInicio = inicioDate.toISOString()
                  const formattedFim = agora.toISOString()

                  setDataInicio(formattedInicio)
                  setDataFim(formattedFim)
                  setIntervalo(opt)

                  setPagina(1)
                  setQuantidade(100)
                  setResultadoFiltro('ALL')
                }}
                style={{ flex: 1, padding: '0 8px', fontSize: '0.8rem' }}
              >
                {t(`interval${opt}`)}
              </button>
            ))}
          </div>
        </Box>
      </Box>
    </section>
  )
}
