# Deploying largen.dev to exe.dev

A runbook. **Executed against `largen.exe.xyz` on 2026-08-23**; §§1–5 and 7 are
verified on the box, §6 (the `largen.dev` domain) is not yet done.

Corrections made while running it are folded in below. Two are worth reading
before you deploy anywhere else, because neither is guessable:

- **The SSH target is `largen.exe.xyz`, not `largen`.** There is no bare alias.
- **An open GET SSE stream deadlocks the MCP client through the exe.dev proxy.**
  See "The proxy serialises a connection" below. This one cost the most time and
  produced no error message on either side.

## The finding that shapes this: exe.dev terminates TLS

Task 1.1 asked whether the VM terminates TLS itself, because the answer decides
whether a reverse proxy is needed at all. It does:

> exe.dev proxies traffic to `https://vmname.exe.xyz/` to your VM seamlessly,
> handling certificates, TLS termination, and optionally offering basic
> authentication.

**So do not install Caddy, nginx or Traefik.** A second proxy would terminate
TLS behind something that already did, add a hop, and give you two places to
misconfigure a redirect. The server listens on plain HTTP on a local port and
the platform does the rest.

The consequence for this repo: `site/server.mjs` binds `PORT` (default 8787) and
speaks HTTP. That is correct and finished — there is no TLS work to do in the
application.

## The trap: the front door is private by default

Access is private by default; a visitor is redirected to log in to exe.dev on
first visit. That is the opposite of what this service needs — the whole point of
the MCP endpoint is that an agent reaches it with no credentials, and the
agent-mcp spec says so explicitly.

If you skip `share set-public` in step 5, `claude mcp add` will fail against what
looks like a working deployment, because `/api/mcp` will answer with a login
redirect rather than a protocol response. Budget a minute to be confused by this
if you skip it.

Making it public is correct here and not a compromise: everything exposed is
public documentation or a pure function over input the caller supplied. There is
no private state on the box beyond rendered previews, which are already
addressed by unguessable ids.

---

## 1. Create the VM and confirm the runtime

```sh
ssh exe.dev new --name largen
ssh exe.dev ls                      # confirm it exists
```

SSH into it. Per the docs the syntax is `ssh [user@]vmname [command...]`, which
implies exe.dev installs a config alias:

```sh
ssh largen.exe.xyz 'node --version; systemctl --version | head -1; id'
```

**Use the full hostname.** `ssh largen` does not resolve — exe.dev installs no
bare alias. `ssh exe.dev ls` prints the real hostnames.

Observed on a fresh `boldsoftware/exeuntu` VM: Ubuntu 24.04.4 LTS, systemd 255,
passwordless sudo, user `exedev`, port 8787 free, `/srv` empty.

### 1.2 Node — and where systemd can actually see it

`@modelcontextprotocol/sdk@1.30.0` declares `engines: node >= 18`.

**Check for nvm before concluding node is absent.** A plain
`ssh host 'node --version'` runs non-interactively and does not source
`.bashrc`, so an nvm-installed node looks missing when it is not:

```sh
ssh largen.exe.xyz 'ls ~/.nvm/versions/node/ 2>/dev/null || echo "no nvm"'
```

**systemd does not source shells**, so an nvm node is unreachable from a unit
even when it works fine for you interactively. On this box node 24.19.0 was
under nvm, and three separate things had to be true for the service to start:

```sh
# 1. a stable path outside /home's shell setup
NVMBIN=/home/exedev/.nvm/versions/node/v24.19.0/bin
for b in node npm npx; do sudo ln -sfn "$NVMBIN/$b" "/usr/local/bin/$b"; done
```

2. `ProtectHome=read-only` in the unit, not `true` — `true` hides `/home`
   entirely and the symlink dangles.
3. `SupplementaryGroups=exedev`, because `/home/exedev` is `750` and the `largen`
   service user must traverse it. Group `r-x` is the narrowest thing that works;
   do not `chmod 755` a home directory to fix this.

