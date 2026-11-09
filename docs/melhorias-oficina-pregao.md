# Melhorias para a Oficina e o Pregão

Anotadas em 05/11/2026, na revisão dos 8 PRs abertos da Oficina (156 a 164, dos quais só 158 e 163 entraram) e na triagem dos 199 pedidos que esperavam decisão. Cada item diz o que aconteceu, com o exemplo, e o que mudaria. O objetivo é que menos PR chegue ao Azure para ser abandonado.

## O que já entrou (05/11/2026)

As duas listas abaixo foram levadas no mesmo dia, cada uma numa sessão própria, com testes. As duas foram para a `Desenv` e para os dois remotos.

**Oficina, `Desenv` em `8c3f35a`** (8 commits, de `84064bb` a `8c3f35a`; a suíte foi de 600 para 662 testes; o README ganhou a seção "O que a revisão de 05/11/2026 mudou"). Feitos: 2, 4, 5, 7, 7a, 8a, 8b, 8c e 8d. Em parte:
- **1:** o localizador segue o valor até a conta em `src/src/utils` e manda a conta ao modelo. O prompt pede a linha que sustenta cada afirmação, e o Triador marca "precisa de você". Ficou de fora barrar o PR antes do push: a régua barraria 23 dos 40 PRs só de texto medidos, e só 7 deles eram rótulos falsos conhecidos.
- **3:** a etiqueta "não vi o efeito" foi feita, e o Triador abre a aba do componente. Só entende o padrão `aba === Aba.X &&`, e nada disso foi conferido no navegador.
- **6:** há aviso de texto repetido na seção e na tela. O texto renderizado em volta do trecho não vai ao modelo.
- **8:** o veredito sai dos quatro itens. Os PRs 156 a 164 entraram no `testes/revisor/medir.py`, mas a medição não foi rodada, porque precisa do Ollama com a placa livre.
- Também apareceu: `decisoes.reaprovado` procura uma marca que a rota pública não manda, e provavelmente nunca dá verdadeiro.

**Pregão, `Desenv` em `480296c`** (5 commits; 219 testes). Feitos: 9, 13, 14 e 16. Em parte:
- **9:** a regex `DAY_TRADE` do front não pega "janelas de 1min, 5min e 15min". Mudá-la é mexer nos dois repositórios.
- **10:** só pega a "Curva de capital". Sharpe, Profit factor e Queda máx. ficam atrás do "Aprofundar", que o roteiro não abre.
- **11:** o pedido novo parecido vai junto do anterior, com "Visto também como". O par em que os dois já foram ao time continua indo ao administrador, e mandar a chave do outro pede um campo novo no contrato do .NET e do Front.
- **12:** entrou no Desenv em 07/11/2026 (`c0e4778`). Com `"dados": "reais"`, o `agendado.ps1` sobe o front sem o mock e pula a rodada se o DotNet não responde. Antes do navegador, a rodada confere a conta (cargo Minerador, preferências de volta à semente, notificações desligadas), e uma trava de rede bloqueia cadastro, troca de senha, plano, decisão de pedido e todo DELETE. Falta só o dono criar a conta de teste e pôr o e-mail e a senha no `config.local.json`.

A rodada das 13h de 05/11 foi a primeira com o código novo. Ela tirou da fila 11 contas de arredondamento, 2 contas entre medianas, 60 achados por decisão do dono e 24 recursos novos. A queda de energia logo depois cortou a publicação; a consolidação da rodada seguinte cobre os mesmos diários.

## O que já entrou (07 e 08/11/2026)

Os itens 17 a 25 foram feitos em 07/11, em branches com testes, e entraram na `Desenv` dos quatro repositórios em 08/11, antes das rodadas das 9h e das 10h.

- **Oficina, `bf9f3c6`** (685 testes): 17, 18, 19, 20, 21 e 22. O 19 procura a conta no Back-DotNet e não no Back-Python. Para medir o 17, foram usados os PRs 140 a 180: a dúvida do revisor estava em 27 de 36, e entraram 37% dos PRs com ela e 40% dos sem.
- **Back-DotNet, `93264ae4`, e Front, `6b5835c`:** o 23. O motivo da decisão vai a 1500 caracteres e o detalhe do evento a 2000, com uma migration que só alarga as colunas.
- **Pregão, `30a4515`** (241 testes): o 24 e a primeira metade do 25. Ficou de fora o aviso de "pode ser do mock".
- **08/11:** os itens 26 e 27, abaixo, no Pregão e no `DAY_TRADE` da Front.

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
