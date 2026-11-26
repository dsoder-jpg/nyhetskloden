// Kodesjekk. Kjør med: npm run lint
const globals = require('globals');
const rules = {
  'no-dupe-keys': 'error', 'no-duplicate-case': 'error', 'no-unreachable': 'error', 'no-dupe-else-if': 'error', 'no-self-assign': 'error',
  'no-unsafe-negation': 'error', 'no-cond-assign': ['error', 'except-parens'], 'no-constant-binary-expression': 'error', 'use-isnan': 'error',
  'valid-typeof': 'error', 'no-sparse-arrays': 'error', 'no-redeclare': 'error', 'no-shadow-restricted-names': 'error', 'no-unused-vars': 'off',
};
module.exports = [
  { ignores: ['public/vendor/**', 'dist/**', 'data/**', 'node_modules/**'] },
  { files: ['*.js', 'scripts/**/*.js', 'test/**/*.js'], languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node } }, rules: { ...rules, 'no-undef': 'error' } },
  // sideskriptene deler globale navn med hverandre, så no-undef sjekkes i en egen test i stedet
  { files: ['public/js/**/*.js'], languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.browser, maplibregl: 'readonly', topojson: 'readonly', qrcode: 'readonly' } }, rules },
];
