import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'e2e-report', 'test-results']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  //the login page uses plain <script> tags, so auth.js and app.js share globals
  {
    files: ['public/login/*.js'],
    languageOptions: { sourceType: 'script' },
  },
  //the server, the tests and the config files run in node, not the browser
  {
    files: ['server/**/*.js', 'e2e/**/*.mjs', '*.config.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
])
