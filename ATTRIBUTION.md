# Attribution and provenance

## Publisher

- **Project:** Outcome Check (`@enwithai/outcome-check`), formerly developed under the working name AgentScore.
- **Commons:** EnWithAI Engineering Commons. Philosophy: _measure engineering outcomes rather than merely counting AI activity or generated code._
- **Copyright holder:** EnWithAI Technologies (as stated in [LICENSE](LICENSE)).
- **License:** MIT. It applies to all code, documentation, schemas and examples in this repository.
- **Maintainers:** EnWithAI Technologies. Individual maintainers will be listed at publication.
- **Security issues:** see [SECURITY.md](SECURITY.md).

## Development provenance

Outcome Check was written for this repository. Outcome Check has **no runtime dependencies**. It was developed with substantial AI assistance (Claude Code).
Commits carry a `Co-Authored-By` trailer, and changes were directed and accepted by the project's human sponsor. Test
fixtures and demo data are synthetic. See [NOTICE.md](NOTICE.md) for third-party material.

## Built on

| Upstream                                        | Version                            | License | How Outcome Check uses it                                                                                            |
| ----------------------------------------------- | ---------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| [Node.js](https://nodejs.org)                   | 22 / 24 / ≥ 26                     | MIT     | Runtime only                                                                                                         |
| [GitHub CLI](https://github.com/cli/cli) (`gh`) | `581392e` (source read 2026-10-09) | MIT     | Input format: users export data with `gh pr list --json` / `gh run list --json`. Outcome Check never runs gh itself. |

Development tools (Vitest, ESLint, typescript-eslint, Prettier, Ajv, TypeScript) are not distributed. Research and
design influences are in [REFERENCES.md](REFERENCES.md). Listing a project does not mean its maintainers endorse
Outcome Check.

## Frameworks

| Framework | Owner                  | Relationship   | Note                                                                                                                                                                          |
| --------- | ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLEAR     | NetworkGain Consulting | `none`         | No structured-reasoning methodology is used.                                                                                                                                  |
| TRACE     | EnWithAI Technologies  | `not-assessed` | Each metric traces to exported PR/CI records (`--audit` lists the PR numbers behind every value). Alignment with TRACE cannot be stated until its specification is published. |

## Ecosystem

Outcome Check is independently usable. It has no dependency on CrewPE, any EnWithAI service or NetworkGain, and it never
uses the network. CrewPE is EnWithAI's enterprise engineering-lifecycle product and could consume Outcome Check's JSON report within its outcome-management and governance views; no such integration
exists today. NetworkGain Consulting offers advisory and transformation services, and using Outcome Check creates no
obligation to engage them.

## Not affiliated

Outcome Check is not affiliated with, endorsed by or certified by GitHub, the OpenTelemetry project, the DORA research program, Anthropic or Google.
