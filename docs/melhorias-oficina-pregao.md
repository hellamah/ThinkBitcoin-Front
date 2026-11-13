# Melhorias para a Oficina e o Pregão

Anotadas em 05/11/2026, na revisão dos 8 PRs abertos da Oficina (156 a 164, dos quais só 158 e 163 entraram) e na triagem dos 199 pedidos que esperavam decisão. Cada item diz o que aconteceu, com o exemplo, e o que mudaria. O objetivo é que menos PR chegue ao Azure para ser abandonado.

## A fila em 12/11/2026

Dos 40 itens anotados até 09/11, 30 entraram, 8 entraram em parte e 2 não começaram (15 e 28). Em 10/11 entraram os itens 36 a 40. Eles não vêm de uma revisão de PRs, e sim dos números das execuções: os `resumo.json` das execuções das 10h da Oficina de 05 a 09/11 (57 pedidos foram ao modelo, e dos PRs 167 a 198 entraram 17 de 32) e os diários e o relatório do Pregão de 09/11. Em 11/11 entraram o 41 e o 42, lidos do `agendado.log` do Pregão. Dos itens de 10 e 11/11, estão feitos o 36, o 38, o 39, o 40, o 41 e o 42; o 37 não começou.

**O que mais pesa, por ordem:**
1. **38 (Pregão):** a `falta` fica fora da fila do administrador, a não ser que caiba no que a tela já tem. Nas rodadas de 09/11, de 21 a 24 dos 39 a 48 achados eram faltas, e na triagem de 05/11 foram descartados 90 dos 103 pedidos de falta. **Feito em 10/11**, e na `Desenv` do Pregão desde 11/11 (`3e25300`). A triagem rodou pela primeira vez na consolidação das 18h de 11/11: das 9 faltas que se repetiram, 1 foi ao time e 8 ficaram nas sugestões do relatório. O item diz o que entrou e o que ficou.
2. **36 (Oficina):** a etiqueta passa a usar as idas ao modelo. Em 09/11, 12 de 13 PRs saíram com "precisa de você". Com nota e até 3 idas ao modelo entraram 10 de 12 PRs; com nota e 4 ou mais, 3 de 8. **Feito em 12/11** (`73230e4`): com a nota, o PR de 4 idas ou mais sai com "precisa de você", e o de até 3, com "confira o texto". Os seis PRs abertos (199 a 204) só mudam quando forem refeitos.
3. **39 (Pregão):** o Pregão não via o descarte, e seguia listando e publicando o que o dono já tinha descartado. **Feito em 12/11** (`3b99b4b` no Pregão e `3180765` na Oficina): 23 dos 42 recorrentes de 12/11 tinham a mesma chave de um pedido descartado, e saíram do time. O diagnóstico do item estava errado num ponto: o slippage, o drawdown, a "Pega da alta" e a Taxa de Alta que ele cita não voltaram com outra chave, voltaram com a mesma, e só o Pregão não sabia. O mesmo assunto com outra chave vai ao modelo, e pegou pouco.
4. **37 (Oficina):** a prova. Dos 32 PRs, 17 saíram sem teste que prove, e a rodada só do teste não trouxe a prova em 24 de 35 vezes. **Feito em 12/11, sem ganho medido, e fora do `Desenv`:** o teste que já existe como modelo e a dica do erro de montagem ficaram na branch `claude/modelo-de-teste` da Oficina (`6d33900`). Em 28 repetições a prova não melhorou, e em 7 dos 11 pedidos a correção só mexeu em idiomas, sem componente para tirar o modelo. Detalhes no item 37.
5. **8 (Oficina):** medir o revisor, o que ficou de fora em 05/11. Dos PRs 167 a 198, 19 têm o veredito no `agendado.log`: 16 "aprovar", dos quais 5 entraram, e 3 "recusar", dos quais 1 entrou (o 197). Dos 7 que já saíram com o veredito tirado dos itens (179, 180, 188, 192, 196, 197 e 198), o revisor acertou 3. A medição do `testes/revisor/medir.py` continua sem rodar.

**Item 40 (Pregão), investigado em 11/11:** com dados reais, a série da Simulação demora mais que a espera do roteiro quando o Trader troca de moeda, e em 3 das 5 rodadas até 11/11 ele perdeu as duas ações seguintes. A leitura da chegada está inteira, e nenhum pedido da Simulação foi validado desde então. **Feito em 11/11** (`d964238`): o Trader espera o aviso de carregamento sair, por até 20 s. Conferido com o Chrome e dados reais, sem o modelo.

**Itens 41 e 42 (Pregão), de 11/11:** os dois custaram uma execução agendada inteira. O 42 foi feito no mesmo dia, e o 41 no dia seguinte.
- **42:** a consolidação das 13h de 11/11 caiu quando o modelo parou de responder a uma pergunta do juiz, e o dia ficou sem relatório e sem publicação dessa rodada. **Feito em 11/11** (`6ca1dfb`), antes da rodada das 18h: o silêncio do Ollama vira "o modelo não terminou", que a consolidação já sabe tratar. Não foi medido contra o Ollama.
- **41:** duas rodadas perdidas em dois dias (13h de 10/11 e 9h de 11/11) com o front-dev no ar pela metade. **Feito em 12/11** (`bf41d6f` na Oficina e `a60a664` no Pregão): a causa era o Triador da Oficina, que subia o Vite de outra pasta sobre o cache do `front-dev` do Pregão. Falta uma rodada depois de uma triagem de verdade para provar. Antes, em 11/11 (`208631c`), o Trader já tentava de novo a abertura do `/login`.

**O que falta dos itens que entraram em parte:**
- **3:** o Triador só entende o padrão `aba === Aba.X &&`, e nada foi conferido no navegador.
- **6:** o texto renderizado em volta do trecho não vai ao modelo.
- **10:** conferir. Este documento diz que o Sharpe, o Profit factor e a Queda máx. ficam atrás do "Aprofundar", que o roteiro não abre. O `trader/faltas.py` diz que ficam atrás do "Dá para confiar?", que o roteiro abre desde 05/11. Nos relatórios de 07 a 09/11, "Faltas do que a tela já mostra" veio com 0, e a "Falta de gráfico de Drawdown" foi ao time.
- **11:** o par em que os dois pedidos já foram ao time. O item 39 cobre.
- **9:** a regex do front que não pega "janelas de 1min, 5min e 15min". O item 38 cobre, sem depender da lista de palavras.
- **1:** barrar o PR antes do push ficou de fora por decisão, porque a régua barraria 23 dos 40 PRs medidos.

**O que perdeu peso:**
- **25 e 28:** o aviso de "pode ser do mock" e o teste do catálogo do mock. O Pregão passou a rodar com dados reais (item 12), e o Trader deixa de ver o mock. O pedido 9765d117 continua aprovado, para a Oficina acertar os planos do `mockApi.js`.
- **15:** manter os fatos no pedido de simplificar. Foi um caso só (PR 58).
- **Pequeno, da execução de 09/11:** no d2c7e7b3, a resposta do modelo deixou `<<<<<<< ANTO` dentro do `ZooEstrategias.jsx`, e a segunda resposta deixou os marcadores de novo. Recusar o bloco de troca com marcador dentro, antes de rodar as checagens, dá ao modelo o erro certo já na segunda resposta.

## O que já entrou (05/11/2026)

As duas listas abaixo foram levadas no mesmo dia, cada uma numa sessão própria, com testes. As duas foram para a `Desenv` e para os dois remotos.

**Oficina, `Desenv` em `8c3f35a`** (8 commits, de `84064bb` a `8c3f35a`; a suíte foi de 600 para 662 testes; o README ganhou a seção "O que a revisão de 05/11/2026 mudou"). Feitos: 2, 4, 5, 7, 7a, 8a, 8b, 8c e 8d. Em parte:
- **1:** o localizador segue o valor até a conta em `src/src/utils` e manda a conta ao modelo. O prompt pede a linha que sustenta cada afirmação, e o Triador marca "precisa de você". Ficou de fora barrar o PR antes do push: a régua barraria 23 dos 40 PRs só de texto medidos, e só 7 deles eram rótulos falsos conhecidos.
- **3:** a etiqueta "não vi o efeito" foi feita, e o Triador abre a aba do componente. Só entende o padrão `aba === Aba.X &&`, e nada disso foi conferido no navegador.
- **6:** há aviso de texto repetido na seção e na tela. O texto renderizado em volta do trecho não vai ao modelo.
- **8:** o veredito sai dos quatro itens. Os PRs 156 a 164 entraram no `testes/revisor/medir.py`, mas a medição não foi rodada, porque precisa do Ollama com a placa livre.
- Também apareceu: `decisoes.reaprovado` procurava uma marca que a rota pública não manda, e o pedido aprovado de novo voltava devolvido em toda execução. Corrigido em 06/11 (`c0bdfec`): a devolução por uma decisão fica num registro da Oficina (`relatorios/decididos.json`), e vale a aprovação que vem depois dela.

**Pregão, `Desenv` em `480296c`** (5 commits; 219 testes). Feitos: 9, 13, 14 e 16. Em parte:
- **9:** a regex `DAY_TRADE` do front não pega "janelas de 1min, 5min e 15min". Mudá-la é mexer nos dois repositórios.
- **10:** só pega a "Curva de capital". Sharpe, Profit factor e Queda máx. ficam atrás do "Aprofundar", que o roteiro não abre.
- **11:** o pedido novo parecido vai junto do anterior, com "Visto também como". O par em que os dois já foram ao time continua indo ao administrador, e mandar a chave do outro pede um campo novo no contrato do .NET e do Front.
- **12:** entrou no Desenv em 07/11/2026 (`c0e4778`). Com `"dados": "reais"`, o `agendado.ps1` sobe o front sem o mock e pula a rodada se o DotNet não responde. Antes do navegador, a rodada confere a conta (cargo Minerador, preferências de volta à semente, notificações desligadas), e uma trava de rede bloqueia cadastro, troca de senha, plano, decisão de pedido e todo DELETE. O `config.local.json` já está com `"dados": "reais"` e com a conta preenchida. A primeira rodada com dados reais foi a de 09/11 às 19:19, fora do agendamento (40 achados, 7 telas, 9 minutos), e a das 9h de 10/11 foi a primeira agendada a subir o front sem o modo demonstração.

