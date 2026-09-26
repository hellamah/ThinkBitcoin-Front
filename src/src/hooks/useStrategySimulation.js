import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import useSimulationData from './useSimulationData'
import useRobustezSimulacao from './useRobustezSimulacao'
import { TrechoRobustez } from '../utils/tarefaRobustez'
import { montarSerieDeSinais } from '../utils/signalLab'
import {
  simular,
  dividirParaValidacao,
  compararEstrategias,
  ultimoDisparo,
} from '../utils/backtest'
import {
  bootstrapRetorno,
  retornoSemMelhores,
  custoDeEquilibrio,
  resumirExcursoes,
  resultadoPorMes,
  serieSubmersa,
} from '../utils/robustez'
import { limiarPorTentativas } from '../utils/acaso'
import {
  lerParametrosDaUrl,
  escreverParametrosNaUrl,
  sanearParametros,
  impressaoDaConfiguracao,
} from '../utils/parametrosSimulacao'
import {
  lerTentativas,
  registrarTentativa,
  zerarTentativas,
  lerDiario,
  guardarNoDiario,
  removerDoDiario,
  lerRevelacoes,
  registrarRevelacao,
} from '../utils/experimentos'

// Quanto tempo uma configuração precisa ficar parada na tela para contar como
// tentativa. Sem isto, digitar "2,5" no stop contaria "2" e "2,5" como dois
// testes, e clicar rápido por três horizontes para chegar ao quarto contaria
// quatro — quando a pessoa só OLHOU para o último.
const ATRASO_TENTATIVA_MS = 1500

/**
 * Tudo que a simulação de estratégia precisa, fora do Dashboard.
 *
 * Morava no Dashboard: o estado dos parâmetros, a série própria, o corte de
 * validação, o holdout e o ranking — umas 160 linhas que só um painel lia.
 * Com a régua aleatória, as leituras de robustez, a URL e o diário, ficar lá
 * faria da página inteira a dona de um detalhe do painel.
 *
 * Os parâmetros continuam fora do DashboardContext, pelo mesmo motivo de antes:
 * nenhum outro painel os consulta, e levá-los ao contexto global faria a tela
 * inteira reagir a um ajuste que só interessa a um painel.
 *
 * @param {object} params
 * @param {string|null} params.token
 * @param {string|null} params.sigla - Moeda única; sem ela não há simulação.
 * @param {Function} params.t
 * @param {{intl: string}} params.idioma
 */
