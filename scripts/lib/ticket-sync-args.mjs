/**
 * scripts/lib/ticket-sync-args.mjs — pure CLI flag-parsing helpers for scripts/ticket-sync.mjs
 * (CAM-279 / T-3). Extracted into its own module for the same reason as
 * scripts/lib/ticket-sync-mapping.mjs: vitest can unit-test the parser directly without
 * importing the whole CLI (which does top-level env/network work on import). No I/O, no
 * process.exit — an unknown/incomplete flag throws a plain Error the caller decides how to
 * report (the CLI turns it into a `usage: ...` message + exit 1).
 */

function valueOf(args, i, flag) {
  if (i + 1 >= args.length) throw new Error(`${flag} requires a value`);
  return args[i + 1];
}

/** `set <id> [--state S] [--add-label L]* [--remove-label L]* [--note N] [--actor A]` */
export function parseSetFlags(args) {
  const f = { add: [], remove: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--state") { f.state = valueOf(args, i, a); i++; }
    else if (a === "--add-label" || a === "--add") { f.add.push(valueOf(args, i, a)); i++; }
    else if (a === "--remove-label" || a === "--remove") { f.remove.push(valueOf(args, i, a)); i++; }
    else if (a === "--note") { f.note = valueOf(args, i, a); i++; }
    else if (a === "--actor") { f.actor = valueOf(args, i, a); i++; }
    else throw new Error(`unknown flag "${a}"`);
  }
  return f;
}

/** `handoff <id> --role R [--state S] [--note N] [--actor A]` */
export function parseHandoffFlags(args) {
  const f = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--role") { f.role = valueOf(args, i, a); i++; }
    else if (a === "--state") { f.state = valueOf(args, i, a); i++; }
    else if (a === "--note") { f.note = valueOf(args, i, a); i++; }
    else if (a === "--actor") { f.actor = valueOf(args, i, a); i++; }
    else throw new Error(`unknown flag "${a}"`);
  }
  return f;
}

/**
 * `create --type T --title T [--epic E] [--role R] [--persona P] [--feature F]
 *         [--priority N] [--description-file F | --description "..."] [--actor A]`
 */
export function parseCreateFlags(args) {
  const f = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--type") { f.type = valueOf(args, i, a); i++; }
    else if (a === "--title") { f.title = valueOf(args, i, a); i++; }
    else if (a === "--epic") { f.epic = valueOf(args, i, a); i++; }
    else if (a === "--role") { f.role = valueOf(args, i, a); i++; }
    else if (a === "--persona") { f.persona = valueOf(args, i, a); i++; }
    else if (a === "--feature") { f.feature = valueOf(args, i, a); i++; }
    else if (a === "--priority") { f.priority = valueOf(args, i, a); i++; }
    else if (a === "--description-file") { f.descriptionFile = valueOf(args, i, a); i++; }
    else if (a === "--description") { f.description = valueOf(args, i, a); i++; }
    else if (a === "--actor") { f.actor = valueOf(args, i, a); i++; }
    else throw new Error(`unknown flag "${a}"`);
  }
  return f;
}

/** `comment <id> --body "..." [--body-file F] [--actor A]` */
export function parseCommentFlags(args) {
  const f = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--body") { f.body = valueOf(args, i, a); i++; }
    else if (a === "--body-file") { f.bodyFile = valueOf(args, i, a); i++; }
    else if (a === "--actor") { f.actor = valueOf(args, i, a); i++; }
    else throw new Error(`unknown flag "${a}"`);
  }
  return f;
}

/** `release <id> [--actor A]` — the only flag a single-verb command like `release` needs. */
export function parseActorFlag(args) {
  const f = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--actor") { f.actor = valueOf(args, i, a); i++; }
    else throw new Error(`unknown flag "${a}"`);
  }
  return f;
}
