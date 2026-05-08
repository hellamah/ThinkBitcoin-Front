import React from 'react'
import Box from '@mui/material/Box'
import Pagination from '@mui/material/Pagination'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import { MdRefresh, MdTrendingUp, MdTrendingDown } from 'react-icons/md'
import { toLocal } from '../../utils/dateUtils'
import * as mathUtils from '../../utils/mathUtils'

export default function HistoryTable({ 
  historicoMoeda, 
  historicoFiltrado, 
  moedasFiltro, 
  totalPaginas, 
  pagina, 
  setPagina, 
  t 
}) {
  if (moedasFiltro.length === 0 || !historicoMoeda) return null

  return (
    <>
      <Box className="panel history-panel" sx={{
        marginTop: '32px',
        overflow: 'hidden'
      }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MdRefresh style={{ color: 'var(--color-primary)' }} /> {t('coinHistory')}: {moedasFiltro[0]}
        </h2>
        <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(255,255,255,0.1)' } }}>
                <TableCell sx={{ color: '#888', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('date')}</TableCell>
                <TableCell sx={{ color: '#888', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('value')}</TableCell>
                <TableCell sx={{ color: '#888', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('variation')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historicoFiltrado.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ color: '#666', py: 8 }}>
                    <div style={{ opacity: 0.5, fontSize: '0.9rem' }}>
                      {t('noRecordsFound') || 'Nenhum registro encontrado para os filtros selecionados'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                historicoFiltrado.map((r, idx) => {
                  const val = r.precoFechamento ?? r.PrecoFechamento ?? r.valor ?? r.Valor ?? r.valorNegociado ?? r.ValorNegociado ?? 0
                  const dVar = r.precoPercentualVariacao ?? r.PrecoPercentualVariacao ?? r.variacaoPercentual ?? r.VariacaoPercentual ?? r.variacao ?? r.Variacao ?? 0
                  const isUp = dVar >= 0
                  return (
                    <TableRow
                      key={idx}
                      sx={{
                        '&:hover': { background: 'rgba(255,255,255,0.02)' },
                        '& td': { borderBottom: '1px solid rgba(255,255,255,0.03)', py: 1.5 }
                      }}
                    >
                      <TableCell sx={{ color: '#aaa', fontFamily: "'Share Tech Mono', monospace" }}>
                        {toLocal(r.horaReferencia ?? r.HoraReferencia ?? r.dataHora ?? r.DataHora)}
                      </TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 600 }}>
                        {mathUtils.formatCurrency(val)}
                      </TableCell>
                      <TableCell sx={{ color: isUp ? '#4caf50' : '#f44336', fontWeight: 700 }}>
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

      {totalPaginas > 1 && (
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
