---
name: adr-maintainer
description: Create or update architecture decision records for this repository while preserving append-only ADR history.
---

Use this skill when creating a new ADR or changing an architectural decision.

Workflow:

1. Read `docs/adr/README.md`.
2. Read relevant existing ADRs before proposing a new decision.
3. Preserve append-only history:
   - Do not delete accepted decision text.
   - Do not rewrite past rationale to match a new decision.
   - If a decision changes, create a new ADR and append a supersession note to the old ADR.
4. Use the existing template and filename style:
   - `docs/adr/0002-short-title.md`
   - Status: `Proposed`, `Accepted`, `Rejected`, `Deprecated`, or `Superseded`.
5. Keep the decision focused on one major architectural choice.
6. Cross-reference implementation docs when useful, but make the ADR stand alone.

Before finishing, verify that numbering is sequential and that any replaced ADR has a dated note in its `追記` section.
