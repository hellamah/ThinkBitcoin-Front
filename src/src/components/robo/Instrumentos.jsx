import { keyframes } from '@emotion/react'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { estiloDeTabela } from '../treinamento/formato'
import { posicoesDaRegua } from '../../utils/roboAoVivo'
import { FONTE_DOS_NUMEROS, SEM_MOVIMENTO } from './estilo'

// Os instrumentos da tela Robô ao vivo: a régua até o gatilho, a escala das
// pausas, a barra das entradas, o medidor do limite e as chaves dos gráficos. As
// cores vêm dos tokens de tema, então tudo acompanha claro e escuro. Texto usa
// sempre token de texto; a cor do dado fica na marca ao lado dele.

const crescer = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`
const pulsar = keyframes`
  0% { box-shadow: 0 0 0 0 var(--accent-a40); }
  70% { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`

/** O ponto que diz se o robô está registrando: pulsa só quando está. */
export function PontoDeEstado({ ativo }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        display: 'inline-block',
        flexShrink: 0,
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: ativo ? 'var(--perf-up)' : 'var(--perf-warn)',
        ...(ativo ? { animation: `${pulsar} 2.4s ease-out infinite`, [SEM_MOVIMENTO]: { animation: 'none' } } : {}),
      }}
    />
  )
}

/** Um número do painel: o rótulo discreto e o valor em evidência. */
export function Indicador({ rotulo, detalhe, testId, children }) {
  return (
    <Box sx={{ minWidth: 0, pt: 1.25, borderTop: '1px solid var(--border)' }}>
      <Typography variant="caption" component="div" sx={{ color: 'var(--text-muted)', lineHeight: 1.3 }}>{rotulo}</Typography>
      <Typography
        component="div"
        data-testid={testId}
        sx={{ fontFamily: FONTE_DOS_NUMEROS, fontSize: { xs: '1.05rem', md: '1.2rem' }, lineHeight: 1.4, color: 'var(--text-primary)' }}
      >
        {children}
      </Typography>
      {detalhe && <Typography variant="caption" component="div" sx={{ color: 'var(--text-muted)', lineHeight: 1.3 }}>{detalhe}</Typography>}
    </Box>
  )
}

/**
 * A régua do preço de agora até o gatilho: o caminho que falta aparece como uma
 * faixa que ganha força na direção do gatilho. A frase ao lado diz o mesmo em
 * palavras; a régua é o que se lê de relance.
 */
export function ReguaDoGatilho({ preco, gatilho, rotuloPreco, rotuloGatilho, valorPreco, valorGatilho, resumo }) {
  const pos = posicoesDaRegua(preco, gatilho)
  const paraDireita = pos.gatilho >= pos.preco
  const inicio = Math.min(pos.preco, pos.gatilho)
  const largura = Math.abs(pos.gatilho - pos.preco)
  const rotulo = (posicao, titulo, valor, forte) => (
    <Box sx={{ position: 'absolute', bottom: 18, left: `${posicao}%`, transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
      <Typography variant="caption" component="div" sx={{ color: 'var(--text-muted)', lineHeight: 1.2 }}>{titulo}</Typography>
      <Typography component="div" sx={{ fontFamily: FONTE_DOS_NUMEROS, fontSize: { xs: '0.9rem', md: '1rem' }, lineHeight: 1.3, color: forte ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        {valor}
      </Typography>
    </Box>
  )
  return (
    <Box role="img" aria-label={resumo} data-testid="robo-regua" sx={{ position: 'relative', height: 70 }}>
      {rotulo(pos.preco, rotuloPreco, valorPreco, false)}
      {rotulo(pos.gatilho, rotuloGatilho, valorGatilho, true)}
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 7, height: '1px', backgroundColor: 'var(--border-strong)' }} />
      <Box
        sx={{
          position: 'absolute',
          bottom: 3,
          height: 9,
          left: `${inicio}%`,
          width: `${largura}%`,
          borderRadius: '4px',
          background: `linear-gradient(${paraDireita ? 'to right' : 'to left'}, var(--accent-a10), var(--accent-a50))`,
          transformOrigin: paraDireita ? 'left center' : 'right center',
          animation: `${crescer} 700ms 180ms cubic-bezier(.2,.7,.2,1) both`,
          [SEM_MOVIMENTO]: { animation: 'none' },
        }}
      />
      {/* O gatilho é um traço firme; o preço, um ponto com o anel da superfície. */}
      <Box sx={{ position: 'absolute', bottom: 0, left: `${pos.gatilho}%`, width: 2, height: 15, marginLeft: '-1px', backgroundColor: 'var(--text-primary)' }} />
      <Box
        sx={{
          position: 'absolute',
          bottom: 1,
          left: `${pos.preco}%`,
          width: 13,
          height: 13,
          marginLeft: '-6.5px',
          borderRadius: '50%',
          backgroundColor: 'var(--accent-ink)',
          boxShadow: '0 0 0 2px var(--surface-panel-solid)',
        }}
      />
    </Box>
  )
}

// O rótulo não sai da faixa: perto das pontas, ele se apoia na própria marca.
const alinhamento = (posicao) => (posicao < 15 ? 'translateX(0)' : posicao > 85 ? 'translateX(-100%)' : 'translateX(-50%)')

/**
 * Onde a duração de hoje cai no histórico, em escala linear: a marca de hoje sobre
 * os dias que o texto ao lado explica (metade, 1 em cada 10 e o recorde).
 */
export function EscalaDeDuracao({ atual, marcas, maior, rotuloAtual, resumo }) {
  const posicao = (dias) => Math.min(100, (dias / Math.max(maior, 1)) * 100)
  const hoje = posicao(atual)
  return (
    <Box role="img" aria-label={resumo} data-testid="robo-normal-escala" sx={{ position: 'relative', height: 52, mt: 0.5 }}>
      <Typography
        component="div"
        sx={{ position: 'absolute', top: 0, left: `${hoje}%`, transform: alinhamento(hoje), fontFamily: FONTE_DOS_NUMEROS, fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}
      >
        {rotuloAtual}
      </Typography>
      <Box sx={{ position: 'absolute', left: 0, right: 0, top: 26, height: 4, borderRadius: '4px', backgroundColor: 'var(--surface-fill-strong)' }} />
      <Box sx={{ position: 'absolute', left: 0, top: 26, height: 4, width: `${hoje}%`, borderRadius: '4px', backgroundColor: 'var(--accent-ink)' }} />
      {marcas.map((dias) => (
        <Box key={dias}>
          <Box sx={{ position: 'absolute', top: 23, left: `${posicao(dias)}%`, width: '1px', height: 10, backgroundColor: 'var(--text-muted)' }} />
          <Typography
            component="div"
            sx={{ position: 'absolute', top: 34, left: `${posicao(dias)}%`, transform: alinhamento(posicao(dias)), fontFamily: FONTE_DOS_NUMEROS, fontSize: '0.72rem', color: 'var(--text-muted)' }}
          >
            {dias}
          </Typography>
        </Box>
      ))}
      <Box sx={{ position: 'absolute', top: 21, left: `${hoje}%`, width: 14, height: 14, marginLeft: '-7px', borderRadius: '50%', backgroundColor: 'var(--accent-ink)', boxShadow: '0 0 0 2px var(--surface-panel-solid)' }} />
    </Box>
  )
}

/** A divisão das entradas: quantas ganharam e quantas perderam, e o tamanho de cada lado. */
export function BarraDeEntradas({ comGanho, total, rotuloGanho, rotuloPerda }) {
  const fracao = total > 0 ? (comGanho / total) * 100 : 0
  const legenda = (cor, texto) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '2px', flexShrink: 0, backgroundColor: cor }} />
      <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>{texto}</Typography>
    </Box>
  )
  return (
    <Box sx={{ mt: 0.75 }}>
      <Box aria-hidden="true" sx={{ display: 'flex', gap: '2px', height: 8 }}>
        {fracao > 0 && <Box sx={{ width: `${fracao}%`, borderRadius: '4px 0 0 4px', backgroundColor: 'var(--perf-up)' }} />}
        {fracao < 100 && <Box sx={{ flex: 1, borderRadius: '0 4px 4px 0', backgroundColor: 'var(--perf-down)' }} />}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 1.5, mt: 0.5 }}>
        {legenda('var(--perf-up)', rotuloGanho)}
        {legenda('var(--perf-down)', rotuloPerda)}
      </Box>
    </Box>
  )
}

/** Quanto do limite já foi usado. A cor só muda perto dele; o texto ao lado diz o resto. */
export function MedidorDoLimite({ fracao }) {
  if (fracao === null || fracao === undefined) return null
  const uso = Math.min(1, Math.abs(fracao))
  const cor = uso >= 1 ? 'var(--perf-down)' : uso >= 0.7 ? 'var(--perf-warn)' : 'var(--accent-ink)'
  return (
    <Box aria-hidden="true" sx={{ height: 4, my: 0.5, borderRadius: '4px', backgroundColor: 'var(--surface-fill-strong)' }}>
      <Box sx={{ height: '100%', minWidth: 3, width: `${uso * 100}%`, borderRadius: '4px', backgroundColor: cor }} />
    </Box>
  )
}

/** A chave de uma série: repete a forma da marca no gráfico, para a cor não ser o único sinal. */
export function ChaveDaSerie({ tipo, cor }) {
  const desenho = {
    linha: <line x1="1" y1="6" x2="17" y2="6" stroke={cor} strokeWidth="2" strokeLinecap="round" />,
    tracejada: <line x1="1" y1="6" x2="17" y2="6" stroke={cor} strokeWidth="2" strokeDasharray="4 3" />,
    ponto: <circle cx="9" cy="6" r="4" fill={cor} />,
    sobe: <path d="M9 1.5 14 10H4Z" fill={cor} />,
    desce: <path d="M9 10.5 4 2h10Z" fill={cor} />,
    losango: <path d="M9 .8 14.2 6 9 11.2 3.8 6Z" fill={cor} />,
  }[tipo]
  return <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true" style={{ flexShrink: 0 }}>{desenho}</svg>
}

export function LegendaDoGrafico({ itens }) {
  return (
    <Box data-testid="robo-legenda" sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, mb: 1 }}>
      {itens.map((item) => (
        <Box key={item.rotulo} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <ChaveDaSerie tipo={item.tipo} cor={item.cor} />
          <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>{item.rotulo}</Typography>
        </Box>
      ))}
    </Box>
  )
}

/** O gráfico em tabela, fechado por padrão: nenhum valor depende de passar o mouse. */
export function TabelaDoGrafico({ rotulo, colunas, linhas }) {
  if (!linhas.length) return null
  return (
    <Box
      component="details"
      data-testid="robo-tabela-do-grafico"
      sx={{ mt: 1, '& > summary': { cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', width: 'fit-content' }, '& > summary:hover': { color: 'var(--text-primary)' } }}
    >
      <summary>{rotulo}</summary>
      <TableContainer sx={{ maxHeight: 240, mt: 0.5 }}>
        <Table size="small" stickyHeader sx={{ ...estiloDeTabela, '& th': { ...estiloDeTabela['& th'], backgroundColor: 'var(--surface-panel-solid)' } }}>
          <TableHead>
            <TableRow>
              {colunas.map((coluna, i) => <TableCell key={coluna} align={i === 0 ? 'left' : 'right'}>{coluna}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {linhas.map((linha) => (
              <TableRow key={linha.chave}>
                {linha.valores.map((valor, i) => (
                  <TableCell key={colunas[i]} align={i === 0 ? 'left' : 'right'} sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{valor}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
