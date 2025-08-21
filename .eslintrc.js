module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  // Minimal, relaxed ESLint configuration: only essential checks.
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Prevent runtime ReferenceError from undeclared variables.
    'no-undef': 'error',
    // Warn about unused variables but allow underscore-prefixed args.
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Allow console statements in this repo.
    'no-console': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    '*.min.js',
  ],
};