A rodada das 13h de 05/11 foi a primeira com o código novo. Ela tirou da fila 11 contas de arredondamento, 2 contas entre medianas, 60 achados por decisão do dono e 24 recursos novos. A queda de energia logo depois cortou a publicação; a consolidação da rodada seguinte cobre os mesmos diários.

## O que já entrou (07 e 08/11/2026)

Os itens 17 a 25 foram feitos em 07/11, em branches com testes, e entraram na `Desenv` dos quatro repositórios em 08/11, antes das rodadas das 9h e das 10h.

- **Oficina, `bf9f3c6`** (685 testes): 17, 18, 19, 20, 21 e 22. O 19 procura a conta no Back-DotNet e não no Back-Python. Para medir o 17, foram usados os PRs 140 a 180: a dúvida do revisor estava em 27 de 36, e entraram 37% dos PRs com ela e 40% dos sem.
- **Back-DotNet, `93264ae4`, e Front, `6b5835c`:** o 23. O motivo da decisão vai a 1500 caracteres e o detalhe do evento a 2000, com uma migration que só alarga as colunas.
- **Pregão, `30a4515`** (241 testes): o 24 e a primeira metade do 25. Ficou de fora o aviso de "pode ser do mock".
- **08/11:** os itens 26 e 27, abaixo, no Pregão e no `DAY_TRADE` da Front.
- **09/11, Oficina, `d178420`** (696 testes): os itens 29, 30, 31, 32, 33 e 35.
  - **31:** a checagem `nota` exige só as chaves-alvo. A chave citada depois de um "como", ou seguida de "já explica" e "não mexer", é modelo, e vai ao pedido com o lugar no código.
  - **32:** o aviso usa o glossário do Pregão ao lado e não vale num worktree, onde o caminho não existe.
- **09/11, Pregão, `2f48972`** (244 testes): o 34. Ficou diferente da proposta. A regra "todos os pedaços" pura quebraria o trecho escrito com LaTeX ("MOMENTUM DA BUSCA ($\Delta$15…)"), cujo pedaço "delta" nunca esteve na tela. Por isso a comparação é com a captura de antes da correção: sai da volta o pedaço que estava e saiu, e a cauda que fechava a linha e cresceu. Nos diários de 06 e 08/11, isso pega exatamente o d636070d e o 102c5561.
- **11/11, Pregão, `d964238`** (289 testes): o 38 (`3e25300`), o 42 (`6ca1dfb`), a nova tentativa do `/login`, do 41 (`208631c`), e o 40.
- **12/11, Oficina, `3aabd98`** (705 testes): o 36. Junto foi a correção do teste do tempo da chamada, que falhava por arredondamento do relógio numa de três rodadas da suíte.
- **12/11, Oficina, `bf41d6f`** (708 testes): o cache próprio do Vite da comparação de telas do Triador, do 41.
- **12/11, Pregão, `a60a664`** (289 testes): o `Front-Firme` do `agendado.ps1`, do 41.
- **12/11, Oficina, `09547cf`** (723 testes): a exportação dos descartados, do 39 (`3180765`), e o `conftest.py` que impede a suíte de gravar o arquivo real.
- **12/11, Pregão, `3b99b4b`** (335 testes): o filtro dos descartados, do 39.

## Oficina (`ThinkBitcoin-Back-Python-Agents-Oficina`, pasta `Agents-Front`)

### 1. Texto novo sem apoio no cálculo
Em 3 dos 6 PRs abandonados, o texto novo descrevia um cálculo que o código não faz:
- PR 161: "a mediana do mercado". Na verdade é a mediana do próprio ativo, na série dele (`marketAnalytics.js`, `ticketMediana`).
- PR 157: "Otimização (período selecionado)". Na verdade é só o trecho de ajuste, e a Avaliação usa o resto do mesmo período.
- PR 162: "Máximo atingido hoje". Na verdade o `/100` é fixo no componente (`HeatmapInsights.jsx`).

Causa provável: o localizador entrega o componente que mostra o texto, e não a função que calcula o número. O modelo explica "o que é X" sem ver como X é calculado.

Proposta: no pedido `confuso` sobre uma métrica, o localizador segue o valor do JSX até a função em `utils/` (`marketAnalytics`, `signalLab`, `backtest`) e a manda junto. O prompt pede o trecho de código que sustenta cada afirmação nova, e sem trecho não há afirmação. O triador já lista as "palavras que o código da tela não mostra". No pedido `confuso`, essa lista podia barrar o PR, e não só avisar.

### 2. Teste com dado impossível não prova nada
No PR 156, o teste monta uma taxa de alta de 60% com intervalo de 50 a 55%. Na tela isso não acontece: o intervalo é o de Wilson da própria taxa, e a taxa sempre cai dentro dele (`signalLab.js`). Por isso as classes `up`/`down` nunca aparecem, e mesmo assim o teste passa. Já o PR 158, que entrou, gera os dados com `derivarAnalytics`, a função de verdade.

Proposta: quando existe a função de `utils/` que alimenta a tela, o teste de prova monta a entrada com ela, e não à mão. O conferente pode recusar o teste que só passa com a saída do próprio cálculo inventada.

### 3. "Nada mudou na tela" não pode virar "pode aprovar"
O triador marcou "pode aprovar" no 156 e no 159, os dois abandonados, com a frase "abri as 7 telas antes e depois do PR, sem clicar em nada, e nada mudou". No 156 não mudou porque a correção não tem efeito. No 159 a Excursão fica atrás da aba Aprofundar, e o triador não chegou lá.

Proposta: se o pedido pede uma mudança visível e o triador não mediu mudança nenhuma, a etiqueta é "não vi o efeito" (precisa de você), nunca "pode aprovar". O triador também abre a aba ou seção do componente que o diff muda.

### 4. Correção que desfaz uma correção validada
O PR 164 trocou, no Top 5, o filtro por símbolo por um filtro por id. O filtro por símbolo foi justamente o que corrigiu o pedido do Top 5 (PR 76, validado). Além disso, com id vazio o filtro novo não deduplica nada.

Proposta: antes de abrir o PR, rodar `git blame` nas linhas removidas. Se elas vieram de um "Merged PR N" de ramo `pregao/` cujo pedido está validado, o PR não sai, ou sai com o aviso no topo. O `repetido.py` já sabe achar o PR que trouxe um commit.

### 5. Pedido antigo corrigido sem conferir se ainda acontece
O PR 164 corrigiu em 03/11 um pedido visto pela última vez em 16/10. Desde então o Trader passou pelo Painel todos os dias e não viu o problema de novo.

Proposta: antes de corrigir, olhar a `ultimaVez` e as visitas à tela depois dela. Se a tela foi visitada por, por exemplo, 7 dias sem o problema, o pedido volta ao administrador como "não aparece desde DD/MM".

### 6. Título que repete o texto vizinho
O PR 159 trocou o título "Excursão das operações" pelo rótulo do botão selecionado ("Contra (MAE)"), que já aparece ao lado. A seção perdeu o nome.

Proposta: dar ao modelo o texto renderizado em volta do trecho (o triador já abre as telas) e avisar quando um texto novo é igual a outro texto visível na mesma seção.

### 7. Diff com mudanças só de espaço
O PR 164 mudou a indentação de `}, [atualizarSetas, ...]` e deixou um espaço no fim de uma linha.

Proposta: rodar `git diff --check` e recusar o trecho que só muda espaço antes do commit.

### 7a. Dica que nunca abre
O PR 106 pôs a dica da volatilidade num `Tooltip` por fora do `StatChip` (`HeatmapInsights.jsx`). Como o `StatChip` não repassa eventos nem ref, a dica nunca abriu, e a do "Pico de buscas" também não. O teste do PR só conferia que a chave do texto existia. O Trader continuou pedindo explicação (6078aec6, 3559a54f, e729b3b2), e não era ruído. Corrigido à mão em 05/11, com um teste que passa o mouse e espera a dica.

Proposta: quando a correção é uma dica, a prova passa o mouse (`fireEvent.mouseOver`) e espera o texto aparecer, em vez de procurar a chave no arquivo de idioma.

### 8. O revisor aprova quase tudo
O qwen3-coder:30b deu "aprovar" em 7 dos 8 PRs, e o dono aceitou 2. No 156 o veredito foi "aprovar", mas o próprio texto do revisor dizia que "a correção solicitada ainda não está totalmente aplicada à tela" e ainda inventava que "o PR foi aprovado pelo administrador".

Proposta: tirar o veredito dos itens ("resolve o pedido?" sim/não), e não de um campo livre. Um texto que diz "não aplicada" não pode sair com "aprovar". As decisões de 05/11 podem virar casos do `testes/revisor/medir.py`: 2 merges e 6 abandonos, cada um com o motivo comentado no PR.

### 8a. Texto falso que já entrou no Desenv
O item 1 já aconteceu. Na triagem de 05/11, quatro correções antigas da Oficina estavam no Desenv dizendo o que o código não faz:
- PR 123: "Moeda Preferida (Base Global)" e "Define a moeda base para todos os cálculos de lucro e perda da conta". Na verdade a moeda preferida só escolhe o ativo que abre selecionado: o Back-DotNet só a guarda, e o Back-Python nem a lê.
- PR 61: "Saldo de Segurança (USDT) (Retido)". Nada retém o valor, que é só uma preferência gravada. E o rótulo ficou com dois parênteses seguidos.
- PR 106: na Geopolítica, a dica "Volatilidade de preço" num número que vem do interesse de busca (`trend.volatilidade15`).
- PR 60: o botão 1D passou a mandar `'1d'`, mas a tela só aceita `'1h'`, `'24h'` e `'1m'` (`GeoHeatmapView.jsx`, linhas 203 e 533).

