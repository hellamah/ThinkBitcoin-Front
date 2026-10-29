import { useEffect, useRef, useState } from 'react'
import { montarSerieDeSinais } from '../utils/signalLab'
import { avaliarPeriodo, prepararCaminhada, resumirCaminhada } from '../utils/escolhaPeloPassado'

const VAZIO = Object.freeze({ resultado: null, calculando: false, feitos: 0, total: 0 })

const pausa = () => new Promise((resolver) => setTimeout(resolver, 0))

/**
 * A caminhada do "escolher pelo passado", um período por vez.
 *
 * Não vai para o worker: medida sobre dois anos reais, a caminhada inteira
 * leva ~100 ms (21 períodos de ~5 ms cada), e a série de sinais, ~200 ms uma
 * vez por série. Avaliando um período por vez e devolvendo a vez à tela entre
 * eles, a página continua respondendo — e a tela pode dizer em que período a
 * conta está.
 *
 * Uma regra nova (outra saída, outro custo) começa a conta de novo, e a
 * anterior para na próxima pausa.
 *
 * @param {object} params
 * @param {Array<object>|null} params.registros - A série longa.
 * @param {string|null} params.aPartirDe - Início do primeiro treino.
 * @param {string|null} params.ate - Onde a caminhada para.
 * @param {object|null} params.regra - Regra comum, memorizada por quem chama:
 *   um objeto novo a cada render refaria a conta a cada render.
 * @returns {{resultado: object|null, calculando: boolean, feitos: number, total: number}}
 */
export default function useEscolhaPeloPassado({ registros, aPartirDe, ate, regra }) {
  const [estado, setEstado] = useState(VAZIO)
  // A série de sinais depende só dos candles: sobrevive a qualquer troca de
  // regra.
  const serieRef = useRef({ registros: null, serie: null })

  useEffect(() => {
    if (!registros?.length || !regra) {
      setEstado(VAZIO)
      return undefined
    }

    let cancelado = false
    const calcular = async () => {
      setEstado((atual) => ({ ...atual, calculando: true, feitos: 0 }))
      // Deixa a tela pintar o "calculando" antes do trecho que bloqueia.
      await pausa()
      if (cancelado) return

      if (serieRef.current.registros !== registros) {
        serieRef.current = { registros, serie: montarSerieDeSinais(registros) }
      }
      const caminhada = prepararCaminhada(registros, regra, {
        aPartirDe,
        ate,
        serieDeSinais: serieRef.current.serie,
      })
      if (!caminhada) {
        setEstado(VAZIO)
        return
      }

      const total = caminhada.periodos.length
      const avaliados = []
      for (let k = 0; k < total; k++) {
        await pausa()
        if (cancelado) return
        avaliados.push(avaliarPeriodo(caminhada, caminhada.periodos[k]))
        setEstado((atual) => ({ ...atual, feitos: k + 1, total }))
      }

      setEstado({
        resultado: { ...resumirCaminhada(avaliados), diasTreino: caminhada.diasTreino, diasTeste: caminhada.diasTeste },
        calculando: false,
        feitos: total,
        total,
      })
    }
    calcular()

    return () => {
      cancelado = true
    }
  }, [registros, aPartirDe, ate, regra])

  return estado
}