export default function useStrategySimulation({ token, sigla, t, idioma }) {
  // ------ parâmetros, com ida e volta pela URL ------
  const [searchParams, setSearchParams] = useSearchParams()
  // Lidos da URL uma vez, no começo. Depois disso a URL é SAÍDA: quem manda é o
  // estado, e a URL só registra — senão cada escrita voltaria como leitura.
  const [parametros, setParametros] = useState(() => lerParametrosDaUrl(searchParams))

  // Sem saneamento aqui, de propósito: o campo de stop passa por "0" e "0,"
  // enquanto alguém digita "0,5", e sanear cada tecla apagaria o campo no meio
  // da digitação. O que vem de fora (URL, diário) é que é saneado.
  const alterarParametro = useCallback((nome, valor) => {
    setParametros((atual) => ({ ...atual, [nome]: valor }))
  }, [])

  const restaurarParametros = useCallback((p) => setParametros(sanearParametros(p)), [])

  // `setSearchParams` muda de identidade a cada navegação. Pô-lo nas
  // dependências do efeito que escreve a URL faria a própria escrita disparar
  // o efeito de novo; a ref guarda a versão atual sem entrar na lista.
  const setSearchParamsRef = useRef(setSearchParams)
  useEffect(() => {
    setSearchParamsRef.current = setSearchParams
  }, [setSearchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const atual = new URLSearchParams(window.location.search)
    const proxima = escreverParametrosNaUrl(atual, parametros)
    if (proxima.toString() === atual.toString()) return
    // `replace`: ajustar um parâmetro não é navegar. Com push, o botão de
    // voltar desfaria um clique de cada vez em vez de sair da página.
    setSearchParamsRef.current(proxima, { replace: true })
  }, [parametros])

  // ------ série e sinais ------
  //
  // A série NÃO é a do dashboard. Ela é buscada à parte, numa janela de 180
  // dias, porque a do dashboard é curta demais para a amostra fechar e é a
  // resposta paginada — que a tabela de histórico troca por baixo de todos os
  // painéis. Ver utils/simulationWindow.js.
  const {
    registros: serieSimulacao,
    aPartirDe: inicioSimulacao,
    carregando,
    erro,
  } = useSimulationData({ token, sigla })

  // A série de sinais é montada UMA vez por série de candles, e todo o resto do
  // painel a recebe pronta. Antes ela era remontada cinco vezes a cada troca de
  // parâmetro — pelo seletor, pela simulação, pelas duas pontas do holdout e
  // pelo ranking — sobre exatamente os mesmos candles.
  const serieDeSinais = useMemo(
    () => (serieSimulacao?.length ? montarSerieDeSinais(serieSimulacao) : null),
    [serieSimulacao]
  )

  // O seletor oferece os sinais presentes na SÉRIE DA SIMULAÇÃO, não na do
  // laboratório: são janelas diferentes, e um sinal que existe em 180 dias pode
  // não existir nos 7 que o laboratório analisa.
  //
  // Ordenado pelo RÓTULO traduzido, não pela chave: quando a escolha deixa de
  // existir na janela, o painel cai no PRIMEIRO da lista, e esse primeiro
  // precisa ser o que a pessoa vê no topo do seletor.
  const sinaisDisponiveis = useMemo(() => {
    if (!serieDeSinais) return []
    const presentes = new Set()
    serieDeSinais.forEach(({ sinais }) => sinais.forEach((s) => presentes.add(s)))
    return [...presentes].sort((a, b) =>
      t(`signal_${a}`).localeCompare(t(`signal_${b}`), idioma.intl)
    )
  }, [serieDeSinais, t, idioma])

  // A escolha pode deixar de existir ao trocar de moeda. Para a entrada, cair
  // no primeiro disponível mantém o painel útil; para saída e confirmação,
  // que são opcionais, cair em "nenhum" é o que não inventa uma regra.
  const disponivel = (s) => (s && sinaisDisponiveis.includes(s) ? s : null)
  const sinalEntrada = disponivel(parametros.sinalEntrada) ?? sinaisDisponiveis[0] ?? null
  const sinalSaida = disponivel(parametros.sinalSaida)
  const sinalConfirmacao = disponivel(parametros.sinalConfirmacao)

  // O corte de validação não depende de parâmetro nenhum: é função da série e da
  // janela. Fica à parte para o holdout e o ranking usarem o MESMO corte.
  const corte = useMemo(() => {
    if (!serieSimulacao) return null
    const c = dividirParaValidacao(serieSimulacao, undefined, { aPartirDe: inicioSimulacao })
    if (!c) return null
    return { ...c, serieDeSinaisAjuste: montarSerieDeSinais(c.registrosAjuste) }
  }, [serieSimulacao, inicioSimulacao])

  // ------ simulação ------
  //
  // Os parâmetros da REGRA COMUM, sem o sinal de entrada. O ranking roda a mesma
  // regra sobre todos os sinais, então não depende de qual está selecionado —
  // memoizá-lo sobre o objeto inteiro fazia clicar num nome da tabela
  // recalcular catorze estratégias para produzir a tabela idêntica.
  const {
    direcao,
    saidaPorTempo,
    modoStop,
    stopPercentual,
    alvoPercentual,
    custoPercentual,
    filtroTendencia,
    riscoPorOperacao,
  } = parametros

  // `aPartirDe` vem da janela da simulação, não do filtro do dashboard: é o que
  // separa os candles de aquecimento do período que de fato vira operação.
  const opcoesComuns = useMemo(
    () => ({
      direcao,
      saidaPorTempo,
      modoStop,
      stopPercentual,
      alvoPercentual,
      custoPercentual,
      sinalSaida,
      filtroTendencia,
      sinalConfirmacao,
      riscoPorOperacao,
      aPartirDe: inicioSimulacao,
    }),
    [
      direcao, saidaPorTempo, modoStop, stopPercentual, alvoPercentual, custoPercentual,
      sinalSaida, filtroTendencia, sinalConfirmacao, riscoPorOperacao, inicioSimulacao,
    ]
  )

  const opcoesSimulacao = useMemo(
    () => (sinalEntrada ? { ...opcoesComuns, sinalEntrada } : null),
    [opcoesComuns, sinalEntrada]
  )

  const resultado = useMemo(
    () =>
      serieSimulacao && opcoesSimulacao
        ? simular(serieSimulacao, { ...opcoesSimulacao, serieDeSinais })
        : null,
    [serieSimulacao, opcoesSimulacao, serieDeSinais]
  )

  // Corte de validação: o usuário ajusta os parâmetros olhando o trecho de
  // ajuste, e a coluna de validação mostra como aquilo se sai no pedaço que ele
  // não usou para escolher.
  const holdout = useMemo(() => {
    if (!corte || !opcoesSimulacao) return null
    return {
      ajuste: simular(corte.registrosAjuste, {
        ...opcoesSimulacao,
        serieDeSinais: corte.serieDeSinaisAjuste,
      }),
      // A validação recebe a série inteira e só abre posição depois do corte:
      // assim os indicadores de janela móvel chegam aquecidos ao primeiro
      // candle validado. Sendo a série inteira, a série de sinais dela serve.
      validacao: simular(corte.registrosValidacao, {
        ...opcoesSimulacao,
        aPartirDe: corte.aPartirDeValidacao,
        serieDeSinais,
      }),
    }
  }, [corte, opcoesSimulacao, serieDeSinais])

  const comparativo = useMemo(() => {
    if (!serieSimulacao) return null
    return compararEstrategias(serieSimulacao, {
      ...opcoesComuns,
      serieDeSinais,
      serieDeSinaisAjuste: corte?.serieDeSinaisAjuste ?? null,
    })
  }, [serieSimulacao, opcoesComuns, serieDeSinais, corte])

  // ------ validação reservada ------
  //
  // O trecho de validação só vale enquanto não é olhado. Ele era mostrado ao
  // vivo a cada ajuste — e, por dentro da janela cheia, também na curva, no
  // retorno e na régua aleatória. Quem ajustava olhando qualquer um deles
  // escolhia a regra pela validação, e ela virava um segundo trecho de ajuste.
  //
  // Agora a tela mostra só o AJUSTE até a pessoa fixar a regra. Fixar é
  // revelar: aí aparecem a validação e a janela cheia, para aquela regra. Mudar
  // qualquer parâmetro é outra regra, e volta a ser só ajuste.
  const parametrosEfetivos = useMemo(
    () => ({ ...parametros, sinalEntrada, sinalSaida, sinalConfirmacao }),
    [parametros, sinalEntrada, sinalSaida, sinalConfirmacao]
  )
  const impressao = useMemo(() => impressaoDaConfiguracao(parametrosEfetivos), [parametrosEfetivos])

  const [revelacoes, setRevelacoes] = useState(() => lerRevelacoes(sigla))
  useEffect(() => {
    setRevelacoes(lerRevelacoes(sigla))
  }, [sigla])

  const revelacao = revelacoes.find((r) => r.impressao === impressao) ?? null
  // Sem trecho reservado — janela curta demais para cortar — não há o que
  // esconder, e a tela mostra a janela inteira como antes.
  const temReserva = Boolean(holdout?.ajuste && holdout?.validacao)
  const reservada = temReserva && !revelacao
  const exibido = reservada ? holdout.ajuste : resultado

  // ------ robustez ------
  const robustez = useRobustezSimulacao({
    registros: serieSimulacao,
    aPartirDe: inicioSimulacao,
    opcoes: opcoesSimulacao,
    trecho: reservada ? TrechoRobustez.AJUSTE : TrechoRobustez.CHEIA,
  })

  // As leituras que só relêem o resultado já simulado. Baratas o bastante para
  // a thread da tela: nenhuma volta aos candles. São do que está na tela: do
  // ajuste enquanto a validação está reservada.
  const analises = useMemo(() => {
    if (!exibido) return null
    const { trades, curva, metricas, parametros: p } = exibido
    return {
      bootstrap: bootstrapRetorno(trades),
      semMelhores: retornoSemMelhores(trades),
      equilibrio: custoDeEquilibrio(trades, { direcao: p.direcao, buyAndHold: metricas.buyAndHold }),
      excursoes: resumirExcursoes(trades),
      porMes: resultadoPorMes(curva, trades, p.capitalInicial),
      submersa: serieSubmersa(curva),
    }
  }, [exibido])

  const disparo = useMemo(
    () =>
      serieSimulacao && sinalEntrada
        ? ultimoDisparo(serieSimulacao, {
            sinalEntrada,
            filtroTendencia,
            sinalConfirmacao,
            serieDeSinais,
          })
        : null,
    [serieSimulacao, sinalEntrada, filtroTendencia, sinalConfirmacao, serieDeSinais]
  )

  // ------ tentativas e diário ------
  const [tentativas, setTentativas] = useState(() => lerTentativas(sigla))
  const [diario, setDiario] = useState(() => lerDiario(sigla))
  const [diarioCheio, setDiarioCheio] = useState(false)

  useEffect(() => {
    setTentativas(lerTentativas(sigla))
    setDiario(lerDiario(sigla))
    setDiarioCheio(false)
  }, [sigla])

  const temResultado = Boolean(resultado)
  useEffect(() => {
    if (!sigla || !temResultado) return undefined
    const timer = setTimeout(
      () => setTentativas(registrarTentativa(sigla, impressao)),
      ATRASO_TENTATIVA_MS
    )
    return () => clearTimeout(timer)
  }, [sigla, impressao, temResultado])

  const zerar = useCallback(() => setTentativas(zerarTentativas(sigla)), [sigla])

  // O diário guarda sempre os números do AJUSTE — é sobre eles que a regra foi
  // escolhida —, e a validação só da regra revelada. Guardar a janela cheia de
  // uma regra já revelada sobrescreveria o registro do momento em que ela foi
  // fixada com números que já contêm a validação.
  const resumoDoDiario = useCallback(
    (comValidacao) => {
      const base = holdout?.ajuste ?? resultado
      const validacao = holdout?.validacao
      // A régua só vale se estiver em dia E medida no mesmo trecho da base: um
      // percentil de outra configuração, ou da janela cheia, seria guardado
      // como se fosse do ajuste desta.
      const acasoDoAjuste = !robustez.calculando && (reservada || !temReserva)
      const anterior = lerDiario(sigla).find((e) => e.impressao === impressao)?.resumo
      return {
        retornoTotal: base.metricas.retornoTotal,
        alfa: base.metricas.alfa,
        alfaValidacao:
          comValidacao && validacao && validacao.trades.length > 0 ? validacao.metricas.alfa : null,
        tradesConcluidos: base.metricas.tradesConcluidos,
        percentilAcaso: acasoDoAjuste
          ? robustez.acaso?.percentil ?? null
          : anterior?.percentilAcaso ?? null,
      }
    },
    [holdout, resultado, robustez, reservada, temReserva, sigla, impressao]
  )

  const guardar = useCallback(() => {
    if (!resultado) return
    const { lista, cheio } = guardarNoDiario(sigla, {
      impressao,
      parametros: parametrosEfetivos,
      resumo: resumoDoDiario(Boolean(revelacao)),
    })
    setDiario(lista)
    setDiarioCheio(cheio)
  }, [resultado, sigla, impressao, parametrosEfetivos, resumoDoDiario, revelacao])

  // Fixar a regra: revela a validação dela e a registra no diário, com o ajuste
  // que a escolheu e o resultado revelado — o registro do que se decidiu ANTES
  // de ver a prova. Não se desfaz.
  const revelar = useCallback(() => {
    if (!reservada) return
    setRevelacoes(registrarRevelacao(sigla, impressao))
    const { lista, cheio } = guardarNoDiario(sigla, {
      impressao,
      parametros: parametrosEfetivos,
      resumo: resumoDoDiario(true),
    })
    setDiario(lista)
    setDiarioCheio(cheio)
  }, [reservada, sigla, impressao, parametrosEfetivos, resumoDoDiario])

  const remover = useCallback((id) => {
    setDiario(removerDoDiario(sigla, id))
    setDiarioCheio(false)
  }, [sigla])

  // Dias que a série cobre, e quantos deles estão guardados. A cobertura é da
  // janela cheia: é ela que diz se a coleta tinha o período pedido.
  const diasJanela = resultado?.metricas.diasAnalisados ?? null
  const diasAjuste = exibido?.metricas.diasAnalisados ?? null
  const diasReservados =
    reservada && diasJanela !== null && diasAjuste !== null
      ? Math.max(0, Math.round(diasJanela - diasAjuste))
      : 0
  const impressoesReveladas = useMemo(
    () => new Set(revelacoes.map((r) => r.impressao)),
    [revelacoes]
  )

  return {
    resultado: exibido,
    ajuste: reservada ? null : holdout?.ajuste ?? null,
    validacao: reservada ? null : holdout?.validacao ?? null,
    comparativo,
    parametros: parametrosEfetivos,
    onParametro: alterarParametro,
    onRestaurar: restaurarParametros,
    sinaisDisponiveis,
    carregando,
    erro,
    // A série do gráfico de operações acompanha o que está na tela: o zoom em
    // torno de uma operação do ajuste não pode avançar sobre o trecho guardado.
    serie: reservada ? corte.serieDeSinaisAjuste : serieDeSinais,
    robustez,
    analises,
    disparo,
    reserva: {
      reservada,
      revelada: Boolean(revelacao),
      reveladaEm: revelacao?.em ?? null,
      // Quantas regras desta moeda já foram reveladas. Cada uma gasta um
      // pouco do trecho reservado, e o veredito avisa quando são várias.
      revelacoes: revelacoes.length,
      impressoesReveladas,
      diasJanela,
      diasReservados,
      onRevelar: revelar,
    },
    experimentos: {
      tentativas: Math.max(1, tentativas.length),
      limiar: limiarPorTentativas(tentativas.length),
      onZerar: zerar,
    },
    diario: {
      entradas: diario,
      cheio: diarioCheio,
      impressaoAtual: impressao,
      onGuardar: guardar,
      onRemover: remover,
    },
  }
}
