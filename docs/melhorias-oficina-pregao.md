# Melhorias para a Oficina e o Pregão

Anotadas em 05/11/2026, na revisão dos 8 PRs abertos da Oficina (156 a 164, dos quais só 158 e 163 entraram) e na triagem dos 199 pedidos que esperavam decisão. Cada item diz o que aconteceu, com o exemplo, e o que mudaria. O objetivo é que menos PR chegue ao Azure para ser abandonado.

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
