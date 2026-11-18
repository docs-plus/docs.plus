#!/usr/bin/env bash
# Upgrades the production host in the stages of #747 (Debian 11 -> 12 -> 13 in place).
# Run one stage at a time, as the deploy user, inside screen or tmux. Each stage logs its whole
# session, prints numbered steps, and ends with one RESULT line, also kept in the ledger.
set -Eeuo pipefail
export LC_ALL=C

SELF=$(readlink -f "$0")
STAGE=${1:-help}
LOGDIR=$HOME/upgrade-logs
LEDGER=$LOGDIR/ledger.txt

# Re-run inside `script`: it keeps a pty, so the log holds apt's progress and prompts too.
if [ "$STAGE" != help ] && [ -z "${UP_LOG:-}" ]; then
  [ "$(id -u)" -ne 0 ] || { echo "Run as the deploy user, not root." >&2; exit 1; }
  mkdir -p "$LOGDIR"
  UP_LOG="$LOGDIR/$(date -u +%Y%m%dT%H%M%SZ)-$STAGE.log"; export UP_LOG
  exec script -qefa -c "$(printf '%q ' "$SELF" "$@")" "$UP_LOG"
fi

DEPLOY=/opt/projects/prod.docs.plus/.deploy/current
RUNNER=/opt/actions-runner/prod
APP_HELD=(hocuspocus-worker hocuspocus-server rest-api) # start order, as the deploy job
APP_ALL=(webapp rest-api hocuspocus-server hocuspocus-worker admin-dashboard)
STORE_Q=store-documents
BACKUP_TIMERS=7
REQUIRE_BACKUPS=yes # "no" needs a maintainer ruling; #747 ran with "no" on 2026-11-18, before #748
RUNNER_PM2_APP=prod.docs.plus-runner # the runner's PM2 name until #743 moves it to svc.sh
HOP=$HOME/upgrade-hop.env         # the open hop: OLD, NEW, TARGET, STATE
DRAINED=$HOME/upgrade-drained.env # written by drain, removed by a passing start
RESTART_NO=$HOME/restart-no.txt
PM2_UNIT=pm2-$USER
PM2_DROPIN=/etc/systemd/system/$PM2_UNIT.service.d/10-boot-path.conf
REQUIRED_UNITS=(docker containerd ssh cron netfilter-persistent) # must start at every boot
BUN=$HOME/.bun/bin/bun
PM2_JS=$HOME/.bun/install/global/node_modules/pm2/bin/pm2
PM2_WRAPPER=/usr/local/bin/pm2 # the one pm2 command, for the boot unit and by hand
NODE_MAJOR=26                  # the newest Node LTS line (26 "Lithium" since 2026-10)
COMPOSE=(docker compose --project-directory "$DEPLOY" -f "$DEPLOY/docker-compose.prod.yml" --env-file "$DEPLOY/.env.production")
APT=(sudo env DEBIAN_FRONTEND=noninteractive APT_LISTCHANGES_FRONTEND=none NEEDRESTART_MODE=a
  apt-get -o DPkg::Lock::Timeout=300 -o APT::Color=0
  -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)

T0=$SECONDS N=0 TOTAL=0 FAILS=0 PASSES=0 DONE=0
FACTS="" NEXT="" WHERE="" SUDO_PID="" UNHOLD=""

# Reads all input, unlike grep -q, so the writer never dies of SIGPIPE under pipefail.
q() { grep "$@" >/dev/null; }
utc() { date -u +%FT%TZ; }
dur() { local s=$((SECONDS - T0)); printf '%dm%02ds' $((s / 60)) $((s % 60)); }
begin() { TOTAL=$1; printf '%s %s stage=%s script=%s\n' "$(utc)" "$USER" "$STAGE" "$(sha256sum "$SELF" | cut -c1-12)"; }
step() { N=$((N + 1)); printf '\n[%s %d/%d] %s (+%s)\n' "$STAGE" "$N" "$TOTAL" "$*" "$(dur)"; }
ok() { printf '  PASS  %s\n' "$*"; PASSES=$((PASSES + 1)); }
bad() { printf '  FAIL  %s\n' "$*"; FAILS=$((FAILS + 1)); }
info() { printf '  info  %s\n' "$*"; }
fact() { FACTS="${FACTS:+$FACTS }$*"; }
die() { [ -z "${2:-}" ] || NEXT=$2; printf '\nSTOP: %s\n' "$1"; exit 1; }
# Keys pressed while a step ran (an arrow key, for one) sit in the input and would join the answer.
confirm() {
  local a junk
  while read -r -t 0.2 -n 256 junk; do :; done
  read -r -p "$1 Type yes to go on: " a || die "no input"
  a=$(printf '%s' "$a" | sed $'s/\e\\[[0-9;]*[A-Za-z~]//g' | tr -d '[:space:]')
  [ "$a" = yes ] || die "not confirmed" "${2:-run $0 $STAGE again when ready}"
}

finish() {
  local rc=$? v=PASS line
  [ -z "$SUDO_PID" ] || kill "$SUDO_PID" 2>/dev/null || true
  [ -z "$UNHOLD" ] || sudo apt-mark unhold $UNHOLD >/dev/null || true
  [ "$DONE" = 0 ] || return 0
  DONE=1
  { [ "$rc" = 0 ] && [ "$FAILS" = 0 ]; } || v=FAIL
  [ "$v" = PASS ] || [ -n "$NEXT" ] || NEXT="read the log, fix the error, then run $0 $STAGE again"
  line="RESULT $STAGE $v in $(dur)${FACTS:+: $FACTS}${WHERE:+ (error at $WHERE)}. Next: ${NEXT:-none}"
  printf '\n%s\n' "$line"
  [ "$STAGE" = help ] || printf '%s %s %s log=%s\n' "$(utc)" "$USER" "$line" "${UP_LOG##*/}" >> "$LEDGER"
}
trap 'WHERE="line $LINENO: ${BASH_COMMAND:0:60}"' ERR
trap finish EXIT
trap 'exit 130' INT TERM

# A release upgrade can outlast sudo's 15-minute ticket; keep it fresh in the background.
keep_sudo() { sudo -v || die "sudo refused"; (while sleep 50; do sudo -n true 2>/dev/null || exit; done) & SUDO_PID=$!; }

