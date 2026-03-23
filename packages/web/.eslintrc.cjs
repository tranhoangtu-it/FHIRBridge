/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...require('../../.eslintrc.base.cjs'),
  parserOptions: {
    ...require('../../.eslintrc.base.cjs').parserOptions,
    project: './tsconfig.lint.json',
    tsconfigRootDir: __dirname,
    ecmaFeatures: { jsx: true },
  },
  rules: {
    'react-hooks/exhaustive-deps': 'off',
    'react-hooks/rules-of-hooks': 'off',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
