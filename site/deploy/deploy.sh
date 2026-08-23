#!/usr/bin/env bash
# largen.dev — pull, build, restart.
#
# Replaces an rsync from a developer's laptop. What is deployed is now exactly
# what is on origin/main, which is the point: there is no step where the running
# site and the repository can quietly disagree.
#
# Safe to run when nothing has changed — it exits early. That is what lets the
# timer call it on a schedule and lets you call it by hand for the same effect.
#
# On failure it returns to the commit that was running before. A deploy that
# leaves the site down is worse than one that does not happen.
#
# This file is the source of truth, but it is NOT what runs. It is installed to
# /usr/local/bin/largen-deploy and run from there, because bash reads a script
# lazily by byte offset: `git reset --hard` on the tree containing the running
# script can change it underneath the interpreter mid-execution. The last step
# refreshes the installed copy when this one has changed, so updates still
# propagate — just not into the process already using it.
set -euo pipefail

REPO=/srv/largen
BRANCH=main
HEALTH=http://127.0.0.1:8787/health
export PATH=/usr/local/bin:$PATH

cd "$REPO"
log() { printf '  %s\n' "$*"; }

BEFORE=$(git rev-parse HEAD)

git fetch -q origin "$BRANCH"
TARGET=$(git rev-parse "origin/$BRANCH")

if [ "$BEFORE" = "$TARGET" ] && [ "${1:-}" != "--force" ]; then
  log "already at $(git rev-parse --short HEAD) — nothing to do"
  exit 0
fi

log "deploying $(git rev-parse --short "$BEFORE") -> $(git rev-parse --short "$TARGET")"
git --no-pager log --oneline "$BEFORE..$TARGET" 2>/dev/null | sed 's/^/    /' || true

roll_back() {
  log "FAILED — rolling back to $(git rev-parse --short "$BEFORE")"
  git reset -q --hard "$BEFORE"
  npm --prefix "$REPO/site" ci --omit=dev --silent || true
  node "$REPO/skill/scripts/cli.mjs" build >/dev/null 2>&1 || true
  sudo systemctl restart largen || true
  exit 1
}
trap roll_back ERR

git reset -q --hard "$TARGET"

# Only site/ has dependencies — the MCP SDK. The build needs nothing installed:
# the bundler is part of the library.
log "installing dependencies"
npm --prefix "$REPO/site" ci --omit=dev --silent

# dist/ is gitignored, so it must be produced here or the server has no
# stylesheet to stream.
log "building dist/"
node "$REPO/skill/scripts/cli.mjs" build | sed -n 's/^  \([a-z].*css\)/    \1/p'

sudo systemctl restart largen
sleep 2

# A restart that returns and a service that works are different claims.
for i in $(seq 1 10); do
  if curl -fsS --max-time 3 "$HEALTH" >/dev/null 2>&1; then
    trap - ERR
    VERSION=$(curl -fsS "$HEALTH" | sed -n 's/.*"version": "\([^"]*\)".*/\1/p')
    log "healthy — version ${VERSION:-?} at $(git rev-parse --short HEAD)"
    # Propagate a changed deploy script to the copy that runs next time.
    if ! cmp -s "$REPO/site/deploy/deploy.sh" /usr/local/bin/largen-deploy; then
      sudo install -m 0755 "$REPO/site/deploy/deploy.sh" /usr/local/bin/largen-deploy
      log "deploy script updated for next run"
    fi
    exit 0
  fi
  sleep 1
done

roll_back