Os quatro pedidos foram aprovados de novo, com o motivo da aprovação apontando o erro.

Em 06/11 apareceram mais dois, também da Oficina:
- `bc5016e` (28/10): "Custo total acumulado (USD, inc. slippage)". A simulação não tem slippage nenhum; o custo é só a taxa (`backtest.js`, `custoPago`).
- `0076d0d` (27/10): "Define a periodicidade de atualização de dados na interface", para a frequência de review, que nada usa.

Por causa do primeiro, em 05/11 cinco pedidos de slippage foram descartados com um motivo errado ("o custo da Simulação já inclui slippage"). O descarte não volta atrás.

Proposta: além do item 1, quando a correção troca uma constante, conferir a constante nova contra os valores que o código aceita (no PR 60, a lista da linha 203).

### 8b. Correção que edita o mock para a conta fechar
O PR 120 trocou no `mockZooEstrategia.js` `aprovada: false` por `true` e `moedasAprovadas: 0` por `10`, para a estratégia "passar". O dono desfez depois. O PR 117 fixou a cotação do mock. O PR 59 passou a recalcular o Alfa na tela por causa de 0,01 de arredondamento.

Proposta: proibir que a correção mude um campo de veredito ou resultado em `mock*.js`. O mock imita a API, e mudar o resultado dele esconde a pergunta do Trader em vez de respondê-la.

### 8c. O motivo da aprovação não chega à Oficina
O prompt já tem a linha "Nota do administrador" (`pedido.py`, `_campos`), mas só o revisor a preenche, ao refazer. A Oficina lê a rota pública, que não traz o `motivoDecisao` da aprovação. Na triagem de 05/11, 32 aprovações saíram com o motivo apontando o erro, por exemplo "o texto atual 'Base Global' é falso". Esse motivo não chega a quem corrige.

Proposta: levar o motivo da aprovação como `nota`, pela conta de sistema que a Oficina já tem.

### 8d. A devolução por "modo demonstração" pega pedido de rótulo
A regra que devolve o pedido quando o número nasce no `mockApi.js` devolveu o b87233bd ("Significado de IC 95%"), que é sobre um rótulo, e o 166bd58a (whitelist de IPs), que não tem número nenhum.

Proposta: aplicar a regra só quando o pedido é sobre um número que não fecha (tipo `errado` com conta no trecho).

### Revisão de 06/11/2026: 14 PRs, 4 entraram
Os PRs 167 a 178 saíram da execução de 05/11 às 10h, ainda com o código antigo; o 179 e o 180, da de 06/11, já com o novo. Entraram o 169 (rótulos da volatilidade e do pico), o 171 (dica "Participação no top 5" na lista de países), o 172 (valor do HHI também no "distribuída") e o 174 (o critério das linhas esmaecidas). Os motivos dos outros 10 estão nos comentários de cada PR.

#### 17. Etiquetas que não separam nada
Os 14 PRs chegaram com "precisa de você" e "revisor em dúvida", e 5 deles também com "não vi o efeito". Quando tudo leva a mesma etiqueta, ela não ajuda a escolher o que revisar primeiro.

Proposta: medir as etiquetas contra as decisões de 05/11 e 06/11 (6 merges, 16 abandonos) e só pôr "precisa de você" no que de fato difere dos que entraram.

#### 18. "Não aparece desde" com o texto ainda na tela
O item 5 devolveu o cfc7447c (ACTIVE_GROWTH), o ef656090 (Alfa) e o 2947ae85 (dominância de busca) como "não aparece desde 22/10". Mas os três textos continuam na tela (`PatrimonioCard.jsx`, linha 60; `heatmap.centralDescricao`): o Trader só não voltou a falar deles. E a regra foi aplicada a um `falta` (e282abfe), em que "sumir" não faz sentido.

Proposta: antes de devolver, procurar o trecho na captura da tela (`bruto.json` do Pregão, como o item 14 já faz). Se ele ainda aparece, o problema segue. Não aplicar a regra a `falta`.

#### 19. "O front não tem o dado" quando o backend tem
O bcd792e4 voltou com "o front-end não possui a unidade de medida nem a escala de `trend.delta5`". A conta está em `TrendHelper.cs` do Back-DotNet (`valorAtual - serie[^6]`, na escala de 0 a 100 do interesse de busca). O d636070d voltou com "o motor fornece apenas um valor total", quando a resposta certa era tirar do rótulo um slippage que não existe.

Proposta: no item 1, seguir também o campo da API até a função que o calcula no backend, antes de responder "sem correção no front".

#### 20. A Oficina desfaz correção feita à mão, e abre PR sem código
O PR 168 trocou de volta para `'1d'` o valor do botão 1D que o dono tinha corrigido à mão em `b579bbd`. O item 4 só protege linhas vindas de ramos `pregao/` com pedido validado. O PR 179 não tinha código nenhum, só o histórico, porque a correção já estava no Desenv.

Proposta: proteger também as linhas de commits recentes do dono que citam o pedido ou o problema. E não abrir PR cujo diff só tem `docs/`: devolver como "já está assim no Desenv".

#### 21. Texto de idioma que o i18n não interpola
O PR 176 escreveu `"{{count}} candles ({intervalo}) {{isFixed ? 'no período selecionado' : 'no histórico total'}}"`: chave simples, e um ternário dentro de `{{ }}`. A tela mostraria o texto cru.

Proposta: uma checagem que recusa, nos arquivos de idioma, qualquer `{x}` simples e qualquer `{{ }}` que não seja um nome passado na chamada `t(...)`.

### Revisão de 07/11/2026: 5 PRs, 5 entraram
Os PRs 181 a 185 saíram da execução de 07/11 às 10h, já com a nota do administrador (item 8c) e as melhorias de 05/11:
- 185: o "inc. slippage" saiu do custo total. No d636070d de 06/11, a resposta tinha sido a contrária (item 19).
- 184: a mediana da volatilidade e do ticket passou a dizer "do ativo". O PR cita a nota do administrador.
- 183: a frequência de review parou de prometer uma atualização que não existe.
- 182: "Otimização" passou a dizer "trecho de ajuste".
- 181: a "Queda B&H" do Ranking ganhou "(Mediana)".

#### 22. A coluna irmã corrigida pela metade
O 733cac6a citava a "Queda máx." do Ranking, que já dizia "(Mediana)". O PR 181 acrescentou "(Mediana)" à coluna vizinha, a "Queda B&H". Mas outras colunas do Ranking também são medianas entre as moedas e continuam sem dizer: "Retorno/ano", "Buy & hold/ano", as capturas, a exposição e a taxa paga (`medianaCagr`, `medianaCagrBuyHold` etc. em `ZooEstrategias.jsx`). O PR também deixou no JSX um comentário que narra a mudança ("// Adiciona (Mediana) para diferenciar…").

Proposta:
- Quando a correção é o rótulo de uma coluna, listar as colunas irmãs que mostram o mesmo tipo de valor (o mesmo prefixo `mediana*` no JSX) e corrigir todas, ou dizer no PR por que não.
- Comentário no código explica o porquê, não narra o diff.

#### 23. A nota do administrador cabe em 500 caracteres
O DotNet recusa o motivo da decisão acima de 500 caracteres. Duas notas de aprovação de 07/11 tiveram de ser encurtadas: o 46f71e5e e o 5235da0f. Elas diziam a chave, o texto atual, o texto sugerido e o arquivo da conta. Essa nota é justamente o que fez o 184 acertar (item 8c), e 500 caracteres mal dão para isso.

Proposta (no Back-DotNet): subir o limite do motivo da aprovação para uns 1500 caracteres, ou separar a nota para a Oficina do motivo que vai para o histórico.

### Revisão de 09/11/2026: 13 PRs, 8 entraram
Os PRs 186 a 195 saíram da execução de 08/11 e os 196 a 198 da de 09/11, as duas já com os itens 17 a 22.

- **Entraram 8:**
  - 190: o Ticket Médio passou a dizer "do ativo".
  - 191: a dica da Exposição Média, com o texto da nota.
  - 193: a dica do MAE e do MFE.
  - 194: "candles de 1 hora".
  - 197: o "—" no lugar da intensidade que o mock não traz.
  - 198: a descrição do Risco Máximo.
  - 187 e 195, cada um com um ajuste do dono por cima (itens 29 e 30).
- **Abandonados 5** (186, 188, 189, 192 e 196), com o motivo comentado em cada PR.

Os 8 que entraram vieram com a nota do administrador. Dos 5 abandonados, 2 fizeram outra coisa que não a nota (186 e 188), e 2 renomearam uma métrica para outra (192 e 196).

#### 29. Chave de idioma com ponto no nome
O PR 195 pôs `"ajuda.simAlpha"` solto no topo dos cinco idiomas, e o 188 pôs `"ajuda.simEquilibrio"` dentro do bloco `ajuda`. O `t()` divide a chave nos pontos (`TranslationContext.buscar`) e nunca acha nenhuma das duas, e a dica mostraria o nome da chave. O revisor viu o sintoma no 195 ("a chave não existe"), mas não a causa.

Proposta: a checagem dos idiomas recusa chave com ponto no nome, e diz em que bloco ela vai.

#### 30. A interpolação nova num uso, e o outro uso da mesma chave sem o nome
O PR 187 pôs `{{metrica}}` em `heatmap.participacaoTop5` e passou a métrica no tooltip do mapa. Mas a dica da lista (linha 1231) usa a mesma chave sem a métrica, e mostraria `{{metrica}}` cru. A checagem do item 21 aceitou, porque uma das chamadas passa o nome.

Proposta: com um `{{nome}}` novo no texto, toda chamada `t('chave'...)` do código precisa passá-lo, e a que não passa barra o PR.

#### 31. O rótulo virou a descrição, e a correção que ignora a nota
- **PR 186:** a nota pedia "uma descrição como a do Saldo de Segurança". O PR trocou o rótulo (`initialInvestmentSettings`) pelo texto da descrição, e o campo ficou sem nome.
- **PR 188:** a nota pedia só trocar o "hoje" de `simulationBreakEvenSub`. O PR criou uma dica nova e não mexeu nessa chave.

