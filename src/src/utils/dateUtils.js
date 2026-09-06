/**
 * Utilitários para conversão de datas (UTC <=> Local)
 * Assegura que todas as datas do backend (UTC) sejam exibidas no fuso do usuário
 * e as seleções de data do usuário sejam enviadas como UTC ISO.
 *
 * ---------------------------------------------------------------------------
 * Sobre o parâmetro `locale`
 * ---------------------------------------------------------------------------
 * O fuso e o IDIOMA da data são coisas diferentes, e o produto tratava as duas
 * como uma só. O fuso vem do sistema, e está certo assim: quem está em São
 * Paulo quer ver o candle no horário de São Paulo, tenha escolhido a interface
 * em que língua for. Já o FORMATO é escolha do usuário — é a mesma preferência
 * que decide o texto da tela.
 *
 * Antes daqui havia três respostas simultâneas para "em que idioma estou":
 * o texto seguia a preferência, a tabela seguia o navegador (`toLocaleString()`
 * sem argumento) e o eixo dos gráficos seguia os Estados Unidos ('en-US'
 * cravado). Num navegador pt-BR, o MESMO candle aparecia como `04/01, 06:00 PM`
 * no gráfico e `01/04/2026, 18:00:00` na tabela logo abaixo — dígitos
 * invertidos, na mesma tela. Não são dois formatos: são duas datas possíveis, e
 * quem lê não tem como saber qual é.
 *
 * O locale entra por parâmetro, e não lido de um estado global, porque estas
 * funções são puras e porque a maioria das chamadas vive dentro de `useMemo`:
 * como argumento ele entra naturalmente na lista de dependências, e a tela
 * reformata sozinha ao trocar de idioma. Ambiente, ele seria esquecido
 * exatamente ali.
 *
 * Quem chama pega o valor de `useTranslation().idioma.intl` — o campo BCP 47
 * que o registro de idiomas já declarava e que quase ninguém usava. Omitir o
 * parâmetro cai no padrão do navegador, que é o comportamento antigo: é rede
 * de segurança para chamada esquecida, não o caminho esperado.
 */

/**
 * Marca de fuso NO FIM da string: `Z` ou deslocamento `±hh:mm` / `±hhmm`.
 *
 * A verificação anterior era `endsWith('Z') || includes('+') || includes('-')`,
 * e o `includes('-')` é sempre verdadeiro numa data ISO por causa dos hífens de
 * `2026-04-01`. O ramo que anexava o `Z` nunca executou uma única vez: toda
 * data sem fuso saía daqui interpretada como hora local.
 */
const TEM_FUSO = /(Z|[+-]\d{2}:?\d{2})$/i

// A guarda de tipo não é enfeite: `TEM_FUSO.test` converte o argumento em
// texto, então um timestamp numérico (1775073600000) não casa e sairia daqui
// como "1775073600000Z", que `new Date` lê como data inválida. Número e Date
// já carregam o instante sem ambiguidade e passam intactos.
const comoUtc = (valor) =>
  typeof valor === 'string' && !TEM_FUSO.test(valor) ? `${valor}Z` : valor

/**
 * Converte uma string UTC (com ou sem Z) para data e hora completas, no fuso do
 * usuário e no formato do idioma escolhido.
 *
 * @param {string} utcString - Data em formato ISO (ex: 2026-04-01T00:00:00)
 * @param {string} [locale] - Etiqueta BCP 47 (`idioma.intl`). Omitido, usa o
 *   padrão do navegador.
 * @returns {string} - Ex.: `01/04/2026, 18:00:00` em pt-BR; `4/1/2026, 6:00:00 PM` em en-US.
 */
export const toLocal = (utcString, locale) => {
  if (!utcString) return '-'
  try {
    return new Date(comoUtc(utcString)).toLocaleString(locale)
  } catch (err) {
    console.error('Erro ao converter data para local:', err)
    return utcString
  }
}

/**
 * Versão curta, para rótulo de eixo e célula estreita: dia, mês e hora, sem ano
 * e sem segundos.
 *
 * O conjunto de campos é o mesmo em todo idioma; a ORDEM e o relógio (12h ou
 * 24h) ficam por conta do locale, que é justamente o que faz `04/01` virar
 * `01/04` onde precisa. Cravar 'en-US' aqui era o que punha o eixo do gráfico
 * em desacordo com a tabela logo abaixo dele.
 *
 * @param {string} utcString
 * @param {string} [locale] - Etiqueta BCP 47 (`idioma.intl`).
 * @returns {string} - Ex.: `01/04, 18:00` em pt-BR; `04/01, 06:00 PM` em en-US.
 */
export const toLocalChartLabel = (utcString, locale) => {
  if (!utcString) return ''
  try {
    const d = new Date(comoUtc(utcString))
    return d.toLocaleString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    })
  } catch {
    return utcString
  }
}

/**
 * Só a hora do relógio, sem data. Para quando a data já está no contexto — o
 * "expira às 14:30" de uma cobrança gerada agora, por exemplo.
 *
 * @param {string|number|Date} valor
 * @param {string} [locale] - Etiqueta BCP 47 (`idioma.intl`).
 * @returns {string} - Ex.: `14:30` em pt-BR; `02:30 PM` em en-US.
 */
export const toLocalTime = (valor, locale) => {
  if (!valor) return ''
  try {
    const d = new Date(typeof valor === 'string' ? comoUtc(valor) : valor)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/**
 * Garante que uma data/string local seja convertida para UTC ISO string antes do envio à API.
 * @param {Date|string} localInput 
 * @returns {string|null}
 */
export const toUTCISO = (localInput) => {
  if (!localInput) return null
  try {
    const d = new Date(localInput)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  } catch {
    return null
  }
}

/**
 * Ordem de dia e mês numa data curta, no formato de padrão do `date-fns`.
 *
 * Serve para o eixo de tempo do Chart.js, que recebe padrões do date-fns em vez
 * de opções de `Intl`. O date-fns tem o token `P` para "data curta localizada",
 * mas ele traz o ano junto — informação que num eixo de horas só ocupa espaço.
 * Sem ano não há token localizado, então a ordem é perguntada ao `Intl` e o
 * padrão, montado a partir da resposta.
 *
 * A ordem é o ponto: `dd/MM` cravado faz `01/04` significar 1º de abril para um
 * leitor e 4 de janeiro para outro, sem nada na tela desfazendo o empate.
 *
 * @param {string} [locale] - Etiqueta BCP 47.
 * @returns {string} - `'dd/MM'` ou `'MM/dd'`.
 */
export const padraoDeDataCurta = (locale) => {
  try {
    const partes = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
    }).formatToParts(new Date(Date.UTC(2026, 3, 1)))
    const mesPrimeiro =
      partes.findIndex((p) => p.type === 'month') <
      partes.findIndex((p) => p.type === 'day')
    return mesPrimeiro ? 'MM/dd' : 'dd/MM'
  } catch {
    return 'dd/MM'
  }
}
