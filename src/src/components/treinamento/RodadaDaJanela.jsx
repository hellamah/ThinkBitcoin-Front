import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import ErrorMessage from '../ErrorMessage'
import useRodadaDoEpisodio from '../../hooks/useRodadaDoEpisodio'
import useTranslation from '../../hooks/useTranslation'
import { UM_MINUTO_MS, proporcaoDeAcoes } from '../../utils/treinamento'
import { formatarMetrica, rotuloDaMetrica } from './graficos'
import { BarraDeAcoes } from './Miniaturas'
import { EstadoVazio, MoedaChip, Painel } from './Painel'
import { comSinal, estiloDeTabela, formatarDiaComAno, formatarNumero, formatarPercentual } from './formato'

// As outras moedas que negociaram o mesmo lote que o episódio aberto: o mesmo
// trecho do histórico, o mesmo modelo, uma moeda depois da outra. Os vizinhos
// do resto do detalhe comparam a mesma moeda ao longo do treino; aqui a
// pergunta é outra — o episódio foi ruim por causa da moeda ou do ponto em que
// o modelo estava? Se a rodada inteira foi mal, o problema não era a moeda.

// Rodada cujo último episódio é deste intervalo pode ainda estar rodando.
const RODADA_RECENTE_MS = 5 * UM_MINUTO_MS

const corDoSinal = (v) => (!Number.isFinite(v) ? 'var(--text-muted)' : v > 0 ? 'var(--perf-up)' : v < 0 ? 'var(--perf-down)' : 'var(--text-secondary)')

// Barra que sai do zero para um lado ou para o outro, na escala do maior
// |reward| da rodada: o sinal e o tamanho lidos de relance, lado a lado.
function BarraDoReward({ valor, escala }) {
  if (!Number.isFinite(valor) || !(escala > 0)) return null
  const largura = Math.min(50, (Math.abs(valor) / escala) * 50)
  return (
    <Box aria-hidden="true" sx={{ position: 'relative', width: 72, height: 8, borderRadius: 4, background: 'var(--surface-fill)', flexShrink: 0 }}>
      <Box sx={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: '1px', background: 'var(--border-strong)' }} />
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: valor >= 0 ? '50%' : `${50 - largura}%`,
          width: `${largura}%`,
          borderRadius: 4,
          background: corDoSinal(valor),
        }}
      />
    </Box>
  )
}

