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
import { avaliarAnomalia } from '../../utils/marketStats'
import useJanelaVirtual, { LIMIAR_DE_VIRTUALIZACAO } from '../../hooks/useJanelaVirtual'

export default function HistoryTable({
  historicoFiltrado,
  moedasFiltro,
  limitesPorMoeda = {},
  totalPaginas,
  pagina,
  setPagina,
  t,
  locale
}) {
  // `pagina` e `setPagina` chegam por prop. Antes vinham do contexto global E
  // como prop — as props eram passadas e ignoradas, então quem lesse a chamada
  // no Dashboard via uma ligação que não existia. Agora existe uma só, e ela é
  // a que aparece na chamada.
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

  // Só a fatia visível da tabela vai para o DOM. Sem isto, o filtro de 1 mês
  // monta 759 linhas de uma vez (2232 células do MUI, cada uma com `sx`), e
  // reordenar por uma coluna refaz todas: uma long task de ~480 ms medida num
  // desktop, que é meia tela travada — e num celular, bem mais.
  //
  // Abaixo do limiar nada muda: a tabela continua inteira no DOM, onde o
  // Ctrl+F do navegador a alcança por completo.
  const virtualizada = sortedData.length > LIMIAR_DE_VIRTUALIZACAO
  const janela = useJanelaVirtual({
    total: sortedData.length,
    ativo: virtualizada,
    // Palpite usado só até haver uma linha na tela para medir de verdade.
    alturaInicial: 62,
  })

  // Os espaçadores precisam de uma célula dentro. Um `<tr>` vazio é inválido
  // no modelo de conteúdo de tabela do HTML, e a altura dele não é garantida:
  // funciona no Chrome, mas um navegador que colapse a linha para zero levaria
  // junto a barra de rolagem e o posicionamento da fatia inteira.
  const colunas = moedasFiltro && moedasFiltro.length > 1 ? 4 : 3

  const linhasVisiveis = virtualizada
    ? sortedData.slice(janela.inicio, janela.fim)
    : sortedData

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
        {/* Quando virtualizada, a rolagem é do contêiner e não da página: é o
            `scrollTop` dele que diz qual fatia renderizar. O cabeçalho fica
            fixo porque, com a lista rolando aqui dentro, ele sairia de vista
            já nas primeiras linhas. */}
        <TableContainer
          component={Paper}
          ref={janela.refRolagem}
          onScroll={janela.aoRolar}
          sx={{
            backgroundColor: 'transparent',
            boxShadow: 'none',
            ...(virtualizada ? { maxHeight: '70vh', overflowY: 'auto' } : null),
          }}
        >
          {/* `aria-rowcount` com o total real: o leitor de tela anuncia
              "linha 340 de 759" mesmo que só 32 estejam no DOM. Sem ele, a
              pessoa ouviria a contagem da fatia e concluiria que a tabela
              tem 32 linhas. */}
          <Table
            size="small"
            stickyHeader={virtualizada}
            // +1 pelo cabeçalho: `aria-rowcount` conta TODAS as linhas da
            // tabela, e o `aria-rowindex` das linhas de dados já começa em 2
            // por causa dele. Sem o +1, a última linha se anuncia como
            // "745 de 744".
            aria-rowcount={virtualizada ? sortedData.length + 1 : undefined}
          >
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
                      {t('coin')}
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
                    {t('variation')}
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={moedasFiltro.length > 1 ? 4 : 3} align="center" sx={{ color: 'var(--text-faint)', py: 8 }}>
                    <div style={{ opacity: 0.5, fontSize: '0.9rem' }}>
                      {t('noRecordsFound')}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Os dois espaçadores ocupam a altura das linhas que não
                      foram renderizadas. São eles que mantêm a barra de
                      rolagem proporcional à lista inteira — sem eles, a
                      barra teria o tamanho da fatia visível e rolar levaria
                      ao fim da tabela em um palmo. */}
                  {janela.alturaAcima > 0 && (
                    <TableRow aria-hidden="true" sx={{ height: janela.alturaAcima }}>
                      <TableCell colSpan={colunas} sx={{ p: 0, border: 0 }} />
                    </TableRow>
                  )}
                {linhasVisiveis.map((r, i) => {
                  const idx = janela.inicio + i
                  const val = r.precoFechamento ?? r.PrecoFechamento ?? r.valor ?? r.Valor ?? r.valorNegociado ?? r.ValorNegociado ?? 0
                  const dVar = r.precoPercentualVariacao ?? r.PrecoPercentualVariacao ?? r.variacaoPercentual ?? r.VariacaoPercentual ?? r.variacao ?? r.Variacao ?? 0
                  const isUp = dVar >= 0
                  // Cada moeda tem sua própria régua: um volume alto em DOGE
                  // não diz nada sobre o que é alto em BTC.
                  const anomalia = avaliarAnomalia(r, limitesPorMoeda[r.sigla])

                  return (
                    <TableRow
                      // A chave é a posição NA JANELA, não o índice absoluto.
                      // Com o índice absoluto, rolar uma linha trocava a chave
                      // de todas as trinta e o React desmontava e remontava a
                      // fatia inteira a cada evento de scroll, em vez de
                      // reaproveitar os nós e só trocar o conteúdo — parte do
                      // custo que a virtualização existe para evitar, de volta
                      // durante a rolagem.
                      key={i}
                      // A medição da altura sai daqui: a primeira linha da
                      // fatia é a única que o hook precisa ver.
                      ref={i === 0 ? janela.refLinha : undefined}
                      aria-rowindex={virtualizada ? idx + 2 : undefined}
                      sx={{
                        '&:hover': { backgroundColor: 'var(--surface-subtle)' },
                        '& td': { borderBottom: '1px solid var(--border-subtle)', py: 1.5, px: 2 }
                      }}
                    >
                      <TableCell sx={{ color: 'var(--text-muted)', fontFamily: "'Share Tech Mono', monospace" }}>
                        {toLocal(r.horaReferencia ?? r.HoraReferencia ?? r.dataHora ?? r.DataHora, locale)}
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
                          {anomalia?.variacao && (
                            <span
                              className="anomaly-badge variation"
                              title={t('anomalyVariationTitle', { sigmas: anomalia.sigmas.toFixed(1) })}
                            >
                              {anomalia.sigmas.toFixed(1)}σ
                            </span>
                          )}
                          {anomalia?.volume && (
                            <span
                              className="anomaly-badge volume"
                              title={t('anomalyVolumeTitle', { razao: anomalia.razaoVolume.toFixed(1) })}
                            >
                              {anomalia.razaoVolume.toFixed(1)}× vol
                            </span>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
                  {janela.alturaAbaixo > 0 && (
                    <TableRow aria-hidden="true" sx={{ height: janela.alturaAbaixo }}>
                      <TableCell colSpan={colunas} sx={{ p: 0, border: 0 }} />
                    </TableRow>
                  )}
                </>
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