Proposta:
- **A nota cita uma chave** (como `simulationBreakEvenSub`) **e o diff não a muda:** a checagem barra o PR, que não seguiu a nota.
- **A nota diz "como a do X":** o localizador manda junto o uso de X (o bloco da `safetyBalanceDescription` em `Settings.jsx`).
- **O rótulo curto vira uma frase longa:** a correção ganha um aviso para a revisão.

#### 32. O nome de uma métrica trocado pelo de outra
- **PR 192:** trocou "Taxa de Alta" por "Taxa de Acerto", que é outra métrica.
- **PR 196:** trocou "Profit factor" por "Média de Ganho vs. Média de Perda", que é o payoff.

Nos dois, o texto novo põe na tela uma conta que o código não faz (item 1), e o revisor só desconfiou com "dúvida".

Proposta: o glossário do Pregão (`persona/glossario.md`) vai ao programador com os nomes das métricas. A correção que tira de um rótulo o nome de uma métrica do glossário, ou põe o de outra, ganha um aviso ("renomeia a métrica X").

#### 33. A conta do back foi, e o intervalo saiu errado
O PR 189 é do bcd792e4, o pedido que o item 19 tinha em mente. A conta no Back-DotNet chegou ao modelo (`delta5 = valorAtual - serie[^6]`), mas ele escreveu "(0-100 pts)", o intervalo das parcelas. A diferença de duas leituras de 0 a 100 vai de -100 a +100.

Proposta: a pergunta do `conta_no_back` lembra que o intervalo é o do resultado da conta, e não o das parcelas, e o rótulo com intervalo cita a conta.

### Levantamento de 10/11/2026: 32 PRs, 17 entraram
Lido dos `resumo.json` das execuções das 10h de 05 a 09/11 e do histórico do `Desenv` da Front. Nessas execuções, 57 pedidos foram ao modelo, com 3,3 idas ao modelo por pedido em média e 7 no máximo. Cada ida é uma pergunta ao modelo: a resposta, a segunda resposta feita com os erros e as rodadas só do teste. Saíram os PRs 167 a 198, e dos 32 entraram 17.

#### 36. A etiqueta continua igual em quase todo PR
O item 17 entrou em 08/11, e as etiquetas seguiram iguais. Na execução de 08/11 às 19:30, 9 de 10 PRs saíram com "precisa de você", e na de 09/11 às 10h, 12 de 13. Nas execuções de 05 a 09/11 que registraram a contagem, nenhuma marcou "pode aprovar".

Duas coisas que a Oficina já sabe ao abrir o PR separam o que entrou:
- **A nota do administrador:** com ela entraram 13 de 20 PRs, e sem ela, 4 de 12. Desde 06/11, todo PR saiu com nota.
- **As idas ao modelo:** com até 3 entraram 13 de 17, e com 4 ou mais, 4 de 15.
- **As duas juntas:** com nota e até 3 idas entraram 10 de 12. Os dois que ficaram são o 186 e o 189, dos itens 31 e 33. Com nota e 4 idas ou mais entraram 3 de 8 (187, 193 e 197).

Ter o teste que prova separa pouco: entraram 9 de 15 com teste e 8 de 17 sem.

Feito em 12/11, na `Desenv` da Oficina (`9cba708`, merge `73230e4`, 705 testes):
- **A descrição do PR** ganha a linha "Idas ao modelo: N (com nota do administrador)", no começo, e a etiqueta a lê de lá.
- **Com nota e 4 idas ou mais,** o PR sai com "precisa de você", mesmo com o revisor e o Triador a favor.
- **Com nota e até 3 idas,** sai com "confira o texto" (ou "pode aprovar", com tudo a favor), mesmo que o Triador tenha pedido o dono ou o revisor tenha pedido ajuste ou ficado em dúvida. As outras etiquetas continuam na lista.
- **Ficou diferente da proposta num ponto:** o "recusar" do revisor e a decisão do dono seguem pedindo o dono com qualquer número de idas. Nenhum PR de até 3 idas com o veredito registrado saiu com "recusar", e não há número para soltá-lo.
- **A régua** virou o `testes/etiquetas/medir.py`, que lê os relatórios e o histórico do `Desenv` do front. Pela regra, dos PRs 179 a 198 com as etiquetas guardadas, entraram 5 de 7 dos que sairiam com "confira o texto" e 3 de 8 dos que sairiam com "precisa de você".

O que ficou:
- **Os seis PRs abertos** (199 a 204) não têm a linha na descrição e seguem a regra de antes até serem refeitos.
- **São poucos PRs.** A régua é medida de novo a cada revisão, como no item 17.
- **Conferido com os testes de unidade e a régua,** sem uma execução da Oficina. A das 10h de 12/11 é a primeira.

#### 37. A prova que não sai, e a rodada só do teste que quase nunca a traz
Dos 32 PRs, 17 saíram com o aviso "sem teste que a prove". A rodada só do teste, que custa mais uma ou duas idas ao modelo, trouxe a prova 11 vezes e não trouxe 24. O motivo mais comum nos avisos é o teste do modelo falhar com a correção já aplicada (11 vezes), e há falha que é da montagem do teste, e não da correção:
- **38228ae8 (PR 197):** `useNavigate() may be used only in the context of a <Router> component`.
- **2947ae85, em 09/11:** `Cannot find module '../src/pages/GeoHeatmapView'`.
- **f7b0276c, em 09/11:** o teste "não encaixou no arquivo" (`SimulationPanel.test.jsx`).

Proposta:
- O localizador manda junto um teste que já existe do mesmo componente (em `src/test/`), de onde saem o caminho do import e a montagem com o `Router` e os provedores. Quando o componente não tem teste, a Oficina escreve o esqueleto, e o modelo só preenche o que o teste confere.
- A rodada só do teste recebe o erro da montagem separado do erro da conferência, e não repete a mesma pergunta quando a primeira falhou na montagem.

**Feito em 12/11, sem ganho medido (branch `claude/modelo-de-teste` da Oficina, `6d33900`, fora do `Desenv`).** A rodada só do teste passa a receber o começo do teste mais parecido que o front já tem (o que importa o arquivo mudado; se a correção mudou um componente, o que o mostra com `render(`) e o erro de montagem dito como tal, com a dica (`corretor/modelo_de_teste.py`). A primeira resposta, a que escreve a correção, ficou como estava, e não houve esqueleto. O relatório do PR diz qual teste serviu de modelo.
- **A medição** (`testes/prova/medir_modelo.py`) refaz a rodada de pedidos já feitos, com a função da produção, com e sem o modelo e a dica, no mesmo erro de partida. Só 4 dos pedidos de montagem ainda tinham o ramo do PR no clone do front. Com 2 rodadas: montagem 0 de 4 com e 1 de 4 sem; os outros 5 pedidos que não provaram, 0 de 5 nas duas versões; os 2 que provaram em produção, 0 de 2 na repetição. Com 3 rodadas e as dicas corrigidas: 1 de 4 nas duas. Total de 28 execuções, e os resultados estão em `testes/prova/resultados/2026-11-12_*-modelo`.
- **O que a medição ensinou.** Os erros de montagem vêm em camadas: o Router, o `split` de `null`, o mock sem exportação, o `ResizeObserver`, e cada correção mostra o próximo. A repetição varia mais do que a mudança: o mesmo pedido saiu com `SEM TESTE`, com resposta vazia ou com prova na 1ª rodada só na versão sem o modelo. Dois pedidos que provaram em produção não provaram na repetição, então 11 pedidos não distinguem as versões. Uma dica estava errada e foi corrigida (o `ResizeObserver` não é um import que faltou, e sim uma classe falsa no teste).
- **Onde o modelo nem entrou.** Em 7 dos 11 pedidos a correção só mexeu nos arquivos de idioma (as chaves de texto), e o modelo vem do componente que a correção muda. Nesses, a repetição testou só as dicas. Se isso vale para os outros pedidos sem teste (34 dos 68 da rodada), é aí que o modelo teria de entrar, e isso não foi conferido.
- **O que falta:** tirar o modelo do componente que usa a chave de idioma mudada, para os 7 pedidos entrarem; e guardar o ramo de cada PR e rodar cada pedido 3 vezes, para a medição poder distinguir as versões. A decisão de mesclar a branch é do dono. Nada mostrou ganho, e a rodada extra (3) provou 1 pedido que 2 rodadas não provaram, mas isso foi 1 caso.

## Pregão (`ThinkBitcoin-Back-Python-Agents-Pregao`)

### 9. Day trade fora das decisões do Pregão
O `decisoes.md` do Estrategista registra que o cliente-alvo está em aberto: order book, ordem real e gráficos de 1 a 15 minutos dependem dele. O `trader/decisoes.py` só tira as telas do treino e a vitrine. Por isso esses pedidos chegam à fila, e só no front eles são agrupados (`GRUPOS_DE_DESCARTE`, grupo `dayTrade`). Em 05/11 eram 33 no grupo.

Proposta: um terceiro motivo em `decisoes.py`, com a mesma regex do front, para o achado do tipo `falta` que depende do cliente-alvo. Ele fica no relatório e não vira pedido até o dono decidir.

### 10. "Falta" de algo que a tela já mostra
Alguns pedidos de falta pedem o que a Simulação já mostra: Profit factor, Sharpe, Curva de capital (num deles, o trecho citado é "Curva de capital") e Queda máx.

Proposta: antes de publicar um `falta`, procurar o nome pedido no texto da tela que a rodada capturou. Se ele aparece, o achado vira `confuso` (o Trader não achou o que estava lá) ou sai.

### 11. Pares suspeitos só aparecem no relatório
O `consolidar.py` já acha os pares que "podem ser o mesmo problema", mas os dois pedidos vão à fila. Na triagem de 05/11 havia grupos de 4 a 6 pedidos sobre o mesmo assunto: Ajuste × Validação, Taxa de Alta × Base, Ticket Médio, Delta Acumulado, Top 5, seletor de timeframe.

