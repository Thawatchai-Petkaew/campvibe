#!/usr/bin/env bash
# Vercel Ignored Build Step (wired via vercel.json "ignoreCommand").
#
# Skips the build when the diff since the last successfully deployed SHA of
# this branch touches only docs/ or markdown files. Exit 0 = skip the build,
# exit 1 = build (Vercel's documented semantics).
#
# HONESTY NOTE (Vercel docs, project-settings "Ignored Build Step"): a build
# skipped here is still COUNTED AS A FULL DEPLOYMENT toward the Hobby
# 100/day rolling quota - this script saves build minutes and the single
# concurrent build slot, NOT quota. Quota relief comes entirely from
# git.deploymentEnabled in vercel.json, which stops non-staging/main
# branches from creating deployments at all.
set -euo pipefail

# VERCEL_GIT_PREVIOUS_SHA is only exposed when an ignore step is configured
# and only when a previous successful deployment exists for this branch.
# No baseline to diff against -> always build.
if [ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" ]; then
  exit 1
fi

# The previous SHA may not be present in the shallow clone; treat any git
# failure as "cannot prove docs-only" and build.
if ! git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  exit 1
fi

if git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ':!docs' ':!**/*.md'; then
  exit 0
fi

exit 1
