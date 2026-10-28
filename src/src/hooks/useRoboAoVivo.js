import { useCallback, useEffect, useState } from 'react'
import { apiRequest, HistoricoDecisaoEndpoint, SequenciaRetornoEndpoint, ZooEstrategiaEndpoint } from '../utils/apiClient'
import {
  ATIVACAO_MOTOR,
  ESTRATEGIAS_DA_CURVA,
  INICIO_DA_CURVA,
  MOEDA_MOTOR,
  operacoesDoMotor,
  sequenciasDaBusca,
} from '../utils/roboAoVivo'

// O robô ao vivo: as operações do motor desde a ativação, a curva de papel da
// mesma regra ao lado do buy & hold, desde o fechamento anterior, e as decisões
// de cada vela. As três buscas são independentes: a falha de uma não apaga as
// outras da tela.

// A API pagina de 10 em 10; 27 operações por ano (docs/motor-de-risco.md)
// cabem com folga em 200 por muito tempo.
const QUANTIDADE = 200

// Uma decisão por hora: 400 velas cobrem as 14 noites do diário com folga, e a
// busca não cresce com o tempo. Se vier cortada, o diário começa onde ela começa.
const QUANTIDADE_DE_VELAS = 400

export default function useRoboAoVivo() {
  // undefined = ainda não carregou.
  const [operacoes, setOperacoes] = useState(undefined)
  const [curvas, setCurvas] = useState(undefined)
  const [sequencias, setSequencias] = useState(undefined)
  const [erroOperacoes, setErroOperacoes] = useState(null)
  const [erroCurva, setErroCurva] = useState(null)
  const [erroSequencias, setErroSequencias] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelado = false
    const comoErro = (e) => (e instanceof Error ? e : new Error(String(e ?? '')))
    const buscar = async () => {
      setCarregando(true)
      const [ops, curva, velas] = await Promise.allSettled([
        apiRequest(HistoricoDecisaoEndpoint.LIST({ siglaMoeda: MOEDA_MOTOR, dataInicio: ATIVACAO_MOTOR, quantidade: QUANTIDADE })),
        apiRequest(ZooEstrategiaEndpoint.CURVA({ moeda: MOEDA_MOTOR, estrategias: ESTRATEGIAS_DA_CURVA, dataInicio: INICIO_DA_CURVA })),
        apiRequest(SequenciaRetornoEndpoint.LIST({ siglaMoeda: MOEDA_MOTOR, dataInicio: ATIVACAO_MOTOR, quantidade: QUANTIDADE_DE_VELAS })),
      ])
      if (cancelado) return
      if (ops.status === 'fulfilled') {
        setOperacoes(operacoesDoMotor(ops.value?.resultado?.registros))
        setErroOperacoes(null)
      } else {
        setErroOperacoes(comoErro(ops.reason))
      }
      if (curva.status === 'fulfilled') {
        setCurvas(Array.isArray(curva.value?.resultado) ? curva.value.resultado : [])
        setErroCurva(null)
      } else {
        setErroCurva(comoErro(curva.reason))
      }
      if (velas.status === 'fulfilled') {
        setSequencias(sequenciasDaBusca(velas.value?.resultado))
        setErroSequencias(null)
      } else {
        setErroSequencias(comoErro(velas.reason))
      }
      setCarregando(false)
    }
    buscar()
    return () => { cancelado = true }
  }, [recarga])

  const recarregar = useCallback(() => setRecarga((n) => n + 1), [])

  return { operacoes, curvas, sequencias, erroOperacoes, erroCurva, erroSequencias, carregando, recarregar }
}