Proposta: publicar o par suspeito como um pedido só (o mais visto), com o outro como "visto também como". Ou, no mínimo, mandar a chave do outro, para a tela mostrar os dois juntos.

### 12. Quase tudo vem do modo demonstração
Dos 199 pedidos que esperavam decisão em 05/11, 185 tinham `dados: demonstracao`. O Trader avalia o mock, e uma parte dos pedidos é defeito do mock e não da plataforma. Por exemplo, a rodada do zoo tem data fixa (06/10), então a tela de Estratégias sempre avisa "rodada atrasada: 221 horas" (09b1f2e4, d743353c).

Proposta: rodar o Trader numa conta de teste com dados reais, ou deixar o mock com datas relativas ao dia (o histórico do Painel já faz isso, `historicoMockDe`).

### 13. Conferência de conta que não conhece mediana nem arredondamento
- 8c88cbd9: o Trader dividiu a mediana do retorno pela mediana da queda e comparou com a "Mediana Calmar". A mediana das razões não é a razão das medianas.
- 893c071f e b9983f6a: a diferença de 0,01 entre o Alfa (ou o VWAP) e a conta feita com números já arredondados.

A consolidação já separa "as contas que fecham no arredondamento", mas estas passaram.

Proposta: aceitar como arredondamento a diferença de até meia unidade por parcela na soma e na subtração, e não conferir divisão entre colunas que dizem "Mediana".

### 14. Reabertura com um texto que já saiu da tela
O 38264b82 foi reaberto em 04/11 citando "MOMENTUM DA BUSCA", mas o PR 147 trocou esse rótulo por "Variação de Interesse" em 02/11, e o texto não existe mais no front. O 81504d28 cita o texto antigo do Laboratório, que o PR 58 trocou.

Proposta: reabrir só quando o trecho citado está na captura da tela da rodada.

### 15. Pedidos que se contradizem, e a correção que perde o conteúdo
O 81504d28 pediu um texto menos técnico para as linhas esmaecidas. O PR 58 simplificou, mas tirou o critério ("linhas esmaecidas indicam sinais de baixo destaque"). Depois o 7ad2e391 pediu o critério de volta.

Proposta para a Oficina: no pedido de simplificar, o texto novo mantém cada fato do antigo, em palavras mais simples. O conferente pode comparar os termos e números dos dois textos.

### 16. "Falta" de recurso grande não é pedido de alteração
Dos 103 pedidos de falta, 47 eram de day trade (item 9) e 32 eram recursos novos: 2FA, notificação push, vários gráficos lado a lado, correlação entre busca e preço, alertas por indicador, fuso horário. Todos foram descartados como roadmap, porque a Oficina corrige tela e não constrói recurso, e o descarte não volta atrás.

Proposta: o Pregão manda o `falta` que não é ajuste de tela para uma lista de sugestões no relatório, para o dono, e não para a fila do administrador.

### 24. Reabertura de um pedido que a tela já atende (07/11/2026)
- **7a634960:** foi reaberto citando "Compra líquida no período". O trecho está na tela, porque é o começo do rótulo atual, "Compra líquida no período selecionado (Ativo)". Por isso a regra do item 14 deixou passar. Mas o ajuste pede o escopo "(Ativo)" e uma dica sobre o período, e as duas coisas já existem desde o PR 158.
- **bc62f248:** foi reaberto com o Alfa "+90.23%", uma diferença de 0,01 que é arredondamento (item 13). A peneira de arredondamento só roda nos achados novos, e não na volta de um corrigido.

Proposta:
- Na volta de um corrigido, passar o achado pelas mesmas peneiras dos novos: o arredondamento e a conta entre medianas.
- Conferir também o ajuste contra a captura. Se o que ele pede (o termo entre aspas ou parênteses) já está no texto da tela, o pedido não reabre.

### 25. Defeito do modo demonstração que vira pedido (07/11/2026)
Três dos 20 pedidos de 07/11 eram defeitos do front-dev, e não da plataforma:
- **38228ae8 ("4 4 88 88"):** o heatmap do `mockApi.js` só traz a liderança, e a tela a repete no lugar da intensidade.
- **a4d99967 (Europa leva mais de 5 s):** com dados reais, o clique responde em 60 a 80 ms.
- **09b1f2e4:** a rodada do zoo tem data fixa no mock.

O item 12 já entrou no Pregão e só espera a conta de teste.

Proposta: enquanto a conta não existe, não publicar achado de tempo de resposta medido no modo demonstração, porque o front-dev do Vite é mais lento que o build. E juntar aos pedidos de demonstração um aviso de "pode ser do mock" quando o número citado vem de um campo que o `mockApi.js` não preenche.

### Revisão de 08/11/2026: 6 pedidos esperando decisão, 1 aprovado
A rodada das 18h de 07/11 publicou 41 pedidos, ainda com o código de antes. Seis esperavam decisão: 4 abertos e 2 reabertos.
- **Aprovado:** o 9765d117, para alinhar os planos do mock aos da API.
- **Descartados:** os outros 5. O 2689692f e o 46835a46 eram recursos de day trade ou novos. O efb06e22 e o bb2939fc a tela já responde. O 95f0d24e contava errado os sinais.

### 26. O termo que diz onde mexer contava como o que o ajuste pede (feito em 08/11)
O efb06e22 foi reaberto, e o ajuste dele era "Incluir a contagem de anos validados diretamente no rótulo da tabela 'Por moeda' (ex: 'Aprovada: não (5/9)')". Para a regra do item 24, "Por moeda" era o que a correção acrescenta. Como o título da tabela está sempre na tela, a volta sairia por acaso.

Feito: o termo precedido de "no rótulo", "na tabela", "ao lado do texto" e parecidos não conta (`status.LUGAR`).

### 27. Day trade e recurso novo que só se viam no detalhe (feito em 08/11)
As duas peneiras só olham o título do achado, e dois títulos passaram:
- **2689692f, "Filtro de Horário (Sessões)":** o day trade aparecia no detalhe ("sessão de Nova York").
- **46835a46, "Presets de Risco":** o Scalper, o stop loss e o take profit apareciam no ajuste.

Feito:
- **Day trade:** a regex `DAY_TRADE` (Front e Pregão juntos) pega o filtro de horário, as sessões de mercado e o "day trade" dito, e não a sessão do login.
- **Recurso novo:** o `RECURSO_NOVO` pega presets e perfis de risco.

### 28. O mock diverge do catálogo da API
O 9765d117 apontava "Minerador (Acesso Completo)" contra a descrição "Acesso à tela de estratégias e aos alertas de preço". Esses nomes só existem no `mockApi.js`. A API real devolve ThinkStart (gratuito), ThinkPro (R$ 15) e ThinkElite (R$ 499,90). O pedido foi aprovado para a Oficina corrigir o mock.

Proposta: um teste na Front que compara o catálogo do mock (planos, moedas, cargos) com uma gravação da resposta real, como o `mockZooEstrategia.js` já é a gravação de uma rodada. Enquanto o Pregão roda no modo demonstração, cada diferença vira pedido.

### Revisão de 09/11/2026: 12 pedidos esperando decisão, 5 aprovados
Esperavam decisão 6 abertos, 4 devolvidos e 2 reabertos.
- **Aprovados, com nota (5):**
  - a2b6b205: dizer que o HHI é calculado sobre todas as regiões.
  - 9f299a56: dizer que o Ticket Médio é o do candle mais recente.
  - 0b7d3fce: a dica da exposição da Simulação, que é a fração do tempo em posição, e não a do capital como em Estratégias.
  - 9765d117, aprovado de novo: os planos do mock.
  - 2947ae85, aprovado de novo: só o texto da `centralDescricao`.
- **Descartados (7).**

As regras novas da Oficina apareceram nas devoluções:
- **Conserto à mão (item 20):** o 9765d117 voltou porque a correção mexia em linhas do commit 8203f53. Ali a regra foi conservadora: a troca dos nomes dos planos não desfazia nada.
- **"Mesmo problema":** o 0b7d3fce voltou como o mesmo do 30a9c425, que é de outra tela e de outra conta. A detecção juntou os dois pelo nome "Exposição".

### 34. A volta que conta com um pedaço do trecho que sobrou
O d636070d e o 102c5561 foram reabertos pela rodada das 9h de 08/11, que já rodava com os itens 24 e 25. A captura daquela rodada já tinha os textos novos ("× a mediana do ativo", sem "inc. slippage"). A volta contou mesmo assim:
- **d636070d:** o trecho era "Custo total acumulado (USD, inc. slippage)". Um dos pedaços ("Custo total acumulado") continua na tela, e um pedaço basta (`captura.trecho_na_tela`). O pedaço que a correção tirou, "inc. slippage", não está mais.
- **102c5561:** o trecho era "1.1× a mediana", e na tela está "1.1× a mediana do ativo". O rótulo antigo é o começo do novo, e o pedaço conta.

Proposta:
- O trecho só está na tela quando **todos** os pedaços com palavras estão.
- O trecho que só aparece como o começo de uma linha mais longa conta como "o rótulo mudou": a correção mexeu nele, e a dúvida que sobra é um pedido novo, e não a volta do antigo.

O item 14 continua valendo para o trecho que saiu inteiro.

### 35. O "mesmo problema" juntou telas e contas diferentes
O 0b7d3fce, sobre a "Exposição Média" da **Simulação** (a fração dos candles em posição, `backtest.js`), voltou como o mesmo problema do 30a9c425, sobre a "Exposição" de **Estratégias** (a fração do capital, no Back-Python).

Proposta: a pergunta do par na Oficina leva a tela e a chave de cada um, e pedidos de telas diferentes, cujos textos vêm de chaves diferentes, não são o mesmo problema sem o modelo dizer por quê.

