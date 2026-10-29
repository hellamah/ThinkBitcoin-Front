// Registro do Chart.js para os gráficos da simulação.
//
// Os gráficos daqui funcionavam por carona: quem registrava escalas e elementos
// era o import do Dashboard.jsx, e o painel só era desenhado dentro dele. Com a
// simulação em tela própria, abrir /simulacao direto — link compartilhado,
// recarga da página — desenharia os gráficos sem escala nenhuma registrada.
//
// Registrar de novo o que o dashboard já registrou é inofensivo: o Chart.js
// guarda cada componente uma vez só. É o mesmo molde do registro da tela de
// treinamento (components/treinamento/graficos.js).
//
// O que cada gráfico usa: linha com eixo de categoria (curva de capital,
// operações no preço, distância do pico), dispersão em eixo linear (excursão),
// preenchimento até a origem (distância do pico), tooltip e legenda. Os
// controladores `line` e `scatter` quem registra é o próprio react-chartjs-2.
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)