The failure mode if you miss any of them is `status=203/EXEC`, which names none
of this.

**A system-wide node avoids all three.** If you install one, revert the unit to
`ProtectHome=true`, drop `SupplementaryGroups`, and point `ExecStart` at
`/usr/bin/node`. The unit comments say so too.

## 2. Deploying — the VM pulls, it is not pushed to

The VM is a clone of `origin/main` and deploys itself. Nothing is copied from a
developer machine, so there is no step at which the running site and the
repository can quietly disagree.

```sh
ssh largen.exe.xyz /usr/local/bin/largen-deploy          # deploy now
ssh largen.exe.xyz /usr/local/bin/largen-deploy --force  # redeploy the same commit
```

`largen-deploy.timer` runs the same script every five minutes and exits in about
0.3s when `origin/main` has not moved, so pushing to `main` is a deploy.

The script fetches, resets, installs, builds `dist/`, restarts, and polls
`/health`. **If the health check fails it returns to the previous commit,
reinstalls, rebuilds and restarts.** A deploy that leaves the site down is worse
than one that does not happen.

`dist/` is not committed — the VM builds it, and `prepack` builds it before
`npm publish`. `site/public/v/` *is* committed, because a versioned path
promises the same bytes forever and rebuilding those would defeat it.

Watch a deploy: `ssh largen.exe.xyz 'journalctl -u largen-deploy -n 40 --no-pager'`

### The old way, for reference

## 2b. Build the artifacts locally, then ship

The server serves `dist/` directly and returns 503 for the stylesheet if it is
missing, so build before you copy.

```sh
npx largen build          # dist/*.css
npx largen contract       # SKILL.md, llms.txt, llms-compact.txt, the contract pages
npx largen release        # freezes dist/ at site/public/v/<version>/
cd site && node test/run.mjs && cd ..    # 40 assertions, locally, before shipping
```

```sh
ssh largen.exe.xyz 'sudo mkdir -p /srv/largen && sudo chown -R $(id -un) /srv/largen'
rsync -a --delete --exclude node_modules --exclude .previews --exclude .git --exclude .claude \
      ./ largen.exe.xyz:/srv/largen/
ssh largen.exe.xyz 'cd /srv/largen/site && /usr/local/bin/npm ci --omit=dev'
```

`npm ci` needs `site/package-lock.json`. `site/` is an npm package for exactly
this reason — the box has npm, and a second lockfile that can disagree with the
first is the kind of drift this project is built to avoid.

## 3. Service account and ownership

The deploying user and the service user are different, so ownership has to let
one write and the other read. `chown -R largen:largen` locks `exedev` out of its
own deploy and the next `rsync` fails with `mkstemp ... Permission denied`.

```sh
ssh largen.exe.xyz 'set -e
  sudo useradd --system --home /srv/largen --shell /usr/sbin/nologin largen 2>/dev/null || true
  sudo usermod -aG exedev largen                  # traverse /home/exedev for node
  sudo chown -R exedev:largen /srv/largen         # exedev deploys, largen reads
  sudo chmod -R g+rX /srv/largen
  sudo mkdir -p /srv/largen/site/.previews
  sudo chown largen:largen /srv/largen/site/.previews
  sudo chmod 750 /srv/largen/site/.previews'      # the only writable path
```

## 4. Start it under systemd

The unit is `site/deploy/largen.service`. Two separate guarantees live in it, and
they cover two different failures: `Restart=always` covers a crash,
`WantedBy=multi-user.target` plus `enable` covers a reboot. Verify them
separately in §7 — one working does not imply the other.

Before installing, set the base URL for the stage you are at. `render_spec`
builds preview URLs from it, so a wrong value produces links that 404 for
whoever you send them to:

