/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...require('../../.eslintrc.base.cjs'),
  parserOptions: {
    ...require('../../.eslintrc.base.cjs').parserOptions,
    project: './tsconfig.lint.json',
    tsconfigRootDir: __dirname,
  },
};
