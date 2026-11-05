# kinstactl

TypeScript/Bun CLI for the Kinsta API. Design: `docs/superpowers/specs/2026-11-05-kinstactl-design.md`.

- Commands: `bun test`, `bun run typecheck`, `bun run gen:types` (regenerates types from `openapi/kinsta-openapi.yaml`).
- `src/client/**` is the library: it must not import from `src/cli/**`, tsyringe, Commander, picocolors, listr2 or @clack/prompts.
- No Bun-only APIs in `src/` (`Bun.*`, `bun:*`); tests may use `bun:test`.
- Never edit `src/client/generated/`; change the OpenAPI spec and run `bun run gen:types`.
- Commits follow the Angular convention (`type(scope): subject`), in English, no attribution.
