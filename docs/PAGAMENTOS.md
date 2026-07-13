# Fluxo de Pagamento de Planos (Pix)

Este documento especifica o contrato entre o **ThinkBitcoin-Front** e o backend para o fluxo de pagamento de planos via Pix (gateway: [AbacatePay](https://www.abacatepay.com)). Em modo demo (`VITE_USE_MOCK=true`) os endpoints são mockados e a cobrança "se paga sozinha" em ~10 segundos.

> **Status:** o contrato está implementado dos dois lados. O detalhamento do
> lado do backend (entidades, webhook, configuração do gateway, cargos) vive
> em `docs/planos-pagamento-README.md` no repositório `ThinkBitcoin-Back-DotNet`.

## Visão geral

```
Front                    Backend (privado)              Gateway Pix
  │  POST /checkout {plano} │                              │
  ├─────────────────────────►  cria cobrança Pix           │
  │                          ├──────────────────────────────►
  │  ◄─ QR code + copia-cola │  ◄─ id da cobrança + brCode  │
  │                          │                              │
  │  (exibe QR, faz polling  │         webhook "pago"       │
  │   do status a cada 4s)   │  ◄───────────────────────────┤
  │                          │  valida assinatura,          │
  │  ◄─ status: PAGO         │  só então ativa o plano      │
```

Princípios:

- **O front nunca fala com o gateway.** Toda integração vive no backend.
- **A ativação do plano acontece no webhook**, nunca por ação do front. O polling só reflete na tela o que o backend já decidiu.
- **Plano gratuito** (valor 0) não passa pelo gateway: o front chama o endpoint legado `migrar` diretamente.

## Endpoints que o backend precisa implementar

Todos autenticados via Bearer token, respostas no envelope padrão `{ mensagem, resultado }`.

### 1. `POST /ThinkBitcoin/planos-pagamento/checkout`

Cria (ou reaproveita) uma cobrança Pix para migração de plano.

**Request:**

```json
{
  "idUsuarioTB": "guid",
  "tipoPlano": 2,
  "nomePlano": "ThinkElite (Profissional)",
  "valor": 499.90
}
```

**Regras obrigatórias:**

- **Ignorar `valor` e `nomePlano` do request** — são apenas informativos. Buscar o plano por `tipoPlano` no banco e cobrar o valor de lá (senão qualquer cliente paga R$ 0,01 pelo plano mais caro).
- **Idempotência:** se já existir cobrança `PENDENTE` do mesmo usuário para o mesmo `tipoPlano`, retornar essa cobrança em vez de criar outra.
- Criar a cobrança no gateway (AbacatePay: valor em **centavos**) e persistir em uma tabela própria (ex.: `CobrancaPlano`) com o id do gateway.

**Response (`resultado.cobranca`):**

```json
{
  "mensagem": "Cobrança Pix gerada com sucesso",
  "resultado": {
    "cobranca": {
      "idCobranca": "guid",
      "idUsuarioTB": "guid",
      "tipoPlano": 2,
      "valor": 499.90,
      "status": "PENDENTE",
      "pixCopiaECola": "00020126...",
      "qrCodeBase64": "data:image/png;base64,...",
      "criadaEm": "2026-07-12T13:00:00Z",
      "expiraEm": "2026-07-12T13:30:00Z",
      "pagaEm": null
    }
  }
}
```

Status possíveis: `PENDENTE` | `PAGO` | `EXPIRADO` | `CANCELADO`.

### 2. `GET /ThinkBitcoin/planos-pagamento/cobranca/{id}`

Endpoint de polling. Retorna a mesma shape de `cobranca` acima.

- Validar que a cobrança pertence ao usuário do token.
- Ler o status **do banco local**, não do gateway (quem atualiza o banco é o webhook).

### 3. `GET /ThinkBitcoin/planos-pagamento/cobranca/pendente`

Retorna a cobrança `PENDENTE` do usuário autenticado, ou `{ "cobranca": null }`. Usado pelo front ao abrir o modal, para retomar um pagamento interrompido sem gerar cobrança duplicada.

> Atenção ao roteamento .NET: a rota literal `pendente` precisa vencer a rota `{id}`.

## Webhook do gateway

Expor um endpoint (ex.: `POST /ThinkBitcoin/webhooks/abacatepay`) e cadastrá-lo no painel do gateway.

1. **Validar autenticidade** — o AbacatePay envia um `?webhookSecret=`; comparar com o secret configurado e rejeitar sem ele.
2. Localizar a `CobrancaPlano` pelo id do gateway.
3. **Idempotência:** se já estiver `PAGO`, responder 200 e não fazer nada (webhooks chegam duplicados).
4. Marcar `PAGO` + `pagaEm` e **só então** executar a lógica do `migrar` para ativar o plano — tudo em uma transação.

Complementos recomendados:

- **Expiração:** job (ou verificação lazy no GET) que marca `EXPIRADO` cobranças pendentes vencidas.
- **Conciliação:** job diário consultando no gateway as cobranças `PENDENTE` antigas, para cobrir webhook perdido.

## Endpoint legado `migrar`

Após esta implantação, `POST /ThinkBitcoin/planos-pagamento/migrar` **não pode mais ativar plano pago** quando chamado com token de usuário comum:

- Aceitar apenas `tipoPlano` de valor zero (downgrade para o plano gratuito) — único caso em que o front ainda o chama.
- A ativação de plano pago passa a acontecer exclusivamente pelo fluxo do webhook.

## Comportamento do front (referência)

Implementado em `src/src/components/PlanosPagamentoModal.jsx`:

- Fluxo em etapas: lista de planos → confirmação (resumo e valor) → pagamento (QR code + copia-e-cola) → sucesso.
- Polling do status a cada 4 segundos enquanto o QR está na tela; falha pontual de rede não interrompe o polling.
- Status `EXPIRADO`/`CANCELADO` devolve o usuário à lista com aviso.
- Ao reabrir o modal com cobrança pendente, o front consulta `/cobranca/pendente` e volta direto para a tela de pagamento.
- Segredos do gateway **não existem no front** — apenas no backend.

Os mocks correspondentes estão em `src/src/utils/mockApi.js` (cobrança auto-paga em 10s, expira em 30min) e mantêm o modo demo funcional sem backend.

## Permissões (cargo) e renovação de token

A assinatura controla o que o usuário pode acessar: ao ativar um plano, o
backend sincroniza o cargo do usuário (`TbCargoUsuarioTB`) com o cargo
definido no catálogo — plano gratuito concede `Consultor` (funções básicas),
planos pagos concedem `Minerador` (funções de IA do robô). O cargo viaja como
claim de `Role` no token JWT, então o front fecha o ciclo em dois pontos:

1. **Renovação de token pós-ativação** — ao concluir migração ou pagamento,
   o `PlanosPagamentoModal` chama `POST /ThinkBitcoin/gerarTokenBearer/renovar`
   (autenticado, sem senha) e aplica o token novo via `login()` do
   `AuthContext`: as permissões novas valem na hora, sem relogin. Se a
   renovação falhar, o fluxo segue e as permissões entram no próximo login.

2. **Upsell no 403** — quando a API responde `403` (autenticado, mas sem o
   cargo exigido), o `apiClient` dispara o evento global
   `subscription-required`; o `Layout` exibe um convite único para conhecer
   os planos, cujo botão navega para `/settings?planos=1` — rota que o
   `Settings` reconhece para abrir o modal de planos direto (e limpa o
   parâmetro da URL). Assim, recurso bloqueado vira funil de migração em vez
   de tela de erro.
