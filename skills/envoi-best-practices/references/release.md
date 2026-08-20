# Release best practices

## Before versioning

- Public runtime behavior is covered by a behavioral test.
- Public types have an expectTypeOf contract test.
- Adapter changes pass the full conformance suite.
- README and PLAN describe the implemented API, not an earlier design.
- No private package is described as installable.

## Gate

```bash
pnpm verify
```

Required stages:

1. `pnpm audit --audit-level high`;
2. oxlint;
3. oxfmt;
4. TypeScript;
5. Vitest;
6. tsdown ESM/CJS/declarations;
7. publint;
8. Are The Types Wrong.

## GitHub CI/CD release

Developers do not bump versions or create release tags locally.

1. Open **Actions -> Release -> Run workflow**.
2. Enter an exact semver.
3. Choose `latest`, `next`, or `beta`.

The workflow validates semver, runs `pnpm version`, executes the gate, commits
and tags the version, creates a tarball with `pnpm pack`, publishes through npm
OIDC, and creates the GitHub Release.

Rules:

- Changesets are not used.
- The same exact version can be rerun safely after a partial failure.
- `@envoijs/http` is the only first-release public package.
- CI creates the tarball with `pnpm pack`.
- CI publishes that tarball with npm CLI because npm Trusted Publishing's OIDC exchange is not implemented by pnpm 11 native publish.
- npm Trusted Publisher must match owner/repo and `.github/workflows/release.yml` exactly.
- No `NPM_TOKEN`; OIDC job requires `id-token: write`.
- Repository rules must allow `github-actions[bot]` to push the release commit and tag.
- Keep axios audit-clean; default-adapter security blocks release.

## Commit convention

Use Conventional Commits and allowed scopes:

```text
http, repo, ci, deps, release, docs, brand
```

Local Husky validates commit messages. CI validates pull-request titles.