```sh
ssh largen.exe.xyz 'set -e
  sudo cp /srv/largen/site/deploy/largen.service /etc/systemd/system/
  sudo sed -i "s|LARGEN_BASE_URL=.*|LARGEN_BASE_URL=https://largen.exe.xyz|" /etc/systemd/system/largen.service
  sudo systemctl daemon-reload
  sudo systemctl enable --now largen
  sleep 2
  curl -s localhost:8787/health'
```

Expect JSON with `"ok": true` and the version. If not:
`ssh largen.exe.xyz 'journalctl -u largen -n 50 --no-pager'`.

## 5. Point the front door at 8787 and make it public

```sh
ssh exe.dev share port largen 8787
ssh exe.dev share set-public largen
```

`share port` sets the proxy target; without it the platform guesses from a
Dockerfile `EXPOSE` and will not find 8787. `set-public` is the step described
above — do not skip it.

```sh
ssh exe.dev share show largen              # `share ls` does not exist; `show` does
curl -s https://largen.exe.xyz/health
curl -sI http://largen.exe.xyz/ | head -1  # platform issues the 301 to https
```

While private, `/health` returns **401** and redirects to
`https://exe.dev/auth?redirect=...`. That is the symptom to recognise: an MCP
client gets an auth redirect where it expected a protocol response.

### The proxy serialises a connection — decline the GET stream

This is the one that will cost you an afternoon if you meet it cold.

MCP's Streamable HTTP transport optionally offers a server→client SSE stream on
`GET /api/mcp`. The SDK *client* opens one right after `initialize`. Through
exe.dev's front door, that open stream blocks every later request **on the same
connection** — so `tools/list` is never even sent, and nothing reaches the
server. Both sides sit there with no error.

`curl` does not reproduce it, because each `curl` gets its own connection;
`fetch`/undici reuses one. Reproduce it deliberately with:

```sh
node -e 'const U="https://largen.exe.xyz/api/mcp";const c=new AbortController();
fetch(U,{headers:{accept:"text/event-stream"},signal:c.signal});
setTimeout(()=>fetch(U,{method:"POST",headers:{"content-type":"application/json"},
 body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list",params:{}}),
 signal:AbortSignal.timeout(8000)}).then(r=>console.log("ok",r.status))
 .catch(e=>console.log("BLOCKED",e.name)).finally(()=>process.exit(0)),1500)'
```

`site/server.mjs` answers `GET /api/mcp` with **405**, which the MCP spec
explicitly permits when a server offers no server→client stream, and the
transport sets `enableJsonResponse: true` so POSTs return plain JSON rather than
a one-event SSE stream. Neither is a workaround: this server is stateless and
every tool returns a single complete result, so nothing was ever going to be
streamed or pushed. Do not "fix" this by re-enabling the stream.

At this point run the full suite against the real host:

```sh
cd site && LARGEN_BASE_URL=https://largen.exe.xyz node test/run.mjs
```

Forty assertions, over a real MCP handshake, against the deployed box. Do this
before touching DNS — debugging the service and debugging DNS at the same time
is two problems wearing one hat.

## 6. Attach largen.dev

Two steps, in this order. DNS first: the platform verifies resolution before it
will accept the hostname.

1. At your DNS provider, point `largen.dev` at `largen.exe.xyz` — ALIAS or
   CNAME-at-apex for the bare domain, CNAME for `www`. Wait for it to resolve:

   ```sh
   dig +short largen.dev
   ```

2. Register it:

   ```sh
   ssh exe.dev domain add largen largen.dev
   ssh exe.dev domain ls largen
   ```

An unregistered hostname gets `421 Misdirected Request`, which is a useful
signal: a 421 means DNS arrived but step 2 did not happen.

Then update the base URL to the real domain and restart:

```sh
ssh largen "sudo sed -i 's|LARGEN_BASE_URL=.*|LARGEN_BASE_URL=https://largen.dev|' \
            /etc/systemd/system/largen.service
            sudo systemctl daemon-reload && sudo systemctl restart largen"
```

