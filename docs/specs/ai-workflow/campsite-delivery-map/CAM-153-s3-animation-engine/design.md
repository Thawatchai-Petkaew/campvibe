# S3 — Design

Internal ops dashboard — exempt from public OKLCH tokens (same as `/status`). No new user-facing copy.

## Motion design (hybrid — owner's G1 choice)
- **Ambient (always):** gentle in-place idle-sway/breathe so the camp feels alive. The only non-data-driven motion; killed first under reduced-motion.
- **Meaningful (on real change):** a character walks between stations only when its state actually changes. In S3 the lone real change is the **entrance** (agents appear → walk to their home station → settle). S6 extends this to live data changes via `triggerWalk`.
- **No random wander** — a strolling idle agent would read as "busy" when it isn't (a lie about state). Cut by design.
- **Reduced-motion fallback:** the entire scene freezes to the S2 static map (every signal still readable as position + color + badge). Honors `prefers-reduced-motion`.

Motion uses `transform`/`opacity` only, per `DESIGN.md` motion rules.
