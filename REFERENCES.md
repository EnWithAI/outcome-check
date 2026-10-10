# References

Sources that shaped Outcome Check. Dependencies and formats we _use_ are in [ATTRIBUTION.md](ATTRIBUTION.md); this file
lists _ideas and specifications_. Listing a source does not imply its authors endorse Outcome Check or are affiliated
with it. No text, diagrams or tables are reproduced.

## Research and practice

### The New SDLC With Vibe Coding: From ad-hoc prompting to Agentic Engineering

- **Authors / publisher:** Addy Osmani, Shubham Saboo, Sokratis Kartakis; Google (course material for Google's
  AI Agents Intensive on Kaggle).
- **Date:** 2026. The exact month is unconfirmed: secondary sources say May or June 2026.
- **Verification:** **the original document was not retrieved**; title, authors and context are corroborated only by
  secondary commentary.
- **What we took from it, via EnWithAI's internal SDLC addendum:** specification, context and verification as the scarce
  resources in AI-assisted development.
- **Our interpretation (EnWithAI's own proposals, not Google's):** outcome metrics with stated denominators, windows and sample sizes, AI attribution unknown by default, and no causal claims.
- No quantitative claims from the paper or its commentary are used.

## Specifications and upstream projects

| Project                                                                                                  | Version / commit       | License    | What we used                                                                                                                    |
| -------------------------------------------------------------------------------------------------------- | ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [GitHub CLI](https://github.com/cli/cli)                                                                 | `581392e`              | MIT        | JSON export field names, bot serialization, 100-item caps, default limits (read from source)                                    |
| [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai) | `06ec68e` (2026-10-07) | Apache-2.0 | Reviewed for future AI-usage ingestion. All relevant `gen_ai.*` attributes are Development stability, so **not used in alpha**. |
| [JSON Schema](https://json-schema.org)                                                                   | draft 2020-12          | —          | Report schema                                                                                                                   |

## Surveyed, not used

| Project                                                                    | Why it was reviewed                                                                                             |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [promptfoo](https://github.com/promptfoo/promptfoo) 0.124.1 (MIT)          | Overlap check: an LLM evaluation tool, not delivery-outcome metrics                                             |
| [Apache DevLake](https://github.com/apache/incubator-devlake) (Apache-2.0) | Overlap check: a hosted engineering-metrics platform; Outcome Check stays local-first with transparent formulas |
