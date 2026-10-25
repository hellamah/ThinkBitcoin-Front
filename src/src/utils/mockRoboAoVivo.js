// Fixture do modo demo do robô ao vivo (/robo-ao-vivo). Só o mockApi a importa,
// e ele fica atrás de um import dinâmico: nada disto viaja no bundle de produção.
//
// Dados reais do banco, lidos em 25/10/2026 (login de leitura):
// - DECISOES_ROBO: TbHistoricoDecisao do BTC desde 22/10, como a rota
//   historicoDecisoes os devolve (ação e direção pelo nome do enum, data sem
//   fuso). As de 22/10 são do DQN; a de 24/10 é a primeira do motor de risco,
//   que fechou a posição que o DQN deixou.
// - CURVAS_ZOO_RECENTES: TbCurvaZooEstrategia (janela historico) depois do fim da
//   fixture do zoo (mockZooEstrategia.js termina em 05/10), na mesma escala.
//   Pontos: [dia 'AAAA-MM-DD', patrimônio, exposição].

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

export const CURVAS_ZOO_RECENTES = {
  'media_50d_vol_alvo_40|BTC': [
    ['2026-10-07', 16.601792036444031, 1], ['2026-10-08', 16.289497035096353, 1], ['2026-10-09', 16.465055378863863, 1],
    ['2026-10-10', 16.535352438521805, 1], ['2026-10-11', 16.691715128176767, 1], ['2026-10-12', 16.308535282454187, 1],
    ['2026-10-14', 16.275063433436475, 1], ['2026-10-15', 16.387423961432585, 1], ['2026-10-16', 16.261839273550141, 1],
    ['2026-10-17', 16.237012841098167, 1], ['2026-10-18', 16.361535531508952, 1], ['2026-10-19', 16.326148899057348, 1],
    ['2026-10-20', 16.543280558483794, 1], ['2026-10-21', 16.755534601004747, 1], ['2026-10-22', 16.222079124306237, 1],
    ['2026-10-23', 16.205857045181929, 0], ['2026-10-24', 16.205857045181929, 0],
  ],
  'buy_hold|BTC': [
    ['2026-10-07', 7.2287006678245698, 1], ['2026-10-08', 7.0927221493703803, 1], ['2026-10-09', 7.169163217542331, 1],
    ['2026-10-10', 7.199771744680846, 1], ['2026-10-11', 7.267854700825005, 1], ['2026-10-12', 7.1010117238384662, 1],
    ['2026-10-14', 7.086437515414671, 1], ['2026-10-15', 7.1353611871471943, 1], ['2026-10-16', 7.0806794928354275, 1],
    ['2026-10-17', 7.0698696448111109, 1], ['2026-10-18', 7.1240889274858841, 1], ['2026-10-19', 7.1086809900130223, 1],
    ['2026-10-20', 7.2032237820234437, 1], ['2026-10-21', 7.2956427772470658, 1], ['2026-10-22', 7.0633672522796322, 1],
    ['2026-10-23', 7.0437030455927019, 1], ['2026-10-24', 7.0175659435518867, 1],
  ],
}
