/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...require('../../.eslintrc.base.cjs'),
  parserOptions: {
    ...require('../../.eslintrc.base.cjs').parserOptions,
    project: './tsconfig.lint.json',
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.ts'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/consistent-type-imports': 'off',
      },
    },
  ],
};
