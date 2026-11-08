// Minimale Konfiguration: fängt Tippfehler und undefinierte Variablen ab.
export default [
  {
    files: ['app/**/*.{js,jsx}', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly', document: 'readonly', fetch: 'readonly', sessionStorage: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', console: 'readonly', process: 'readonly',
      },
    },
    rules: { 'no-undef': 'error', eqeqeq: ['error', 'always'], 'no-dupe-keys': 'error', 'no-unreachable': 'error' },
  },
];
