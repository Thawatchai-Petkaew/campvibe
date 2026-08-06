#!/bin/bash
# CAM-579: give every agent worktree an ISOLATED Prisma client while still sharing
# the bulk of node_modules by symlink (the cheap part of today's pattern).
#
# Root cause this replaces: the old instruction was `ln -s <main tree>/node_modules
# node_modules` — ONE symlink for the whole directory. That also means every
# worktree points at the SAME node_modules/.prisma/client folder: the one place
# `prisma generate` writes to. Two agents in two worktrees, one touching
# prisma/schema.prisma, take turns clobbering that single shared folder — the
# victim sees a confusing 500 / a wall of typecheck errors in code it never
# touched (reproduced + written up in
# docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-579-worktree-isolation/story.md).
#
# Fix: symlink every top-level node_modules entry from the main tree EXCEPT the
# two that decide where `prisma generate` writes: `.prisma` and `@prisma`.
# `prisma generate` (no custom `output` in schema.prisma) places its output at
# `.prisma/client` as a SIBLING of wherever `@prisma/client`'s package.json
# resolves to (real path, following symlinks) — so `@prisma` cannot be a single
# symlink back to the main tree, or that's exactly where the write lands (this
# was caught live: an early version of this script did exactly that and wrote
# into the MAIN TREE's node_modules, discovered before the fix was shipped).
#
# So: `@prisma` becomes a real, local directory too. Everything under it EXCEPT
# `client` (engines, debug, engines-version, fetch-engine, get-platform — never
# a generate target, just read as dependencies) is still symlinked to the main
# tree. `@prisma/client` itself is a real, cheap (~180KB) copy, so its OWN
# realpath is local, which is what makes the sibling `.prisma/client` land
# locally too. Cost: ~1s to link + copy, then two `prisma generate` calls (a
# few seconds each, no network — the query-engine binary is already cached from
# npm install) — nowhere near a full `npm ci`.
#
# CAM-690 (2026-08-06): the `@prisma` carve-out above was applied to exactly 1
# of 55 scope directories. Every OTHER scope (@babel, @radix-ui, @types, ...)
# was still a single top-level symlink for the whole namespace — and a scoped
# package's node path is `node_modules/@scope/pkg`, which TRAVERSES that
# symlink. npm's reify "retire" step then lands on the REAL directory inside
# the MAIN tree, not the link (measured: `npm update` inside a faithful
# worktree renamed the MAIN tree's real `@isaacs/cliui` to a `.cliui-XXXX`
# backup and left `require.resolve('@isaacs/cliui')` failing from the main
# tree). `.bin` has the identical shape one level down (a new bin entry is
# WRITTEN into whatever `.bin` resolves to). This is the exact mechanism that
# emptied ~150 real packages in the owner's live dev tree (CAM-687).
#
# Fix (generalized from the @prisma shape above): EVERY `@scope` directory,
# and `.bin`, become real local directories too, each with a symlink PER
# CHILD PACKAGE (one level deeper) instead of one symlink for the whole
# namespace. A top-level FILE (`.package-lock.json`) is copied, not
# symlinked, closing the same doubt for the one file npm rewrites in place.
# Plain unscoped packages (~600 of them) stay single top-level symlinks —
# proven safe (tech.md): the symlink itself IS the node path there, so
# retire renames the *link*, never the main tree's real directory. Measured
# after this fix: `npm update` + `npm install <pkg-with-a-bin>` inside the
# worktree left the main tree's file count and `@isaacs/cliui` byte-for-byte
# unchanged (docs/specs/ai-workflow/agent-safety/CAM-690-worktree-install-guard/).
# See that story's tech.md for the full measured root cause and the
# mechanisms that were tried and rejected (do not re-derive them).
#
# Usage: run from inside the agent worktree (NOT the main tree):
#   bash scripts/worktree-setup.sh

set -euo pipefail

HERE="$(pwd)"
MAIN_TREE="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"

if [ "$MAIN_TREE" = "$HERE" ]; then
  echo "worktree-setup.sh: refusing to run in the main tree ($MAIN_TREE)." >&2
  echo "This script is for an agent worktree only — the main tree already has its own node_modules." >&2
  exit 1
fi

if [ ! -d "$MAIN_TREE/node_modules" ]; then
  echo "worktree-setup.sh: no node_modules at $MAIN_TREE — run npm ci there first." >&2
  exit 1
fi

if [ ! -d "$MAIN_TREE/node_modules/@prisma/client" ]; then
  echo "worktree-setup.sh: no node_modules/@prisma/client at $MAIN_TREE — run npm ci there first." >&2
  exit 1
