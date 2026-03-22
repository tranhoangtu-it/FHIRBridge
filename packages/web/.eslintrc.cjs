/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...require('../../.eslintrc.base.cjs'),
  parserOptions: {
    ...require('../../.eslintrc.base.cjs').parserOptions,
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