export default function RodadaDaJanela({ item, onNavegar }) {
  const { t, idioma } = useTranslation()
  const { valida, carregando, erro, rodada, mercados, recarregar } = useRodadaDoEpisodio(item)

  const subtitulo = valida
    ? t('treinamento.roundSubtitle', {
      inicio: formatarDiaComAno(item.dataInicioDados, idioma.intl),
      fim: formatarDiaComAno(item.dataFimDados, idioma.intl),
    })
    : undefined

  const pct = (v) => (Number.isFinite(v) ? comSinal(formatarPercentual(v, 2), v) : '–')
  const escala = rodada ? Math.max(0, ...rodada.episodios.map((r) => Math.abs(r.rewardMedio)).filter(Number.isFinite)) : 0
  const emAndamento = rodada && Date.now() - rodada.ultimoMs < RODADA_RECENTE_MS

  const colunas = [
    { id: 'moeda', rotulo: t('treinamento.colCoin') },
    { id: 'reward', rotulo: rotuloDaMetrica(t, 'rewardMedio'), numerica: true },
    { id: 'mercado', rotulo: t('treinamento.roundMarket'), numerica: true, dica: t('treinamento.roundMarketHint') },
    { id: 'winRate', rotulo: rotuloDaMetrica(t, 'winRate'), numerica: true },
    { id: 'acoes', rotulo: t('treinamento.agentActions') },
    { id: 'epsilon', rotulo: rotuloDaMetrica(t, 'epsilon'), numerica: true },
    { id: 'episodio', rotulo: t('treinamento.episode'), numerica: true },
  ]

  let corpo
  if (!valida) {
    corpo = <EstadoVazio mensagem={t('treinamento.roundNoWindow')} />
  } else if (carregando) {
    corpo = (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }} role="status" aria-label={t('treinamento.roundLoading')}>
        <CircularProgress size={24} sx={{ color: 'var(--accent-ink)' }} />
      </Box>
    )
  } else if (erro) {
    corpo = (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, py: 1 }}>
        <ErrorMessage message={t('treinamento.roundLoadError')} />
        <Button size="small" onClick={recarregar} sx={{ color: 'var(--accent-ink)', textTransform: 'none', fontWeight: 600 }}>
          {t('treinamento.retry')}
        </Button>
      </Box>
    )
  } else if (!rodada || rodada.total < 2) {
    corpo = <EstadoVazio mensagem={t('treinamento.roundAlone')} />
  } else {
    corpo = (
      <>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1.5 }}>
          {t('treinamento.roundPosition', { moeda: item.moeda, pos: rodada.posicao, total: rodada.total })}
          {' · '}
          {t('treinamento.roundAverage', { media: formatarMetrica('rewardMedio', rodada.media) })}
        </Typography>
        <Box sx={{ mx: { xs: -2, md: -2.5 } }}>
          <TableContainer>
            <Table size="small" sx={{ ...estiloDeTabela, '& td': { ...estiloDeTabela['& td, & th'], fontVariantNumeric: 'tabular-nums' } }}>
              <TableHead>
                <TableRow>
                  {colunas.map((c) => (
                    <TableCell key={c.id} align={c.numerica ? 'right' : 'left'} title={c.dica}>{c.rotulo}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rodada.episodios.map((r) => {
                  const esteEpisodio = r.idTreinamentoEpisodio === item.idTreinamentoEpisodio
                  const acoes = proporcaoDeAcoes([r])
                  const mercado = mercados[r.moeda]
                  return (
                    <TableRow
                      key={r.idTreinamentoEpisodio}
                      hover={!esteEpisodio}
                      aria-current={esteEpisodio ? 'true' : undefined}
                      onClick={esteEpisodio ? undefined : () => onNavegar(r.idTreinamentoEpisodio)}
                      sx={{
                        cursor: esteEpisodio ? 'default' : 'pointer',
                        background: esteEpisodio ? 'var(--surface-subtle)' : undefined,
                        '& td:first-of-type': esteEpisodio ? { boxShadow: 'inset 3px 0 0 var(--accent-ink)' } : undefined,
                        '&:hover': esteEpisodio ? undefined : { background: 'var(--surface-hover)' },
                      }}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <MoedaChip moeda={r.moeda} />
                          {esteEpisodio && (
                            <Typography component="span" variant="caption" sx={{ color: 'var(--accent-ink)', fontWeight: 600 }}>
                              {t('treinamento.thisEpisode')}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <Box component="span" sx={{ fontWeight: esteEpisodio ? 700 : 400, color: `${corDoSinal(r.rewardMedio)} !important` }}>
                            {formatarNumero(r.rewardMedio, 3)}
                          </Box>
                          <BarraDoReward valor={r.rewardMedio} escala={escala} />
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ color: `${corDoSinal(mercado)} !important` }}>
                        {mercado === undefined ? <CircularProgress size={12} sx={{ color: 'var(--text-muted)' }} /> : pct(mercado)}
                      </TableCell>
                      <TableCell align="right">{formatarMetrica('winRate', r.winRate)}</TableCell>
                      <TableCell>
                        <BarraDeAcoes
                          acoes={acoes}
                          rotulo={acoes
                            ? t('treinamento.actionsSummary', {
                              hold: formatarPercentual(acoes.hold, 0),
                              compra: formatarPercentual(acoes.compra, 0),
                              venda: formatarPercentual(acoes.venda, 0),
                            })
                            : undefined}
                        />
                      </TableCell>
                      <TableCell align="right">{formatarNumero(r.epsilon, 3)}</TableCell>
                      <TableCell align="right">
                        {esteEpisodio ? (
                          `#${r.episodio}`
                        ) : (
                          // A linha inteira é clicável para o mouse; o número é o
                          // botão que o teclado alcança (ver TabelaEpisodios).
                          <Box
                            component="button"
                            type="button"
                            className="botao-nu"
                            aria-label={t('treinamento.abrirEpisodio', { episodio: r.episodio })}
                            onClick={(e) => { e.stopPropagation(); onNavegar(r.idTreinamentoEpisodio) }}
                            sx={{ color: 'var(--accent-ink)', fontWeight: 600 }}
                          >
                            #{r.episodio}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        <Typography variant="caption" component="p" sx={{ color: 'var(--text-muted)', mt: 1.5, mb: 0 }}>
          {t('treinamento.roundEpsilonNote')}
        </Typography>
        {emAndamento && (
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>{t('treinamento.roundInProgress')}</Typography>
            <Button size="small" onClick={recarregar} sx={{ color: 'var(--accent-ink)', textTransform: 'none', fontWeight: 600, py: 0 }}>
              {t('treinamento.refresh')}
            </Button>
          </Box>
        )}
      </>
    )
  }

  return (
    <Painel titulo={t('treinamento.roundTitle')} subtitulo={subtitulo}>
      {corpo}
    </Painel>
  )
}
