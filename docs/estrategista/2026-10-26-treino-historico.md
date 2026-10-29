# Tela de treino como histórico — proposta 1 do Estrategista, versão mínima (26/10/2026)

## A proposta e a versão aprovada

Ronda do Estrategista de 26/10/2026, proposta 1: "A tela de treino diz ao cliente que a IA treina e decide ao vivo, e ela foi encerrada em 22/10". A versão aprovada é só a mínima, no front. A completa ficou de fora: o `suspend` do publicador de treino no Back-DotNet, o roteiro do Pregão, o descarte dos pedidos dessas telas e o texto do aviso de plano.

O que motivou a proposta:
- **O agente foi encerrado.** `docs/agente-v9.md` do Back-Python registra o encerramento em 22/10/2026. Desde 23/10, quem decide ao vivo é o motor de risco (`TB_DECISOR=motor-risco`).
- **A tela dizia o contrário,** para todo usuário logado:
  - o subtítulo: "Acompanhe o treino ao vivo";
  - o selo e o cartão: "Modelo ao vivo".
- **No modo demonstração, o treino parecia vivo.** Os episódios eram gerados até a hora do load. O Trader escreveu no diário de 26/10 que a plataforma serve para "acompanhar o treino de IAs".

## O que mudou

- **Uma faixa no topo da tela de treino** (`pages/TreinamentoEpisodios.jsx`). Ela diz:
  - que o agente foi encerrado em 22/10/2026, sem vantagem sobre a regra de 200 dias;
  - que quem decide hoje é a regra do motor de risco;
  - que a tela é o histórico do treino.
- **Os rótulos, nos 5 idiomas:**
  - o subtítulo vira "Histórico do treino do agente de IA e da qualidade de cada modelo";
  - a aba "Ao vivo" vira "Recentes";
  - o selo da versão vira "último promovido", e a dica diz que ele não decide desde 23/10;
  - o cartão vira "Último modelo promovido".
- **O mock do treino** (`utils/mockApi.js`) tem o relógio parado em `TREINO_ENCERRADO_MS`, 22/10/2026 às 12:20:33 UTC, o último episódio do banco. Episódios, resumo, série, avaliações e filtros param ali. Com isso, o modo demonstração mostra o treino "Parado", como no cluster.

## O teste e a prova

- `test/TreinoEncerrado.test.jsx` testa a faixa na tela e os textos: a data, quem decide, histórico, e "ao vivo" fora do subtítulo, da aba, do selo e do cartão.
- `test/mockApi.test.js` ganhou o teste "o treino para no encerramento do agente, com o relógio depois dele". As 24h dos testes antigos passaram a terminar no encerramento.
- **Prova:** com `src/src` de volta ao `azure/Desenv`, a faixa, os textos e o teste do encerramento falham. Com a mudança, passam.
- **Checagens da CI:** `npx vitest run` (75 arquivos, 1188 testes), `npx eslint .` (0 erros, os mesmos 14 avisos de antes) e `npm run build`, com `VITE_API_URL=http://localhost`.

## O que ficou de fora

- **A completa,** inteira.
- **O detalhe do episódio** (`DetalheEpisodio`) não tem a faixa. A proposta pedia só a tela de treino.
- **Os textos históricos da aba Validação** ("Virou o modelo ao vivo", "modelo ao vivo (degraus)") descrevem o que aconteceu em cada sessão e ficaram como estão.
- **O aviso de plano** ("funções de IA do robô"), que é decisão do dono.

## Outros PRs da mesma proposta

Nenhum. A entrega foi por push direto no `Desenv`, como o dono pediu na obra anterior.
