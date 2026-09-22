import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Typography from '@mui/material/Typography'
import useTranslation from '../../hooks/useTranslation'
import { MoedaChip, Painel } from './Painel'
import { compararPor, estiloDeTabela, formatarData, formatarNumero, formatarPercentual } from './formato'

export default function TabelaEpisodios({ itens, onAbrir }) {
  const { t, idioma } = useTranslation()
  // Padrão por data, e não pelo número do episódio: a numeração recomeça a
  // cada ciclo, e ordenar por ela intercalava ciclos diferentes.
  const [ordenarPor, setOrdenarPor] = useState('dataHora')
  const [ordem, setOrdem] = useState('desc')
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(25)

  const colunas = useMemo(() => [
    { id: 'episodio', rotulo: t('treinamento.colEpisode'), numerica: true },
    { id: 'dataHora', rotulo: t('treinamento.colDateTime') },
    { id: 'moeda', rotulo: t('treinamento.colCoin') },
    { id: 'versaoModelo', rotulo: t('treinamento.colVersion') },
    { id: 'rewardMedio', rotulo: t('treinamento.colRewardAvg'), numerica: true },
    { id: 'rewardTotal', rotulo: t('treinamento.colRewardTotal'), numerica: true },
    { id: 'lossMedia', rotulo: t('treinamento.colLossAvg'), numerica: true },
    { id: 'epsilon', rotulo: t('treinamento.colEpsilon'), numerica: true },
    { id: 'winRate', rotulo: t('treinamento.colWinRate'), numerica: true },
    { id: 'duracaoSegundos', rotulo: t('treinamento.colDuration'), numerica: true },
  ], [t])

  const ordenados = useMemo(
    () => [...itens].sort(compararPor(ordenarPor, ordem)),
    [itens, ordenarPor, ordem]
  )

  // A janela muda por baixo da tabela (período, polling, filtro). Sem prender
  // a página ao novo total, a tabela ficava numa página que não existe mais —
  // em branco, e com aviso do MUI no console.
  const ultimaPagina = Math.max(0, Math.ceil(ordenados.length / porPagina) - 1)
  const paginaAtual = Math.min(pagina, ultimaPagina)
  const visiveis = ordenados.slice(paginaAtual * porPagina, (paginaAtual + 1) * porPagina)

  const alternarOrdem = (id) => {
    if (ordenarPor === id) setOrdem(ordem === 'asc' ? 'desc' : 'asc')
    else { setOrdenarPor(id); setOrdem('desc') }
  }

  return (
    <Painel titulo={t('treinamento.tableTitle')} subtitulo={t('treinamento.tableSubtitle')} corpoSx={{ mx: { xs: -2, md: -2.5 }, mb: { xs: -2, md: -2.5 } }}>
      <TableContainer>
        <Table size="small" sx={estiloDeTabela}>
          <TableHead>
            <TableRow>
              {colunas.map((c) => (
                <TableCell key={c.id} align={c.numerica ? 'right' : 'left'} sortDirection={ordenarPor === c.id ? ordem : false}>
                  <TableSortLabel
                    active={ordenarPor === c.id}
                    direction={ordenarPor === c.id ? ordem : 'asc'}
                    onClick={() => alternarOrdem(c.id)}
                  >
                    {c.rotulo}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visiveis.map((r) => (
              <TableRow
                key={r.idTreinamentoEpisodio}
                hover
                onClick={() => onAbrir(r.idTreinamentoEpisodio)}
                sx={{ cursor: 'pointer', '&:hover': { background: 'var(--surface-hover)' } }}
              >
                {/* A linha inteira é clicável para o mouse, mas <tr> não pode
                    virar botão sem quebrar a semântica da tabela: o número do
                    episódio é o botão que o teclado alcança. */}
                <TableCell align="right">
                  <Box
                    component="button"
                    type="button"
                    className="botao-nu"
                    aria-label={t('treinamento.abrirEpisodio', { episodio: r.episodio })}
                    onClick={(e) => { e.stopPropagation(); onAbrir(r.idTreinamentoEpisodio) }}
                    sx={{ color: 'var(--accent-ink)', fontWeight: 600 }}
                  >
                    {r.episodio}
                  </Box>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatarData(r.dataHora, idioma.intl)}</TableCell>
                <TableCell><MoedaChip moeda={r.moeda} /></TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>{r.versaoModelo ?? '–'}</Typography>
                </TableCell>
                <TableCell align="right">{formatarNumero(r.rewardMedio)}</TableCell>
                <TableCell align="right">{formatarNumero(r.rewardTotal, 2)}</TableCell>
                <TableCell align="right">{formatarNumero(r.lossMedia)}</TableCell>
                <TableCell align="right">{formatarNumero(r.epsilon)}</TableCell>
                <TableCell align="right">{formatarPercentual(r.winRate)}</TableCell>
                <TableCell align="right">{formatarNumero(r.duracaoSegundos, 2)}</TableCell>
              </TableRow>
            ))}
            {visiveis.length === 0 && (
              <TableRow>
                <TableCell colSpan={colunas.length} align="center" sx={{ py: 4, color: 'var(--text-muted) !important' }}>
                  {t('treinamento.noEpisodes')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={ordenados.length}
        page={paginaAtual}
        onPageChange={(_, p) => setPagina(p)}
        rowsPerPage={porPagina}
        onRowsPerPageChange={(e) => { setPorPagina(parseInt(e.target.value, 10)); setPagina(0) }}
        rowsPerPageOptions={[10, 25, 50, 100]}
        // Sem estes três a paginação ficava em inglês em todos os idiomas —
        // o MUI só traduz sozinho com um locale de tema, que o app não usa.
        labelRowsPerPage={t('treinamento.rowsPerPage')}
        labelDisplayedRows={({ from, to, count }) => t('treinamento.displayedRows', { from, to, count })}
        getItemAriaLabel={(tipo) => (tipo === 'next' || tipo === 'last' ? t('treinamento.nextPage') : t('treinamento.previousPage'))}
        sx={{ color: 'var(--text-primary)', '& .MuiTablePagination-selectIcon, & .MuiIconButton-root': { color: 'var(--text-secondary)' } }}
      />
    </Painel>
  )
}
