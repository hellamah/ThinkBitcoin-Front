import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import useTranslation from '../../hooks/useTranslation'
import { BarraDeAcoes, Sparkline } from './Miniaturas'
import { MoedaChip, Painel, Variacao } from './Painel'
import { compararPor, corDaMoeda, estiloDeTabela, formatarDia, formatarNumero, formatarPercentual } from './formato'

// Uma linha por moeda. Junta o que antes eram quatro blocos separados — a
// tabela "Evolução desde o início", o gráfico de barras que misturava três
// unidades no mesmo eixo, a distribuição de ações em contagem absoluta e o
// top 5 — num lugar só, onde cada número tem a própria coluna e unidade.
//
// Sem coluna de loss: o loss é da rede, não da moeda. As moedas se alternam a
// cada episódio sobre a mesma rede, e com dados reais a coluna mostrava o mesmo
// 0,081 nas dez linhas — um número que não distingue nada. O loss segue no
// cartão da aba ao vivo, na tabela de episódios e na de versões, onde a
// comparação faz sentido.

export default function TabelaMoedas({ linhas, resumo, onSelecionarMoeda, onAbrir }) {
  const { t, idioma } = useTranslation()
  const [ordenarPor, setOrdenarPor] = useState('rewardMedio')
  const [ordem, setOrdem] = useState('desc')

  const desdeInicio = useMemo(() => new Map((resumo || []).map((r) => [r.moeda, r])), [resumo])
  const ordenadas = useMemo(() => [...linhas].sort(compararPor(ordenarPor, ordem)), [linhas, ordenarPor, ordem])

  const colunas = [
    { id: 'moeda', rotulo: t('treinamento.colCoin'), ordenavel: true },
    { id: 'total', rotulo: t('treinamento.colEpisodes'), ordenavel: true, numerica: true },
    { id: 'rewardMedio', rotulo: t('treinamento.colRewardAvg'), ordenavel: true, numerica: true },
    { id: 'tendencia', rotulo: t('treinamento.colTrend'), ordenavel: true, numerica: true, dica: t('treinamento.trendHint') },
    { id: 'curva', rotulo: t('treinamento.colCurve') },
    { id: 'winRate', rotulo: t('treinamento.colWinRate'), ordenavel: true, numerica: true },
    { id: 'acoes', rotulo: t('treinamento.colActions'), dica: t('treinamento.colActionsHint') },
    { id: 'desdeInicio', rotulo: t('treinamento.colSinceStart'), numerica: true, dica: t('treinamento.sinceStartHint') },
    { id: 'melhor', rotulo: t('treinamento.colBestEpisode'), numerica: true },
  ]

  const alternarOrdem = (id) => {
    if (ordenarPor === id) setOrdem(ordem === 'asc' ? 'desc' : 'asc')
    else { setOrdenarPor(id); setOrdem(id === 'moeda' ? 'asc' : 'desc') }
  }

  const pct = (v) => formatarPercentual(v, 0)

  return (
    <Painel
      titulo={t('treinamento.coinPerformance')}
      subtitulo={t('treinamento.coinPerformanceSub')}
      corpoSx={{ mx: { xs: -2, md: -2.5 }, mb: { xs: -1, md: -1.5 } }}
    >
      <TableContainer>
        <Table size="small" sx={{ ...estiloDeTabela, '& td': { ...estiloDeTabela['& td, & th'], fontVariantNumeric: 'tabular-nums' } }}>
          <TableHead>
            <TableRow>
              {colunas.map((c) => (
                <TableCell key={c.id} align={c.numerica ? 'right' : 'left'} title={c.dica} sortDirection={ordenarPor === c.id ? ordem : false}>
                  {c.ordenavel ? (
                    <TableSortLabel
                      active={ordenarPor === c.id}
                      direction={ordenarPor === c.id ? ordem : 'asc'}
                      onClick={() => alternarOrdem(c.id)}
                    >
                      {c.rotulo}
                    </TableSortLabel>
                  ) : c.rotulo}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {ordenadas.map((m) => {
              const inicio = desdeInicio.get(m.moeda)
              const deltaInicio = inicio && inicio.rewardAtual != null && inicio.rewardInicial != null
                ? inicio.rewardAtual - inicio.rewardInicial
                : null
              const curva = m.curva || []
              return (
                <TableRow key={m.moeda} hover sx={{ '&:hover': { background: 'var(--surface-hover)' } }}>
                  <TableCell>
                    <MoedaChip
                      moeda={m.moeda}
                      onClick={() => onSelecionarMoeda(m.moeda)}
                      rotulo={t('treinamento.filterCoin', { moeda: m.moeda })}
                    />
                  </TableCell>
                  <TableCell align="right">{m.total}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{formatarNumero(m.rewardMedio, 3)}</TableCell>
                  <TableCell align="right"><Variacao d={m.tendencia} /></TableCell>
                  <TableCell>
                    <Sparkline
                      largura={80}
                      valores={curva}
                      cor={corDaMoeda(m.moeda)}
                      rotulo={curva.length > 1
                        ? `${m.moeda}: ${formatarNumero(curva[0], 3)} → ${formatarNumero(curva[curva.length - 1], 3)}`
                        : undefined}
                    />
                  </TableCell>
                  <TableCell align="right">{formatarPercentual(m.winRate, 1)}</TableCell>
                  <TableCell>
                    <BarraDeAcoes
                      acoes={m.acoes}
                      largura={80}
                      rotulo={m.acoes
                        ? t('treinamento.actionsSummary', { hold: pct(m.acoes.hold), compra: pct(m.acoes.compra), venda: pct(m.acoes.venda) })
                        : undefined}
                    />
                  </TableCell>
                  {/* Duas linhas: a variação em destaque, e de onde para onde
                      embaixo. Numa linha só, a coluna empurrava a tabela para
                      rolagem horizontal já em 1440px. */}
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {inicio ? (
                      <>
                        <Variacao d={deltaInicio} />
                        <Box component="span" sx={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                          {formatarNumero(inicio.rewardInicial, 3)} → {formatarNumero(inicio.rewardAtual, 3)}
                          {/* Sem a data, "desde o início" não dizia de quando: o
                              histórico da API real começa meses antes da janela. */}
                          {inicio.dataHoraInicial && ` · ${t('treinamento.sinceDate', { data: formatarDia(inicio.dataHoraInicial, idioma.intl) })}`}
                        </Box>
                      </>
                    ) : '–'}
                  </TableCell>
                  <TableCell align="right">
                    {m.melhor ? (
                      <Box
                        component="button"
                        type="button"
                        className="botao-nu"
                        onClick={() => onAbrir(m.melhor.idTreinamentoEpisodio)}
                        aria-label={t('treinamento.abrirEpisodio', { episodio: m.melhor.episodio })}
                        sx={{ color: 'var(--accent-ink)', fontWeight: 600, whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
                      >
                        #{m.melhor.episodio} · {formatarNumero(m.melhor.rewardMedio, 3)}
                      </Box>
                    ) : '–'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Painel>
  )
}
