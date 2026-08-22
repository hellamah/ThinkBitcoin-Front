# Consentimento LGPD no front

_Atualizado em 22 de agosto de 2026._

Como o front lê os documentos legais, colhe o aceite e mostra ao usuário o que
ficou registrado. O modelo de dados, as regras de negócio e os endpoints estão
documentados no backend, em
[`consentimento-lgpd-README.md`](../../ThinkBitcoin-Back-DotNet/docs/consentimento-lgpd-README.md).

## O que mudou

O texto da Política de Privacidade e dos Termos de Uso **saiu do bundle**. Antes
vivia em JSX, duplicado entre o modal de consentimento e as páginas `/termos` e
`/privacidade`, sem número de versão e sem data — não havia como responder qual
redação uma pessoa tinha aceitado. Agora vem da API, versionado no banco.

E os dois checkboxes do cadastro, que só habilitavam o botão, passaram a enviar
o aceite com a versão de cada documento.

## Peças

| Arquivo | Papel |
|---|---|
| `utils/consentimento.js` | Vocabulário compartilhado: tipos, origens, motivos de pendência e helpers puros |
| `utils/markdownLegal.js` | Parser do Markdown dos documentos |
| `components/DocumentoLegalConteudo.jsx` | Renderiza os blocos do parser como elementos React |
| `hooks/useDocumentoLegal.js` | Versão vigente, histórico de versões e leitura de uma versão específica |
| `hooks/useConsentimento.js` | Pendências, histórico e registro de aceite/revogação |
| `pages/DocumentoLegal.jsx` | `/termos` e `/privacidade` |
| `components/ConsentimentoLGPD.jsx` | Modal de re-consentimento |
| `components/MeusConsentimentosPanel.jsx` | Painel "Privacidade e consentimento" em Configurações |

### Por que um parser próprio de Markdown

O conteúdo vem do banco e é renderizado numa página pública. Toda biblioteca de
Markdown resolve isso entregando uma string de HTML, o que obrigaria a usar
`dangerouslySetInnerHTML` e a confiar na sanitização dela. `parseDocumentoMarkdown`
devolve uma **estrutura de dados**, e o componente monta elementos React — não
existe caminho por onde marcação do conteúdo vire marcação da página.

O subconjunto suportado é o que os documentos usam e nada além: título de seção,
parágrafo, lista, destaque (`>`) e negrito. Sintaxe não reconhecida vira texto
literal em vez de sumir da tela.

## Fluxos

**Cadastro.** `CadastroConviteOverlay` carrega a versão vigente dos dois
documentos, exibe o número da versão ao lado de cada checkbox e envia `aceites`
no corpo do `POST /usuariosTB/`. O botão fica desabilitado até os documentos
carregarem — sem a versão, a API recusaria o aceite e o usuário só descobriria
depois de preencher o formulário inteiro.

**Re-consentimento.** O `Layout` consulta as pendências e monta o modal quando
há alguma. Ele mostra **o que mudou** (`resumoAlteracoes`) e qual versão a pessoa
havia aceitado antes: pedir o aceite de novo sem dizer o que mudou transforma o
consentimento informado em formalidade.

O modal não cobre `/privacidade` nem `/termos` — cobrar o aceite por cima do
texto impediria a leitura calma do que se está aceitando.

**Configurações.** O painel mostra o estado atual de cada tipo, o histórico
completo com data, origem e IP, um link para reler **a versão exata que foi
aceita** (`/termos?versao=<id>`) e os botões de revogação. Revogar dispara o
modal na mesma navegação.

**Cookies.** O banner continua gravando a escolha no `localStorage` — visitante
anônimo não tem a quem associar um registro. Havendo sessão, a escolha também
sobe para a trilha, e a que ficou presa no navegador de antes é sincronizada uma
vez (o servidor ignora reenvio idêntico, então isso não polui o histórico).

### Sincronização entre telas

`useConsentimento` é usado por duas telas ao mesmo tempo — o painel de
Configurações e o `Layout` —, cada uma com seu próprio estado. Um evento de
janela (`consentimento-alterado`) avisa as demais instâncias quando a trilha
muda; sem ele, revogar em Configurações deixava a sessão inteira seguir sem
cobrança até a próxima navegação. A instância que dispara ignora o próprio
evento, para não recarregar duas vezes em paralelo.

## Modo demo

`mockApi.js` implementa os endpoints novos com o **mesmo texto** que a migração
semeia no banco — um mock com texto resumido faria a demo exibir um documento
que não existe. A demo entra com os dois documentos já aceitos, para que a
primeira tela não seja um modal de consentimento.

O mock também **recusa cadastro sem o aceite dos dois documentos**, espelhando o
servidor. Um mock permissivo esconderia justamente no modo demo a regra que o
produto passou a ter.

## Testes

`test/consentimento.test.js` e `test/markdownLegal.test.js` cobrem os utilitários
puros; `test/mockApi.test.js` cobre a recusa de cadastro sem aceite. O que não
está coberto por teste automatizado são os componentes — a verificação do fluxo
completo (revogar → modal → aceitar → histórico) foi feita no navegador.

## Limitação conhecida

A escolha entre "Apenas essenciais" e "Aceitar todos" agora fica **registrada**,
mas continua sem governar nada: nenhum código lê o valor para tratar cookies de
forma diferente. E, a rigor, a aplicação não grava cookie algum — toda a
persistência local é `localStorage`. As duas observações são das notas 2 e 3 do
dossiê de revisão jurídica.