fi

if [ -d node_modules ] && [ ! -L node_modules ] \
   && [ -d node_modules/@prisma ] && [ ! -L node_modules/@prisma ] \
   && [ -d node_modules/.bin ] && [ ! -L node_modules/.bin ]; then
  echo "worktree-setup.sh: node_modules already isolated here (real node_modules + real @prisma + real .bin) — leaving the links as-is." >&2
else
  [ -L node_modules ] && rm node_modules
  mkdir -p node_modules

  shopt -s dotglob nullglob

  # Pass 1: every top-level entry EXCEPT `.prisma` (prisma generate's own
  # output, left alone below), a `@scope` namespace dir, or `.bin` (both
  # handled in their own real-dir passes next, per the CAM-690 header
  # comment). A plain top-level FILE (`.package-lock.json`) is copied, not
  # symlinked — cheap, and it removes any doubt about npm rewriting it in
  # place through a symlink. Everything else (~600 unscoped packages) stays
  # a single top-level symlink: proven safe, the symlink itself IS the node
  # path npm's reify "retire" step renames.
  linked=0
  copied_files=0
  for entry in "$MAIN_TREE"/node_modules/*; do
    name="$(basename "$entry")"
    [ "$name" = ".prisma" ] && continue
    [[ "$name" == @* ]] && continue
    [ "$name" = ".bin" ] && continue
    rm -rf "node_modules/$name"
    if [ -f "$entry" ] && [ ! -L "$entry" ]; then
      cp "$entry" "node_modules/$name"
      copied_files=$((copied_files + 1))
    else
      ln -s "$entry" "node_modules/$name"
      linked=$((linked + 1))
    fi
  done

  # Pass 2: every `@scope` namespace directory (not just @prisma) becomes a
  # real local directory, with ONE symlink PER CHILD PACKAGE (one level
  # deeper than before). A scoped package's node path is
  # node_modules/@scope/pkg, which traverses @scope — a single symlink for
  # the whole namespace let npm's retire/extract land on the REAL directory
  # inside the main tree (the CAM-687 write-through). @prisma/client keeps
  # its own real, local copy: `prisma generate` places its output at
  # `.prisma/client`, a SIBLING of wherever @prisma/client's package.json
  # resolves to (realpath), so that one child can never be a symlink either.
  scoped_linked=0
  for scope_entry in "$MAIN_TREE"/node_modules/@*; do
    scope_name="$(basename "$scope_entry")"
    rm -rf "node_modules/$scope_name"
    mkdir -p "node_modules/$scope_name"
    for child in "$scope_entry"/*; do
      child_name="$(basename "$child")"
      if [ "$scope_name" = "@prisma" ] && [ "$child_name" = "client" ]; then
        cp -R "$child" "node_modules/@prisma/client"
      else
        ln -s "$child" "node_modules/$scope_name/$child_name"
      fi
      scoped_linked=$((scoped_linked + 1))
    done
  done

  # Pass 3: `.bin` is the same shape of bug one level down — a single `.bin`
  # symlink means a NEW bin entry (npm adding a package that ships one)
  # WRITES straight into whatever `.bin` resolves to. Real local `.bin` +
  # one relink per existing entry keeps any future add local to this
  # worktree.
  bin_linked=0
  rm -rf node_modules/.bin
  mkdir -p node_modules/.bin
  if [ -d "$MAIN_TREE/node_modules/.bin" ]; then
    for entry in "$MAIN_TREE"/node_modules/.bin/*; do
      name="$(basename "$entry")"
      ln -s "$entry" "node_modules/.bin/$name"
      bin_linked=$((bin_linked + 1))
    done
  fi
  shopt -u dotglob nullglob

  echo "worktree-setup.sh: linked $linked top-level + $scoped_linked @scope/* + $bin_linked .bin/* entries from $MAIN_TREE; copied $copied_files top-level file(s) + @prisma/client locally (write-isolated: node_modules/@*, node_modules/.bin, .prisma, @prisma/client)."
fi

mkdir -p node_modules/.prisma

echo "worktree-setup.sh: generating this worktree's own Prisma client(s) from ITS OWN schema..."
npx prisma generate
if [ -f prisma/delivery/schema.prisma ]; then
  npm run delivery:generate
fi

echo "worktree-setup.sh: done. node_modules/.prisma/client (+ prisma/delivery/generated) now match this worktree's own schema and cannot be clobbered by another worktree's generate."
