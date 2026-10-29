// Corte da janela em ajuste e validação, e a leitura do instante de um candle.
//
// Nasceu dentro do backtest.js, onde a simulação é a única consumidora. Mudou de
// casa quando o laboratório de sinais passou a precisar do MESMO corte: o
// backtest importa `montarSerieDeSinais` do signalLab, então o signalLab
// importar `dividirParaValidacao` do backtest fecharia um ciclo entre os dois
// módulos. Um terceiro arquivo, que não depende de nenhum deles, desfaz o nó.
//
// O backtest reexporta as duas peças para quem já as importava de lá continuar
// funcionando — a mudança é de organização, não de contrato.
//
// Que os dois usem exatamente esta função, e não cada um a sua, é o que faz
// "fora da amostra" significar a mesma coisa nas duas telas: mesmo trecho,
// mesma fração, mesmo tratamento do aquecimento.

// Quanto da janela fica reservado para validação. Mesma fração da avaliação
// out-of-sample do backend, para que as duas telas signifiquem o mesmo por
// "fora da amostra".
export const FRACAO_VALIDACAO_PADRAO = 0.2

/**
 * Instante do candle, em ms, tolerando as quatro grafias que a API usa.
 *
 * Fica aqui, junto do corte, porque o corte é definido em termos dele: o que
 * separa ajuste de validação é uma data. Estava escrito três vezes — uma no
 * backtest, uma dentro do `dentroDaJanela` do signalLab e uma no dashboard —
 * e as três precisavam concordar sobre qual campo ler primeiro.
 *
 * @param {object} registro
 * @returns {number|null} null quando o carimbo falta ou não é data válida.
 */
export const instanteDe = (registro) => {
  const bruto =
    registro?.horaReferencia ??
    registro?.HoraReferencia ??
    registro?.dataHora ??
    registro?.DataHora
  if (!bruto) return null
  const t = new Date(bruto).getTime()
  return Number.isFinite(t) ? t : null
}

/**
 * Separa a janela em uma parte para ajustar e outra para validar.
 *
 * O problema que isto resolve: quem testa quinze combinações de sinal, stop e
 * horizonte na mesma janela e fica com a melhor não descobriu uma estratégia —
 * descobriu qual combinação se encaixou naquele pedaço de passado. A melhor
 * parece boa PORQUE foi escolhida depois de ver o resultado. Sem separar, a
 * ferramenta ajuda o usuário a se enganar com aparência de rigor.
 *
 * A parte de validação é a MAIS RECENTE. Reservar o passado e validar no que
 * veio antes inverteria a seta do tempo: o ajuste enxergaria o futuro da
 * validação.
 *
 * As duas séries devolvidas são usadas de formas diferentes, de propósito:
 *
 * - `registrosAjuste` é a série **cortada**: a validação não existe ali, nem
 *   como aquecimento. É o que o usuário manipula.
 * - `registrosValidacao` é a série **inteira**, acompanhada de
 *   `aPartirDeValidacao`. Assim os indicadores de janela móvel chegam aquecidos
 *   ao corte — desperdiçar os primeiros 20 candles da validação com RSI frio
 *   seria trocar um viés por outro.
 *
 * A fração é medida sobre a JANELA ESCOLHIDA, não sobre o array inteiro. Os
 * candles de aquecimento que vêm antes de `aPartirDe` não são período de
 * análise — são combustível de indicador. Contá-los inflaria a validação: numa
 * janela de 7 dias com 3 de aquecimento, 20% do array são 28% do que o usuário
 * de fato escolheu.
 *
 * @param {Array<object>} registros - Série na ordem da API (mais recente primeiro).
 * @param {number} [fracao] - Fração reservada para validação, em (0, 1).
 * @param {{aPartirDe?: string|number|null}} [opcoes] - Início da janela. Sem
 *   ele, a série inteira conta como janela.
 * @returns {{
 *   registrosAjuste: Array<object>,
 *   registrosValidacao: Array<object>,
 *   aPartirDeValidacao: string,
 *   candlesAjuste: number,
 *   candlesValidacao: number
 * }|null} - null quando algum dos lados ficaria curto demais para simular.
 */
export const dividirParaValidacao = (
  registros,
  fracao = FRACAO_VALIDACAO_PADRAO,
  { aPartirDe = null } = {}
) => {
  if (!Array.isArray(registros)) return null
  if (!(fracao > 0) || !(fracao < 1)) return null

  const total = registros.length

  const limite = aPartirDe !== null ? new Date(aPartirDe).getTime() : null
  const naJanela =
    limite !== null && Number.isFinite(limite)
      ? registros.filter((r) => {
          const t = instanteDe(r)
          return t !== null && t >= limite
        }).length
      : total

  const tamanhoValidacao = Math.floor(naJanela * fracao)

  // Dois candles é o mínimo do motor: um para o sinal, outro para a entrada.
  // Abaixo disso, de qualquer lado, o corte não produz duas simulações — só
  // uma simulação e um erro.
  if (tamanhoValidacao < 2 || total - tamanhoValidacao < 2) return null

  // A série chega do mais recente para o mais antigo, então a validação é o
  // COMEÇO do array. O candle mais antigo dela é o último desse trecho.
  const validacao = registros.slice(0, tamanhoValidacao)
  const maisAntigoDaValidacao = validacao[validacao.length - 1]

  const aPartirDeValidacao =
    maisAntigoDaValidacao?.horaReferencia ??
    maisAntigoDaValidacao?.HoraReferencia ??
    maisAntigoDaValidacao?.dataHora ??
    maisAntigoDaValidacao?.DataHora ??
    null

  if (!aPartirDeValidacao) return null

  return {
    registrosAjuste: registros.slice(tamanhoValidacao),
    registrosValidacao: registros,
    aPartirDeValidacao,
    candlesAjuste: total - tamanhoValidacao,
    candlesValidacao: tamanhoValidacao,
  }
}
