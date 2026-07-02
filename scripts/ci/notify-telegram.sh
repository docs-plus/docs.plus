#!/usr/bin/env bash
# Usage: notify-telegram.sh <env-file|-> <text>
# Reads TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID from the env file, or from the
# process environment when the first arg is '-'. Never fails the caller.
set -u
SRC="${1:-}"
TEXT="${2:-}"
if [ "${SRC}" != "-" ]; then
  TELEGRAM_BOT_TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' "${SRC}" 2>/dev/null | cut -d= -f2- || true)
  TELEGRAM_CHAT_ID=$(grep '^TELEGRAM_CHAT_ID=' "${SRC}" 2>/dev/null | cut -d= -f2- || true)
fi
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ] || [ -z "${TEXT}" ]; then
  echo "::warning::Telegram credentials or message text unavailable; skipping notification"
  exit 0
fi
curl -sf --max-time 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d chat_id="${TELEGRAM_CHAT_ID}" -d text="${TEXT}" >/dev/null \
  || echo "::warning::Telegram notification failed"
exit 0
