# Dependency admission

Prefer a maintained package over reimplementing a solved problem, but do not add a package based on an API demo alone.

## Required evidence

Before adding a runtime dependency, record:

1. npm package exists and has a stable, non-placeholder version;
2. latest release date and recent release cadence;
3. weekly downloads/adoption (context, not an absolute quality score);
4. repository activity, maintainers, open security issues, and bus factor;
5. license consistency between repository and package metadata;
6. supported runtimes/framework versions;
7. bundle cost and whether it is tree-shakeable;
8. whether envoi can keep it optional or peer-only;
9. rollback path if maintenance stops.

Popularity does not override correctness. Low downloads do not automatically reject a focused package, but an unpublished `0.0.0` package with no adoption is not suitable as an envoi built-in.

## sonofmagic/ability assessment

At review time:

- repository API demonstrates `ability.update({ roles, permissions })` and `ability.reset()`;
- GitHub shows no observable adoption (0 stars/forks);
- `@icebreakers/ability` is absent from the npm registry;
- package metadata remains `0.0.0` with template description;
- repository and package license declarations are inconsistent.

Decision: document a consumer-side integration pattern, but do not add it as a runtime dependency or built-in adapter.

Re-evaluate only after a stable npm release, consistent licensing, active maintenance, and observable adoption.