### Levantamento de 10/11/2026: o que chega à fila do administrador
Lido dos diários e do relatório de 09/11. As quatro rodadas do dia tiveram de 39 a 48 achados cada, e de 21 a 24 deles eram do tipo `falta`. O relatório mandou 38 problemas ao time (7 em "Errado ou não bate", 19 em "Confunde" e 12 em "Falta para o day trader") e publicou 36 pedidos. Outros 73 achados ficaram fora por decisão do dono, e 17 foram para as sugestões de recurso novo.

### 38. A falta é metade do que o Trader acha, e a peneira é uma lista de palavras
Das 12 faltas que foram ao time em 09/11, 11 ainda não tinham pedido:
- **Slippage, três vezes:** "Simulação de Slippage", "Falta de campo para slippage estimado" e "Falta de estimativa de impacto de mercado (slippage)".
- **Gráficos e recursos:** "Visualização de Fluxo de Ordens em Tempo Real (Order Flow)", "Histórico de Ordens Próprias", "Gráfico de Equidade sobre o Preço", "Falta de gráfico de Drawdown", "Breakdown de Lucros/Perdas" por sinal e "Falta de Filtro de Regiões no Mapa".
- **Configuração e métrica:** "Precisão de Decimais no Risco Máximo" e "Ausência de Frequência de Trades".

A que já tinha pedido é a "Frequência de Operações (Turnover)" (d2c7e7b3), aprovada.

As peneiras `DAY_TRADE` e `RECURSO_NOVO` são listas de palavras, e cresceram a cada revisão (itens 9, 16 e 27). A falta escrita com outras palavras passa:
- A do fluxo de ordens foi ao time com "Tempo Real" no título, que está na lista do `RECURSO_NOVO`. Nas outras rodadas, o Trader a descreveu como "Tape Reading" e "Time & Sales".
- O pedido de day trade também chega com outro tipo. O "Alerta de preço não dispara se o preço voltar antes de fechar a hora" foi ao time como `errado`, e o ajuste pede alerta instantâneo com push e som.

Na triagem de 05/11, foram descartados 90 dos 103 pedidos de falta: 47 de day trade, 32 de recurso novo e 11 do que a tela já mostra (`trader/faltas.py`).

Proposta:
- Inverter o padrão: a `falta` vai para as sugestões do relatório, para o dono, e não para a fila. Só vai à fila a que cabe num texto ou elemento que a tela já tem, e quem diz é o modelo, numa pergunta fechada por falta, com o texto capturado da tela.
- A mesma pergunta vale para o `errado` e o `confuso` cujo ajuste pede um recurso.
- As duas listas ficam como atalho para o que já é conhecido, e deixam de precisar crescer.

Feito em 10/11, e na `Desenv` do Pregão desde 11/11 (`e5a3af2`, merge `3e25300`, 262 testes):
- **A primeira consolidação com a triagem** foi a das 18h de 11/11. A das 13h caiu no juiz antes de chegar a ela (item 42). Das 9 faltas que se repetiram, 1 foi ao time como ajuste de tela e 8 ficaram nas sugestões do relatório, com a chave para o `--promover`. O registro guardou as 9 respostas. O relatório lista 28 sugestões de recurso novo, com as 8 entre elas, e 2 faltas do que a tela já mostra ("Curva de capital").
- **A que foi ao time** é a "Ausência de Frequência de Trades" (Simulação · Estratégias), que pede um campo novo com a quantidade de trades por dia. Parece mais um recurso novo do que um ajuste, e é a primeira resposta da triagem a conferir. A Oficina tem em correção um pedido de nome parecido, "Frequência de Operações (Turnover)" (PR 204). Não foi conferido se é o mesmo assunto.
- **A pergunta:** a falta que se repetiu vai ao modelo uma vez por problema, depois do juiz (`faltas.triar`): é um ajuste numa tela que já existe, SIM ou NÃO? A resposta fica no registro (`ajuste_de_tela`). A que leva NÃO sai dos recorrentes antes de ganhar texto de pedido, e vai para as sugestões do relatório, com a chave.
- **O que o administrador aprovou segue sem pergunta.** Das 133 faltas que já foram ao time, 3 estão aprovadas: "Tempo Médio de Operação", "Frequência de Operações (Turnover)" e "Indicação de Fonte de Volatilidade".
- **O dono manda uma sugestão à fila** com `python -m trader.consolidar --promover <chave>`.
- **Sem resposta do modelo,** a falta fica fora da consolidação, e a seguinte pergunta de novo. Com a API do DotNet fora do ar, nada é perguntado.
- **Ficou de fora:** a mesma pergunta para o `errado` e o `confuso` cujo ajuste pede um recurso.
- **Medido em 10/11** (`testes/cerebro/medir_ajuste.py`, o `gemma4:12b` com contexto de 16384, de 5 a 25 s por pergunta): a pergunta foi feita às faltas que já foram ao time, contra as decisões do administrador.
  - **As aprovadas:** as 2 que estavam na rota pública levaram SIM ("Frequência de Operações (Turnover)" e "Indicação de Fonte de Volatilidade").
  - **As não aprovadas:** das 25 mais recentes, 14 levaram NÃO e 11 levaram SIM. Dos 11, 4 são de telas encerradas, que o `decisoes.py` já tira antes. Entre os outros 7 há recurso que passou, como o "Gráfico de Preço de candles" e a "Visualização de Take Profit / Stop Loss no Gráfico".
  - **O que isso diz:** a pergunta corta mais da metade e não barrou o que foi aprovado, mas não é uma peneira limpa. E são só 2 aprovadas para conferir o outro lado.

### 39. O assunto descartado volta com outra chave
O Pregão só lê de volta do DotNet os pedidos aprovados (`trader/status.py`: aprovado, em-correcao, corrigido e validado). O descarte, ele só conhece pelas listas escritas à mão no `decisoes.py` e no `faltas.py`. O pedido descartado continua descartado enquanto a chave é a mesma. Quando o juiz cria o mesmo assunto como um problema novo, a chave é outra, e o pedido volta à fila.
- **Slippage:** cinco pedidos foram descartados em 05/11 (item 8a). Em 09/11, três problemas de slippage foram ao time sem pedido ainda (item 38), e o relatório ainda lista o "Slippage (Derrapagem)" (`02c0a429`), de uma consolidação anterior.
- **Os pares:** o relatório de 09/11 lista 8 pares, que são quatro assuntos: a divergência da Taxa de Alta (`c9802535`, `524a0ab0` e `393cffd0`), o drawdown (`95471f0d`, `8b1ad7d2` e `eff65e79`), o slippage (`02c0a429`, `c2c80f5b` e `68a09dd9`) e a "Pega da alta" (`607ccd3e` e `e71ba880`). O item 11 junta o pedido novo ao parecido, mas trata cada par sozinho.

**O diagnóstico estava errado num ponto (12/11):** com a lista dos descartados na mão, os problemas que este item cita não voltaram com outra chave, voltaram com a mesma. O slippage (`02c0a429`, `c2c80f5b` e `68a09dd9`), o drawdown (`95471f0d`, `8b1ad7d2` e `eff65e79`), a "Pega da alta" (`607ccd3e` e `e71ba880`) e a Taxa de Alta (`c9802535` e `524a0ab0`) têm a chave de um pedido descartado, e o único do item com outra chave é o `393cffd0`. O DotNet manteve o descarte, como diz o primeiro parágrafo, mas o Pregão não sabia dele: seguia listando o problema em "Para o time" e o publicando a cada consolidação. No relatório mais novo de 12/11, 23 dos 42 recorrentes tinham a chave de um descartado: 17 dos 34 "Para o time" e 6 das 8 sugestões do modelo.

Feito em 12/11, na `Desenv` da Oficina (`3180765`, e o `09547cf`, que fecha um teste que sujava o arquivo) e na do Pregão (`3b99b4b`, 335 testes):
- **A lista vem da Oficina.** A rota dos descartados (`GET /api/PedidoAlteracao?status=descartado`) pede o cargo Sistema ou Administrador, e a conta do Trader tem de ser só Minerador. A Oficina entra com a conta Sistema e, a cada execução que entra na API (10h e 19h30), grava o `relatorios/descartados.json`: o começo do id, a chave, o tipo, as telas, o problema, o trecho, o motivo e a data. O Pregão o lê da pasta irmã. Sem o arquivo, segue como antes. Não foi preciso mudar o DotNet.
- **A mesma chave sai sem modelo,** antes do `juntar_suspeitas`, e o relatório a lista em "Fora por decisão do dono" com o pedido, o motivo e as rodadas em que o Trader a viu depois do descarte.
- **O mesmo assunto com outra chave vai ao modelo:** até 8 candidatos (em outra tela, só falta contra falta), a pergunta do número e a confirmação SIM ou NÃO sobre o par. A resposta fica no registro, e o padrão é o achado seguir.
- **O `--promover`** libera o problema e avisa quando a chave é de um descartado, porque o DotNet não reabre pedido descartado: só se decide o que espera decisão.
- **Medido com o modelo,** nos 42 recorrentes de 12/11: 23 de mesma chave, e dos 19 restantes só 4 tinham candidato, todos com resposta 0. A primeira versão errou duas: a Exposição Média da Simulação contra a das Estratégias, que o item 35 mostra serem contas diferentes, e o drawdown em valores monetários contra o Drawdown Máximo. O modelo só confirmou o `393cffd0` (Taxa de Alta entre o Dashboard e o Laboratório) como o mesmo assunto de um descartado (`059b8ace`, duplicado do `5235da0f`). O período da Pressão Compradora parece ser o mesmo assunto de um descartado, e o modelo disse 0: ele é conservador, e o que deixa passar segue ao time, como antes.
- **O efeito, num ensaio da consolidação** (uma cópia do registro numa pasta temporária, o relatório de 12/11, os diários e o DotNet só lidos, e o modelo de verdade): 23 recorrentes saíram pela chave e 0 pelo modelo. O "Para o time" caiu de 34 para 17, as "Sugestões de recurso novo" de 27 para 21, e o "Fora por decisão do dono" subiu de 42 para 65. O registro e o relatório de produção ficaram idênticos aos de antes. Levou 1 min 45 s, com 4 perguntas ao modelo.
- **Um teste sujou a produção, e foi fechado.** Os testes de `--enviar` e `--conflitos` da Oficina chamam o `main()` com uma conta falsa, e passaram a gravar o `relatorios/descartados.json` de verdade: às 16:21 um deles o trocou por uma lista vazia. O `conftest.py` (`09547cf`) leva o arquivo para uma pasta temporária em todo teste, e a suíte (723 testes) deixa de tocar no real.

