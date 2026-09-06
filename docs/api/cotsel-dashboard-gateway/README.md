# Dashboard Gateway OpenAPI Source

This directory is the editable source for the Cotsel Dashboard Gateway OpenAPI
contract. The sibling `cotsel-dashboard-gateway.openapi.yml` file is a compact
external-reference index. The sibling
`cotsel-dashboard-gateway.bundled.openapi.yml` file is the committed, self-contained
contract for URL-based and external consumers. Runtime builds copy the same generated
content through `gateway/.generated/openapi/`.

## Change procedure

1. Edit the smallest applicable path or component fragment.
2. Add a new fragment to `manifest.json` when a new domain or chunk is needed.
3. Run `pnpm openapi:dashboard:index` from the repository root.
4. Run `pnpm openapi:dashboard:bundle` to update both the committed and runtime bundles.
5. Run `pnpm openapi:dashboard:check` and the affected gateway contract tests.
6. Commit the source fragments, index, and bundled contract together.

Do not edit the generated index or bundles directly. The bundler rejects duplicate
path, schema, parameter, response, and security-scheme keys. Every editable source
YAML file is subject to the repository's 500-line limit; only the generated bundled
contract is excluded.

The fragment split is an authoring boundary only. Internal component references
remain canonical `#/components/...` references in the generated OpenAPI contract.

## Contract-preservation invariant

`pnpm openapi:dashboard:check` rebuilds the index and bundle in memory and compares
them with the committed artifacts. It fails on an unlisted fragment, an unresolved
reference, a duplicate OpenAPI key, or an out-of-date index or bundle. Gateway
contract tests then verify that the runtime bundle is byte-for-byte identical to the
committed bundle and exposes the same paths and component schemas as the source graph.

Reviewers should treat changes to `manifest.json`, path fragments, or component
fragments as API changes. A change that only rearranges fragments must leave the
parsed path and component-schema sets unchanged.
