# Robô ao vivo — proposta 2 do Estrategista, versão mínima (25/10/2026)

## A proposta e a versão aprovada

Ronda do Estrategista de 25/10/2026, proposta 2: "O painel do robô, com o critério que você registrou". A versão aprovada é só a mínima: uma página "Robô ao vivo" para administrador, com as rotas que a API já serve e os dados no modo demonstração. A completa (o placar refeito pelas operações e a checagem diária do critério, no DotNet) não foi aprovada.

O que motivou a proposta:
- Desde 23/10/2026 às 11:49 UTC, quem decide ao vivo é o motor de risco (`docs/motor-de-risco.md` do Back-Python), só no BTC e com dinheiro de mentira.
- Nenhuma tela mostrava essas decisões. A rota `GET ThinkBitcoin/historicoDecisoes` existia, e nenhum componente a chamava.
- É a "Fase 2 — Painel do Robô Trader" do `docs/ROADMAP.md`.

## O que mudou

- **`/robo-ao-vivo`**, só para administrador (`ProtectedRoute`). A página tem três blocos:
  - **Estado de hoje:** dentro ou fora do mercado, pela última operação; a dose da regra, pela última exposição da curva do zoo; a regra em palavras; desde quando o motor decide; e a última operação.
  - **A regra no papel contra o buy & hold:** a curva da `media_50d_vol_alvo_40` no BTC e a do buy & hold, desde o último fechamento antes da ativação (22/10), as duas a partir de zero.
  - **Operações:** cada compra, venda e ajuste de dose desde a ativação, com o preço, o valor e a taxa.
- **O menu de administrador** (o do Pregão) ganhou o terceiro item, "Robô ao vivo".
- **`apiClient`:** endpoint `HISTORICO_DECISAO.LIST`.
- **O modo demonstração:**
  - `mockApi` responde `historicoDecisoes` com os filtros e a paginação da API;
  - a curva do zoo pedida com data passa a ser filtrada como na API e traz os pontos reais recentes;
  - sem data, a curva continua a mesma, e a tela do zoo não muda;
  - os dados estão em `mockRoboAoVivo.js` e são reais, lidos do banco em 25/10.
- **Os textos** estão nos 5 idiomas.

Duas escolhas de desenho:
- **As operações de antes da ativação ficam fora.** Elas são do DQN, que foi encerrado.
- **A tela não desenha curva com o saldo.** O `SaldoAnterior` volta a 1.000 quando o worker reinicia (28 de 106 linhas em 25/10), como o documento do motor descreve.

## O teste e a prova

- `test/roboAoVivo.test.js` testa as contas (UTC, corte na ativação, dentro ou fora, dose, curva a partir de 1,0, nome da ação) e o modo demonstração (`historicoDecisoes` filtrado, a curva com data e a curva sem data).
- `test/RoboAoVivo.test.jsx` testa a página: as duas rotas pedidas com as datas certas, "fora do mercado", a operação de 24/10 com a taxa, o retorno do período, e a falha da curva sem esconder as operações.
- `test/MenuPregao.test.jsx` confere os três itens do menu.
- **Prova:** com os arquivos de `src/src` de volta ao `azure/Desenv`, os três arquivos de teste falham, e com a mudança passam.
- **Checagens da CI:** `npx vitest run` (74 arquivos, 1184 testes), `npx eslint .` (0 erros) e `npm run build`, com `VITE_API_URL=http://localhost`, como a Oficina.

## O que ficou de fora

- O placar refeito pelas operações e a checagem diária do critério (fidelidade de 3 pontos e queda), no DotNet.
- O registro da ativação no `docs/motor-de-risco.md` do Back-Python.
- A tela para o Minerador. As rotas aceitam o cargo dele, mas a página e o menu são só de administrador.

## Outros PRs da mesma proposta

Nenhum. É um PR só, no front.

## Correção de 26/10/2026, depois de conferir no navegador do cluster

- **A lista de operações não carregava** ("Não foi possível carregar as operações do robô.").
  - A rota `historicoDecisoes` respondia 500, porque a função dela nunca entrou na lista de injeção da API.
  - A correção está no Back-DotNet, commit 390b5035.
  - Os testes desta tela imitavam a API e não pegaram isso.
- **O estado de hoje dizia "Nenhuma operação desde a ativação" quando a busca falhava,** com o fechamento de 24/10 no banco.
  - Agora, sem a lista, a linha mostra "–".
  - O teste "a falha das operações não diz que não houve operação", em `test/RoboAoVivo.test.jsx`, falha com a página anterior e passa com a nova.