codename() { (. /etc/os-release && echo "$VERSION_CODENAME"); }
next_of() { case "$1" in bullseye) echo bookworm ;; bookworm) echo trixie ;; *) echo "" ;; esac; }
version_of() { case "$1" in bullseye) echo 11 ;; bookworm) echo 12 ;; trixie) echo 13 ;; esac; }
kernel_for() { case "$1" in 11) echo 5.10 ;; 12) echo 6.1 ;; 13) echo 6.12 ;; esac; }
timer_count() { systemctl list-timers --all --no-legend | grep -c docsplus-backup || true; }
count_of() { docker ps -q --filter "label=com.docker.compose.service=$1" "${@:2}" | wc -l; }
failed_units() { systemctl --failed --plain --no-legend | awk '{print $1}' | sort; }
runner_unit() { cat "$RUNNER/.service" 2>/dev/null || true; }
# The runner has its own svc.sh unit after #743. Until then it is a PM2 app, and PM2 restores it at boot.
runner_mode() {
  if [ -n "$(runner_unit)" ]; then echo unit
  elif pm2_list | q "^$RUNNER_PM2_APP "; then echo pm2
  else echo none; fi
}
runner_stop() {
  case "$(runner_mode)" in
    unit) (cd "$RUNNER" && sudo ./svc.sh stop) ;;
    pm2) pm2c stop "$RUNNER_PM2_APP" >/dev/null ;;
  esac
}
runner_start() {
  case "$(runner_mode)" in
    unit) [ "$(systemctl is-active "$(runner_unit)")" = active ] || (cd "$RUNNER" && sudo ./svc.sh start) ;;
    pm2) pm2_list | q "^$RUNNER_PM2_APP online$" || pm2c start "$RUNNER_PM2_APP" >/dev/null ;;
  esac
}
runner_listening() {
  case "$(runner_mode)" in
    unit) sudo journalctl -b -u "$(runner_unit)" --no-pager -o cat 2>/dev/null | q 'Listening for Jobs' ;;
    pm2) pm2_list | q "^$RUNNER_PM2_APP online$" && tail -n 200 "$HOME/.pm2/logs/$RUNNER_PM2_APP-out.log" 2>/dev/null | q 'Listening for Jobs' ;;
    *) return 1 ;;
  esac
}
# Services that are enabled and running now: each one must run again after a boot.
boot_units() {
  comm -12 <(systemctl list-unit-files --type=service --state=enabled --no-legend | awk '{print $1}' | sort) \
    <(systemctl list-units --type=service --state=active --no-legend --plain | awk '{print $1}' | sort)
}
# PM2 checks use the exact command the boot unit runs, so a pass here means the boot works.
pm2_cmd() { systemctl cat "$PM2_UNIT" 2>/dev/null | sed -n 's/^ExecStart=\(..*\) resurrect$/\1/p' | tail -n1; }
pm2c() { local c; c=$(pm2_cmd); [ -n "$c" ] || return 1; $c "$@"; }
# The pid file works for both forms: "PM2 vX: God Daemon" on node, "bun .../pm2/lib/Daemon.js" on bun.
pm2_daemon() {
  local p; p=$(cat "$HOME/.pm2/pm2.pid" 2>/dev/null || true)
  if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then echo "$p"; else pgrep -u "$USER" -f 'God Daemon|pm2/lib/Daemon\.js' | head -n1 || true; fi
}
pm2_version_of() {
  local args; args=$(ps -o args= -p "$1")
  if [[ $args =~ PM2\ v([0-9.]+): ]]; then echo "${BASH_REMATCH[1]}"; return; fi
  python3 -c 'import json,os,sys; d=sys.argv[1].split()[1]; print(json.load(open(os.path.join(os.path.dirname(d),"..","package.json")))["version"])' "$args" 2>/dev/null || true
}
# jlist can print "[PM2] Spawning..." lines first; the JSON is the last line that starts with "[".
pm2_json() { grep '^\[' | tail -n1; }
pm2_boot_ok() {
  local c w; c=$(pm2_cmd); [ -n "$c" ] || return 1
  for w in $c; do [ -e "$w" ] || return 1; done
  [ "$(systemctl is-enabled "$PM2_UNIT" 2>/dev/null)" = enabled ] && pm2c ping 2>/dev/null | q pong
}
pm2_list() {
  pm2c jlist 2>/dev/null | pm2_json | python3 -c 'import json,sys
for p in json.load(sys.stdin): print(p["name"], p["pm2_env"]["status"])' 2>/dev/null | sort || true
}
save_pre() {
  docker ps --format '{{.Names}}' | sort > "$HOME/pre-containers.txt"
  failed_units > "$HOME/pre-failed.txt"
  boot_units > "$HOME/pre-units.txt"
  timer_count > "$HOME/pre-timers.txt"
  if [ -n "$(pm2_daemon)" ]; then pm2c save >/dev/null && ok "pm2 save: the boot restores today's app list"; fi
  pm2_list > "$HOME/pre-pm2.txt"
  info "containers $(wc -l < "$HOME/pre-containers.txt"), boot services $(wc -l < "$HOME/pre-units.txt"), pm2 apps $(wc -l < "$HOME/pre-pm2.txt"), backup timers $(cat "$HOME/pre-timers.txt")"
}
sources() { shopt -s nullglob; local f; for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do [ -f "$f" ] && echo "$f"; done; }
# Runs apt-get update and names every source that failed, in APT_BROKEN.
APT_BROKEN=""
apt_refresh() {
  local out rc=0; out=$(mktemp)
  if "${APT[@]}" update -q 2>&1 | tee "$out"; then rc=0; else rc=1; fi
  APT_BROKEN=$(grep -E '^(E|W): ' "$out" | grep -oE "https?://[^ ']+" | sort -u | xargs || true)
  rm -f "$out"
  [ "$rc" = 0 ] && [ -z "$APT_BROKEN" ]
}
stamp() { date -u +%Y%m%dT%H%M%SZ; }
kept_conffiles() { sudo find /etc -cnewer "$1" \( -name '*.dpkg-dist' -o -name '*.ucf-dist' -o -name '*.dpkg-old' \) | sort; }

R() { docker exec docsplus-redis redis-cli "$@"; }
need_redis() {
  [ "$(R PING 2>/dev/null)" = PONG ] || die "docsplus-redis does not answer PING" "check 'docker ps' for docsplus-redis"
  [ "$(R EXISTS "bull:$STORE_Q:meta")" = 1 ] || die "the key bull:$STORE_Q:meta is missing" "check the queue name in apps/hocuspocus.server/src/lib/queue.ts"
}
# One atomic read, so a retry that moves between lists cannot be missed.
store_busy() {
  R EVAL "local n=0 for _,k in ipairs({'wait','active','paused'}) do n=n+redis.call('LLEN',KEYS[1]..k) end for _,k in ipairs({'delayed','prioritized'}) do n=n+redis.call('ZCARD',KEYS[1]..k) end return n" 1 "bull:$STORE_Q:"
}
dlq_waiting() {
  local k q n=0
  for k in $(R --scan --pattern 'bull:*-dlq:meta'); do
    q=${k#bull:}; q=${q%:meta}; n=$((n + $(R LLEN "bull:$q:wait")))
  done
  echo "$n"
}
num() { [[ $1 =~ ^[0-9]+$ ]] || die "could not read $2 (got '$1')" "${3:-check docsplus-redis}"; }

queue_gate() {
  step "queue reads"
  need_redis
  local n; n=$(store_busy); num "$n" "the store queue"; info "store jobs now: $n"
  n=$(dlq_waiting); num "$n" "the dead-letter queues"
  [ "$n" = 0 ] && ok "every *-dlq at wait=0" || die "$n dead-letter jobs wait. Nothing was stopped." "clear the DLQ first"
}
# Stops new edits, then waits until the worker has saved every queued one.
stop_and_drain() {
  step "stop hocuspocus-server and drain the store queue"
  local n t=0
  STOP_EPOCH=$(date +%s); STOP_UTC=$(utc)
  "${COMPOSE[@]}" stop hocuspocus-server
  while :; do
    n=$(store_busy); num "$n" "the store queue" "run $0 start, then check docsplus-redis"
    [ "$n" != 0 ] || break
    [ "$t" -lt 600 ] || die "the store queue did not drain in 10 min ($n jobs left)" "run $0 start, then read the worker logs"
    printf '  store jobs left: %s (%ds)\n' "$n" "$t"; sleep 10; t=$((t + 10))
  done
  ok "store queue empty after ${t}s"
  n=$(dlq_waiting); num "$n" "the dead-letter queues"
  [ "$n" = 0 ] && ok "every *-dlq at wait=0" || die "$n dead-letter jobs appeared during the drain" "run $0 start, then read the DLQ"
  DRAIN_S=$t
}

# The checks every outage stage runs first. A failure here stops nothing.
# Mode "window" is the #747 hop window; mode "reboot" is the plain #708 reboot (no #748 yet).
preflight() {
  local mode=$1 u
  step "preflight checks (nothing is stopped yet)"
  [ -n "${TMUX:-}${STY:-}" ] && ok "inside tmux or screen" || bad "not inside screen or tmux: run '$(command -v tmux >/dev/null && echo 'tmux new -s upgrade' || echo 'screen -S upgrade')'"
  step "what must come back after the boot"
  case "$(runner_mode)" in
    unit) [ "$(systemctl is-enabled "$(runner_unit)" 2>/dev/null)" = enabled ] && ok "runner starts at boot: $(runner_unit)" || bad "the runner unit is not enabled: 'sudo systemctl enable $(runner_unit)'" ;;
    pm2) pm2_boot_ok && ok "runner starts at boot: PM2 app $RUNNER_PM2_APP (#743 moves it to svc.sh later)" || bad "the runner is a PM2 app, and PM2 does not start at boot: run $0 pm2-boot" ;;
    *) bad "no runner found (no svc.sh unit, no PM2 app $RUNNER_PM2_APP)" ;;
  esac
  [ "$(pgrep -fc '[/]bin/Runner.Worker' || true)" = 0 ] && ok "no deploy job runs now" || bad "a deploy job runs now: wait until it ends"
  if [ -n "$(pm2_daemon)" ]; then
    pm2_boot_ok && ok "PM2 apps come back at boot: $PM2_UNIT runs $(pm2_cmd)" \
      || bad "PM2 apps (TinyDocy) would not come back after a boot: run $0 pm2-boot"
  fi
  for u in "${REQUIRED_UNITS[@]}"; do
    [ "$(systemctl is-enabled "$u" 2>/dev/null)" = enabled ] && ok "$u starts at boot" || bad "$u does not start at boot: 'sudo systemctl enable $u'"
  done
  local held pol
  held=$(awk '{sub(/^\//, "", $1); print $1}' "$RESTART_NO" 2>/dev/null || true)
  pol=$(docker ps -q | xargs -r docker inspect -f '{{.Name}} {{.HostConfig.RestartPolicy.Name}}' | sed 's#^/##' \
    | awk '$2 != "always" && $2 != "unless-stopped" {print $1}' | grep -vxF -f <(echo "$held") | xargs || true)
  [ -z "$pol" ] && ok "every running container restarts at boot" || bad "these containers would not restart at boot: $pol"
  step "host state"
  if [ "$mode" = window ]; then
    local t; t=$(timer_count)
    if [ "$REQUIRE_BACKUPS" = yes ]; then
      [ "$t" = "$BACKUP_TIMERS" ] && ok "$t backup timers (#748)" || bad "$t backup timers, want $BACKUP_TIMERS: do #748 first"
    else
      info "#748 backups waived (maintainer, 2026-11-18): $t backup timers. The rollback is the pre-hop snapshot."
      fact "backups_waived=yes"
    fi
  fi
  systemctl list-units 'docsplus-backup*' --state=running --no-legend | q . && bad "a backup job runs now: wait for it" || ok "no backup job running"
  [ -z "$(apt-mark showhold)" ] && ok "no held package" || bad "held packages: $(apt-mark showhold | xargs). Unhold them, or record why"
  [ -z "$(dpkg --audit)" ] && ok "dpkg audit clean" || bad "dpkg --audit is not empty: run $0 patch"
  [ "$(df --output=avail -k / | tail -n1)" -gt $((5 * 1024 * 1024)) ] && ok "more than 5 GiB free on /" || bad "less than 5 GiB free on /"
  if dpkg-query -W -f='${Status}' grub-pc 2>/dev/null | q 'ok installed'; then
    local dev; dev=$(sudo debconf-show grub-pc | sed -n 's/^[* ]*grub-pc\/install_devices: *//p')
    [ -n "$dev" ] && ok "grub-pc installs to $dev" || bad "grub-pc has no install device: run 'sudo dpkg-reconfigure grub-pc'"
  fi
  sudo sshd -t && ok "sshd config is valid" || bad "'sudo sshd -t' fails: fix /etc/ssh/sshd_config"
  [ "$mode" != window ] || { [ -s "$HOME/containers-before.txt" ] && ok "inventory saved" || bad "no inventory: run $0 inventory"; }
  ! grep -rqs yarnpkg $(sources) || info "a yarn source remains (#747 step 4). Its old key can fail apt on hop 2."
  [ "$FAILS" = 0 ] || die "$FAILS preflight check(s) failed. Nothing was stopped." "fix each FAIL above, then run $0 $STAGE again"
}

