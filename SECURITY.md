# Security policy

## Supported versions

Only the latest `0.x` alpha receives fixes.

## Reporting a vulnerability

Security contact: **Koushik Ramani** ([@aiwithrk](https://github.com/aiwithrk)), maintainer, EnWithAI Technologies.

Please **do not open a public issue**. Use GitHub's private vulnerability reporting ("Report a vulnerability" on the
Security tab).
Include the Outcome Check version, the command and a minimal **synthetic** export. Never include real exports, since
they contain names and logins. We aim to acknowledge within 5 business days.

## Security and privacy properties Outcome Check is designed to keep

- It never uses the network, needs no token, and has no telemetry. No model or paid API is used.
- It never executes anything: no child processes, `eval` or dynamic imports.
- It reads only the files you pass and writes only the report you request with `--output`.
- **No identities in output:** logins, names, emails, PR titles and commit messages never appear in any report format.
- The HTML report contains no JavaScript and declares a restrictive Content-Security-Policy.

A violation of any of these is a security bug. See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).
