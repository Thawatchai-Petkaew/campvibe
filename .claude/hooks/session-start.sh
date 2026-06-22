#!/usr/bin/env bash
# SessionStart hook — remind the agent to read its memory before working
# (reinforces CLAUDE.md Iron Rule #4). Output is injected as session context.
cat <<'MSG'
CampVibe — read your memory before working (Iron Rule #4):
- Your standard: .claude/rules/<role>.md (code · api · architecture · qa · security · discovery · ops · observability · performance · seo · ux)
- UI work: DESIGN.md (tokens · states · a11y · design gate)
- Iron rules + gates G1–G5: CLAUDE.md
- Context for decisions: docs/project/* (business/strategy) + docs/context/* (stable principles / Second Brain)
MSG
exit 0