cmd_status() {
  begin 3
  . /etc/os-release
  step "release and kernel"
  info "$PRETTY_NAME, kernel $(uname -r)"
  case "$VERSION_CODENAME" in
    bullseye) info "security support: LTS ended 2026-08-31" ;;
    bookworm) info "security support: LTS to 2028-06-30" ;;
    trixie) info "security support: LTS to 2030-06-30" ;;
  esac
  local reboot=no; [ ! -e /var/run/reboot-required ] || reboot=yes
  info "reboot required: $reboot"
  step "packages (this refreshes the package lists)"
  apt_refresh >/dev/null || true
  [ -z "$APT_BROKEN" ] && info "apt sources: all answer" || info "apt sources BROKEN: $APT_BROKEN (run $0 sources)"
  local up; up=$(apt list --upgradable 2>/dev/null | grep -c / || true)
  info "upgradable: $up, held: $(apt-mark showhold | wc -l), dpkg audit lines: $(dpkg --audit | wc -l)"
  step "host"
  info "root disk: $(df -h --output=avail / | tail -n1 | xargs) free"
  info "containers running: $(docker ps -q | wc -l)"
  info "failed units: $(failed_units | xargs)"
  [ ! -f "$HOP" ] || info "open hop: $(xargs < "$HOP")"
  fact "debian=$VERSION_ID upgradable=$up reboot=$reboot failed_units=$(failed_units | wc -l)"
  if [ -f "$HOP" ] || [ -f "$DRAINED" ]; then NEXT="an upgrade window is open: finish it with hop, check or start"
  elif [ "$reboot" = yes ]; then NEXT="plan the reboot (#708)"
  elif [ "$up" -gt 0 ]; then NEXT="$0 patch"
  elif [ -n "$(next_of "$VERSION_CODENAME")" ]; then NEXT="the hop window: $0 drain"
  else NEXT="nothing; run $0 patch each month"; fi
}

# #747 step 1, with the reads for steps 3 and 4. It never overwrites the step 1 list.
cmd_inventory() {
  begin 4
  step "host and Docker"
  info "cpus $(nproc), $(free -g | awk 'NR==2{print $2}') GiB RAM, $(df -h --output=avail / | tail -n1 | xargs) free"
  info "docker $(docker version --format '{{.Server.Version}}')"
  dpkg-query -W -f='  info  ${Package} ${Version}\n' docker-ce containerd.io
  step "before lists"
  if [ -s "$HOME/containers-before.txt" ]; then
    info "kept the existing step 1 list from $(date -r "$HOME/containers-before.txt" -u +%FT%TZ)"
  else
    docker ps --format '{{.Names}}' | sort > "$HOME/containers-before.txt"
    failed_units > "$HOME/failed-before.txt"
    pm2_list > "$HOME/pm2-before.txt"
    boot_units > "$HOME/units-before.txt"
  fi
  info "containers: $(wc -l < "$HOME/containers-before.txt"), failed units: $(xargs < "$HOME/failed-before.txt")"
  info "boot services: $(xargs < "$HOME/units-before.txt" 2>/dev/null)"
  if [ -n "$(pm2_daemon)" ]; then
    pm2_boot_ok && info "PM2 boot path works: $(pm2_list | grep -c ' online$' || true) apps online" \
      || info "PM2 boot path is BROKEN: its apps would not return after a boot. Run $0 pm2-boot"
  fi
  info "runner: $(runner_mode)$( [ "$(runner_mode)" != unit ] || echo " $(runner_unit) $(systemctl is-enabled "$(runner_unit)" 2>/dev/null)")"
  step "apt"
  grep -h '^[^#]' $(sources) | sed 's/^/  info  /' || true
  info "holds: $(apt-mark showhold | xargs), dpkg audit lines: $(dpkg --audit | wc -l)"
  info "grub-pc install device: $(sudo debconf-show grub-pc 2>/dev/null | sed -n 's/^[* ]*grub-pc\/install_devices: *//p')"
  step "reads for #747 steps 3 and 4"
  info "host Redis on 6379 (expect only this redis-cli):"
  redis-cli -h 127.0.0.1 -p 6379 CLIENT LIST 2>/dev/null | sed 's/^/        /' || info "host Redis does not answer"
  info "host Redis keys: $(redis-cli -h 127.0.0.1 -p 6379 INFO keyspace 2>/dev/null | grep -c '^db' || true) databases with keys"
  sudo ss -tnp | grep ':6379' | sed 's/^/        /' || info "no TCP client on 6379"
  sudo grep -rls yarn /etc/systemd/system /etc/cron* /var/spool/cron 2>/dev/null | sed 's/^/        /' || info "no unit or cron job names yarn"
  info "MANUAL: if nothing uses them: 'sudo systemctl disable --now redis-server' (keep the package), 'sudo apt-get purge -y yarn'"
  info "MANUAL from a laptop: the GlitchTip issue count, and the status.docs.plus HTTP code"
  fact "containers=$(wc -l < "$HOME/containers-before.txt") failed_units=$(wc -l < "$HOME/failed-before.txt") holds=$(apt-mark showhold | wc -l)"
  NEXT="$0 cves"
}

# #747 steps 2 and 12.
cmd_cves() {
  begin 2
  step "debsecan"
  # Without recommends: debsecan would pull in the exim4 mail server and its libraries.
  command -v debsecan >/dev/null || "${APT[@]}" -y --no-install-recommends install debsecan
  step "count"
  local c known fixed; c=$(codename)
  known=$(debsecan | wc -l)
  # The tracker drops a release's feed when its LTS ends (bullseye: 404), so this row can be missing.
  local out
  if out=$(debsecan --suite "$c" --only-fixed 2>&1); then fixed=$(grep -c . <<< "$out" || true)
  else fixed="n/a"; info "the security tracker has no feed for $c (its LTS ended), so the fixed-not-installed row is n/a"; fi
  fact "release=$c known_cves=$known fixed_not_installed=$fixed"
  NEXT="post both counts on #747"
}

# #747 step 5, and the monthly update: every package inside the current release.
cmd_patch() {
  begin 4
  keep_sudo
  step "refresh the package lists"
  apt_refresh || die "apt-get update fails on: ${APT_BROKEN:-see above}" "run $0 sources to fix them, then $0 patch again"
  step "pending packages"
  local list n; list=$(apt list --upgradable 2>/dev/null | grep / || true)
  if [ -z "$list" ]; then fact "upgraded=0"; NEXT="nothing"; return; fi
  n=$(wc -l <<< "$list"); echo "$list" | sed 's/^/  /'
  local docker=upgraded a
  if grep -qE '^(docker-ce|docker-ce-cli|containerd\.io)/' <<< "$list"; then
    read -r -p "Docker is in the list. Its upgrade restarts every container (a short outage). Upgrade Docker now? yes/no: " a || die "no input"
    if [ "$a" != yes ]; then
      UNHOLD="docker-ce docker-ce-cli containerd.io"
      sudo apt-mark hold $UNHOLD >/dev/null; docker=deferred
    fi
  fi
  ! grep -q '^linux-image' <<< "$list" || info "a new kernel is in the list: it needs a reboot (#708)"
  confirm "Upgrade these $n packages?"
  step "full-upgrade"
  local mark; mark=$(mktemp)
  NEXT="run 'sudo dpkg --configure -a', then $0 patch again"
  "${APT[@]}" -y full-upgrade
  step "after"
  [ -z "$(dpkg --audit)" ] && ok "dpkg audit clean" || bad "dpkg --audit is not empty"
  local kept; kept=$(kept_conffiles "$mark"); rm -f "$mark"
  [ -z "$kept" ] || { info "kept your config; new versions saved beside:"; echo "$kept" | sed 's/^/        /'; }
  local reboot=no; [ ! -e /var/run/reboot-required ] || reboot=yes
  fact "upgraded=$n docker=$docker reboot=$reboot kept_conffiles=$(grep -c . <<< "$kept" || true)"
  [ "$reboot" = yes ] && NEXT="plan the reboot (#708)" || NEXT="nothing"
}

