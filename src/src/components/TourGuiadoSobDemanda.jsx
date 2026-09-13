import { lazy, Suspense } from 'react'

// O tour roda uma vez por usuário, então a react-joyride só é baixada quando
// ele de fato começa. Ver o comentário em TourGuiado.
//
// O catch não é enfeite: chunk sob demanda pode não chegar (rede oscilando, ou
// um deploy que trocou os hashes com a aba aberta), e um `lazy` que rejeita
// lança no render. Sem ele, o erro subiria até o ErrorBoundary da rota e
// derrubaria o Dashboard inteiro por causa de um balão de boas-vindas. Assim o
// tour só não aparece — e, como não chega a ser concluído, volta a ser
// oferecido na próxima visita.
const TourGuiado = lazy(() =>
  import('./TourGuiado').catch((err) => {
    console.error('Erro ao carregar o tour guiado:', err)
    return { default: () => null }
  })
)

export default function TourGuiadoSobDemanda(props) {
  // Suspense próprio, com fallback nulo: sem ele a espera pelo chunk subiria
  // até o Suspense do App, que trocaria a página inteira pelo spinner.
  return (
    <Suspense fallback={null}>
      <TourGuiado {...props} />
    </Suspense>
  )
}
