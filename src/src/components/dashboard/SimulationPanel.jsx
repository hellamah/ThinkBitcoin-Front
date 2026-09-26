import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { comportamentoDeRolagem } from '../../utils/movimento'
import { useTheme } from '@mui/material/styles'
import { MdPlayCircleOutline, MdWarningAmber } from 'react-icons/md'

import RotuloComAjuda from './RotuloComAjuda'
// Antes dos gráficos: a tela da simulação não passa pelo Dashboard.jsx, que era
// quem registrava o Chart.js. Ver o arquivo.
import './simulacao/registroGraficos'
import { chartPalette } from '../../utils/themeTokens'
import { DIAS_JANELA_SIMULACAO } from '../../utils/simulationWindow'
import { StopMode } from '../../utils/enums'

import ControlesSimulacao from './simulacao/ControlesSimulacao'
import VereditoSimulacao from './simulacao/VereditoSimulacao'
import CurvaCapital from './simulacao/CurvaCapital'
import CartoesEssenciais from './simulacao/CartoesEssenciais'
import ConfiancaSimulacao from './simulacao/ConfiancaSimulacao'
import OperacoesNoPreco from './simulacao/OperacoesNoPreco'
import TabelaOperacoes from './simulacao/TabelaOperacoes'
import ExcursaoOperacoes from './simulacao/ExcursaoOperacoes'
import ConsistenciaMensal from './simulacao/ConsistenciaMensal'
import MapaSensibilidade from './simulacao/MapaSensibilidade'
import RankingEstrategias from './simulacao/RankingEstrategias'
import EscolhaPeloPassado from './simulacao/EscolhaPeloPassado'
import DiarioExperimentos from './simulacao/DiarioExperimentos'
import { montarRessalvas, montarVeredito } from './simulacao/veredito'

// As análises de terceiro nível. Começam todas fechadas: cada uma responde uma
// pergunta que só existe para quem já leu a resposta principal.
const Aba = Object.freeze({
  OPERACOES: 'operacoes',
  EXCURSAO: 'excursao',
  MENSAL: 'mensal',
  SENSIBILIDADE: 'sensibilidade',
  RANKING: 'ranking',
  PASSADO: 'passado',
  DIARIO: 'diario',
})

// Sem o hook da tela — nos testes, e em qualquer uso que não passe `reserva` —
// o painel se comporta como antes: nada guardado, validação à vista.
const SEM_RESERVA = Object.freeze({
  reservada: false,
  revelada: false,
  reveladaEm: null,
  revelacoes: 0,
  impressoesReveladas: null,
  diasJanela: null,
  diasReservados: 0,
  onRevelar: () => {},
})

// "Escolher pelo passado" vem logo depois do ranking: é a pergunta que ele
// levanta.
const ABAS = [
  [Aba.OPERACOES, 'simulationTabTrades'],
  [Aba.EXCURSAO, 'simulationTabExcursion'],
  [Aba.MENSAL, 'simulationTabMonthly'],
  [Aba.SENSIBILIDADE, 'simulationTabSensitivity'],
  [Aba.RANKING, 'simulationTabRanking'],
  [Aba.PASSADO, 'simulationTabPast'],
  [Aba.DIARIO, 'simulationTabJournal'],
]

/**
 * Simulação de estratégia sobre a série carregada.
 *
 * O painel responde "e se eu tivesse operado este sinal?" em três níveis, e
 * nenhum cálculo ficou de fora — só a ordem em que eles aparecem:
 *
 * 1. Sempre à vista: os cinco controles que definem a regra, o retorno em
 *    destaque já comparado ao buy & hold e ao custo, o veredito em uma frase,
 *    a curva de capital e três cards (acaso, fora da amostra, operações).
 * 2. "Dá para confiar?": robustez, risco, custo, distância do pico e a
 *    validação completa.
 * 3. "Aprofundar": operações no preço, excursão, meses, sensibilidade,
 *    comparação de sinais e diário.
 *
 * Eram todos visíveis ao mesmo tempo — uns quarenta números antes da primeira
 * aba, e a resposta para "funcionou?" repetida em quatro lugares. O que não
 * mudou é o que não bajula: o buy & hold continua ao lado do retorno, o custo
 * continua na primeira linha, e a amostra curta esmaece os números e vira o
 * título do veredito.
 *
 * Os cálculos moram no `useStrategySimulation`; este componente só desenha.
 *
 * Mora numa tela própria (`pages/Simulacao.jsx`), onde o título é o da página
 * — `nivelTitulo` — e o seletor de moeda entra logo abaixo dele, em todos os
 * estados: trocar de moeda enquanto a série carrega é justamente quando se quer.
 */
