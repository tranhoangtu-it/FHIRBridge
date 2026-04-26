# Contributing to FHIRBridge

Thanks for considering a contribution. FHIRBridge is a small, single-maintainer OSS project. This file describes what contributions are welcome and how to get them merged.

---

## What is in scope

| Welcome                                                 | Out of scope                                                                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Bug fixes                                               | Hosted SaaS / billing / quota / tier features (see [docs/adr/0007-oss-only-pivot.md](docs/adr/0007-oss-only-pivot.md)) |
| New HIS connector adapters (e.g., HL7 v2 → FHIR mapper) | DICOM imaging, e-prescribing, PHR storage                                                                              |
| New `AiProvider` adapters (Azure OpenAI, AWS Bedrock)   | Multi-tenant infrastructure                                                                                            |
| New FHIR R4 resource validators                         | Forks targeting non-FHIR-R4 standards                                                                                  |
| Test coverage on adversarial / privacy invariants       | Test suites without realistic FHIR fixtures                                                                            |
| i18n strings (VI / EN / JA)                             | New UI languages without first-language coverage                                                                       |
| Performance fixes that come with a perf test            | Performance changes without measurement                                                                                |
| Documentation improvements                              | Marketing copy / hosted-tier copy                                                                                      |

If you are unsure whether your idea is in scope, **open an issue first** before writing code.

## Before you submit a PR

1. Read [docs/code-standards.md](docs/code-standards.md) — the maintainer enforces these.
2. Read [docs/test-strategy.md](docs/test-strategy.md) — every behavior change needs a test.
3. Read [docs/system-architecture.md](docs/system-architecture.md) — understand DI bootstrap, streaming export, the 3-gate AI flow, and the de-identifier invariants.
4. Run the verification chain locally:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
```

All four must pass before you push. CI runs the same plus `pnpm test:integration` + `pnpm test:e2e:cli` + `pnpm test:security`.

## PR checklist

- [ ] Branch from up-to-date `main`. Use a descriptive name: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`.
- [ ] Conventional-commits in the subject line: `feat: ...`, `fix: ...`, `refactor: ...`, `chore: ...`, `docs: ...`, `test: ...`, `build: ...`.
- [ ] One concern per commit. Squash-merge will keep `main` linear.
- [ ] Body explains the WHY in 2-5 sentences. Link any related issue.
- [ ] Tests added or extended for any behavior change.
- [ ] If touching auth / SSRF / IDOR / streaming / de-identifier: a security or invariant test is mandatory.
- [ ] If adding a new resource type: the de-identifier sweep is extended AND an invariant test feeds adversarial PHI through it.
- [ ] No `console.log` in production code paths.
- [ ] No raw `Error` thrown in business logic — extend `DomainError`.
- [ ] No relative cross-package imports — use `@fhirbridge/core` / `@fhirbridge/types`.
- [ ] Files under 200 LOC. If yours is bigger, split.
- [ ] Doc updates in the same PR if you touched anything user-visible.

## Reviewing process

The maintainer reviews on best-effort timeline:

- **Critical security fix** — usually within 7 days.
- **Bug fix with reproducer** — usually within 14 days.
- **Feature** — depends on scope alignment; longer review.
- **Documentation only** — fastest path; usually < 7 days.

The maintainer may ask for changes; please address them in the same PR. If a PR sits idle for 30+ days, it may be closed with a polite note — feel free to reopen with revised scope.

## Reporting bugs

File an issue with:

- What you tried (commands, payloads, env config — redact secrets).
- What you expected to happen.
- What actually happened (logs, error messages, stack traces).
- Repro steps a maintainer can run locally with `pnpm test`.
- The exact commit hash you were on (`git rev-parse HEAD`).

Please don't file an issue that is just "doesn't work for me" without the above — those get closed. Reproducers are the maintainer's most precious resource.

## Reporting security vulnerabilities

**Do not** file a public issue with exploit details. Use the GitHub private security advisory flow:

→ https://github.com/tranhoangtu-it/FHIRBridge/security/advisories/new

See [SECURITY.md](.github/SECURITY.md) for the full policy.

## Code of conduct

This project follows the spirit of the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Be respectful in issues, PRs, and discussion. The maintainer reserves the right to remove abusive comments and block repeat offenders.

## License

By contributing, you agree your contribution will be licensed under the MIT License (see [LICENSE](LICENSE)). You retain copyright; you grant the project an MIT license to your contribution.

## Thank you

The project exists because someone took the time to file an issue or open a PR. That's the contribution that matters most.
