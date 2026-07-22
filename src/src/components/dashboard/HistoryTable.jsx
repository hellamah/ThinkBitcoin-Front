import React, { useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Pagination from '@mui/material/Pagination'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Paper from '@mui/material/Paper'
import { MdRefresh, MdTrendingUp, MdTrendingDown } from 'react-icons/md'
import { toLocal } from '../../utils/dateUtils'
import * as mathUtils from '../../utils/mathUtils'

import { useDashboard } from '../../context/DashboardContext'

export default function HistoryTable({ 
  historicoMoeda, 
  historicoFiltrado, 
  moedasFiltro, 
  totalPaginas, 
  t 
}) {
  const { pagina, setPagina } = useDashboard()
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedData = useMemo(() => {
    if (!historicoFiltrado) return []
    let sortableItems = [...historicoFiltrado]
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let valA, valB
        if (sortConfig.key === 'date') {
          valA = new Date(a.horaReferencia ?? a.HoraReferencia ?? a.dataHora ?? a.DataHora).getTime()
          valB = new Date(b.horaReferencia ?? b.HoraReferencia ?? b.dataHora ?? b.DataHora).getTime()
        } else if (sortConfig.key === 'coin') {
          valA = a.sigla || ''
          valB = b.sigla || ''
          return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
        } else if (sortConfig.key === 'value') {
          valA = a.precoFechamento ?? a.PrecoFechamento ?? a.valor ?? a.Valor ?? a.valorNegociado ?? a.ValorNegociado ?? 0
          valB = b.precoFechamento ?? b.PrecoFechamento ?? b.valor ?? b.Valor ?? b.valorNegociado ?? b.ValorNegociado ?? 0
        } else if (sortConfig.key === 'variation') {
          valA = a.precoPercentualVariacao ?? a.PrecoPercentualVariacao ?? a.variacaoPercentual ?? a.VariacaoPercentual ?? a.variacao ?? a.Variacao ?? 0
          valB = b.precoPercentualVariacao ?? b.PrecoPercentualVariacao ?? b.variacaoPercentual ?? b.VariacaoPercentual ?? b.variacao ?? b.Variacao ?? 0
        }

        if (valA < valB) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (valA > valB) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }
    return sortableItems
  }, [historicoFiltrado, sortConfig])

  if (!moedasFiltro || moedasFiltro.length === 0) return null

  const titulo = moedasFiltro.length > 1 ? moedasFiltro.join(', ') : moedasFiltro[0]

  const sortLabelSx = { 
    color: 'var(--text-muted) !important', 
    fontWeight: '800', 
    fontSize: '0.75rem', 
    textTransform: 'uppercase',
    '&.Mui-active': { color: 'var(--accent-ink) !important' },
    '& .MuiTableSortLabel-icon': { color: 'inherit !important' }
  }

  return (
    <>
      <Box className="panel history-panel" sx={{
        marginTop: '32px',
        overflow: 'hidden'
      }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MdRefresh style={{ color: 'var(--accent-ink)' }} /> {t('coinHistory')}: {titulo}
        </h2>
        <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { borderBottom: '1px solid var(--border-strong)', padding: '12px 16px' } }}>
                <TableCell>
                  <TableSortLabel
                    active={sortConfig.key === 'date'}
                    direction={sortConfig.key === 'date' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('date')}
                    sx={sortLabelSx}
                  >
                    {t('date')}
                  </TableSortLabel>
                </TableCell>
                {moedasFiltro.length > 1 && (
                  <TableCell>
                    <TableSortLabel
                      active={sortConfig.key === 'coin'}
                      direction={sortConfig.key === 'coin' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('coin')}
                      sx={sortLabelSx}
                    >
                      {t('coin') || 'Moeda'}
                    </TableSortLabel>
                  </TableCell>
                )}
                <TableCell>
                  <TableSortLabel
                    active={sortConfig.key === 'value'}
                    direction={sortConfig.key === 'value' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('value')}
                    sx={sortLabelSx}
                  >
                    {t('value')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortConfig.key === 'variation'}
                    direction={sortConfig.key === 'variation' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('variation')}
                    sx={sortLabelSx}
                  >
                    {t('variation') || 'Variação'}
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={moedasFiltro.length > 1 ? 4 : 3} align="center" sx={{ color: 'var(--text-faint)', py: 8 }}>
                    <div style={{ opacity: 0.5, fontSize: '0.9rem' }}>
                      {t('noRecordsFound') || 'Nenhum registro encontrado para os filtros selecionados'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((r, idx) => {
                  const val = r.precoFechamento ?? r.PrecoFechamento ?? r.valor ?? r.Valor ?? r.valorNegociado ?? r.ValorNegociado ?? 0
                  const dVar = r.precoPercentualVariacao ?? r.PrecoPercentualVariacao ?? r.variacaoPercentual ?? r.VariacaoPercentual ?? r.variacao ?? r.Variacao ?? 0
                  const isUp = dVar >= 0

                  return (
                    <TableRow
                      key={idx}
                      sx={{
                        '&:hover': { backgroundColor: 'var(--surface-subtle)' },
                        '& td': { borderBottom: '1px solid var(--border-subtle)', py: 1.5, px: 2 }
                      }}
                    >
                      <TableCell sx={{ color: 'var(--text-muted)', fontFamily: "'Share Tech Mono', monospace" }}>
                        {toLocal(r.horaReferencia ?? r.HoraReferencia ?? r.dataHora ?? r.DataHora)}
                      </TableCell>
                      {moedasFiltro.length > 1 && (
                        <TableCell sx={{ color: 'var(--accent-ink)', fontWeight: 'bold' }}>
                          {r.sigla}
                        </TableCell>
                      )}
                      <TableCell sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {mathUtils.formatCurrency(val)}
                      </TableCell>
                      <TableCell sx={{ color: isUp ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isUp ? <MdTrendingUp /> : <MdTrendingDown />}
                          {mathUtils.formatPercent(dVar)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {totalPaginas > 1 && moedasFiltro.length === 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 3 }}>
          <Pagination
            count={totalPaginas}
            page={pagina}
            onChange={(_, val) => setPagina(val)}
            color="primary"
          />
        </Box>
      )}
    </>
  )
}
