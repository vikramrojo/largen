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
# script can change it underneath the interpreter mid-execution.
#
# The installed copy is refreshed BEFORE the deploy runs, then re-executed.
# Refreshing it afterwards — the obvious order — cannot work: a commit that
# changes what the deploy must do can only land if the old script can already do
# it. Removing the root `npm ci` was exactly that, and the old copy failed on the
# very commit that deleted the lockfile it was installing from, rolled back, and
# would have done so forever.
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

# Adopt the incoming deploy script before acting on the commit that carries it.
# The guard stops a re-exec loop if the installed copy somehow never matches.
if [ "${LARGEN_DEPLOY_REEXEC:-}" != "1" ]; then
  INCOMING=$(mktemp)
  if git show "$TARGET:site/deploy/deploy.sh" > "$INCOMING" 2>/dev/null &&
     ! cmp -s "$INCOMING" /usr/local/bin/largen-deploy; then
    log "deploy script changed in the incoming commit — adopting it and re-running"
    sudo install -m 0755 "$INCOMING" /usr/local/bin/largen-deploy
    rm -f "$INCOMING"
    LARGEN_DEPLOY_REEXEC=1 exec /usr/local/bin/largen-deploy "$@"
  fi
  rm -f "$INCOMING"
fi

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
    exit 0
  fi
  sleep 1
done

roll_back
