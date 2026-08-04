// exportUtils.js
// Utilitários para exportação de dados do Heatmap Geopolítico nos formatos CSV e JSON.

import { ExportFormat } from './enums'

// O Excel no Windows ignora o charset do MIME ao abrir um arquivo local: sem
// BOM ele lê o CSV como ANSI e o cabeçalho vira "PaÃ­s,DominÃ¢ncia". Três bytes
// resolvem, e nenhum outro leitor de CSV se incomoda com eles.
const BOM_UTF8 = '\uFEFF'

/**
 * Escapa uma célula para CSV conforme a RFC 4180: envolve em aspas quando o
 * conteúdo tem vírgula, aspas ou quebra de linha, e duplica as aspas internas.
 *
 * Necessário desde que a coluna passou a carregar o nome do país em vez do
 * código ISO: "Korea, Republic of" partiria a linha em duas colunas.
 * @param {*} valor - Conteúdo da célula
 * @returns {string} Célula pronta para concatenar
 */
const celulaCSV = (valor) => {
  const texto = valor === null || valor === undefined ? '' : String(valor)
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * Resolve o código ISO guardado na célula de país do chartData.
 * A célula vem como { v: 'BR', f: '' } (formato Google Charts) ou como string.
 */
const codigoDaCelula = (countryCell) =>
  typeof countryCell === 'object' && countryCell !== null ? countryCell.v : countryCell

/**
 * Converte os dados do chartData (formato Google Charts) para CSV.
 * @param {Array} chartData - Array no formato [[{v: 'BR'}, valor, tooltip], ...]
 * @param {string} simboloMoeda - Símbolo da moeda selecionada (ex: 'BTC')
 * @param {(codigo: string) => string} nomePais - Resolve o nome localizado
 * @returns {string} String no formato CSV
 */
const paraCSV = (chartData, simboloMoeda, nomePais) => {
  if (!chartData || chartData.length <= 1) return ''
  const linhas = [
    ['Código', 'País', `Dominância ${simboloMoeda} (%)`].map(celulaCSV).join(','),
  ]
  chartData.slice(1).forEach(([countryCell, val]) => {
    const codigo = codigoDaCelula(countryCell)
    linhas.push([codigo, nomePais(codigo), val].map(celulaCSV).join(','))
  })
  // CRLF é o que a RFC 4180 pede; todo leitor relevante aceita.
  return linhas.join('\r\n')
}

/**
 * Converte os dados do chartData para JSON estruturado.
 * @param {Array} chartData - Array no formato Google Charts
 * @param {string} simboloMoeda - Símbolo da moeda selecionada
 * @param {(codigo: string) => string} nomePais - Resolve o nome localizado
 * @returns {string} String JSON formatada
 */
const paraJSON = (chartData, simboloMoeda, nomePais) => {
  if (!chartData || chartData.length <= 1) return '[]'
  const registros = chartData.slice(1).map(([countryCell, val]) => {
    const codigo = codigoDaCelula(countryCell)
    return { codigo, pais: nomePais(codigo), simbolo: simboloMoeda, dominancia: val }
  })
  return JSON.stringify(registros, null, 2)
}

/**
 * Dispara o download de um arquivo no navegador.
 * @param {string} conteudo - Conteúdo do arquivo como string
 * @param {string} nomeArquivo - Nome do arquivo a ser baixado
 * @param {string} tipoMime - MIME type (ex: 'text/csv', 'application/json')
 */
const dispararDownload = (conteudo, nomeArquivo, tipoMime) => {
  const blob = new Blob([conteudo], { type: tipoMime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Exporta os dados do Heatmap no formato especificado e dispara o download.
 * @param {Array} chartData - Dados no formato Google Charts
 * @param {string} simboloMoeda - Símbolo da moeda selecionada
 * @param {string} intervalo - Intervalo do mapa (ex: '24h', '1h')
 * @param {string} [formato=ExportFormat.CSV] - Formato de saída ('csv' ou 'json')
 * @param {(codigo: string) => string} [nomePais] - Resolve o nome localizado do
 *   país. A resolução depende do idioma escolhido, que vive na tela; por isso
 *   entra por parâmetro em vez de este módulo importar o locale. O padrão
 *   devolve o próprio código, preservando o comportamento antigo.
 */
export const exportarHeatmapDados = (
  chartData,
  simboloMoeda,
  intervalo,
  formato = ExportFormat.CSV,
  nomePais = (codigo) => codigo
) => {
  const timestamp = new Date().toISOString().slice(0, 10)
  const nomeBase = `heatmap_${simboloMoeda}_${intervalo}_${timestamp}`

  if (formato === ExportFormat.JSON) {
    const conteudo = paraJSON(chartData, simboloMoeda, nomePais)
    dispararDownload(conteudo, `${nomeBase}.json`, 'application/json')
  } else {
    const conteudo = paraCSV(chartData, simboloMoeda, nomePais)
    dispararDownload(BOM_UTF8 + conteudo, `${nomeBase}.csv`, 'text/csv;charset=utf-8;')
  }
}

// Exportados para teste: o download depende de DOM e não roda no ambiente node
// da suíte, mas a montagem do conteúdo é pura e é onde os bugs moram.
export const __test__ = { paraCSV, paraJSON, celulaCSV, BOM_UTF8 }
