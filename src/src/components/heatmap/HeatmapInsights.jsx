import React, { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import { MdTrendingUp, MdTrendingDown, MdAccessTime, MdWarningAmber } from 'react-icons/md'

// ---------------------------------------------------------------------------
// Painel de insights do heatmap: consome o último registro de /variavel-externa/trend
// e de /variavel-externa/fear-greed (já buscados pelo useCoinPrices e anexados à
// moeda do carrossel como `trend` e `fear`), sem nenhuma chamada extra à API.
// ---------------------------------------------------------------------------

// Helpers exportados para testes unitários.
export const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v))

// O geoHHI pode chegar como fração (0-1) ou em pontos (0-10000), dependendo da
// normalização aplicada na coleta. Converte sempre para fração.
export const normalizarHHI = (hhi) => {
  const v = num(hhi)
  if (v === null) return null
  return v > 1 ? v / 10000 : v
}

export const formatarMinutos = (min) => {
  const v = num(min)
  if (v === null) return null
  if (v < 60) return `${v} min`
  const h = Math.floor(v / 60)
  const m = v % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export const formatarHora = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// O Google Trends normaliza a série em 0-100, mas registros imputados podem
// extrapolar; limita a exibição para não parecer bug ("130/100").
export const clampInteresse = (v) => {
  const n = num(v)
  return n === null ? null : Math.max(0, Math.min(100, n))
}

export const formatarContagem = (seg) => {
  const v = num(seg)
  if (v === null || v <= 0) return null
  const m = Math.floor(v / 60)
  const s = v % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const corFearGreed = (valor) => {
  if (valor >= 75) return '#4ade80'
  if (valor >= 50) return '#a3e635'
  if (valor >= 25) return '#fb923c'
  return '#f87171'
}

const StatChip = ({ label, value, delta, hint }) => {
  const deltaNum = num(delta)
  const chip = (
    <Box sx={{
      flex: '1 1 45%', minWidth: '120px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '10px', px: 1.5, py: 1,
    }}>
      <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Outfit, sans-serif' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.3 }}>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', fontFamily: 'Share Tech Mono, monospace' }}>
          {value}
        </Typography>
        {deltaNum !== null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2, color: deltaNum >= 0 ? '#4ade80' : '#f87171', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Share Tech Mono, monospace' }}>
            {deltaNum >= 0 ? <MdTrendingUp size={13} /> : <MdTrendingDown size={13} />}
            {deltaNum >= 0 ? '+' : ''}{deltaNum.toFixed(1)}
          </Box>
        )}
      </Box>
    </Box>
  )
  return hint ? <Tooltip title={hint} arrow>{chip}</Tooltip> : chip
}

const BarraMedida = ({ label, valorLabel, percent, cor }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Outfit, sans-serif' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: cor, fontFamily: 'Share Tech Mono, monospace' }}>
        {valorLabel}
      </Typography>
    </Box>
    <LinearProgress
      variant="determinate"
      value={Math.max(0, Math.min(100, percent))}
      sx={{
        height: '5px', borderRadius: '3px',
        background: 'rgba(255,255,255,0.05)',
        '& .MuiLinearProgress-bar': { background: cor, borderRadius: '3px' },
      }}
    />
  </Box>
)