## 7. Verify (tasks 6.3, 6.4, 7.1)

```sh
# 6.3 — HTTPS end to end, and the plaintext redirect
curl -sI http://largen.dev  | head -1        # expect 301/308 to https
curl -s  https://largen.dev/health

# 6.4a — survives a crash
# `systemctl kill -s SIGKILL` fails on this box with "Invalid argument";
# signal the main pid directly.
ssh largen.exe.xyz 'sudo kill -9 $(systemctl show -p MainPID --value largen)'
sleep 6 && curl -s https://largen.exe.xyz/health

# 6.4b — survives a reboot. A different guarantee; test it separately.
#
# Check the boot id actually changed. Polling /health straight after `reboot`
# will happily get a 200 from the process that has not gone down yet, which
# reads as a pass and proves nothing.
ssh largen.exe.xyz 'cat /proc/sys/kernel/random/boot_id'
ssh largen.exe.xyz 'sudo reboot'
sleep 45
ssh largen.exe.xyz 'cat /proc/sys/kernel/random/boot_id; uptime -s
                    journalctl -u largen -b --no-pager | head -3'   # -b = this boot

# 7.1 — the documented install command
claude mcp add largen --transport http https://largen.dev/api/mcp
```

Then the full suite and the screenshots against production:

```sh
LARGEN_BASE_URL=https://largen.dev node site/test/run.mjs
LARGEN_BASE_URL=https://largen.dev SHOTS=/tmp/prod-shots node site/test/shots.mjs
```

**Look at the screenshots.** A 200 is not evidence that anything rendered — this
library's own history is twelve static checks passing while six components were
visibly broken.

Finally, confirm the stylesheet the CDN serves is the one you built:

```sh
curl -s https://largen.dev/largen.css -o /tmp/prod.css && cmp /tmp/prod.css dist/largen.css
```

## 8. Releasing a new version

```sh
npx largen build
npx largen contract
npx largen release          # refuses to overwrite an existing version directory
rsync -a --delete --exclude node_modules --exclude .previews --exclude .git --exclude .claude \
      ./ largen.exe.xyz:/srv/largen/
ssh largen.exe.xyz 'cd /srv/largen/site && /usr/local/bin/npm ci --omit=dev
                    sudo systemctl restart largen'
```

That refusal is the mechanism behind "a published versioned path always returns
the same bytes". If a version needs different bytes, it needs a different version
number — the unversioned `/largen.css` is the path that moves.

**And the banner version does not identify the path that moves.** `/largen.css`
is a live read of `dist/`, changing on every deploy that changes the build while
still printing whatever `package.json` says. `/largen.css` and
`/v/<same-version>/largen.css` can — and currently do — differ.

What identifies a build:

```sh
curl -s  https://largen.exe.xyz/build.json     # sha256 + SRI for every file
curl -sI https://largen.exe.xyz/largen.css     # ETag, without downloading
curl -s  https://largen.exe.xyz/health         # version, build id, what is served
```

`build.json` travels into each new frozen path, so `/v/<version>/build.json`
states that release's own hashes. `/v/0.1.0/` and `/v/0.2.0/` predate it and are
left alone — adding a file to a frozen release is what the guard exists to stop.

## Rollback

```sh
ssh exe.dev share set-private largen     # fastest — pulls it off the internet
ssh largen.exe.xyz 'sudo systemctl stop largen'  # or stop the service
```

The library is unaffected by any of this and keeps working from a local file or
from npm. There are no consumers to migrate and no data to preserve beyond
rendered previews, which expire in 24 hours by design.

## Sources

Platform behaviour was taken from exe.dev's documentation —
<https://exe.dev/docs/all>, <https://exe.dev/docs/cli-ssh>, <https://exe.dev/vps>
— and then corrected against the box. Where this file and the documentation
disagree, this file was observed.
