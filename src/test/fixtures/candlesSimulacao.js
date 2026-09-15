// Candles sintéticos das suítes da simulação.
//
// Moravam no topo do backtest.test.js. Saíram quando as regras novas do motor
// (saída por sinal, stop móvel, filtros, dimensionamento) ganharam suíte
// própria: copiar estes construtores seria o lugar onde as duas suítes
// passariam a montar candles de jeitos diferentes sem ninguém perceber.

// O martelo é o sinal de entrada de toda a suíte: é puramente geométrico e
// avaliado candle a candle, então dá para colocá-lo numa posição exata sem
// depender do resto da série. Divergência, VWAP e osciladores dependem de
// janela e não serviriam para cravar "o sinal está NESTE candle".
export const HORA_MS = 3600000

export const candle = ({
  abertura,
  maior,
  menor,
  fechamento,
  hora,
  martelo = false,
  estrela = false,
  volume = 100,
  // A amplitude alimenta DUAS coisas: a proporção que classifica o candle e o
  // ATR. Por padrão ela acompanha a geometria fixa do padrão (42 no martelo,
  // 100 no neutro), porque é isso que a maioria dos casos precisa. Quem testa
  // volatilidade passa o valor explicitamente.
  amplitude = null,
}) => ({
  precoAbertura: abertura,
  precoMaior: maior,
  precoMenor: menor,
  precoFechamento: fechamento,
  precoVolume: volume,
  precoTotalNegociada: volume * fechamento,
  horaReferencia: hora,
  // Sombra inferior ≥ 2× o corpo e maior que a superior: martelo.
  // Corpo no meio da amplitude, sombras iguais: neutro.
  precoCorpoCandle: martelo || estrela ? 10 : 50,
  // Estrela cadente e o espelho do martelo: sombra SUPERIOR longa.
  precoSombraSuperior: estrela ? 30 : martelo ? 2 : 25,
  precoSombraInferior: martelo ? 30 : estrela ? 2 : 25,
  precoAmplitude: amplitude ?? (martelo || estrela ? 42 : 100),
  // Constantes em toda a série para que nenhuma anomalia dispare sem ser
  // pedida: desvio zero na variação, razão 1 no volume e no ticket.
  precoPercentualVariacao: 0,
  precoFinanceiroPorTrade: 10,
  volumeDelta: 0,
})

/**
 * Monta a série na ordem da API a partir de definições cronológicas.
 *
 * @param {Array<object>} defs - Um candle por hora, do mais antigo ao mais novo.
 * @param {{inicio?: string, sufixoZ?: boolean, saltos?: object}} opcoes
 *   `saltos` mapeia índice → horas puladas antes daquele candle.
 */
export const serie = (defs, { inicio = '2026-01-01T00:00:00Z', sufixoZ = true, saltos = {} } = {}) => {
  const base = new Date(inicio).getTime()
  let deslocamento = 0
  const cronologico = defs.map((d, i) => {
    deslocamento += (saltos[i] ?? 1) - 1
    const t = new Date(base + (i + deslocamento) * HORA_MS).toISOString()
    return candle({ ...d, hora: sufixoZ ? t : t.replace('Z', '') })
  })
  // A API entrega do mais recente ao mais antigo.
  return [...cronologico].reverse()
}

// Candle parado, sem sinal: preenche a série em volta do que está sendo medido.
export const parado = (preco) => ({
  abertura: preco,
  maior: preco,
  menor: preco,
  fechamento: preco,
})