export default function HeatmapInsights({ trend, fear, t }) {
  // Countdown até a próxima atualização do Fear & Greed (timeUntilUpdateSeg).
  const [segundosRestantes, setSegundosRestantes] = useState(null)
  const fearUpdateSeg = num(fear?.timeUntilUpdateSeg)

  useEffect(() => {
    if (fearUpdateSeg === null || fearUpdateSeg <= 0) {
      setSegundosRestantes(null)
      return
    }
    const alvo = Date.now() + fearUpdateSeg * 1000
    const tick = () => setSegundosRestantes(Math.max(0, Math.round((alvo - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [fearUpdateSeg])

  if (!trend && !fear) return null

  const valorAtual = clampInteresse(trend?.valorAtual)
  const mediaPeriodo = num(trend?.mediaPeriodo)
  const delta5 = num(trend?.delta5)
  const delta15 = num(trend?.delta15)
  const volatilidade = num(trend?.volatilidade15)
  const pico = formatarMinutos(trend?.minutosDesdePico)
  const rank = num(trend?.rankNoMinuto)
  const hhi = normalizarHHI(trend?.geoHHI)
  const horaRef = formatarHora(trend?.horaReferencia)
  const dadosImputados = trend?.isTimeseriesOk === false || trend?.isGeoOk === false

  const fearValor = num(fear?.valor)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Timestamp da coleta + selo de qualidade dos dados */}
      {(horaRef || dadosImputados) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {horaRef && (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'Outfit, sans-serif' }}>
              <MdAccessTime size={13} />
              {t('heatmap.atualizadoAs') || 'Atualizado às'} {horaRef}
            </Box>
          )}
          {dadosImputados && (
            <Tooltip title={t('heatmap.dadosImputados') || 'Parte dos dados foi estimada (coleta incompleta)'} arrow>
              <Box sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.5,
                px: 1, py: 0.2, borderRadius: '10px',
                background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.3)',
                fontSize: '0.7rem', color: '#fb923c', fontFamily: 'Outfit, sans-serif',
              }}>
                <MdWarningAmber size={13} />
                {t('heatmap.dadosImputados') || 'Dados parcialmente estimados'}
              </Box>
            </Tooltip>
          )}
        </Box>
      )}

      {/* Pulso da narrativa: métricas do último registro de trend */}
      {trend && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {valorAtual !== null && (
            <StatChip
              label={t('heatmap.interesseAtual') || 'Interesse atual'}
              value={`${valorAtual}/100`}
              hint={mediaPeriodo !== null ? `${t('heatmap.mediaPeriodo') || 'média'}: ${mediaPeriodo.toFixed(1)}` : undefined}
            />
          )}
          {delta5 !== null && (
            <StatChip label={t('heatmap.momentum5') || 'Momentum 5min'} value="" delta={delta5} />
          )}
          {delta15 !== null && (
            <StatChip label={t('heatmap.momentum15') || 'Momentum 15min'} value="" delta={delta15} />
          )}
          {volatilidade !== null && (
            <StatChip label={t('heatmap.volatilidade') || 'Volatilidade 15min'} value={volatilidade.toFixed(1)} />
          )}
          {pico !== null && (
            <StatChip label={t('heatmap.picoHa') || 'Pico de buscas há'} value={pico} />
          )}
          {rank !== null && (
            <StatChip label={t('heatmap.rankBuscas') || 'Rank de buscas'} value={`#${rank}`} />
          )}
        </Box>
      )}

      {/* Concentração geográfica (índice HHI) */}
      {hhi !== null && (
        <BarraMedida
          label={t('heatmap.concentracaoGeo') || 'Concentração geográfica'}
          valorLabel={hhi >= 0.25
            ? `🎯 ${t('heatmap.concentrada') || 'Narrativa concentrada'}`
            : `🌍 ${t('heatmap.distribuida') || 'Narrativa globalizada'}`}
          percent={hhi * 100}
          cor="#ffd700"
        />
      )}

      {/* Índice Fear & Greed do ativo */}
      {fearValor !== null && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
          <BarraMedida
            label={t('heatmap.fearGreed') || 'Fear & Greed'}
            valorLabel={`${fearValor} · ${fear?.classificacao || ''}`}
            percent={fearValor}
            cor={corFearGreed(fearValor)}
          />
          {formatarContagem(segundosRestantes) && (
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'Share Tech Mono, monospace', alignSelf: 'flex-end' }}>
              ⏳ {t('heatmap.proximaAtualizacao') || 'Próxima atualização em'} {formatarContagem(segundosRestantes)}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  )
}
