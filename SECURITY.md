# Security policy

## Supported versions

Only the latest `0.x` alpha receives fixes.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private vulnerability reporting once the repository is public.
Include the Outcome Check version, the command and a minimal **synthetic** export. Never include real exports, since
they contain names and logins. We aim to acknowledge within 5 business days. _(Private reporting is enabled at
publication time; until then report directly to the maintainers at EnWithAI.)_

## Security and privacy properties Outcome Check is designed to keep

- It never uses the network, needs no token, and has no telemetry. No model or paid API is used.
- It never executes anything: no child processes, `eval` or dynamic imports.
- It reads only the files you pass and writes only the report you request with `--output`.
- **No identities in output:** logins, names, emails, PR titles and commit messages never appear in any report format.
- The HTML report contains no JavaScript and declares a restrictive Content-Security-Policy.

A violation of any of these is a security bug. See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).
