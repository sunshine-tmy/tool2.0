# Standalone release templates

This directory contains only the launchers copied into generated standalone
archives. Application source always comes from the repository root; do not copy
or maintain a second source tree here.

Generate a package locally with:

```powershell
pwsh ./scripts/package-standalone.ps1 -Platform windows -Preview
pwsh ./scripts/package-standalone.ps1 -Platform windows
```

Release builds download the pinned Python installer from python.org, verify its
SHA-256 digest, build the application, and publish archives, checksums, manifests
and an SBOM from CI.
