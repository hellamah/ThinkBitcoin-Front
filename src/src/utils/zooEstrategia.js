// Zoo de estratégias: regras simples em candle diário, medidas pela régua de
// risco contra o buy & hold da mesma moeda. Os números chegam prontos da API
// (o worker Python calcula, o .NET grava): aqui só o que a tela precisa para
// mostrar — escolha padrão, queda a partir do topo, veredito do ano.

// As referências do zoo: o buy & hold tem a queda inteira do mercado, o caixa
// não ganha nada. Ficam no ranking para comparar, mas não são a escolha padrão.
export const REFERENCIAS = Object.freeze(['buy_hold', 'caixa'])
export const BUY_HOLD = 'buy_hold'

// O agente DQN na janela de teste dele: o _melhor do treino, cru (sem os gates
// da decisão ao vivo), como mais uma linha do ranking.
export const AGENTE = 'agente_dqn'

// Os dois rankings do zoo. O histórico mede as regras no histórico inteiro de
// cada moeda; a janela do agente mede as regras e o agente só no teste do
// holdout, o único trecho que o treino não viu e que não escolheu o modelo.
export const JANELAS = Object.freeze({ HISTORICO: 'historico', TESTE_AGENTE: 'teste-agente' })

/** A janela pedida na URL (?janela=); qualquer outra coisa é o histórico. */
export const janelaDaUrl = (valor) => (valor === JANELAS.TESTE_AGENTE ? JANELAS.TESTE_AGENTE : JANELAS.HISTORICO)

/** O parâmetro da API: o histórico vai sem ele, como antes da janela existir. */
export const parametroDaJanela = (janela) => (janela === JANELAS.TESTE_AGENTE ? janela : undefined)

/**
 * A escolha padrão do ranking. Na janela do agente, o agente — é para ele que a
 * aba existe. Senão, a primeira estratégia que não é referência; sem nenhuma, a
 * primeira.
 */
export const estrategiaPadrao = (rodada) => {
  const lista = rodada?.estrategias ?? []
  if (rodada?.janela === JANELAS.TESTE_AGENTE && lista.some((e) => e.estrategia === AGENTE)) return AGENTE
  return (lista.find((e) => !REFERENCIAS.includes(e.estrategia)) ?? lista[0])?.estrategia ?? null
}

/** A estratégia escolhida, se ela existe nesta rodada; senão, a padrão. */
export const estrategiaDaRodada = (rodada, escolhida) =>
  (escolhida && (rodada?.estrategias ?? []).some((e) => e.estrategia === escolhida) ? escolhida : estrategiaPadrao(rodada))

/** Meses inteiros da janela, de início a fim (datas ISO); nulo sem as duas. */
export const mesesDaJanela = (inicio, fim) => {
  const ms = Date.parse(fim) - Date.parse(inicio)
  return Number.isFinite(ms) ? Math.max(1, Math.round(ms / (30.44 * 24 * 3_600_000))) : null
}

/** As moedas da rodada, em ordem alfabética. */
export const moedasDaRodada = (rodada) =>
  [...new Set((rodada?.estrategias ?? []).flatMap((e) => (e.porMoeda ?? []).map((m) => m.moeda)))].sort()

/** BTC quando a rodada o tem; senão, a primeira moeda. */
export const moedaPadrao = (moedas) => (moedas.includes('BTC') ? 'BTC' : moedas[0] ?? null)

/**
 * Nome da estratégia no idioma da tela. Estratégia nova, que o dicionário ainda
 * não conhece, cai na descrição que veio do worker (em português) e, sem ela,
 * no identificador — nunca na chave crua do dicionário.
 */
export const nomeDaEstrategia = (t, estrategia, descricao) => {
  const chave = `zoo.nomes.${estrategia}`
  const nome = t(chave)
  return nome === chave ? (descricao || estrategia) : nome
}

/** Pontos da curva para o gráfico: {x: ms, y: patrimônio}, sem os nulos. */
export const pontosDaCurva = (curva) =>
  (curva?.pontos ?? [])
    .filter((p) => p.patrimonio !== null && p.patrimonio !== undefined)
    .map((p) => ({ x: new Date(p.data).getTime(), y: p.patrimonio }))

/**
 * Queda a partir do topo, ponto a ponto: patrimônio / maior patrimônio até ali − 1.
 * O primeiro topo é o capital inicial (1,0), como na régua do worker: quem já
 * começa perdendo a taxa de entrada começa um pouco abaixo de zero.
 */
export const quedaDaCurva = (pontos, base = 1) => {
  let topo = base
  return pontos.map(({ x, y }) => {
    topo = Math.max(topo, y)
    return { x, y: topo > 0 ? y / topo - 1 : 0 }
  })
}

/** A pior queda da série (fração negativa); 0 sem queda. */
export const piorQueda = (queda) => queda.reduce((pior, p) => Math.min(pior, p.y), 0)

/**
 * O veredito de um ano: 'ok' quando as duas condições do critério valem; senão,
 * qual delas falhou ('retorno', 'queda' ou 'ambas').
 */
export const resultadoDoAno = (ano) => {
  if (ano.retornoOk && ano.quedaOk) return 'ok'
  if (!ano.retornoOk && !ano.quedaOk) return 'ambas'
  return ano.retornoOk ? 'queda' : 'retorno'
}

/**
 * O dia de uma data do zoo, com o ano, no formato do idioma. As datas do zoo são
 * dias de fechamento à meia-noite UTC: no fuso do navegador (UTC−3) elas viravam
 * a véspera às 21h — "03/03, 21:00" no lugar de 04/03/2018.
 */
export const formatarDiaUtc = (valor, locale) => {
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(d)
}

/**
 * O mesmo dia do calendário, à meia-noite do fuso local. O eixo de tempo do
 * gráfico desenha no fuso do navegador; sem isto, cada ponto caía na véspera.
 */
export const noDiaLocal = (ms) => {
  const d = new Date(ms)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime()
}

/**
 * O zoo roda todo dia às 00:30 UTC (CronJob thinkbitcoin-back-python-worker-zoo)
 * e a rodada leva um minuto. Passadas 30 horas, a do dia não saiu: job com erro,
 * máquina desligada o dia inteiro, release fora do ar. Sem o aviso, a tela seguia
 * mostrando a rodada velha, e só a data miúda do cabeçalho denunciava.
 */
export const HORAS_PARA_ATRASO = 30

/** Horas inteiras desde a rodada; nulo sem data válida. */
export const horasDesdeARodada = (dataHora, agora = Date.now()) => {
  // new Date(null) é 1970, não data inválida.
  if (!dataHora) return null
  const instante = new Date(dataHora).getTime()
  return Number.isFinite(instante) ? Math.floor((agora - instante) / 3_600_000) : null
}

/** A rodada passou do horário da seguinte, com folga. */
export const rodadaAtrasada = (dataHora, agora = Date.now()) => {
  const horas = horasDesdeARodada(dataHora, agora)
  return horas !== null && horas >= HORAS_PARA_ATRASO
}

/** A linha de uma moeda dentro de uma estratégia da rodada. */
export const linhaDaMoeda = (rodada, estrategia, moeda) =>
  rodada?.estrategias?.find((e) => e.estrategia === estrategia)?.porMoeda?.find((m) => m.moeda === moeda) ?? null
