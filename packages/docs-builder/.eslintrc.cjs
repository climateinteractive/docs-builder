module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    // XXX: This is needed so that eslint doesn't complain about the use of
    // Map and Set types in JS sources (like in the sample app)
    es6: true
  },
  parser: '@typescript-eslint/parser',
  rules: {
    '@typescript-eslint/consistent-type-imports': 'error'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:eslint-comments/recommended',
    'prettier'
  ]
}
