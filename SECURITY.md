# Security policy

## Supported releases

Security fixes are applied to the latest release and the current `main` branch.
This project is intended for a local computer or a trusted LAN; it is not a
public multi-tenant service.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private
security advisory workflow and include affected versions, reproduction steps,
impact, and any suggested mitigation. Maintainers will acknowledge a report
within five business days and coordinate disclosure after a fix is available.

Never include administrator PINs, cookies, local paths, personal media, model
inputs, or other private data in a report.

## Reviewed dependency exceptions

`pnpm audit:python` fails on every newly reported advisory. The checked-in
exception set is limited to two optional, loopback-only GPU runtimes:

- BasicSR 1.4.2 has no fixed PyPI release for its local SLURM environment
  command issue. The image Worker removes `SLURM_NODELIST` before import and
  never runs in a SLURM environment.
- Torch 2.6 is retained for Chatterbox V3 and CUDA 12.4 compatibility. Workers
  do not enable distributed or training APIs and only load models installed by
  an administrator. Public Torch versions are audited separately because PyPI
  advisory services do not recognize the `+cu124` local version suffix.

Review these exceptions whenever the model runtime is upgraded and at least
once per release cycle. Do not add an exception without a concrete code or
deployment mitigation and an upstream compatibility reason.
