import React, { useMemo, useCallback } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import { FilterResult, FilterInterval } from '../../utils/enums'
import { useDashboard } from '../../context/DashboardContext'

export default function DashboardFilters({ t }) {
  const {
    dataInicio, setDataInicio,
    dataFim, setDataFim,
    resultadoFiltro, setResultadoFiltro,
    intervalo, setIntervalo,
    setPagina
  } = useDashboard()

  const handleDateChange = useCallback((setter) => (e) => {
    if (!e.target.value) {
      setter('')
    } else {
      setter(new Date(`${e.target.value}T00:00:00`).toISOString())
    }
    setPagina(1)
    setIntervalo(FilterInterval.CUSTOM)
  }, [setPagina, setIntervalo])

  const textFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'rgba(255,255,255,0.02)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&.Mui-focused fieldset': { borderColor: 'var(--color-primary)' }
    }
  }), [])

  const boxFlexSx = { flex: '1 1 180px', minWidth: '150px' }

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
        <Box sx={boxFlexSx}>
          <TextField
            fullWidth
            label={t('startDate')}
            type="date"
            value={dataInicio ? dataInicio.split('T')[0] : ''}
            onChange={handleDateChange(setDataInicio)}
            InputLabelProps={{ shrink: true }}
            size="small"
            variant="outlined"
            sx={textFieldSx}
          />
        </Box>

        <Box sx={boxFlexSx}>
          <TextField
            fullWidth
            label={t('endDate')}
            type="date"
            value={dataFim ? dataFim.split('T')[0] : ''}
            onChange={handleDateChange(setDataFim)}
            InputLabelProps={{ shrink: true }}
            size="small"
            variant="outlined"
            sx={textFieldSx}
          />
        </Box>

        <Box sx={{ flex: '0 1 140px', minWidth: '120px' }}>
          <TextField
            fullWidth
            select
            label={t('result')}
            value={resultadoFiltro}
            onChange={(e) => {
              setResultadoFiltro(e.target.value)
              setPagina(1)
            }}
            size="small"
            variant="outlined"
            sx={textFieldSx}
          >
            <MenuItem value={FilterResult.ALL}>{t('all')}</MenuItem>
            <MenuItem value={FilterResult.WIN}>{t('win')}</MenuItem>
            <MenuItem value={FilterResult.LOSS}>{t('loss')}</MenuItem>
          </TextField>
        </Box>

        <Box sx={{ flex: '0 1 180px', minWidth: '160px' }}>
          <div className="interval-selector-mini">
            {[FilterInterval.H24, FilterInterval.D7, FilterInterval.M1].map((opt) => (
              <button
                key={opt}
                className={`interval-btn-mini ${intervalo === opt ? 'active' : ''}`}
                onClick={() => setIntervalo(opt)}
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
