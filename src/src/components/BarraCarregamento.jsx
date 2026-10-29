import { useEffect, useState, useSyncExternalStore } from 'react'
import useTranslation from '../hooks/useTranslation'
import { haCarregamento, inscreverCarregamento } from '../utils/carregamentoGlobal'

// Barra fina no topo da tela enquanto houver requisição ou página a caminho.
// Algumas telas levam um ou dois segundos para trazer os dados, e nesse meio
// tempo nada na tela dizia que algo estava acontecendo.
//
// O progresso é estimado, não medido: nem o fetch nem o import dinâmico dizem
// quanto falta. A barra avança cada vez mais devagar rumo a um teto e só
// completa quando o trabalho termina de fato — assim ela nunca chega ao fim
// antes da hora, que é o que a faria parecer travada.

// Abaixo disto a espera não aparece. Quase toda troca de filtro volta antes, e
// uma barra piscando a cada clique viraria ruído que ensina a ignorá-la.
export const ATRASO_PARA_APARECER_MS = 200
// Uma requisição que termina enquanto a próxima da mesma cadeia ainda nem
// começou — `await` de uma para disparar a outra — não pode completar a barra
// no meio da carga.
export const TOLERANCIA_NO_FIM_MS = 150
// Encher até o fim e sumir; espelha as transições do App.css.
export const DURACAO_DA_SAIDA_MS = 550

const PROGRESSO_INICIAL = 0.08
const TETO = 0.9
const INTERVALO_DO_PASSO_MS = 400
// Fração do que falta até o teto a cada passo: ~50% em 2s, ~75% em 4s.
const FRACAO_DO_PASSO = 0.15

const Fase = Object.freeze({
  OCULTA: 'oculta',
  CORRENDO: 'correndo',
  SAINDO: 'saindo',
})

export default function BarraCarregamento() {
  const { t } = useTranslation()
  const ativo = useSyncExternalStore(inscreverCarregamento, haCarregamento, () => false)
  const [fase, setFase] = useState(Fase.OCULTA)
  const [progresso, setProgresso] = useState(0)

  useEffect(() => {
    if (fase === Fase.SAINDO) {
      // Uma carga nova durante a saída espera a barra sumir e recomeça do
      // zero: voltar de 100% para o início, à vista, pareceria um erro.
      const timer = setTimeout(() => {
        setFase(Fase.OCULTA)
        setProgresso(0)
      }, DURACAO_DA_SAIDA_MS)
      return () => clearTimeout(timer)
    }

    if (fase === Fase.OCULTA) {
      if (!ativo) return undefined
      const timer = setTimeout(() => {
        setProgresso(PROGRESSO_INICIAL)
        setFase(Fase.CORRENDO)
      }, ATRASO_PARA_APARECER_MS)
      return () => clearTimeout(timer)
    }

    if (ativo) {
      const timer = setInterval(() => {
        setProgresso((atual) => atual + (TETO - atual) * FRACAO_DO_PASSO)
      }, INTERVALO_DO_PASSO_MS)
      return () => clearInterval(timer)
    }

    const timer = setTimeout(() => {
      setProgresso(1)
      setFase(Fase.SAINDO)
    }, TOLERANCIA_NO_FIM_MS)
    return () => clearTimeout(timer)
  }, [ativo, fase])

  const visivel = fase !== Fase.OCULTA

  // Sem `aria-valuenow`: o número é uma estimativa, e anunciá-lo como
  // porcentagem real seria dizer ao leitor de tela algo que não sabemos.
  return (
    <div
      className="barra-carregamento"
      data-fase={fase}
      role={visivel ? 'progressbar' : undefined}
      aria-label={visivel ? t('carregando') : undefined}
      aria-hidden={visivel ? undefined : true}
    >
      <div
        className="barra-carregamento-preenchimento"
        style={{ transform: `scaleX(${progresso})` }}
      />
    </div>
  )
}