# #747 step 7, without the snapshot. Also Rollback step 1.
cmd_drain() {
  begin 9
  local cur new; cur=$(codename); new=$(next_of "$cur")
  [ ! -f "$DRAINED" ] || die "the app is already drained ($(xargs < "$DRAINED"))" "take the snapshot and run $0 hop, or run $0 start"
  preflight window
  queue_gate
  step "save the pre-window lists"
  save_pre
  info "MANUAL before you go on: the window is announced, merges are stopped, the content-safety block and the laptop probe run,"
  info "and you can log in at the DigitalOcean Recovery Console (it needs a local password)."
  confirm "This stops the editor (a full outage) until '$0 start'."
  NEXT="run $0 start to bring the editor back, then find the cause"
  step "stop the runner ($(runner_mode))"
  runner_stop
  stop_and_drain
  local n stop_epoch=$STOP_EPOCH stop_utc=$STOP_UTC t=$DRAIN_S
  step "stop rest-api and hocuspocus-worker, and hold them down"
  "${COMPOSE[@]}" stop rest-api hocuspocus-worker
  for k in $(R --scan --pattern 'bull:*:meta'); do q=${k#bull:}; q=${q%:meta}
    echo "$q wait=$(R LLEN "bull:$q:wait") delayed=$(R ZCARD "bull:$q:delayed") failed=$(R ZCARD "bull:$q:failed")"
  done | sort > "$LOGDIR/queues-${new:-$cur}.txt"
  local want=0 c s
  : > "$RESTART_NO"
  for s in "${APP_HELD[@]}"; do
    for c in $(docker ps -aq --filter "label=com.docker.compose.service=$s"); do
      want=$((want + 1))
      docker update --restart=no "$c" >/dev/null
      docker inspect -f '{{.Name}} {{.HostConfig.RestartPolicy.Name}}' "$c" >> "$RESTART_NO"
    done
  done
  [ "$(grep -c ' no$' "$RESTART_NO" || true)" = "$want" ] && ok "$want containers held at restart=no" || die "restart=no is not on all $want containers"
  step "record"
  printf 'STOP_EPOCH=%s\nSTOP_UTC=%s\nRELEASE=%s\n' "$stop_epoch" "$stop_utc" "$cur" > "$DRAINED"
  fact "stop=$stop_utc drain=${t}s store=0 dlq=0 held=$want"
  if [ -n "$new" ]; then NEXT="take the DigitalOcean snapshot pre-$new, wait until it finishes, then run $0 hop"
  else NEXT="do the work that needed the drain, then $0 check and $0 start"; fi
}

# #747 steps 8 and 9. One release hop, then one reboot. A rerun resumes the open hop.
cmd_hop() {
  begin 10
  local old new target resume=0
  if [ -f "$HOP" ]; then
    . "$HOP"; old=$OLD; new=$NEW; target=$TARGET
    [ "$STATE" = started ] || die "the hop to $new is already upgraded" "reboot if you have not, then run $0 check"
    resume=1
  else
    old=$(codename); new=$(next_of "$old")
    [ -n "$new" ] || die "$old is the newest release this script knows" "nothing to do: run $0 patch for updates"
    target=$(version_of "$new")
  fi
  [ -f "$DRAINED" ] || die "the app is not drained" "run $0 drain first"
  local s; for s in "${APP_HELD[@]}"; do [ "$(count_of "$s")" = 0 ] || die "$s still runs" "run $0 drain first"; done
  keep_sudo
  if [ "$resume" = 0 ]; then
    preflight window
    local snap; read -r -p "Type the name of the finished snapshot: " snap || die "no input"
    [ "$snap" = "pre-$new" ] || die "the snapshot must be named pre-$new" "take it, then run $0 hop again"
    printf 'OLD=%s\nNEW=%s\nTARGET=%s\nSTATE=started\nSNAPSHOT_UTC=%s\n' "$old" "$new" "$target" "$(utc)" > "$HOP"
  else
    TOTAL=8
    step "resume the open hop $old -> $new: repair dpkg first"
    sudo dpkg --configure -a
    "${APT[@]}" -y -f install
  fi
  NEXT="do not reboot. Run 'sudo dpkg --configure -a' and 'sudo apt-get -f install', then $0 hop (it resumes this hop)"
  sudo systemctl stop apt-daily.timer apt-daily-upgrade.timer unattended-upgrades.service 2>/dev/null || true

  step "switch the apt sources $old -> $new"
  [ -d "$HOME/apt-$old.bak" ] || sudo cp -a /etc/apt "$HOME/apt-$old.bak"
  local f; for f in $(sources); do ! sudo grep -q "$old" "$f" || sudo sed -i "s/$old/$new/g" "$f"; done
  if [ "$new" = bookworm ]; then
    for f in $(sources); do ! sudo grep -q download.docker.com/linux/ubuntu "$f" || sudo sed -i 's#download.docker.com/linux/ubuntu#download.docker.com/linux/debian#' "$f"; done
  fi
  for f in $(sources); do ! sudo grep -q apt-archive.postgresql.org "$f" || sudo sed -i 's#://apt-archive\.postgresql\.org/#://apt.postgresql.org/#' "$f"; done # $new is live there
  ! grep -rn "$old" $(sources) && ok "no source names $old" || die "a source still names $old"
  info "the old sources are saved in $HOME/apt-$old.bak"

  step "refresh the package lists"
  apt_refresh || die "apt-get update fails on: ${APT_BROKEN:-see above}" "fix that source (for a Docker key error: https://download.docker.com/linux/debian/gpg), then $0 hop"
  apt-cache policy docker-ce | tee "$LOGDIR/docker-policy-$new.txt" | sed -n '1,3p'
  apt-cache policy docker-ce | q "Candidate:.*~debian\.$target~$new" && ok "Docker has a $new build" || die "no Docker build for $new" "check the Docker source, then $0 hop"

  local mark; mark=$(mktemp)
  step "download every package first (a network drop cannot stop the install halfway)"
  "${APT[@]}" -y -d full-upgrade
  step "upgrade --without-new-pkgs"
  "${APT[@]}" -y upgrade --without-new-pkgs
  step "full-upgrade"
  "${APT[@]}" -y full-upgrade

  step "after the upgrade"
  [ -z "$(dpkg --audit)" ] && ok "dpkg audit clean" || die "dpkg --audit is not empty"
  local kept; kept=$(kept_conffiles "$mark"); rm -f "$mark"
  echo "$kept" > "$LOGDIR/conffiles-$new.txt"
  [ -z "$kept" ] || { info "kept your config; new versions saved beside (review later):"; echo "$kept" | sed 's/^/        /'; }
  sudo sshd -t && ok "sshd config is valid" || die "'sudo sshd -t' fails: a reboot could lock you out" "fix /etc/ssh/sshd_config, then $0 hop"
  local k; k=$(kernel_for "$target")
  sudo grep -q "vmlinuz-$k\." /boot/grub/grub.cfg && ok "grub boots kernel $k" || die "grub.cfg has no $k kernel" "run 'sudo update-grub', then $0 hop"
  sed -i 's/^STATE=.*/STATE=upgraded/' "$HOP"

  step "reboot"
  fact "$old->$new kept_conffiles=$(grep -c . <<< "$kept" || true) snapshot_at=$(sed -n 's/^SNAPSHOT_UTC=//p' "$HOP")"
  NEXT="reboot by hand ('sudo reboot'), log in, then run $0 check"
  confirm "Reboot now into Debian $target?" "$NEXT"
  NEXT="log in after the reboot, reattach screen (screen -r) or open a new one, then run $0 check"
  finish; trap - EXIT
  sleep 2; sudo systemctl reboot
}

# #747 step 10, and Rollback step 3. With no open hop, it checks the current release.
cmd_check() {
  begin 6
  local target old new
  if [ -f "$HOP" ]; then
    . "$HOP"; target=$TARGET old=$OLD new=$NEW
    [ "$STATE" != started ] || die "the hop did not finish" "run $0 hop (it resumes)"
  else
    target=$(version_of "$(codename)") old="" new=$(codename)
    info "no open hop: checking the current release (Rollback or a plain reboot)"
  fi
  step "release and kernel"
  local vid; vid=$(. /etc/os-release && echo "$VERSION_ID")
  [ "$vid" = "$target" ] && ok "Debian $vid" || bad "Debian $vid, want $target"
  [ "$(apt-cache policy | grep -c "$new-security" || true)" -ge 1 ] && ok "$new-security source" || bad "no $new-security source"
  [ -z "$old" ] || { ! grep -rqn "$old" $(sources) && ok "no source names $old" || bad "a source still names $old"; }
  [[ $(uname -r) == "$(kernel_for "$target")".* ]] && ok "kernel $(uname -r)" || bad "kernel $(uname -r) is not the Debian $target kernel"

  step "containers (wait up to 3 min for 'starting')"
  local t=0
  while [ -n "$(docker ps -q --filter health=starting)" ] && [ "$t" -lt 180 ]; do
    printf '  starting: %s (%ds)\n' "$(docker ps -q --filter health=starting | wc -l)" "$t"; sleep 10; t=$((t + 10))
  done
  local pre=$HOME/pre-containers.txt; [ -s "$pre" ] || pre=$HOME/containers-before.txt
  local now held extra missing
  now=$(docker ps --format '{{.Names}}' | sort)
  held=$(awk '{sub(/^\//, "", $1); print $1}' "$RESTART_NO" 2>/dev/null | sort || true) # none after a plain reboot
  extra=$(comm -13 "$pre" <(echo "$now") | xargs)
  missing=$(comm -23 "$pre" <(echo "$now") | comm -23 - <(echo "$held") | xargs)
  [ -z "$extra$missing" ] && ok "containers match ${pre##*/}, except the held app" || bad "containers differ: missing [$missing] extra [$extra]"
  [ -z "$(docker ps -q --filter health=unhealthy)$(docker ps -q --filter health=starting)" ] && ok "no container unhealthy or starting" || bad "a container is unhealthy or starting"

  step "host services"
  local u st down=""
  for u in "${REQUIRED_UNITS[@]}"; do
    [ "$(systemctl is-active "$u" 2>/dev/null)" = active ] && ok "$u active" || bad "$u not active: 'sudo systemctl start $u', then read 'journalctl -u $u -b'"
  done
  local preu=$HOME/pre-units.txt; [ -s "$preu" ] || preu=$HOME/units-before.txt
  while read -r u; do
    [ -n "$u" ] || continue
    st=$(systemctl is-active "$u" 2>/dev/null || true)
    [ "$st" = active ] && continue
    [ "$(systemctl show -p Type --value "$u")/$(systemctl show -p Result --value "$u")" = oneshot/success ] && continue
    case "$u" in ntp.service) [ "$(systemctl is-active ntpsec 2>/dev/null)" = active ] && continue ;; esac # Debian 12 renames it
    down="$down $u"
  done < <(cat "$preu" 2>/dev/null || true)
  [ -z "$down" ] && ok "every service that ran before the boot runs again (${preu##*/})" || bad "services that ran before and do not run now:$down"
  local pref=$HOME/pre-failed.txt; [ -s "$pref" ] || pref=$HOME/failed-before.txt
  local newfail; newfail=$(comm -13 "$pref" <(failed_units) | xargs)
  [ -z "$newfail" ] && ok "no new failed unit" || bad "new failed units: $newfail"
  local pret; pret=$(cat "$HOME/pre-timers.txt" 2>/dev/null || echo 0)
  [ "$(timer_count)" -ge "$pret" ] && ok "$(timer_count) backup timers (before: $pret)" || bad "backup timers: $(timer_count), before: $pret"

  step "runner and PM2 (wait up to 2 min for the runner)"
  t=0
  until runner_listening || [ "$t" -ge 120 ]; do
    printf '  waiting for the runner to listen (%ds)\n' "$t"; sleep 10; t=$((t + 10))
  done
  runner_listening && ok "runner ($(runner_mode)) is listening for jobs" \
    || bad "runner ($(runner_mode)) is not listening for jobs: start it ($([ "$(runner_mode)" = pm2 ] && echo "pm2 start $RUNNER_PM2_APP" || echo "sudo ./svc.sh start in $RUNNER")), then check again"
  local prep=$HOME/pre-pm2.txt; [ -f "$prep" ] || prep=$HOME/pm2-before.txt
  if grep -q ' online$' "$prep" 2>/dev/null; then
    [ "$(systemctl is-active "$PM2_UNIT" 2>/dev/null)" = active ] && ok "$PM2_UNIT active" || bad "$PM2_UNIT not active: 'sudo systemctl start $PM2_UNIT', then read 'journalctl -u $PM2_UNIT -b'"
    local pm2down; pm2down=$(comm -23 <(grep ' online$' "$prep") <(pm2_list | grep ' online$' || true) | xargs)
    [ -z "$pm2down" ] && ok "every PM2 app that was online is online: $(grep -c ' online$' "$prep")" || bad "PM2 apps down: $pm2down ('$(pm2_cmd) logs <name>')"
  else info "no PM2 app was online before"; fi

  step "notes (no pass rule)"
  info "$(redis-server --version 2>/dev/null | cut -d' ' -f1-3)"
  info "iptables: $(update-alternatives --query iptables 2>/dev/null | sed -n 's/^Value: //p')"
  info "/tmp: $(findmnt -no FSTYPE /tmp 2>/dev/null || echo 'on /')"
  info "clock synced: $(timedatectl show -p NTPSynchronized --value 2>/dev/null) (it can take a few minutes after a boot)"
  info "sshd: $(sudo sshd -T 2>/dev/null | grep -i '^passwordauthentication' || true)"
  info "obsolete packages: $(apt list '?obsolete' 2>/dev/null | grep -c / || true) (review; remove nothing until 24 h after hop 2)"
  info "MANUAL from a laptop: gh api repos/docs-plus/docs.plus/actions/runners --jq '.runners[]|[.name,.status]|@tsv'"

  step "result"
  fact "debian=$vid kernel=$(uname -r) checks=$PASSES/$((PASSES + FAILS))"
  [ "$FAILS" = 0 ] || die "$FAILS check(s) failed" "do not run start. Fix each FAIL and run $0 check again, or run the #747 Rollback"
  [ ! -f "$HOP" ] || sed -i 's/^STATE=.*/STATE=checked/' "$HOP"
  NEXT="$0 start"
}

