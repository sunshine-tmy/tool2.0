# Contributing

Use Node.js 24.x and pnpm 11.7.x. Create a focused branch, keep generated files
and local `storage` out of Git, and avoid maintaining a second standalone source
tree.

Before opening a pull request, run:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm audit --prod --audit-level high
```

Python worker changes must also pass Ruff formatting/checking, Mypy, and pytest.
API changes require shared schemas, backend contract tests, corresponding
frontend updates, and documentation. Data migrations must be idempotent,
rollbackable, and must preserve existing media files.

Do not add a project license without an explicit owner decision.
