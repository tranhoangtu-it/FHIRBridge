/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...require('./.eslintrc.base.cjs'),
  root: true,
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.d.ts'],
};