# #747 step 11. Safe to re-run.
cmd_start() {
  begin 5
  if [ -f "$HOP" ]; then . "$HOP"; [ "$STATE" = checked ] || die "the hop to $NEW is not checked" "run $0 check first"; fi
  NEXT="$0 start is safe to re-run. If it fails again, run the #747 Rollback"
  step "restore the restart policy"
  if [ -s "$RESTART_NO" ]; then
    awk '{sub(/^\//, "", $1); print $1}' "$RESTART_NO" | xargs -r docker update --restart=always >/dev/null
    ok "restart=always on $(wc -l < "$RESTART_NO") containers"
  else info "no held containers recorded"; fi
  step "start the app and the runner"
  local s; for s in "${APP_HELD[@]}"; do "${COMPOSE[@]}" start "$s"; done
  runner_start
  step "wait for health (up to 4 min)"
  local t=0 r h
  while :; do
    r=0 h=0
    for s in "${APP_ALL[@]}"; do r=$((r + $(count_of "$s"))); h=$((h + $(count_of "$s" --filter health=healthy))); done
    printf '  healthy %d/%d (%ds)\n' "$h" "$r" "$t"
    if [ "$h" = "$r" ] || [ "$t" -ge 240 ]; then break; fi
    sleep 10; t=$((t + 10))
  done
  step "verify, as the deploy job does"
  for s in traefik docsplus-redis; do
    [ -n "$(docker ps -q --filter "name=^$s$" --filter status=running)" ] && ok "$s running" || bad "$s not running"
  done
  for s in "${APP_ALL[@]}"; do
    r=$(count_of "$s"); h=$(count_of "$s" --filter health=healthy)
    [ "$r" -gt 0 ] && [ "$h" = "$r" ] && ok "$s: $h/$r healthy" || bad "$s: $h/$r healthy"
  done
  # docker exec with stdin closed: `compose exec` waited on the terminal and ignored its timeout.
  smoke() {
    local c; c=$(docker ps -q --filter "label=com.docker.compose.service=$1" --filter health=healthy | head -n1)
    [ -n "$c" ] && timeout -k 5 20 docker exec "$c" bun -e "fetch('http://localhost:$2$3',{signal:AbortSignal.timeout(5000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" </dev/null
  }
  smoke webapp 3000 /api/health && ok "webapp internal health" || bad "webapp internal health"
  smoke rest-api 4000 /health && ok "rest-api internal health" || bad "rest-api internal health"
  smoke hocuspocus-server 4001 /health && ok "hocuspocus-server internal health" || bad "hocuspocus-server internal health"
  step "record"
  local pause=""
  # Stop to now: it includes the time you took between stages, so it is an upper bound of the outage.
  [ ! -f "$DRAINED" ] || pause=" stop_to_start=$(( ($(date +%s) - $(sed -n 's/^STOP_EPOCH=//p' "$DRAINED")) / 60 ))m"
  r=0 h=0
  for s in "${APP_ALL[@]}"; do r=$((r + $(count_of "$s"))); h=$((h + $(count_of "$s" --filter health=healthy))); done
  fact "up=$(utc) healthy=$h/$r checks=$PASSES/$((PASSES + FAILS))$pause"
  [ "$FAILS" = 0 ] || die "$FAILS check(s) failed"
  [ ! -f "$HOP" ] || mv "$HOP" "$LOGDIR/hop-$NEW.done"
  rm -f "$RESTART_NO" "$DRAINED"
  NEXT="from a laptop: the four curls in #747 step 11, Grafana probe_success, the first createdAt; finish the content-safety block and reopen merges"
  [ -z "$(next_of "$(codename)")" ] || NEXT="$NEXT. Next hop: $0 drain"
  [ -n "$(next_of "$(codename)")" ] || NEXT="$NEXT. Then $0 cves for the after counts"
}

