## Summary

Describe the user-visible outcome and architecture impact.

## Validation

- [ ] `pnpm check`
- [ ] `pnpm audit --prod --audit-level high`
- [ ] Python checks, when workers changed
- [ ] Migration dry-run and rollback, when storage changed
- [ ] Clean-checkout distribution smoke, when packaging changed

## Safety

- [ ] Existing local data remains readable and recoverable
- [ ] New/changed APIs have shared schemas and contract tests
- [ ] Logs and screenshots contain no secrets, local paths, or user content
- [ ] Breaking changes are documented