O que ficou:
- **Os pares com um pedido em comum virarem um grupo, publicado como um pedido só** (a segunda proposta) não foi feito.
- **O motivo do descarte pode já não valer.** Os 23 de mesma chave voltaram a ser vistos depois do descarte, em 2 a 7 rodadas (mediana 3), e 9 deles foram descartados porque a tela "já explica", "já tem" ou "foi corrigida": o Delta Acumulado, que o PR 158 corrigiu em 05/11, foi visto de novo em rodadas de 09 a 12/11. O relatório mostra as rodadas de depois do descarte em cada linha. Como o DotNet não reabre pedido descartado, o dono só consegue mandar o assunto de novo com outra chave, e o `--promover` avisa isso.
- **A lista tem a idade da última execução da Oficina** (10h e 19h30): o que o dono descartar entre uma e outra só entra na seguinte. Se a Oficina não entrar na API, o arquivo não se atualiza.
- **A consolidação das 18h de 12/11 é a primeira de verdade com o filtro,** e a primeira vez que o "Para o time" encolhe sem o dono ter decidido nada naquele dia. Vale conferir o relatório dela.

### 40. Com dados reais, a troca de moeda na Simulação estoura a espera do roteiro (10 e 11/11/2026)
Nas rodadas com dados reais de 09/11 às 19:19 e de 10/11 às 9h, o Trader clicou em "SOL" na Simulação, e a tela mostrou "Carregando a série de análise…". As duas ações seguintes não foram executadas: "não achei 'Sinal de entrada' na tela" e "não achei 'Fixar regra e revelar' na tela". Na rodada de 10/11 às 18h, também com dados reais, a série chegou a tempo, e as três ações foram feitas. Na das 18h de 09/11, no modo demonstração, as três também foram feitas. Em 11/11, com dados reais, a das 13h perdeu de novo as duas ações seguintes ("não achei 'Sinal de entrada' na tela" e "não achei 'Móvel (ATR)' na tela"), e a das 18h fez as três. São 3 de 5 rodadas com dados reais.

- **A causa:** depois de cada ação, o `navegador._esperar` esperava a rede parar por até 5 s, mais 1,5 s, e a tela era lida. Medido em 11/11: num clique que não troca de página, a espera da rede do Playwright volta na hora, e a leitura vinha uns 2,5 s depois do clique. O `rotina._visitar` só cancela as ações seguintes quando o caminho da página muda ou uma janela abre (`nav.situacao`), e a troca do `?moeda=` não conta.
- **O que não aconteceu:** a leitura da chegada está inteira nas três rodadas, o Trader não transformou o carregamento em achado, e nenhum pedido da Simulação foi validado desde 09/11. Dois estão corrigidos, esperando a validação: "Sigla MAE / MFE sem definição" e "Dúvida se o Alfa deduz o custo total".

Feito em 11/11, na `Desenv` do Pregão (`dd2c3f0`, merge `d964238`, 289 testes):
- **A espera:** depois de abrir a tela e de cada ação, o Trader espera o aviso de carregamento sair ("Carregando…", nos cinco idiomas do front), por até 20 s (`navegador.ESPERA_DO_CARREGANDO`). A tela é olhada duas vezes depois da ação, porque o aviso da Simulação só aparece 1 s depois do clique.
- **Passado o limite,** o resultado da ação diz "a tela ainda carregava depois de 20 s de espera", as ações que restavam são canceladas, e o Trader lê que a demora é da tela, e não da ferramenta. O aviso que não sai custa o limite uma vez por tela.
- **Como foi conferido:** com os testes de unidade e com o `Navegador` de verdade, no Chrome, com o front-dev e dados reais, sem o modelo. Com o código de antes, a ação seguinte à troca de moeda não achou o controle. Com o novo, o plano que falhou às 13h de 11/11 (SOL e duas ações) correu inteiro. Duas trocas passaram dos 20 s, com o DotNet ocupado pelos cliques em sequência do próprio teste, e saíram com o resultado certo.
- **A medida:** a série de 6 meses (`/ThinkBitcoin/moeda/<moeda>/valor`, 3,6 MB) levou de 3,8 a 5,5 s no DotNet local em cinco pedidos, um de cada vez, e 21,6 s em um (LTC). No Chrome, a primeira troca para ETH levou 8,3 s.

O que ficou:
- **Uma rodada inteira com o modelo.** A das 9h de 12/11 é a primeira.
- **O que o Trader faz com a demora:** quando uma troca passar dos 20 s, ele pode anotar a demora como achado.
- **O tamanho e o tempo da série** (3,6 MB, de 4 a 6 s a cada troca de moeda) são do produto, e não dos agentes: o cliente espera o mesmo, e isso não virou item aqui.

### Ocorrências de 10 e 11/11/2026: duas rodadas e uma consolidação perdidas
Lidas do `diarios/agendado.log` do Pregão. Das cinco execuções agendadas de 10/11 e de 11/11 até as 13h, duas correram inteiras (9h e 18h de 10/11). A das 18h de 11/11 também correu inteira: a consolidação dela cobriu a rodada das 13h e publicou 28 pedidos.

### 41. O front-dev responde uma vez e para (10 e 11/11/2026)
- **13h de 10/11:** a rodada foi pulada com "o front-dev não subiu em 180 s", mas a linha saiu 41 s depois de o front-dev começar a subir (13:00:12 a 13:00:53). A saída do Vite dizia "Re-optimizing dependencies because vite config has changed" e "ready in 9747 ms".
- **9h de 11/11:** o front-dev foi dado como no ar em 9 s, a rodada começou, e a abertura do `/login` estourou os 30 s do Playwright (`Page.goto: Timeout 30000ms exceeded`, à espera do `domcontentloaded`). A rodada terminou com código 1 em 39 s, antes de ler qualquer tela. A consolidação rodou sobre as 8 rodadas anteriores e publicou 29 pedidos.
- **As outras:** as rodadas das 9h e das 18h de 10/11 e a das 13h de 11/11 subiram o front-dev do mesmo jeito e correram.

O que o `agendado.ps1` faz: o laço de espera sai na primeira resposta do Vite, e quem decide é a conferência seguinte (`Front-No-Ar`, com 20 s por endereço). Em 10/11, o Vite respondeu à primeira e não respondeu à segunda em 20 s, e a mensagem dos "180 s" não diz isso. Em 11/11, respondeu às duas e parou na página do login.

A causa, investigada em 12/11: o Triador da Oficina.
- **O mecanismo:** a `comparar_telas.py` da Oficina sobe um `npm run dev` de uma cópia do front numa pasta temporária, com o `node_modules` do clone por junction, e o cache das dependências do Vite fica lá (`node_modules/.vite`). A pasta de onde o Vite sobe entra na conta que diz se o cache vale (o `configHash`): cada subida da cópia o refazia, e o `front-dev` do Pregão, ao subir depois, o refazia de novo (a linha "Re-optimizing dependencies because vite config has changed" na saída do Vite). O `conferente.py` já usava o `vite preview` para não disputar esse cache.
- **Reproduzido com o Chrome:** o `configHash` do cache do clone mudou depois de uma subida da cópia, e o `front-dev` seguinte refez as dependências.
- **A coincidência:** as duas rodadas perdidas foram as primeiras depois de uma execução da Oficina em que o Triador abriu as telas (10h e 19:30 de 10/11). Nas quatro execuções de 08 a 10/11 o Triador abriu as telas, e das quatro rodadas seguintes duas se perderam. As duas que correram (9h e 13h de 09/11) eram do modo demonstração, e as perdidas são de dados reais: não se sabe se isso pesa.
- **O que não se reproduziu:** a lentidão. Com a máquina parada, a refeita levou 5 s, e o `/login` abriu em 0,7 s. Às 9h de 11/11 o cache só ficou pronto 48 s depois de o `front-dev` começar a subir (a `_metadata.json` foi gravada às 09:01:02, e a subida começou às 09:00:14), e a abertura do `/login` espera 30 s. Não se sabe o que deixou a refeita lenta.

Feito em 11/11, na `Desenv` do Pregão antes da rodada das 18h (`e2b3be4`, merge `208631c`, 275 testes):
- **O Trader tenta de novo a abertura do `/login`**, até 3 vezes (`navegador.TENTATIVAS_DO_LOGIN`), só quando o tempo esgota. O log diz em qual tentativa abriu, e o `/login` que abre de primeira não muda.
- **Uma página em branco entre as tentativas:** sem ela, o Chrome derruba a abertura seguinte com `net::ERR_ABORTED`. O teste com o Chrome pegou isso na primeira versão.
- **Com o front parado de vez,** a rodada cai como antes, 60 s depois.
- **Como foi conferido:** com os testes de unidade e com o `Navegador` de verdade contra um servidor local que não responde ao `/login`. Não foi testado contra o front-dev, e não se sabe se teria salvo a rodada das 9h de 11/11. Na rodada das 18h de 11/11 o `/login` abriu de primeira, e a nova tentativa não foi exercitada.

