import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import useTranslation from '../../hooks/useTranslation'
import { formatarMetrica } from './graficos'
import { Painel, Variacao } from './Painel'
import { estiloDeTabela, formatarDataCurta, formatarDuracao } from './formato'

// "0,150 → 0,715 ▲ +0,565": começo, fim e a diferença colorida pelo sentido
// da métrica.
function InicioFim({ id, inicio, fim }) {
  const d = inicio === null || fim === null ? null : fim - inicio
  return (
    <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
      <Box component="span" sx={{ color: 'var(--text-muted)' }}>{formatarMetrica(id, inicio)} → </Box>
      <Box component="span" sx={{ fontWeight: 600 }}>{formatarMetrica(id, fim)}</Box>{' '}
      {d !== null && <Variacao id={id} d={d} />}
    </Box>
  )
}

const estilo = { ...estiloDeTabela, '& td': { ...estiloDeTabela['& td, & th'], fontVariantNumeric: 'tabular-nums' } }
const quebraDaBorda = { mx: { xs: -2, md: -2.5 }, mb: { xs: -1, md: -1.5 } }

export function TabelaCiclos({ ciclos }) {
  const { t, idioma } = useTranslation()
  return (
    <Painel titulo={t('treinamento.cyclesTitle')} subtitulo={t('treinamento.cyclesSub')} corpoSx={quebraDaBorda}>
      <TableContainer>
        <Table size="small" sx={estilo}>
          <TableHead>
            <TableRow>
              <TableCell>{t('treinamento.colCycle')}</TableCell>
              <TableCell>{t('treinamento.colStart')}</TableCell>
              <TableCell align="right">{t('treinamento.duration')}</TableCell>
              <TableCell align="right">{t('treinamento.colEpisodes')}</TableCell>
              <TableCell align="right">{t('treinamento.colRewardStartEnd')}</TableCell>
              <TableCell align="right">{t('treinamento.colWinRateStartEnd')}</TableCell>
              <TableCell>{t('treinamento.colVersion')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ciclos.map((c) => (
              <TableRow key={c.numero}>
                <TableCell sx={{ fontWeight: 700 }}>C{c.numero}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatarDataCurta(c.inicio, idioma.intl)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatarDuracao(c.duracaoMs, idioma.intl)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {c.total}{' '}
                  <Box component="span" sx={{ color: 'var(--text-muted)' }}>(#{c.epInicio}–#{c.epFim})</Box>
                </TableCell>
                <TableCell align="right"><InicioFim id="rewardMedio" inicio={c.rewardInicio} fim={c.rewardFim} /></TableCell>
                <TableCell align="right"><InicioFim id="winRate" inicio={c.winRateInicio} fim={c.winRateFim} /></TableCell>
                <TableCell sx={{ color: 'var(--text-secondary) !important' }}>{c.versoes.join(', ') || '–'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Painel>
  )
}

export function TabelaVersoes({ versoes }) {
  const { t, idioma } = useTranslation()
  return (
    <Painel titulo={t('treinamento.versionsTitle')} subtitulo={t('treinamento.versionsSub')} corpoSx={quebraDaBorda}>
      <TableContainer>
        <Table size="small" sx={estilo}>
          <TableHead>
            <TableRow>
              <TableCell>{t('treinamento.colVersion')}</TableCell>
              <TableCell align="right">{t('treinamento.colEpisodes')}</TableCell>
              <TableCell align="right">{t('treinamento.colRewardAvg')}</TableCell>
              <TableCell align="right">{t('treinamento.colWinRate')}</TableCell>
              <TableCell align="right">{t('treinamento.colLossAvg')}</TableCell>
              <TableCell>{t('treinamento.colPeriod')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {versoes.map((v) => (
              <TableRow key={v.versao}>
                <TableCell sx={{ fontWeight: 700 }}>{v.versao}</TableCell>
                <TableCell align="right">{v.total}</TableCell>
                <TableCell align="right">{formatarMetrica('rewardMedio', v.rewardMedio)}</TableCell>
                <TableCell align="right">{formatarMetrica('winRate', v.winRate)}</TableCell>
                <TableCell align="right">{formatarMetrica('lossMedia', v.lossMedia)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', color: 'var(--text-secondary) !important' }}>
                  {formatarDataCurta(v.inicio, idioma.intl)} – {formatarDataCurta(v.fim, idioma.intl)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Painel>
  )
}