# Repairs the apt sources that make `apt-get update` fail today. It shows each repair and asks
# first, and keeps a copy of each file it changes in the log folder.
cmd_sources() {
  begin 4
  keep_sudo
  local c f u; c=$(codename)
  step "PostgreSQL client source (pgdg)"
  f=/etc/apt/sources.list.d/pgdg.list
  if [ "$c" = bullseye ] && [ -f "$f" ] && q '://apt\.postgresql\.org/' "$f"; then
    info "bullseye left the live PostgreSQL repo; apt-archive.postgresql.org keeps it. Only the host psql client uses it."
    confirm "Point $f at apt-archive.postgresql.org?"
    sudo cp -a "$f" "$LOGDIR/${f##*/}.$(stamp)"
    sudo sed -i 's#://apt\.postgresql\.org/#://apt-archive.postgresql.org/#' "$f"; ok "pgdg uses the archive (hop 1 moves it back to the live repo)"
  else info "nothing to do"; fi
  step "Docker source"
  f=$(grep -rl 'download.docker.com/linux/ubuntu' $(sources) || true)
  if [ -n "$f" ]; then
    info "it names the Ubuntu repo, which has no $c. The installed Docker is a Debian build."
    confirm "Point $f at download.docker.com/linux/debian?"
    sudo cp -a "$f" "$LOGDIR/${f##*/}.$(stamp)"
    sudo sed -i 's#download.docker.com/linux/ubuntu#download.docker.com/linux/debian#' "$f"; ok "Docker uses the Debian repo"
  else info "nothing to do"; fi
  step "yarn (#747 step 4)"
  f=/etc/apt/sources.list.d/yarn.list
  if [ -f "$f" ] || dpkg-query -W yarn >/dev/null 2>&1; then
    u=$( { sudo grep -rls yarn /etc/systemd/system /etc/cron* /var/spool/cron 2>/dev/null; pgrep -af '[y]arn' ; grep -o '"[^"]*yarn[^"]*"' "$HOME/.pm2/dump.pm2" 2>/dev/null; } | xargs || true)
    if [ -z "$u" ]; then
      info "no unit, cron job, process or PM2 app uses yarn"
      confirm "Purge yarn and remove its apt source and key?"
      "${APT[@]}" -y purge yarn
      for f in /etc/apt/sources.list.d/yarn.list /etc/apt/keyrings/yarn.gpg; do [ ! -e "$f" ] || { sudo cp -a "$f" "$LOGDIR/${f##*/}.$(stamp)"; sudo rm -f "$f"; }; done
      ok "yarn removed"
    else
      info "yarn is in use: $u"
      curl -fsS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/yarn.gpg && ok "yarn key refreshed"
    fi
  else info "nothing to do"; fi
  step "verify"
  apt_refresh >/dev/null && ok "apt-get update is clean" || bad "still failing: $APT_BROKEN"
  fact "release=$c apt_clean=$([ -z "$APT_BROKEN" ] && echo yes || echo no)"
  [ "$FAILS" = 0 ] && NEXT="$0 node" || NEXT="read the apt error for $APT_BROKEN, fix it, then $0 sources again"
}

