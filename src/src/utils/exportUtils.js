// exportUtils.js
// Utilitários para exportação de dados do Heatmap Geopolítico nos formatos CSV e JSON.

import { ExportFormat } from './enums'

/**
 * Converte os dados do chartData (formato Google Charts) para CSV.
 * @param {Array} chartData - Array no formato [['Country', 'Valor', tooltip], ...]
 * @param {string} simboloMoeda - Símbolo da moeda selecionada (ex: 'BTC')
 * @returns {string} String no formato CSV
 */
const paraCSV = (chartData, simboloMoeda) => {
  if (!chartData || chartData.length <= 1) return ''
  const linhas = [`País,Dominância ${simboloMoeda} (%)`]
  chartData.slice(1).forEach(([countryCell, val]) => {
    const pais = typeof countryCell === 'object' ? countryCell.v : countryCell
    linhas.push(`${pais},${val}`)
  })
  return linhas.join('\n')
}

/**
 * Converte os dados do chartData para JSON estruturado.
 * @param {Array} chartData - Array no formato Google Charts
 * @param {string} simboloMoeda - Símbolo da moeda selecionada
 * @returns {string} String JSON formatada
 */
const paraJSON = (chartData, simboloMoeda) => {
  if (!chartData || chartData.length <= 1) return '[]'
  const registros = chartData.slice(1).map(([countryCell, val]) => {
    const pais = typeof countryCell === 'object' ? countryCell.v : countryCell
    return { pais, simbolo: simboloMoeda, dominancia: val }
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
 */
export const exportarHeatmapDados = (
  chartData,
  simboloMoeda,
  intervalo,
  formato = ExportFormat.CSV
) => {
  const timestamp = new Date().toISOString().slice(0, 10)
  const nomeBase = `heatmap_${simboloMoeda}_${intervalo}_${timestamp}`

  if (formato === ExportFormat.JSON) {
    const conteudo = paraJSON(chartData, simboloMoeda)
    dispararDownload(conteudo, `${nomeBase}.json`, 'application/json')
  } else {
    const conteudo = paraCSV(chartData, simboloMoeda)
    dispararDownload(conteudo, `${nomeBase}.csv`, 'text/csv;charset=utf-8;')
  }
}
