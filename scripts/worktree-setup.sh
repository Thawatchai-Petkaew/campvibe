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

if [ -d node_modules ] && [ ! -L node_modules ] && [ -d node_modules/@prisma ] && [ ! -L node_modules/@prisma ]; then
  echo "worktree-setup.sh: node_modules already isolated here (real node_modules + real @prisma) — leaving the links as-is." >&2
else
  [ -L node_modules ] && rm node_modules
  mkdir -p node_modules

  shopt -s dotglob nullglob
  linked=0
  for entry in "$MAIN_TREE"/node_modules/*; do
    name="$(basename "$entry")"
    [ "$name" = ".prisma" ] && continue
    [ "$name" = "@prisma" ] && continue
    rm -rf "node_modules/$name"
    ln -s "$entry" "node_modules/$name"
    linked=$((linked + 1))
  done

  # @prisma is where it gets subtle: `prisma generate` places its output at
  # `.prisma/client`, a SIBLING of wherever `@prisma/client`'s package.json
  # resolves to (realpath). If `@prisma` itself is one symlink to the main
  # tree, that sibling `.prisma` is the MAIN TREE's — not this worktree's.
  rm -rf node_modules/@prisma
  mkdir -p node_modules/@prisma
  scoped_linked=0
  for entry in "$MAIN_TREE"/node_modules/@prisma/*; do
    name="$(basename "$entry")"
    [ "$name" = "client" ] && continue
    ln -s "$entry" "node_modules/@prisma/$name"
    scoped_linked=$((scoped_linked + 1))
  done
  # @prisma/client itself: a real, local copy (small, ~180KB, never touched by
  # generate — only .prisma/client is) so its realpath — and therefore the
  # sibling .prisma/client `generate` writes to — stays inside THIS worktree.
  cp -R "$MAIN_TREE/node_modules/@prisma/client" node_modules/@prisma/client
  shopt -u dotglob nullglob

  echo "worktree-setup.sh: linked $linked top-level + $scoped_linked @prisma/* entries from $MAIN_TREE; copied @prisma/client locally (isolated: .prisma, @prisma/client)."
fi

mkdir -p node_modules/.prisma

echo "worktree-setup.sh: generating this worktree's own Prisma client(s) from ITS OWN schema..."
npx prisma generate
if [ -f prisma/delivery/schema.prisma ]; then
  npm run delivery:generate
fi

echo "worktree-setup.sh: done. node_modules/.prisma/client (+ prisma/delivery/generated) now match this worktree's own schema and cannot be clobbered by another worktree's generate."
