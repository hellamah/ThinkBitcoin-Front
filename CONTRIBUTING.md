# Guia de Contribuição

Obrigado por querer contribuir com o ThinkBitcoin Front. Este documento define o fluxo mínimo para manter qualidade, previsibilidade e consistência no projeto.

## 1) Como rodar localmente

### Pré-requisitos
- Node.js 18+
- npm 10+

### Setup rápido
```bash
cd src
npm install
npm run dev
```

A aplicação ficará disponível no endereço mostrado pelo Vite (normalmente `http://localhost:5173`).

### Testes locais (obrigatório antes de PR)
```bash
cd src
npm test
```

## 2) Como abrir Pull Request

1. Atualize sua branch com a base correta (`dev`, salvo orientação diferente do mantenedor).
2. Rode os testes (`npm test`) e valide se não há quebras.
3. Abra o PR para `dev` com:
   - contexto do problema;
   - resumo da solução;
   - impacto técnico/funcional;
   - evidências de teste.
4. Mantenha PRs pequenos e focados (uma mudança por objetivo).

## 3) Convenções de código

Para manter o padrão do projeto:

- Reaproveite utilitários em `src/src/utils` antes de criar novas implementações.
- Use enums e constantes existentes quando aplicável, evitando valores mágicos espalhados.
- Preserve o padrão de componentes e hooks já adotado no projeto.
- Atualize documentação e traduções (`src/src/lang/pt.json` e `src/src/lang/en.json`) quando houver impacto de interface.
- Evite mudanças não relacionadas no mesmo PR.

## 4) Estratégia de branches

Fluxo padrão recomendado:

- `main`: branch estável de produção.
- `dev`: branch de integração das funcionalidades.
- `feature/<nome-curto>`: novas funcionalidades (origem em `dev`, destino em `dev`).
- `fix/<nome-curto>`: correções pontuais (origem em `dev`, destino em `dev`).

Somente promova `dev` para `main` após validações de release.

## 5) Checklist antes de enviar

- [ ] Rodei `npm test` em `src/`.
- [ ] Reutilizei camada de utils/enums quando aplicável.
- [ ] Atualizei documentação relevante.
- [ ] Meu PR está pequeno, objetivo e com descrição clara.
