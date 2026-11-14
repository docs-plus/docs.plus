# Link-scraper tolerance bench

This bench measures how much load the link-metadata routes take, and what fails first. It is not a test. It sends no traffic off the machine.

The results of the 2026-11-14 runs are in the module [BENCHMARK.md](../../src/modules/link-metadata/BENCHMARK.md#load-tolerance-2026-11-14).

## Files

- `shim.ts`: the preload for the REST process. It rewrites every fetch to `203.0.113.0/24` (TEST-NET-3, port 80) onto the fake origin. It blocks and counts every other fetch, every fetch that does not ask for `redirect: 'manual'`, and every fetch that sets Bun's `proxy` or `unix` option. With `BENCH_CONN=fresh` it sends `keepalive: false`, so each fetch opens a new connection. It keeps every listener on 127.0.0.1. A side port (4622) reports the counters, fetch error codes, the event-loop lag and stalls, and the CPU. Its `/connect-probe` dials only 127.0.0.1, and only the runner's canary port or 4622.
- `origin.ts`: the fake origin on 4621. The path picks the behaviour: `page`, `hang`, `trickle`, `huge/head`, `huge/body`, `hostile/<vector>`, `jobs` (a 1 MiB body with the JobPosting past the 256 KiB cut), `status/<code>`, `redirect`, `imgpage`, `img`, `favicon.ico`. `GET /__stats` counts hits, and `GET /__live` gives the cheap counters.
- `driver.ts`: the load driver. It has an open loop (fixed arrival rate), a closed loop and a burst mode. Lanes take turns by weight (smooth weighted round robin), and every random choice is seeded. Each lane may name the full answer it expects (status, bytes, no fallback card); anything else that comes back is `degraded`. A status the lane lists in `designedStatus` (the `limiter-one-ip` 429) is a designed answer, never degraded.
- `run.ts`: the runner. One command runs one scenario session end to end.
- `analysis.ts`: the knee, resource, void and A/A rules, and the series fits (CPU per answer, RSS per unit of work in use).
- `replay.ts`: applies those rules again to saved JSON lines. It groups sessions by the full fact set and refuses to compare across groups. `--pool` rebuilds per-lane quantiles from `requests.csv.gz` across the sessions of a group.
- `fence-cost.ts`: the fence cost on loopback only. A client runs fenced and unfenced against a toy server on `127.0.0.1:0`, in ABAB order.
- `layer2.ts`: the link-metadata router alone, with the link buckets of the limiter. `module` calls the real `init()`. `baseline` mirrors it and adds a parse timer. `coalesce` is an example option.

## Run

Run every command from `apps/hocuspocus.server`. Each session takes less than 8 minutes. Never start the runner under GNU `timeout`: under it, `netstat` prints nothing, so the TIME_WAIT read is void (the runner has its own deadlines).

```bash
bun scripts/bench-link-tolerance/run.ts <scenario> [--smoke]
bun scripts/bench-link-tolerance/run.ts <scenario> --dry-run   # prints the plan and its worst case
bun scripts/bench-link-tolerance/replay.ts [--pool] <out>/<scenario>.jsonl
bun scripts/bench-link-tolerance/fence-cost.ts 4 <out.json>
```

The scenarios are `step0`, `lag-probe`, `ceiling-health`, `hit`, `miss-fast`, `miss-real`, `hang`, `huge`, `hostile`, `image`, `icon`, `herd`, `redis-stall`, `limiter` and `aa`.

Options:

- `--smoke`: short steps at low rates. Results go to `raw/smoke/`.
- `--rates=a,b,c`: replaces the step rates (or the burst sizes for `herd`).
- `--concurrency=1,4,16`: turns the first step into a closed-loop concurrency ramp.
- `--step=S` and `--warmup=S`: seconds per step and warm-up. Without `--step`, a full step lasts long enough for 2,000 requests, up to 30 s.
- `--ip=pool|none|many`: the address mode of the ramps. The default `pool` sends 64 addresses, as Traefik would.
- `--order=reverse`: runs each ramp from its highest rate down.
- `--redis=docker|native`: `docker` (the default) runs the `linkbench-redis` container. `native` runs `redis-server` as a child on 127.0.0.1:6391. Use it only when Docker is down, and never compare numbers across backends.
- `--conn=pooled|fresh`: `fresh` makes REST open one new connection per fetch. On one loopback destination the ephemeral ports (49152-65535) and a 30 s TIME_WAIT cap it near 546 per second; a step that meets `EADDRNOTAVAIL` is void. Every miss number names its transport, for example `pooled loopback, no DNS, no TLS`.
- `--no-fence` is refused. Unfenced, a shim bypass reached a real peer on the LAN (review, 2026-11-14). Use `fence-cost.ts`.
- `--layer=2 --variant=module|baseline|coalesce`: runs `layer2.ts` in place of `src/index.ts`.
- `--rate-limit-max=N`: the REST `RATE_LIMIT_MAX`. By default the runner computes it from the plan, so that no ramp meets a 429.
- `--out=<dir>`: the results folder.
- `--keep-redis`: leaves the Redis container running. It is refused with `--redis=native`.
- `--force-long`: runs a plan whose worst case is over 450 s.

## Safety

- One runner at a time: the runner takes `raw/.bench.lock` (an exclusive create) before any other check. A second runner refuses, and it touches nothing. A lock whose pid is dead is stale: the next runner kills that run's leftover children and removes its container, then takes the lock.
- The lock file is written whole, then linked into place, so no reader sees an empty lock.
- The runner removes only what it started. The container carries the label `linkbench.owner=<session>`. It adopts an existing container only when that label names a bench session, and it removes the container only while the label still equals the one it started or adopted. `docker run` uses `--pull=never`. Every Docker call has a 15 s deadline, so a hung daemon aborts the run instead of wedging it. The Docker path has not run end to end yet: every macOS session on 2026-11-13 and 2026-11-14 used `--redis=native`.
- SIGINT, SIGTERM and SIGHUP tear down. The children (origin, REST, driver) also exit within a second when their parent pid is no longer the runner, so a SIGKILL leaves no Bun process. A native `redis-server` survives a SIGKILL until the next runner clears the stale lock.
- REST always runs under `sandbox-exec`. Outbound connects go only to 127.0.0.1:4621 (origin), :6391 (bench Redis) and :4622 (its own side port, for the foreign-peer control). The mDNSResponder socket is refused. So `Bun.fetch` (which Bun 1.4.4 does not let the shim wrap), `node:net`, DNS and shared services on other loopback ports (6379, 5432, 54321) are refused too.
- Every session proves its fence at start and at end: REST dials the runner's canary port on 127.0.0.1, and the dial must fail in under 100 ms with nothing accepted. Unfenced it would open, so the check tells the two cases apart without a packet off the machine. The kernel does not log these denials for a `sandbox-exec` profile here, so the run cannot count them.

## Limits

- Plain HTTP to one local origin: no DNS lookup and no TLS handshake. By default one keep-alive pool serves every fake host (`pooled`); `--conn=fresh` pays a TCP connect per fetch. DNS is out of scope.
- IP hosts never match an oEmbed provider or a special handler, so only the html stage runs.
- The shim's `inflight` counts fetches still waiting for headers. A body that streams on (a slow image) shows in the origin's `streaming` count. The `outbound-pool` flag and the RSS fit read the two added, matched by time at 1 Hz.
- RSS is the side port's `memoryUsage().rss`. macOS `ps` RSS keeps freed pages, so it is kept only as `psRssMaxMiB`, a high-water mark. Neither is compared with 512 MiB; only a Linux cgroup reading is.
- Icon targets are bare origins (`http://{host}`), so the per-run origin match cannot tag them. Only the window total shows one favicon fetch per request. The icon route has no cache, so repeats of a host are harmless.
- `/api/metadata/archive` is not covered. It calls `web.archive.org`, which the shim blocks.
- Never point `/api/metadata/image` at a `page/` URL. The saved heads name real image hosts.
- The layer-2 parse share uses the scrape call alone as its numerator, and `miss-fast` has a 0 ms origin. Never quote either number against the Rust trigger. Layer 1 has no parse timer, so no layer-1 run answers "parse above 10 % of request time at p95".
- The server histogram's lowest bucket is 0.01 s, so it cannot check a sub-10 ms client latency.
- The stall count has a resolution of about 5 ms around the 50 ms trigger (a 5 ms tick).
- macOS has no CPU quota and no cgroup, so `run.ts` cannot measure the production limits (1.0 CPU, 512M). A Linux container series measured them on 2026-11-14, with REST at `--cpus=1 --memory=512m` in OrbStack. It used `origin.ts`, `shim.ts` and `driver.ts` with its own runner, which is not in the repo. Never compare its numbers with the macOS numbers as one series.
