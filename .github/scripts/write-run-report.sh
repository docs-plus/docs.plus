#!/usr/bin/env bash
# Prints this run's timing table as Markdown. The metric names (M1, M2g, ...) are the CI benchmark's.
# Usage: write-run-report.sh <run.json>, where run.json comes from
#   gh run view <id> --attempt <n> --json createdAt,attempt,event,jobs
# It never fails the run: a missing or bad input prints one warning line and exits 0.
set -uo pipefail

RUN_JSON="${1:-}"
if [ ! -s "${RUN_JSON}" ]; then
  echo "⚠️ Run report: no run data, because gh run view failed."
  exit 0
fi

jq -r \
  --arg subject "${RUN_SUBJECT:-}" \
  --arg free_gb "${FREE_GB:-}" \
  --arg load1 "${LOAD1:-}" \
  --arg report_job "📊 Run Report" \
  -f /dev/stdin "${RUN_JSON}" <<'JQ' || echo "⚠️ Run report: jq could not read the run data."
def ts: if . == null or . == "" or startswith("0001-") then null else fromdateiso8601 end;
def na: if . == null then "n/a" else tostring end;
def opt: if . == "" then "n/a" else . end;

(.createdAt | ts) as $t0
| [.jobs[] | select(.name != $report_job)] as $jobs
| [$jobs[] | .name as $job | (.steps // [])[] | . + {job: $job}] as $steps
| def off($t): if ($t | ts) == null then null else ($t | ts) - $t0 end;
  def dur($x): if ($x.startedAt | ts) == null or ($x.completedAt | ts) == null then null
               else ($x.completedAt | ts) - ($x.startedAt | ts) end;
  def ran: (.conclusion // "") as $c | $c != "" and $c != "skipped";
  def step($n): first($steps[] | select(.name == $n and .conclusion == "success")) // null;
  def job($n): first($jobs[] | select(.name == $n and ran)) // null;

  step("🩺 Verify Deployment") as $verify
| step("🏗️ Build Docker Images") as $images
| step("💾 Pre-deploy disk guard") as $guard
| step("🚀 Deploy Services (rolling replace)") as $roll
| job("🏗️ Build Verification") as $gate
| job("🚀 Deploy Production") as $deploy
| off($verify.completedAt) as $m1
| off($gate.completedAt) as $m2g
| off($images.completedAt) as $m2i
| (if $deploy == null or $m2g == null then null
   elif $images != null and $images.job != "🚀 Deploy Production"
     then off($deploy.startedAt) - ([$m2g, $m2i] | max)
   else off($deploy.startedAt) - $m2g end) as $w
| ([$jobs[] | select(.conclusion == "success") | off(.completedAt)] | max) as $m6
| ([$jobs[] | select(ran) | off(.startedAt)] | map(select(. != null)) | min) as $queue
| ([$jobs[] | select((.name | startswith("🧪 Ext (")) and .conclusion == "success")] | length) as $ext
| [$jobs[] | select(.status != "completed") | .name] as $open
| (.event == "push" and .attempt == 1 and ($deploy.conclusion // "") == "success") as $sample

| "## ⏱️ Run timings",
  "",
  "Event `\(.event)` · attempt \(.attempt) · created \(.createdAt) · benchmark sample: \(if $sample then "yes" else "no" end)",
  (if $subject != "" then "", "Subject: `\($subject | split("\n")[0] | gsub("[`|]"; "'"))`" else empty end),
  (if .attempt > 1 then "", "> Attempt \(.attempt) is a re-run. Jobs carried over from an earlier attempt show negative offsets. The benchmark leaves re-runs out." else empty end),
  (if ($open | length) > 0 then "", "> ⚠️ Still running when the report read the run: \($open | join(", ")). Add these jobs to `report.needs`." else empty end),
  "",
  "### Jobs",
  "",
  "| Job | Start (s) | Duration (s) | Result |",
  "|---|---:|---:|---|",
  ($jobs | sort_by([(ran | not), (.startedAt // "")]) | .[]
    | if ran then "| \(.name) | \(off(.startedAt) | na) | \(dur(.) | na) | \(.conclusion) |"
      else "| \(.name) | — | — | \((.conclusion // "") | if . == "" then "not finished" else . end) |" end),
  "",
  "### Deploy steps",
  "",
  "| Step | Job | Start (s) | Duration (s) | Result |",
  "|---|---|---:|---:|---|",
  # "📦 Verify images present" and the other-job branch of W wait for #565. Keep them.
  (([ "💾 Pre-deploy disk guard", "🏗️ Build Docker Images", "📦 Verify images present",
     "🔧 Ensure Infrastructure", "🗄️ Migrate database (one-shot gate)",
     "🚀 Deploy Services (rolling replace)", "🩺 Verify Deployment", "🚨 Rollback on Failure"
   ] as $names | [$steps[] | select(.name as $n | $names | any(. == $n))]) as $ds
   | if ($ds | length) == 0 then "| No deploy step ran in this run. | | | | |"
     else ($ds[] | if ran then "| \(.name) | \(.job) | \(off(.startedAt) | na) | \(dur(.) | na) | \(.conclusion) |"
                   else "| \(.name) | \(.job) | — | — | \(.conclusion) |" end) end),
  "",
  "### Benchmark metrics (seconds after the run was created)",
  "",
  "| Metric | Value | Definition |",
  "|---|---:|---|",
  "| M1 time to live | \($m1 | na) | end of the `🩺 Verify Deployment` step, when it succeeded |",
  "| M2g gate end | \($m2g | na) | end of the `🏗️ Build Verification` job |",
  "| M2i images end | \($m2i | na) | end of the `🏗️ Build Docker Images` step, in any job |",
  "| M3 image build | \(dur($images) | na) | duration of the `🏗️ Build Docker Images` step |",
  "| M4 disk guard | \(dur($guard) | na) | duration of the `💾 Pre-deploy disk guard` step |",
  "| M5 roll-out | \(dur($roll) | na) | duration of the `🚀 Deploy Services (rolling replace)` step |",
  "| W runner wait | \($w | na) | start of the `🚀 Deploy Production` job, minus the later of M2g and M2i. M2i counts only when the image build runs in another job. |",
  "| M6 work time | \($m6 | na) | end of the last successful job, without this report job |",
  "| queue_s | \($queue | na) | start of the first job that ran |",
  "| Ext suites | \($ext) | successful `🧪 Ext (…)` jobs |",
  "| free_gb | \($free_gb | opt) | free disk on the prod host after the disk guard |",
  "| load1 | \($load1 | opt) | 1-minute load on the prod host at build start |"
JQ