export default function SimulationPanel({
  resultado,
  validacao,
  ajuste,
  comparativo,
  parametros,
  onParametro,
  onRestaurar,
  sinaisDisponiveis,
  carregando,
  erro,
  serie,
  robustez,
  analises,
  disparo,
  experimentos,
  diario,
  reserva = SEM_RESERVA,
  escolhaPeloPassado = null,
  t,
  locale,
  seletor = null,
  nivelTitulo: Titulo = 'h2',
}) {
  const theme = useTheme()
  // `theme.palette.mode` nao aparece dentro do callback, e por isso a regra o
  // chama de desnecessario — mas ele e justamente o gatilho. `chartPalette()`
  // le as CSS custom properties no momento da chamada, e o canvas nao resolve
  // `var()`: sem recalcular na troca de tema, as cores ficam as do tema antigo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cores = useMemo(() => chartPalette(), [theme.palette.mode])

  const [aba, setAba] = useState(null)
  const [foco, setFoco] = useState(null)
  const graficoRef = useRef(null)

  // Operação focada é um índice na lista de operações: com outro resultado,
  // o mesmo índice apontaria para outra operação.
  useEffect(() => setFoco(null), [resultado])

  const focar = useCallback((indice) => {
    setFoco(indice)
    if (indice === null) return
    setAba(Aba.OPERACOES)
    // Quem clicou num ponto do gráfico de excursão ou numa linha lá embaixo
    // precisa ver o gráfico de preço, que pode estar fora da tela.
    graficoRef.current?.scrollIntoView?.({
      behavior: comportamentoDeRolagem(),
      block: 'center',
    })
  }, [])

  const focarEntrada = useCallback(
    (indiceEntrada) => {
      const idx = resultado?.trades.findIndex((op) => op.indiceEntrada === indiceEntrada) ?? -1
      if (idx >= 0) focar(idx)
    },
    [resultado, focar]
  )

  // O cabeçalho aparece mesmo sem resultado: o painel sumir inteiro enquanto a
  // série de 180 dias carrega daria a impressão de que a ferramenta não existe.
  const titulo = (
    <Titulo className="simulation-titulo">
      <MdPlayCircleOutline style={{ verticalAlign: 'middle', marginRight: '10px' }} />
      {t('simulation')}
    </Titulo>
  )
  const cabecalho = (
    <>
      {titulo}
      {seletor}
    </>
  )

  if (carregando) {
    return (
      <section className="panel simulation-panel">
        {cabecalho}
        <p className="simulation-vazio">{t('simulationLoading')}</p>
      </section>
    )
  }

  if (erro) {
    return (
      <section className="panel simulation-panel">
        {cabecalho}
        <div className="simulation-aviso">
          <MdWarningAmber />
          <span>{t('simulationLoadError')}</span>
        </div>
      </section>
    )
  }

  // Sem nenhum sinal na janela não há o que escolher, e os controles seriam
  // botões que não mudam nada.
  if (!sinaisDisponiveis?.length) {
    return (
      <section className="panel simulation-panel">
        {cabecalho}
        <p className="simulation-vazio">{t('simulationNoTrades')}</p>
      </section>
    )
  }

  // Sem nenhuma regra de saída a posição nunca fecharia, e o motor recusa.
  // Dizer isso é diferente de dizer "nenhuma operação": a regra não é ruim, ela
  // não está completa. E os controles continuam na tela para completá-la.
  const semRegraDeSaida =
    parametros.saidaPorTempo === null &&
    parametros.modoStop === StopMode.PERCENTUAL &&
    !(parametros.stopPercentual > 0) &&
    !(parametros.alvoPercentual > 0) &&
    !parametros.sinalSaida

  const metricas = resultado?.metricas ?? null
  const trades = resultado?.trades ?? []

  // Dias inteiros, para a linha não anunciar "119,96 dias". `dias` é MEDIDO na
  // curva, não a constante da janela pedida: pedir e receber são coisas
  // diferentes, e é sobre o que chegou que as operações se apoiam.
  const diasAnalisados =
    metricas?.diasAnalisados !== null && metricas?.diasAnalisados !== undefined
      ? Math.round(metricas.diasAnalisados)
      : null

  const temOperacoes = Boolean(resultado) && trades.length > 0
  const veredito = temOperacoes
    ? montarVeredito({
        metricas,
        acaso: robustez.acaso,
        calculando: robustez.calculando,
        limiar: experimentos.limiar,
        bootstrap: analises?.bootstrap ?? null,
        validacao,
        reservada: reserva.reservada,
      })
    : null
  const ressalvas = temOperacoes
    ? montarRessalvas({
        metricas,
        descontinuidades: resultado.descontinuidades.length,
        validacao,
        diasJanela: reserva.diasJanela,
        revelacoes: reserva.revelada ? reserva.revelacoes : 0,
      })
    : []

  return (
    <section className="panel simulation-panel">
      <div className="simulation-cabecalho">
        {titulo}
        {/* Quantos dias e candles a simulação analisou de fato. Sem isto, a
            diferença entre "a estratégia não funciona" e "a janela não tinha
            dado" fica invisível. É `candlesSimulados`, não o tamanho da série
            recebida: esta vem com os 3 dias de margem de aquecimento. */}
        {/* Com a validação guardada, os números são do ajuste, e a linha diz
            isso — e quantos dias ficaram de fora, esperando a regra ser
            fixada. */}
        {metricas && (
          <RotuloComAjuda
            className="simulation-meta"
            texto={
              reserva.reservada
                ? t('simulationWindowReserved', {
                    dias: diasAnalisados ?? '—',
                    candles: metricas.candlesSimulados,
                    reservados: reserva.diasReservados,
                  })
                : t('simulationWindow', {
                    dias: diasAnalisados ?? DIAS_JANELA_SIMULACAO,
                    candles: metricas.candlesSimulados,
                  })
            }
            ajuda={t('ajuda.simJanela')}
          />
        )}
      </div>

      {seletor}

      <p className="correlation-hint">{t('simulationHint')}</p>

      <ControlesSimulacao
        parametros={parametros}
        onParametro={onParametro}
        sinaisDisponiveis={sinaisDisponiveis}
        t={t}
      />

      {semRegraDeSaida ? (
        <div className="simulation-aviso">
          <MdWarningAmber />
          <span>{t('simulationNoExitRule')}</span>
        </div>
      ) : !temOperacoes ? (
        <p className="simulation-vazio">{t('simulationNoTrades')}</p>
      ) : (
        <>
          <VereditoSimulacao
            metricas={metricas}
            veredito={veredito}
            ressalvas={ressalvas}
            fraco={metricas.amostraInsuficiente}
            desatualizado={robustez.calculando && Boolean(robustez.acaso)}
            t={t}
          />

          <CurvaCapital resultado={resultado} cores={cores} t={t} locale={locale} />

          <CartoesEssenciais
            metricas={metricas}
            robustez={robustez}
            validacao={validacao}
            disparo={disparo}
            fraco={metricas.amostraInsuficiente}
            reserva={reserva}
            t={t}
            locale={locale}
          />

          <ConfiancaSimulacao
            resultado={resultado}
            analises={analises}
            ajuste={ajuste}
            validacao={validacao}
            experimentos={experimentos}
            reservada={reserva.reservada}
            cores={cores}
            t={t}
            locale={locale}
          />

          <div className="simulation-aprofundar">
            <span className="intel-label">{t('simulationDeepen')}</span>
            {/* Botões que abrem e fecham, e não abas: nenhuma vem aberta, e
                clicar na aberta a fecha. O papel de tab exigiria sempre uma
                selecionada. */}
            <div className="simulation-abas" role="group" aria-label={t('simulationDeepen')}>
              {/* Sem o descritor (quem usa o painel sem a tela), a aba que busca
                  a própria série não tem o que buscar. */}
              {ABAS.filter(([valor]) => valor !== Aba.PASSADO || escolhaPeloPassado).map(([valor, chave]) => (
                <button
                  key={valor}
                  type="button"
                  aria-expanded={aba === valor}
                  aria-controls="simulacao-aba-painel"
                  className={`pill-toggle ${aba === valor ? 'ativo' : ''}`}
                  onClick={() => setAba((atual) => (atual === valor ? null : valor))}
                >
                  {t(chave)}
                </button>
              ))}
            </div>

            {aba && (
              <div id="simulacao-aba-painel" className="simulation-aba-painel">
                {aba === Aba.OPERACOES && (
                  <>
                    <div ref={graficoRef}>
                      <OperacoesNoPreco
                        resultado={resultado}
                        serie={serie}
                        foco={foco}
                        onFocar={focar}
                        cores={cores}
                        t={t}
                        locale={locale}
                      />
                    </div>
                    <TabelaOperacoes resultado={resultado} foco={foco} onFocar={focar} t={t} locale={locale} />
                  </>
                )}
                {aba === Aba.EXCURSAO && (
                  <ExcursaoOperacoes
                    excursoes={analises?.excursoes ?? null}
                    onFocarEntrada={focarEntrada}
                    cores={cores}
                    t={t}
                  />
                )}
                {aba === Aba.MENSAL && (
                  <ConsistenciaMensal porMes={analises?.porMes ?? null} t={t} locale={locale} />
                )}
                {aba === Aba.SENSIBILIDADE && (
                  <MapaSensibilidade
                    mapa={robustez.mapa}
                    calculando={robustez.calculando}
                    parametros={parametros}
                    onParametro={onParametro}
                    t={t}
                  />
                )}
                {aba === Aba.RANKING && (
                  <RankingEstrategias
                    comparativo={comparativo}
                    sorte={robustez.sorte}
                    calculando={robustez.calculando}
                    parametros={parametros}
                    onParametro={onParametro}
                    impressoesReveladas={reserva.impressoesReveladas}
                    t={t}
                  />
                )}
                {aba === Aba.PASSADO && escolhaPeloPassado && (
                  <EscolhaPeloPassado descritor={escolhaPeloPassado} parametros={parametros} t={t} locale={locale} />
                )}
                {aba === Aba.DIARIO && (
                  <DiarioExperimentos
                    diario={diario}
                    podeGuardar={Boolean(resultado)}
                    onRestaurar={onRestaurar}
                    t={t}
                    locale={locale}
                  />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
