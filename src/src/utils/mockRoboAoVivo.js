// Fixture do modo demo do robô ao vivo (/robo-ao-vivo). Só o mockApi a importa,
// e ele fica atrás de um import dinâmico: nada disto viaja no bundle de produção.
//
// Dados reais do banco, lidos em 25/10/2026 (login de leitura):
// - DECISOES_ROBO: TbHistoricoDecisao do BTC desde 22/10, como a rota
//   historicoDecisoes os devolve (ação e direção pelo nome do enum, data sem
//   fuso). As de 22/10 são do DQN; a de 24/10 é a primeira do motor de risco,
//   que fechou a posição que o DQN deixou.
// - PLACAR_ROBO: o placar das operações e das curvas do zoo reais de 22 a
//   27/10 (TbCurvaZooEstrategia, lidas em 25 e 28/10/2026), como a rota do
//   .NET o devolve.
// - SEQUENCIAS_ROBO: as linhas da vela das 23h de TbSequenciaRetorno do BTC
//   desde a ativação, lidas em 28/10/2026: a decisão de cada noite (o Tipo: 0
//   mantém, 1 compra, 2 vende). A API devolve todas as horas; a tela só lê a
//   das 23h, e o modo demo traz só ela.

const BTC = '4fbfec54-ec8a-4d0e-aaf8-095102896310'

const decisao = (idHistoricoDecisao, idPosicaoDecisao, idSequenciaRetorno, acao, quantidade, precoCompra, precoMercado, taxa, valorOperacao, saldoAnterior, saldoPosterior, dataHora, status) => ({
  idHistoricoDecisao,
  idPosicaoDecisao,
  idSequenciaRetorno,
  idMoeda: BTC,
  moedaSigla: 'BTC',
  acao,
  direcao: 'Alta',
  quantidade,
  precoCompra,
  precoMercado,
  taxa,
  valorOperacao,
  saldoAnterior,
  saldoPosterior,
  dataHora,
  status,
})

export const DECISOES_ROBO = [
  decisao('60d7c573-9786-43b4-b163-2068304e43ca', 'e80fe75d-8227-4f84-8e56-ff0592d70b32', '73051a14-ff90-47aa-a378-6713c5bec968', 'VenderTudo', 0.01222, 81351.37, 81189.43, 0.99213483, 992.1348346, 1000, 997.02895837, '2026-10-24T00:00:00', 'Fechado'),
  decisao('b3d242bd-cb45-4f56-a5b7-531a7871611d', 'e80fe75d-8227-4f84-8e56-ff0592d70b32', '45b2b438-25df-4796-9bf8-eb494f37656a', 'ComprarTudo', 0.01222251, 81351.37, 81351.37, 0.99431785, 994.31784954, 994.31784954, 993.32353169, '2026-10-22T23:00:00', 'Aberto'),
  decisao('0c937f13-180c-4da2-b3a0-71c31e61ef96', '01e39bbc-0855-4340-a43d-7498a99dd4bb', 'c59d7674-f46b-4e42-aaa5-97fafadc3ef8', 'VenderTudo', 0.01226, 81681.69, 81284.01, 0.99631535, 996.3153547, 1000.18861302, 994.31784954, '2026-10-22T17:00:00', 'Fechado'),
  decisao('2f857d99-a946-4dc7-af42-bd099d74fa1e', '01e39bbc-0855-4340-a43d-7498a99dd4bb', 'f37f82ba-7d5b-4659-906e-429c9fd56be1', 'ComprarTudo', 0.01225721, 81681.69, 81681.69, 1.0011898, 1001.18980283, 1001.18980283, 1000.18861302, '2026-10-22T16:00:00', 'Aberto'),
  decisao('ce1348aa-d94d-42fd-a013-ca23a57cfa8d', 'd854ee85-a945-4e09-8d50-bbc526482dbf', 'acf65cf6-a827-4e59-bad6-e19fa143ba5a', 'VenderTudo', 0.01212, 81861.24, 82041.45, 0.99434237, 994.342374, 1000, 1001.18980283, '2026-10-22T11:00:00', 'Fechado'),
  decisao('85cdc9f2-b280-46b1-b83e-b82da66a0b99', 'd854ee85-a945-4e09-8d50-bbc526482dbf', '8b661def-d010-4419-92ed-feb275f558c0', 'ComprarTudo', 0.01211966, 81861.24, 81861.24, 0.99213041, 992.13041311, 992.13041311, 991.1382827, '2026-10-22T09:00:00', 'Aberto'),
]

// O placar como GET api/RoboAoVivo/placar o devolve: as três curvas a partir de
// 1,0 no fechamento de 22/10, calculadas pela mesma conta do .NET
// (CalculoPlacarRobo) sobre as operações e as curvas do zoo reais de 22 a
// 27/10. A conferência diária ainda não rodou no cluster: a última é nula.
const ponto = (dia, robo, regra, buyHold) => ({ data: `${dia}T00:00:00`, robo, regra, buyHold })

export const PLACAR_ROBO = {
  moeda: 'BTC',
  estrategia: 'media_50d_vol_alvo_40',
  ativacao: '2026-10-23T11:49:00Z',
  inicioDaCurva: '2026-10-22T00:00:00',
  pontos: [
    ponto('2026-10-22', 1, 1, 1),
    ponto('2026-10-23', 0.9962410528401155, 0.9989999999999999, 0.9972160294113853),
    ponto('2026-10-24', 0.9962410528401155, 0.9989999999999999, 0.9935156551978854),
    ponto('2026-10-25', 0.9962410528401155, 0.9989999999999999, 0.9844993784398146),
    ponto('2026-10-26', 0.9962410528401155, 0.9989999999999999, 0.98445602091675),
    ponto('2026-10-27', 0.9962410528401155, 0.9989999999999999, 0.9937810818475808),
  ],
  retornoRobo: -0.0037589471598844515,
  retornoRegra: -0.001000000000000112,
  retornoBuyHold: -0.006218918152419151,
  doseRegra: 0,
  criterio: {
    data: '2026-10-27T00:00:00',
    distancia: -0.0027589471598843396,
    fidelidadeOk: true,
    quedaRobo: 0.0037589471598844515,
    quedaOk: true,
    quedaBuyHold: 0.015543979083250004,
    limiteRelativo: 0.012435183266600003,
    relativaOk: null,
    limiteFidelidade: 0.03,
    limiteQueda: 0.5,
    gatilhoQuedaBuyHold: 0.2,
    fracaoDaQuedaBuyHold: 0.8,
    situacao: 'dentro',
  },
  ultimaConferencia: null,
}
const vela = (idSequenciaRetorno, dataHora, tipo, precoFechamento) => ({
  idSequenciaRetorno,
  moeda: 'BTC',
  moedaPai: 'USDT',
  dataHora,
  tipo,
  precoFechamento,
})

export const SEQUENCIAS_ROBO = [
  vela('d958f6ca-51a5-4acc-af4e-1485bcbf3875', '2026-10-27T23:00:00', 0, 80909.77),
  vela('1ff56e19-57f4-4d3e-b1ea-b5895634ca71', '2026-10-26T23:00:00', 0, 80150.56),
  vela('f793bd72-f0e2-4dd4-be6d-5f14b4538f2f', '2026-10-25T23:00:00', 0, 80154.09),
  vela('7c9cee27-b5da-48c1-978c-14cb7d11550f', '2026-10-24T23:00:00', 0, 80888.16),
  vela('73051a14-ff90-47aa-a378-6713c5bec968', '2026-10-23T23:00:00', 2, 81189.43),
]
