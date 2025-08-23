module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: [],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'prefer-const': 'off',
    'no-var': 'off',
    'object-shorthand': 'off',
    'prefer-template': 'off',
    'template-curly-spacing': 'off',
    'arrow-spacing': 'off',
    'comma-dangle': 'off',
    'semi': ['warn', 'always'],
    'max-len': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    '*.min.js',
  ],
};