import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    // Só `jsx-uses-vars` do eslint-plugin-react, e não o preset inteiro. Sem ela,
    // `no-unused-vars` não enxerga identificador consumido em JSX e acusa como
    // morto o que está vivo: `ChartComp` em TreinamentoEpisodios é recebido como
    // prop e renderizado em `<ChartComp .../>`, e apagá-lo confiando no lint
    // quebraria os quatro gráficos daquela tela. O preset completo traria dezenas
    // de regras novas, que é outra decisão.
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        // O código de base64 é isomórfico de propósito: roda no navegador e sob
        // o vitest, e se protege com `typeof Buffer !== 'undefined'` antes de
        // tocar nele. Declarar aqui evita `no-undef` num uso que já é guardado.
        Buffer: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': [
        'error',
        // `^_` marca descarte deliberado: `({ _ms, ...rest }) => rest` é o
        // idioma de omitir um campo, e ali a variável existe justamente para
        // NÃO ser usada. Apagá-la quebraria o descarte que ela faz.
        { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // A suíte roda em Node, não no navegador: `process` e `global` existem ali e
    // não existem no bloco acima, que declara só `globals.browser`. Sem esta
    // separação o lint acusava `no-undef` que era da configuração, não do código
    // — a config veio do template do Vite e nunca tinha sido executada contra a
    // forma real deste repositório.
    files: ['test/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
])
