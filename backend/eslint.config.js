const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'prisma/migrations/**', 'storage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { require: 'readonly', module: 'readonly', process: 'readonly', console: 'readonly', __dirname: 'readonly', Buffer: 'readonly' } },
    rules: {
      // plain-CommonJS tooling/scripts: require() and empty catch blocks are fine here
      '@typescript-eslint/no-require-imports': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