# Node LTS for the whole host, from NodeSource, so `patch` keeps it updated. The app images
# and the runner bring their own Node; this one serves the host and anything run by hand.
cmd_node() {
  begin 5
  keep_sudo
  step "Node now"
  info "/usr/bin/node: $(/usr/bin/node --version 2>/dev/null || echo none), package: $(dpkg-query -W -f='${Version}' nodejs 2>/dev/null || echo none)"
  info "/usr/local/bin/node: $(/usr/local/bin/node --version 2>/dev/null || echo none) (it comes first in PATH)"
  local lts; lts=$(curl -fsS https://nodejs.org/dist/index.json | python3 -c 'import json,sys; print(next(r["version"] for r in json.load(sys.stdin) if r["lts"]))' || true)
  info "newest Node LTS: ${lts:-unknown}"
  [ -z "$lts" ] || [ "${lts%%.*}" = "v$NODE_MAJOR" ] || info "a newer LTS line exists: set NODE_MAJOR=${lts%%.*} in this script"
  step "the NodeSource source for node_$NODE_MAJOR.x"
  local key=/etc/apt/keyrings/nodesource.gpg list=/etc/apt/sources.list.d/nodesource.list
  command -v gpg >/dev/null || "${APT[@]}" -y install gnupg
  sudo install -d -m 755 /etc/apt/keyrings
  curl -fsS https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --batch --yes --dearmor -o "$key"
  echo "deb [signed-by=$key] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee "$list" >/dev/null
  apt_refresh || die "apt-get update fails on: ${APT_BROKEN:-see above}" "run $0 sources to fix them, then $0 node again"
  apt-cache policy nodejs | q "Candidate: $NODE_MAJOR\." && ok "nodejs $NODE_MAJOR is the candidate" || die "apt does not offer nodejs $NODE_MAJOR"
  step "install nodejs $NODE_MAJOR"
  "${APT[@]}" -s install nodejs | grep -E '^(Inst|Remv) ' | sed 's/^/  /' || true
  confirm "Install it? Debian's nodejs and nodejs-doc are replaced; yarn keeps working."
  "${APT[@]}" -y install nodejs
  step "move the old Node out of PATH"
  local bak moved=0 f
  bak=/var/backups/usr-local-node-$(date -u +%Y%m%dT%H%M%SZ)
  for f in node npm npx n corepack pm2-dev pm2-docker pm2-runtime pm2; do
    local p=/usr/local/bin/$f
    [ -e "$p" ] || [ -L "$p" ] || continue
    [ "$p" = "$PM2_WRAPPER" ] && sudo grep -qs 'server-upgrade.sh' "$p" && continue # our pm2 command stays
    sudo mkdir -p "$bak"; sudo mv "$p" "$bak/"; moved=$((moved + 1)); info "moved $p"
  done
  [ "$moved" = 0 ] || info "saved in $bak (to undo: sudo mv $bak/* /usr/local/bin/)"
  hash -r
  step "verify"
  if [ -f "$HOME/.nvm/alias/default" ] && [ "$(cat "$HOME/.nvm/alias/default")" != system ]; then
    info "your login shell loads nvm, whose default is '$(cat "$HOME/.nvm/alias/default")'. It still gives an older node."
    local a; read -r -p "Make your login shell use this node (nvm alias default system)? yes/no: " a || a=no
    [ "$a" != yes ] || { bash -c '. "$HOME/.nvm/nvm.sh" && nvm alias default system' >/dev/null && ok "nvm default is system"; }
  fi
  [[ $(/usr/bin/node --version) == v$NODE_MAJOR.* ]] && ok "/usr/bin/node $(/usr/bin/node --version)" || bad "/usr/bin/node is $(/usr/bin/node --version)"
  local login; login=$(bash -lic 'command -v node' 2>/dev/null | tail -n1)
  [ "$login" = /usr/bin/node ] && ok "a new login shell uses /usr/bin/node" || info "a new login shell uses $login (nvm). 'nvm alias default system' changes that."
  info "npm $(/usr/bin/npm --version 2>/dev/null || echo none) (comes with it; use bun for installs)"
  fact "node=$(/usr/bin/node --version) source=node_$NODE_MAJOR.x moved=$moved"
  NEXT="nothing; $0 patch keeps Node $NODE_MAJOR updated. Next: $0 pm2-boot"
}

# Installs the newest PM2 with bun, runs it on bun (PM2 supports Node 18+ or Bun 1+), moves
# the running daemon to it with `pm2 update`, and points the boot unit at it. Safe to re-run;
# a re-run upgrades PM2 when a newer version exists. TinyDocy restarts for a few seconds.
cmd_pm2_boot() {
  begin 7
  keep_sudo
  step "find the running PM2"
  local pid old want
  systemctl cat "$PM2_UNIT" >/dev/null 2>&1 || die "there is no $PM2_UNIT unit" "create it once with the pm2 'startup' command, then run $0 pm2-boot"
  pid=$(pm2_daemon); [ -n "$pid" ] || die "no PM2 daemon runs for $USER" "if nothing needs PM2, run 'sudo systemctl disable $PM2_UNIT'"
  old=$(pm2_version_of "$pid"); [ -n "$old" ] || die "could not read the daemon's PM2 version"
  info "daemon: PM2 $old on $(readlink "/proc/$pid/exe")"
  want=${PM2_VERSION:-$(curl -fsS https://registry.npmjs.org/pm2/latest | python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])')}
  [ -n "$want" ] || die "could not read the newest PM2 version" "set PM2_VERSION=<version> and run again"
  info "target: PM2 $want on bun $("$BUN" --version)"
  step "install pm2@$want with bun"
  "$BUN" add -g "pm2@$want"
  [ -f "$PM2_JS" ] || die "pm2 is not at $PM2_JS" "find where 'bun add -g' put it, and set PM2_JS"
  rm -f "$HOME/.bun/bin/pm2" # bun's link runs on node; the one pm2 command is $PM2_WRAPPER
  [ "$("$BUN" "$PM2_JS" --version 2>/dev/null | tail -n1)" = "$want" ] && ok "pm2 $want runs on bun" || die "pm2 $want does not run on bun"
  "$BUN" "$PM2_JS" jlist 2>/dev/null | pm2_json | python3 -c 'import json,sys
for p in json.load(sys.stdin): print(p["name"], p["pm2_env"]["status"])' | sort > "$LOGDIR/pm2-before-update.txt"
  info "apps now: $(xargs < "$LOGDIR/pm2-before-update.txt")"
  step "write the pm2 command ($PM2_WRAPPER)"
  if [ -e "$PM2_WRAPPER" ] && ! sudo grep -qs 'server-upgrade.sh' "$PM2_WRAPPER"; then
    sudo mv "$PM2_WRAPPER" "$PM2_WRAPPER.bak-$(date -u +%Y%m%dT%H%M%SZ)"
  fi
  [ ! -L "$PM2_WRAPPER" ] || sudo rm -f "$PM2_WRAPPER" # an old broken link
  printf '#!/bin/sh\n# Written by server-upgrade.sh pm2-boot: PM2 %s on bun.\nexec %s %s "$@"\n' "$want" "$BUN" "$PM2_JS" | sudo tee "$PM2_WRAPPER" >/dev/null
  sudo chmod 755 "$PM2_WRAPPER"
  [ "$("$PM2_WRAPPER" --version | tail -n1)" = "$want" ] && ok "$PM2_WRAPPER runs PM2 $want" || die "$PM2_WRAPPER does not run"
  step "move the running daemon to PM2 $want on bun (pm2 update)"
  if [ "$old" = "$want" ] && [ "$(readlink "/proc/$pid/exe")" = "$(readlink -f "$BUN")" ]; then
    info "the daemon already runs PM2 $want on bun"
  else
    [ "$(pgrep -fc '[/]bin/Runner.Worker' || true)" = 0 ] || die "a deploy job runs now; pm2 update would kill it" "wait until it ends, then run $0 pm2-boot again"
    confirm "pm2 update restarts every PM2 app (TinyDocy, and the runner while it is still in PM2) for a few seconds."
    NEXT="to go back: $BUN x pm2@$old update (the old PM2 on node)"
    "$PM2_WRAPPER" update
  fi
  pid=$(pm2_daemon)
  [ -n "$pid" ] && [ "$(pm2_version_of "$pid")" = "$want" ] && ok "daemon is PM2 $want" || die "the daemon is not PM2 $want" "$NEXT"
  info "daemon runtime: $(readlink "/proc/$pid/exe")"
  step "save the app list that the boot restores"
  "$PM2_WRAPPER" save >/dev/null && ok "pm2 save"
  step "point the boot unit at $PM2_WRAPPER"
  sudo mkdir -p "${PM2_DROPIN%/*}"
  sudo tee "$PM2_DROPIN" >/dev/null <<UNIT
# Written by server-upgrade.sh pm2-boot on $(utc): PM2 $want on bun, outside /tmp.
[Service]
Environment=PATH=$HOME/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=
ExecStart=$PM2_WRAPPER resurrect
ExecReload=
ExecReload=$PM2_WRAPPER reload all
ExecStop=
ExecStop=$PM2_WRAPPER kill
UNIT
  sudo systemctl daemon-reload
  sudo systemctl reset-failed "$PM2_UNIT" 2>/dev/null || true
  [ "$(systemctl is-enabled "$PM2_UNIT")" = enabled ] || sudo systemctl enable "$PM2_UNIT"
  step "verify"
  pm2_boot_ok && ok "$PM2_UNIT runs: $(pm2_cmd) resurrect" || bad "the boot unit does not reach PM2"
  local down saved now
  down=$(comm -23 <(grep ' online$' "$LOGDIR/pm2-before-update.txt" || true) <(pm2_list | grep ' online$' || true) | xargs)
  [ -z "$down" ] && ok "every app that was online is online: $(pm2_list | grep -c ' online$' || true)" || bad "apps down after the update: $down"
  saved=$(python3 -c 'import json,os; print(" ".join(sorted(p["name"] for p in json.load(open(os.path.expanduser("~/.pm2/dump.pm2"))))))')
  now=$(pm2_list | awk '{print $1}' | sort | xargs)
  [ "$saved" = "$now" ] && ok "the saved list matches the running list" || bad "saved [$saved] differs from running [$now]"
  info "editor-purge stays stopped: PM2 starts it from its cron at 03:17"
  fact "pm2=$old->$want runtime=$(basename "$(readlink "/proc/$pid/exe")") apps=$(pm2_list | wc -l) online=$(pm2_list | grep -c ' online$' || true)"
  [ "$FAILS" = 0 ] || NEXT="to go back: $BUN x pm2@$old update"
  [ "$FAILS" != 0 ] || NEXT="the next boot proves it: $0 reboot (#708), then $0 check"
}

# #708: one plain reboot that proves every service comes back with no manual start.
cmd_reboot() {
  begin 8
  [ ! -f "$HOP" ] && [ ! -f "$DRAINED" ] || die "an upgrade window is open" "finish it with hop, check or start"
  preflight reboot
  queue_gate
  step "save the pre-reboot lists"
  save_pre
  info "MANUAL before you go on: a snapshot from the last hour (or #748 step 11), the Recovery Console login works,"
  info "TinyDocy's owner knows the time, and the laptop probe runs."
  confirm "This stops hocuspocus-server, then reboots the host (a few minutes of full outage)."
  NEXT="run $0 start to bring hocuspocus-server back"
  stop_and_drain
  step "pending Docker upgrade (it restarts every container, so it runs inside this outage)"
  local dk; dk=$(apt list --upgradable 2>/dev/null | grep -E '^(docker|containerd)' | cut -d/ -f1 | xargs || true)
  if [ -n "$dk" ]; then
    local a; read -r -p "Upgrade $dk now, before the reboot? yes/no: " a || a=no
    if [ "$a" = yes ]; then keep_sudo; "${APT[@]}" -y install --only-upgrade $dk; ok "docker $(docker version --format '{{.Server.Version}}')"; fi
  else info "none"; fi
  step "reboot"
  printf 'STOP_EPOCH=%s\nSTOP_UTC=%s\nRELEASE=%s\n' "$STOP_EPOCH" "$STOP_UTC" "$(codename)" > "$DRAINED"
  fact "stop=$STOP_UTC drain=${DRAIN_S}s kernel_now=$(uname -r)"
  NEXT="log in after the boot, reattach screen (screen -r) or open a new one, run $0 check, then $0 start (it starts nothing that already runs)"
  finish; trap - EXIT
  sleep 2; sudo systemctl reboot
}

# Removes what the release hops left behind: obsolete packages, old kernels, leftover configs and
# upgrade copies. It keeps the running kernel, one older kernel to boot from, the services below,
# and every old library that a binary in /usr/local, /opt or bun's global folder still links.
CLEAN_KEEP=(unattended-upgrades ntpsec usrmerge)
cmd_cleanup() {
  begin 7
  [ ! -f "$HOP" ] && [ ! -f "$DRAINED" ] || die "an upgrade window is open" "finish it with hop, check or start first"
  [ -z "$(dpkg --audit)" ] || die "dpkg --audit is not empty" "run $0 patch first"
  keep_sudo
  local kb; kb=$(df --output=used -k / | tail -n1)
  local containers pm2on; containers=$(docker ps -q | wc -l); pm2on=$(pm2_list | grep -c ' online$' || true)

  step "decide what must stay (scans native binaries, about 20 s)"
  local run_k fallback p l obs libs linked
  local -a keep=()
  run_k=linux-image-$(uname -r)
  fallback=$(dpkg-query -W -f='${Package} ${Status}\n' 'linux-image-[0-9]*' 2>/dev/null | awk '/ok installed/{print $1}' | grep -vx "$run_k" | sort -V | tail -n1 || true)
  keep+=("$run_k"); [ -z "$fallback" ] || keep+=("$fallback")
  for p in "${CLEAN_KEEP[@]}"; do dpkg-query -W -f='${Status}' "$p" 2>/dev/null | q 'ok installed' && keep+=("$p"); done
  obs=$(apt list '?obsolete' 2>/dev/null | grep / | cut -d/ -f1 | sort -u || true)
  libs=$(for p in $obs; do dpkg -L "$p" 2>/dev/null | grep -E '\.so(\.[0-9]+)*$' || true; done | xargs -rn1 basename | sort -u)
  # find returns 1 on an unreadable folder, ldd returns 1 on a script: both are normal here.
  linked=$( { find /usr/local -xdev -type f \( -perm -u+x -o -name '*.so' -o -name '*.so.*' \) 2>/dev/null || true
              find /opt "$HOME/.bun/install/global" -xdev -type f \( -name '*.node' -o -name '*.so' -o -name '*.so.*' \) 2>/dev/null || true; } \
    | while read -r f; do { ldd "$f" 2>/dev/null || true; } | awk '{print $1}'; done | sort -u | comm -12 - <(echo "$libs") || true)
  for l in $linked; do p=$(dpkg -S "*/$l" 2>/dev/null | awk -F: 'NR==1{print $1}' || true); [ -z "$p" ] || keep+=("$p"); done
  mapfile -t keep < <(printf '%s\n' "${keep[@]}" | sort -u)
  info "keeping: ${keep[*]}"
  [ -z "$linked" ] || info "old libraries still linked by local binaries: $(echo "$linked" | xargs)"
  sudo apt-mark manual "${keep[@]}" >/dev/null
  info "MANUAL: a finished snapshot of this host exists (the cleanup cannot be undone)."
  confirm "Go on to the package lists?"

  step "obsolete packages (in no current apt source)"
  local purge sim extra n=0
  purge=$(comm -23 <(echo "$obs") <(printf '%s\n' "${keep[@]}") | grep . || true)
  if [ -n "$purge" ]; then
    n=$(wc -l <<< "$purge")
    sim=$("${APT[@]}" -s purge $purge 2>/dev/null | awk '/^(Purg|Remv) /{print $2}' | sort -u)
    extra=$(comm -23 <(echo "$sim") <(echo "$purge") | xargs)
    [ -z "$extra" ] || die "apt would also remove packages that are not obsolete: $extra" "check them, then remove by hand"
    echo "$purge" | xargs | fold -s -w 110 | sed 's/^/  /'
    confirm "Purge these $n obsolete packages?"
    "${APT[@]}" -y purge $purge
  else info "none"; fi

  step "packages nothing needs any more (autoremove)"
  local auto hit
  auto=$("${APT[@]}" -s autoremove --purge 2>/dev/null | awk '/^(Purg|Remv) /{print $2}' | sort -u)
  hit=$(comm -12 <(echo "$auto") <(printf '%s\n' "${keep[@]}") | xargs)
  [ -z "$hit" ] || die "autoremove would remove kept packages: $hit" "mark them manual, then run $0 cleanup again"
  if [ -n "$auto" ]; then
    echo "$auto" | xargs | fold -s -w 110 | sed 's/^/  /'
    confirm "Remove these $(wc -l <<< "$auto") packages?"
    "${APT[@]}" -y autoremove --purge
    n=$((n + $(wc -l <<< "$auto")))
  else info "none"; fi

  step "config files left by removed packages"
  local rc; rc=$(dpkg -l | awk '/^rc/{print $2}')
  if [ -n "$rc" ]; then
    echo "$rc" | xargs | fold -s -w 110 | sed 's/^/  /'
    confirm "Purge the configs of these $(wc -l <<< "$rc") removed packages?"
    sudo dpkg --purge $rc >/dev/null
  else info "none"; fi

  step "upgrade copies and caches"
  local -a junk=()
  for p in "$HOME"/apt-*.bak /var/backups/usr-local-node-*; do [ -e "$p" ] && junk+=("$p"); done
  while read -r p; do [ -n "$p" ] && junk+=("$p"); done < <(sudo find /etc \( -name '*.dpkg-dist' -o -name '*.ucf-dist' -o -name '*.dpkg-old' -o -name '*.ucf-old' \) 2>/dev/null)
  dpkg-query -W yarn >/dev/null 2>&1 || { [ ! -d "$HOME/.cache/yarn" ] || junk+=("$HOME/.cache/yarn"); }
  if [ "${#junk[@]}" -gt 0 ]; then
    { sudo du -sh "${junk[@]}" 2>/dev/null || true; } | sed 's/^/  /'
    confirm "Delete these ${#junk[@]} paths? (Debian's default config copies only; your own files stay)"
    sudo rm -rf -- "${junk[@]}"
  else info "none"; fi
  docker image prune -f >/dev/null && ok "dangling Docker images pruned"

  step "verify"
  [ -z "$(dpkg --audit)" ] && ok "dpkg audit clean" || bad "dpkg --audit is not empty"
  dpkg-query -W -f='${Status}' "$run_k" 2>/dev/null | q 'ok installed' && sudo grep -q "vmlinuz-$(uname -r)" /boot/grub/grub.cfg \
    && ok "running kernel kept and in grub" || bad "the running kernel is not installed or not in grub.cfg"
  [ -z "$fallback" ] || { sudo grep -q "vmlinuz-${fallback#linux-image-}" /boot/grub/grub.cfg && ok "fallback kernel ${fallback#linux-image-} in grub" || bad "fallback kernel missing from grub.cfg"; }
  [ "$(systemctl is-enabled unattended-upgrades 2>/dev/null)" = enabled ] && ok "unattended-upgrades enabled" || bad "unattended-upgrades is not enabled"
  systemctl is-active ntpsec >/dev/null 2>&1 && ok "ntpsec active" || bad "no time sync service (ntpsec) active"
  [ ! -x /usr/local/bin/python3.13 ] || { /usr/local/bin/python3.13 -c 'import ssl, hashlib, ctypes, readline' 2>/dev/null && ok "/usr/local Python still loads ssl, hashlib, ctypes" || bad "/usr/local Python lost a module"; }
  [ "$(docker ps -q | wc -l)" = "$containers" ] && ok "$containers containers still run" || bad "containers: $(docker ps -q | wc -l), before $containers"
  [ "$(pm2_list | grep -c ' online$' || true)" = "$pm2on" ] && ok "$pm2on PM2 apps still online" || bad "PM2 apps online changed from $pm2on"
  apt_refresh >/dev/null && ok "apt-get update is clean" || bad "apt-get update fails on: $APT_BROKEN"
  local freed=$(( (kb - $(df --output=used -k / | tail -n1)) / 1024 ))
  fact "removed_packages=$n freed=${freed}MiB kernels=$(uname -r)${fallback:+,${fallback#linux-image-}}"
  [ "$FAILS" = 0 ] || die "$FAILS check(s) failed" "read the FAIL lines; the post-cleanup snapshot is the rollback"
  NEXT="$0 cves, to see the fixed-not-installed count drop"
}

cmd_help() {
  cat <<EOF
Usage: $0 <stage>      (as the deploy user, inside screen or tmux)

  status     what is out of date now (refreshes the package lists only)
  inventory  #747 step 1: save the before lists; reads for steps 3 and 4
  cves       #747 steps 2 and 12: CVE counts
  patch      #747 step 5, and the monthly update: all packages in this release
  sources    fix the apt sources that fail today (pgdg, Docker, yarn), each asked first
  node       install Node $NODE_MAJOR LTS for the host (NodeSource apt), move the old Node out of PATH
  pm2-boot   newest PM2 with bun, on bun; PM2 apps (TinyDocy) come back after a boot
  reboot     #708: drain the store queue, reboot, then prove all came back (check, start)
  cleanup    after the last hop: obsolete packages, old kernels, leftover configs and copies
  drain      #747 step 7: preflight, then stop the runner and the app after the store queue drains
  hop        #747 steps 8-9: next release, upgrade, reboot (a rerun resumes a broken hop)
  check      #747 step 10: host checks after the reboot
  start      #747 step 11: start the app and run the deploy's health checks

Before any boot:  sources, node, then pm2-boot, once each. The runner comes back as a PM2 app until #743.
Window, per hop:  drain -> DigitalOcean snapshot pre-<release> -> hop -> check -> start
Rollback:         drain (if the app runs) -> restore the snapshot -> check -> start
Logs:             $LOGDIR/<time>-<stage>.log, one RESULT line per stage in $LEDGER
EOF
}

case "$STAGE" in
  status | inventory | cves | patch | drain | hop | check | start | reboot | sources | cleanup) "cmd_$STAGE" ;;
  node) cmd_node ;;
  pm2-boot) cmd_pm2_boot ;;
  *) cmd_help; DONE=1; [ "$STAGE" = help ] || exit 1 ;;
esac
