# Link-metadata benchmark

These are the numbers behind the switch from metascraper to `infra/headScraper.ts` (#242), and the
steps to measure headScraper again. The parser numbers come from one laptop on 2026-10-27, unless a
section gives another date. The metascraper numbers are a frozen record, because the script no
longer runs metascraper. After a deploy, use
[After a deploy: check production](#after-a-deploy-check-production) to compare. How much load the
routes take is in [Load tolerance (2026-11-14)](#load-tolerance-2026-11-14).

## Results (2026-10-27)

### Parse speed

Each number is the median of 30 timed rounds per parser on one saved page head. The two parsers
ran in turn after 3 warm-ups. This is the parse step only. Most of a real preview request waits
on the remote site.

| Set     | Pages | metascraper p50 | headScraper p50 | metascraper p95 | headScraper p95 | Speed-up per page, median (range) | Speed-up, total time |
| ------- | ----- | --------------- | --------------- | --------------- | --------------- | --------------------------------- | -------------------- |
| dev     | 49    | 0.947 ms        | 0.108 ms        | 9.639 ms        | 0.500 ms        | 7.6x (3.5x–32.2x)                 | 13x                  |
| holdout | 46    | 0.713 ms        | 0.107 ms        | 7.444 ms        | 0.400 ms        | 7.1x (3.3x–36.7x)                 | 9.3x                 |

A page is in the holdout set when the first hex digit of its sha256 is `8` to `f`. Fixes could look
at dev pages only. The holdout set was judged once, at the end.

### Field quality, old against new

On the 46 holdout pages, headScraper lost no title, description or image that metascraper found.

| Field       | Same | Same after folding | Differ | metascraper only | Neither |
| ----------- | ---- | ------------------ | ------ | ---------------- | ------- |
| title       | 42   | 1                  | 0      | 0                | 3       |
| description | 34   | 1                  | 2      | 0                | 9       |
| image       | 39   | 0                  | 0      | 0                | 7       |
| author      | 7    | 0                  | 0      | 2                | 37      |
| date        | 6    | 0                  | 0      | 2                | 38      |

"Same after folding" means only quote marks, spaces or an ellipsis differ. The 2 description
differences are the cut style: metascraper ends a cut with `…`, headScraper with `...`. The
author and date rows are body-text rules, such as bylines, that headScraper does not read on
purpose. These comparisons ran before the `name="og:*"` fix, which only adds values.

These comparisons also ran before 2026-11-01. Since then `readHead` cuts at the first `</head` or `<body`, and
headScraper reads no body rule. A page whose title sits only in a body `h1` now gives `no-title`.

### Crafted pages

A crafted page is a head built to be slow, for example deep nesting or a huge `@graph`. There are
28 crafted inputs. metascraper was not run at the next size once one input took more than 10 s.

| Input                         | Size      | metascraper | headScraper |
| ----------------------------- | --------- | ----------- | ----------- |
| deep tag nesting              | 262,139 B | 27.9 s      | under 1 ms  |
| `@graph` outer keys x items   | 58,745 B  | 19.8 s      | under 1 ms  |
| `<title>` dashes              | 262,122 B | 10.3 s      | under 1 ms  |
| valid JSON-LD block under cap | 510,101 B | 14.297 ms   | 0.156 ms    |

headScraper's slowest input at 1 MiB was a flood of `<article>` tags. It took 46.5, 46.7, 53.2,
46.9 and 49.7 ms in five runs, so "about 50 ms at worst". The spread is machine noise. An A/B run
showed the `name="og:*"` fix adds no time. The icon picker, `pickIconHref`, took 20.67 ms on a
crafted 65,517 B head.

### Match with the page's own tags

The `reference` mode reads each saved head's `og:`, `twitter:` and `<title>` tags with plain
regexes, then compares headScraper's value.

| Saved heads | Field       | Agree | Differ | Reference only | headScraper only |
| ----------- | ----------- | ----- | ------ | -------------- | ---------------- |
| 95          | title       | 92    | 0      | 0              | 0                |
| 95          | description | 77    | 0      | 0              | 1                |
| 95          | image       | 72    | 0      | 0              | 7                |
| 206         | title       | 195   | 0      | 0              | 0                |
| 206         | description | 168   | 2      | 0              | 1                |
| 206         | image       | 154   | 0      | 0              | 17               |

"headScraper only" means the page has no such tag, and a fallback rule found a value. The 2
description differences come from the dateline rule kept from metascraper. It strips a leading
"NASA - " or "DER STANDARD – ".

### Live coverage

A local REST server answered all 249 URLs in `scripts/bench-link-extractor.urls.txt`, with an empty
cache. The run then loaded each image and site icon through our own routes, as the card does.

| Grade      | URLs | Meaning                                                     |
| ---------- | ---- | ----------------------------------------------------------- |
| full       | 157  | title, description and an image that loads                  |
| partial    | 30   | title plus a description or an image                        |
| title-only | 9    | title only                                                  |
| fallback   | 52   | every stage missed; the card shows the host                 |
| wall       | 1    | the page was a bot check (Khan Academy, "Client Challenge") |

Why the 52 fell back:

- 35 sites answered 4xx to our honest User-Agent, for example AP, Reuters, NYT, WSJ, Bloomberg,
  Reddit, Stack Overflow, eBay and Etsy.
- 11 sent a page with no title. Amazon and IMDb sent a 2 KB challenge page. YouTube channel pages
  and Pinterest build the title in the browser.
- 6 timed out.

Of the cards that named an image, 7 failed to load. Three were over the 2 MiB relay cap (Figma,
Shopify, Corriere). Three were SVG, which the relay refuses (Hacker News twice, Onet). One named a
file the site no longer has (TechCrunch). 29 site icons failed.

| Region          | URLs | full | fallback |
| --------------- | ---- | ---- | -------- |
| US              | 16   | 9    | 7        |
| Europe          | 48   | 35   | 7        |
| US and Europe   | 39   | 17   | 13       |
| Worldwide mixed | 146  | 96   | 25       |

### Run conditions

- Apple M5 Max, 18 cores, 48 GB, macOS (`darwin 27.0.0`), Bun 1.4.4.
- metascraper 5.50.6 with cheerio 1.2.0; `entities` 7.0.1.
- Code: commit `f96bb6766` plus the uncommitted parser change. Every result file records the
  sha256 prefix of `headScraper.ts`, the script and `bun.lock`. No single commit holds both
  parsers, so a plain checkout cannot replay this comparison.
- Page heads were fetched once on 2026-10-27 with the honest `DocsplusBot` User-Agent and frozen.

### Crafted pages with the JSON-LD tail (2026-11-03)

Since 2026-11-03 the html stage reads past `</head` for JSON-LD scripts (`readPage`, up to
256 KiB and 1 s). The `attack` mode now splits each crafted page as production does. The head
pass reads up to `</head`, and the JSON-LD tail pass (`jobFacts`) reads the rest. The bench
runs both on every page, and the tail is not cut to 256 KiB, so its time is an upper bound.
Measured again on 2026-11-04, after the head pass and the tail pass began to share one JSON-LD
capture and one parse.

| Input at 1 MiB                | Five runs (ms)               |
| ----------------------------- | ---------------------------- |
| deep JSON-LD nesting (head)   | 14.9, 12.5, 16.6, 10.1, 10.2 |
| many meta tags (head)         | 17.4, 17.8, 18.0, 17.8, 17.4 |
| body: many JSON-LD scripts    | 5.0, 5.1, 4.9, 5.0, 5.2      |
| body: empty JSON-LD flood     | 4.4, 4.1, 4.2, 4.3, 4.4      |
| body: deep JSON-LD nesting    | 9.9, 10.1, 14.9, 15.3, 9.5   |
| body: huge JSON-LD script     | 0.17, 0.17, 0.50, 0.23, 0.16 |
| body: JobPosting long lists   | 0.96, 0.95, 1.0, 1.0, 0.89   |
| body: `@graph` of JobPostings | 0.78, 0.81, 0.95, 0.55, 1.3  |

The slowest single run was 18.0 ms, against "about 50 ms" on 2026-10-27. The 2026-10-27 method
passed the whole page to the head pass. Timed that way again, `flood: <article>` took 7.5 to
10.3 ms. With the same body as a tail, it took 10.7 to 11.7 ms. The cause of the drop since
2026-10-27 is not known. The tail no longer skips a script over 128 KiB before parse, so deep
body nesting now parses and costs about 10 to 15 ms. The 512 KiB JSON-LD text cap still cuts a
huge script, which then fails to parse at once. The machine is the one above, on Bun 1.4.4.

On 2026-11-06 the head ends at the first `</head` or `<body`, and the vectors aimed at the
removed body rules became one body flood. `flood: <i itemprop>` moved into the head, where
production reads it. That is a new measure, not a code change. It is now the slowest input:
33.3, 29.0, 29.7, 29.7 and 33.1 ms at 1 MiB. `many meta tags` took 20.2 to 21.1 ms. Bun 1.4.4.

Reading the tail costs download time. Warm, on one laptop, Stripe's job page took 115 to 125 ms
for the head and about 490 ms with the tail. Wikipedia took 125 to 141 ms, and 448 to 797 ms.

## Load tolerance (2026-11-14)

This section says how much load one REST replica takes, and what fails first.
[`scripts/bench-link-tolerance/`](../../../scripts/bench-link-tolerance/README.md) drives REST
against a fake origin on loopback. There is no DNS lookup, no TLS, and no traffic off the machine.

**Condition:** one REST container at `--cpus=1 --memory=512m --memory-swap=512m`, the limit of one
`rest-api` replica. It ran in the OrbStack VM on one Apple M5 Max laptop, with Bun
`1.4.4+38afee6c8` and Redis 8.8.0. Traffic is pooled loopback to one local origin.

| Shape                                | Highest rate held                             | What breaks first                                                                                                                                  |
| ------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image relay (2 MiB, 2.5 s origin)    | 50/s                                          | **Memory.** At 100/s `memory.peak` reached 512 MiB, with 2092 `memory.max` events. REST was OOM-killed at 100/s in one run and 200/s in the other. |
| Hostile heads (7 lanes)              | 48/s                                          | CPU, then memory, then an OOM kill at 96/s.                                                                                                        |
| Cache miss, fast origin, open loop   | 1600/s                                        | CPU, then memory, then an OOM kill at 6400/s.                                                                                                      |
| Cache miss, fast origin, closed loop | 5186.73/s at 16 in flight                     | CPU levels off. The best was 5665.53/s at 64 in flight. `memory.current` stayed at 265.3 MiB or less.                                              |
| Hosts that never answer              | hang@20                                       | **The outbound pool.** At hang@40 the fast lane's p95 rose to 1625.28 ms, from 4.62 ms at hang@20. CPU and memory stayed flat.                     |
| Cache hit                            | 12800/s, the top of the ramp                  | Nothing broke.                                                                                                                                     |
| Icon                                 | 100/s by the knee rule; valid steps to 3200/s | Nothing broke.                                                                                                                                     |

The OOM kill made the image, hostile and open-loop miss sessions void. The kill is the break being
measured, so those rows still stand. Real-delay misses, huge pages, herds and a Redis stall ran on
macOS only, with no CPU quota and no cgroup.

- **REST has no admission limit.** When the driver held 16 to 64 requests in flight, memory stayed
  flat. When arrivals outran the CPU, the queue grew until the OOM kill.
- **The image relay holds each image whole in memory.** RSS grew 1.0868 MiB per image in flight
  (r² 0.997). At 100/s that is about 255 images in flight (Little's law: 100/s × 2.55 s).
- **Each rate is a per-replica limit.** Production runs 2 replicas, so twice a rate is a projection,
  not a measured site limit. The CPU limits also depend on the speed of a production vCPU, which
  was not measured.

The full report, the raw data and the Linux runner are in
`Notes/local-docs/2026-11-13-link-scraper-tolerance/`.

## Measure it again

Run every command from `apps/hocuspocus.server`. `<dir>` is any empty folder outside the repo.

1. Freeze the page heads: `bun scripts/bench-link-extractor.ts fetch <dir>`. Expect about 206 of
   249 heads; the rest are refused or time out.
2. Time headScraper: `bun scripts/bench-link-extractor.ts run <dir> 30 holdout`, then `dev`.
   Compare the result with the headScraper p50 and p95 columns above.
3. Time the crafted inputs: `bun scripts/bench-link-extractor.ts attack <dir>`. Any input above
   60 ms at 1 MiB needs a look.
4. Check the page tags: `bun scripts/bench-link-extractor.ts reference <dir>`.
5. Grade live cards against a local REST server. Clear the local cache first, or `cached` rows
   grade an older answer:

   ```bash
   redis-cli -h 127.0.0.1 --scan --pattern 'meta:*' | xargs -r redis-cli -h 127.0.0.1 del
   bun scripts/bench-link-extractor.ts coverage <dir> http://localhost:4000
   ```

Each mode writes a JSON file into `<dir>` with the machine, the commit and the code hashes. The
2026-10-27 files live in the maintainer's local notes, under
`Notes/local-docs/2026-10-26-242-hovercard/bench/`.

## After a deploy: check production

Production cannot repeat the parse speed. The rule against heavy scripts in production containers
forbids `run` and `attack` there. The `stages` log durations include network time, so they are
not parse times. Parse speed stays a laptop measurement.

Production can show whether cards still arrive. Check that with `coverage`:

1. Wait 24 hours after the deploy. A cached answer lives that long (`CACHE_TTL_POSITIVE_SECONDS`),
   so earlier answers still come from metascraper. If you cannot wait, count only rows with
   `cached: false`.
2. Read the production `RATE_LIMIT_MAX` with `printenv RATE_LIMIT_MAX` in the REST container. One
   run sends 249 metadata requests and up to 249 image requests on the `link-metadata` bucket, and
   249 icon requests on the `metadata-icon` bucket. Each bucket allows `RATE_LIMIT_MAX` x 10 per
   15 minutes per address. The code default is 100 (`env.schema.ts`), so each bucket then allows
   1000, and `.env.example` sets 1000. One run fits under either value.
3. Get the maintainer's approval. A run writes about 249 entries into the shared production Redis,
   and the production server fetches every listed site.
4. Run it from a laptop, never inside a container:

   ```bash
   bun scripts/bench-link-extractor.ts coverage <dir> https://prodback.docs.plus
   ```

5. Compare each URL's `grade` with the 2026-10-27 file. A data-center address meets more bot walls
   than a home laptop, so some extra fallbacks are expected.
6. Read the reason for each new fallback in the REST log. Search for `metadata request completed`;
   each entry has the host, `pipeline_stage` and the `stages` list with a `reason` such as
   `status:4xx`, `timeout` or `no-title`. The log keeps the host only, never the path.

A URL is a regression when it moves from full or partial to fallback with the reason `no-title`, or
to wall. That points at the parser: freeze that head with `fetch`, then run `reference` on it. A
move to fallback with `status:4xx` or `timeout` is the site, not the parser. No action is needed.

Never run `attack` against production, and never clear the production Redis.

If production parse times are needed later, the html stage could log its parse duration beside
`durationMs`. That is a proposal; it is not built.
