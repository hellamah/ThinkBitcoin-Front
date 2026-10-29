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
      backgroundColor: 'var(--surface-subtle)',
      '& fieldset': { borderColor: 'var(--border-strong)' },
      '&:hover fieldset': { borderColor: 'var(--border-strong)' },
      '&.Mui-focused fieldset': { borderColor: 'var(--color-primary)' }
    }
  }), [])

  // Em `row` o flex-basis governa a LARGURA do campo; em `column`, a ALTURA.
  // Os valores aqui (180px, 140px) foram escritos para a linha, e abaixo de
  // 900px — onde o layout vira coluna — passavam a esticar cada campo para
  // 180px de ALTURA: o painel de filtros ficava com 752px, com vãos enormes
  // entre um campo e o seguinte.
  //
  // O mesmo vale para o `alignItems: flex-end` do contêiner: em linha ele
  // alinha os campos pela base, que é o que se quer com rótulo e input de
  // alturas diferentes; em coluna vira alinhamento à direita, e os campos
  // ficavam encostados na borda com o resto da faixa vazia.
  //
  // Em coluna, então, cada campo ocupa a largura toda e a altura que o
  // conteúdo pedir.
  const caixaDoCampo = (baseNaLinha, larguraMinima) => ({
    flex: { xs: '0 0 auto', md: baseNaLinha },
    width: { xs: '100%', md: 'auto' },
    minWidth: { md: larguraMinima },
  })

  return (
    <section className="panel filters-panel">
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 3,
        alignItems: { xs: 'stretch', md: 'flex-end' },
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <Box sx={caixaDoCampo('1 1 180px', '150px')}>
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

        <Box sx={caixaDoCampo('1 1 180px', '150px')}>
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

        <Box sx={caixaDoCampo('0 1 140px', '120px')}>
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

        <Box sx={caixaDoCampo('0 1 180px', '160px')}>
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
