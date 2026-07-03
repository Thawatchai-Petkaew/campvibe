---
description: Summarize the status of all work + items awaiting humans
---
Read the self-hosted delivery ticket DB (`node scripts/ticket-sync.mjs list` / the `/status` dashboard): show tickets by state (kanban), who is doing what, % progress, and the list of tickets `AWAITING_GATE` (work awaiting your approval — run `node scripts/ticket-sync.mjs gates`) along with their gate