Feito em 12/11, antes da rodada das 18h:
- **Oficina, `1997a58`, merge `bf41d6f`** (708 testes): o Vite da cópia do Triador sobe com um cache só dele. A cópia ganha um `vite.oficina.config.mjs`, que importa a configuração do front e só troca o `cacheDir` (`.vite-oficina`, dentro da cópia), e o Vite sobe com `--config`. Sem configuração conhecida na cópia, sobe como antes.
- **Pregão, `42070d3`, merge `a60a664`** (289 testes): o laço de espera do `agendado.ps1` sai com duas respostas seguidas (`Front-Firme`), dentro dos 180 s, e não mais com a primeira. A mensagem da rodada pulada diz o que falhou e em quanto tempo: "o front-dev não respondeu duas vezes seguidas em N s".
- **Como foi conferido, no Chrome e com o Vite de verdade:** o cache do `front-dev` do Pregão não muda depois de uma subida da cópia (o `configHash` é o mesmo antes e depois), e a comparação de telas de um commit contra ele mesmo (200 s, 7 telas) segue sem acusar nada.
- **O `Front-Firme`,** contra um front falso que responde uma vez, cala por 25 s e volta: o laço de antes dava `False` em 24 s (a rodada seria pulada), e o novo dá `True` em 31 s. Com o front mudo e o limite de 30 s, o novo desistiu em 50 s (o de antes, em 69 s), porque o limite é conferido entre as perguntas.

O que ficou:
- **Uma rodada do Pregão depois de uma triagem de verdade.** A prova é a rodada seguinte a uma execução da Oficina em que o Triador abrir as telas: o `diarios/front-dev.log` dela não deve ter a linha "Re-optimizing dependencies", e o `/login` deve abrir de primeira.
- **A rodada só começar depois de o `/login` montar** não virou espera do `agendado.ps1`: a conferência é a resposta da página inicial, e o que o Vite demora com as dependências fica com as 3 tentativas do Trader (uns 90 s no total). Se a refeita passar disso, a rodada cai como antes.
- **O que mais invalida o cache:** uma mudança no `package.json` ou no `vite.config.mjs` do front, trazida pela atualização que o `agendado.ps1` faz, também o refaz. As duas proteções do Pregão cobrem isso, sem medida.
- **A lentidão de 48 s** das 9h de 11/11 segue sem explicação.

### 42. O modelo que para de responder derruba a consolidação (11/11/2026)
A consolidação das 13h de 11/11 terminou com código 1 às 13:35, sem relatório e sem publicação. A rodada tinha corrido inteira (13:00 a 13:10, código 0).
- **O que aconteceu:** uma pergunta do juiz entrou em laço e foi cortada em uns 6997 tokens. O `cerebro.conversar` refez a pergunta com a amostragem padrão do modelo, e o Ollama não mandou nem o começo dessa segunda resposta em 900 s, o limite de leitura do `_chamar`.
- **Por que caiu tudo:** o `TimeoutError` não é um `NaoTerminou`, e o `problemas.agrupar` só trata o `NaoTerminou`. Das 144 segundas tentativas que o log registra, é a primeira que termina assim.
- **Não era disputa pela placa:** a Oficina tinha terminado às 10:10.
- **O que ficou:** o registro foi gravado até 13:19, com o que o juiz já tinha atribuído. O diário das 13h fica para a consolidação das 18h, que pergunta de novo o achado que travou.
- **O item 38:** a triagem vem depois do juiz, e não chegou a rodar.

Feito em 11/11, na `Desenv` do Pregão antes da rodada das 18h (`2653b4a`, merge `6ca1dfb`, 269 testes):
- **O silêncio vira `NaoTerminou`** (`cerebro.SILENCIO`), sem outra tentativa: o achado fica fora daquela consolidação, o relatório avisa, e as outras perguntas seguem. Vale para a resposta que não começa e para o stream que para no meio.
- **O limite de leitura caiu de 900 para 300 s** (`cerebro.ESPERA`). A resposta vem em stream, e as segundas tentativas medidas em outubro levaram de 25 a 120 s.
- **Dois silêncios seguidos ainda derrubam a consolidação** (`cerebro.SILENCIOS_SEGUIDOS`). Com o Ollama parado, cada pergunta que resta custaria 300 s, e a consolidação passaria por cima da execução seguinte. Uma resposta no meio zera a conta, e a conexão recusada sobe como antes.
- **O diário:** o título das notas do modelo passou a dizer "o contexto encheu, ou o Ollama não respondeu".
- **Como foi conferido:** com os testes de unidade e com o `Cerebro` de verdade contra um servidor local que se cala, com o limite em 1 s. Não foi medido contra o Ollama, porque o travamento de 11/11 não se reproduz de propósito. Na consolidação das 18h de 11/11, cinco perguntas entraram em laço e foram refeitas, e o Ollama respondeu a todas: a correção não foi exercitada.

O que ficou:
- **Por que o Ollama se calou** depois do laço cortado não foi investigado.
- **O limite de 300 s** fica curto se uma execução do Pregão esperar na fila do Ollama atrás da Oficina por mais de 5 minutos. Pelos horários do `agendado.log`, as duas não se cruzam hoje.

### Revisão de 13/11/2026: 6 PRs, 6 entraram
Os PRs 199 a 204 saíram da execução de 10/11, a primeira com os itens 29 a 35. Os seis entraram, três deles com um ajuste do dono:
- **199:** o rótulo com dica estava num `<Typography>` dentro de outro (item 38).
- **204:** a dica do giro repetia o rótulo, e o teste passava por isso (item 37).
- **203:** conflitava com o 201 em linhas vizinhas do pt.json. A Oficina tinha marcado os dois com "mesmo texto do PR", e o merge foi feito à mão, mantendo as duas dicas.

Os 5 que tinham nota seguiram a nota; o 200 trocou a dica pedida por um rótulo verdadeiro, "(Fração de Tempo)".

O Pregão já roda com dados reais desde 10/11. Das 8 rodadas até 12/11, 7 foram reais. A das 9h de 11/11 não chegou a rodar, porque a primeira página do front-dev passou de 30 s.

#### 36. O revisor não lê a nota do administrador
O revisor recusou o 200 e o 204 cobrando o texto do pedido do Trader: "o pedido pede 'Número de Operações'". Mas a nota pedia exatamente o giro, e dizia para não chamá-lo de "Número de operações". O programador lê a nota desde o item 8c; o revisor, não.

Proposta: o revisor recebe a nota junto com o pedido, e a resposta "resolve o pedido?" é conferida contra a nota quando ela existe.

#### 37. A dica igual ao rótulo, e o teste que passa por isso
No PR 204, a `colGiroHint` era "Giro/ano (Mediana)", o mesmo texto da `colGiro`. O teste passava o mouse no cabeçalho e procurava o texto da dica, mas a dica das colunas do Ranking é o `title` do `<th>`. O `findByText` achava o próprio cabeçalho e passava sem provar nada.

Proposta:
- A checagem dos idiomas avisa a chave nova de dica (`*Hint`, `*Tooltip`, `*_tooltip`, `ajuda.*`) com o mesmo texto de outra chave (item 6).
- A prova recusa o teste de dica cujo texto esperado é igual ao de um rótulo da tela.

#### 38. Um `<p>` dentro de outro `<p>`
No PR 199, o `label` do `BarraMedida` virou `<Tooltip><Typography>…</Typography></Tooltip>`, e o `BarraMedida` já põe o rótulo dentro de um `Typography`. É o "In HTML, <p> cannot be a descendant of <p>" que o PR 97 tinha corrigido. Nem o revisor nem a prova viram.

Proposta: a prova roda os testes do componente procurando no console os avisos de aninhamento do React ("cannot be a descendant of", "validateDOMNesting"), e um aviso novo barra o PR.

#### 39. A primeira página do front-dev e o timeout da consolidação (Pregão)
- **Front-dev:** na rodada das 9h de 11/11, o `agendado.ps1` subiu o front-dev, e o primeiro `goto` do login passou dos 30 s do Playwright. O Vite ainda montava a primeira página, e a rodada caiu sem diário.
- **Consolidação:** a das 13h35 do mesmo dia caiu num timeout de rede (um `recv` sem resposta).

Proposta: depois de subir o front-dev, o agendado abre a página de login uma vez e espera ela responder antes de chamar o Trader. A chamada da consolidação que estoura o tempo é tentada de novo uma vez antes de derrubar a consolidação.

### Triagem de 13/11/2026: 24 pedidos esperando decisão, 7 aprovados
Esperavam decisão 12 abertos, 8 devolvidos e 4 reabertos, já com pedidos `dados: reais`.
- **Aprovados, com nota (7):**
  - 1aa3fcfe: dizer que a VWAP é a do período, sem sincronizar a conta.
  - Aprovados de novo, porque os PRs anteriores foram abandonados: a32acbe6, 4dc536a6, bcd792e4, cfc7447c (tirar o selo ACTIVE_GROWTH) e b60eb914. As notas dizem também o que o PR anterior errou.
  - 9765d117, aprovado de novo: a nota diz o arquivo e as linhas do mock.
- **Descartados (17):** a tela já responde (7), recurso novo ou day trade (6), atendidos por PR (3) e lentidão do front-dev (1).

#### 40. A lentidão do front-dev também nas rodadas com dados reais (Pregão)
O 255f567a, de uma rodada real, diz que "Américas" e "Ásia" ficam "estáticas por até 5 segundos". No build, o clique responde em 60 a 80 ms. O filtro do item 25 só vale para as rodadas do modo demonstração, porque supunha que, com dados reais, o Trader veria o build. Mas o `agendado.ps1` sobe o front-dev do Vite nos dois modos.

Proposta: o `consolidar.lentidao` vale para toda rodada que usou o front-dev, e não só para as de demonstração. Ou o agendado passa a abrir o build (`npm run preview`) nas rodadas com dados reais.

#### 41. A Oficina não manda o trecho do mock
O 9765d117 voltou depois de 3 tentativas: "o trecho do arquivo `mockApi.js` que contém a definição dos planos não foi incluído". O f7b0276c parou do mesmo jeito em `CartoesEssenciais.jsx`. O localizador acha o componente pelo texto da tela, e o mock não tem texto de tela.

Proposta: quando a nota do administrador cita um arquivo (e as linhas), o `nota.usos` manda o trecho junto, como já manda as chaves. E o "não chegou ao código" que se repete nas 3 tentativas vira devolução com o nome do arquivo que faltou, em vez de gastar as três.
