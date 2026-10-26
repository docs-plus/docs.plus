#!/usr/bin/env bash
# Builds the compose env file for one prod job and refuses a host env that lacks
# a key the deploy needs. Both prod jobs call it, so the guards exist once.
set -eo pipefail
: "${ENV_SOURCE:?}" "${ENV_FILE:?}" "${DEPLOY_TAG:?}"

# Compose `--env-file` is the single source of truth. We do NOT also
# `set -a; source` it elsewhere — that path was double-loading and
# leaking vars to subshells unintentionally.
cp "${ENV_SOURCE}" "${ENV_FILE}"
echo "DEPLOY_TAG=${DEPLOY_TAG}" >> "${ENV_FILE}"

# Error capture must never silently regress: both DSNs feed GlitchTip.
# Require a real first character — dotenv strips quotes, so KEY="" or
# whitespace-only values are empty at runtime.
for k in GLITCHTIP_DSN NEXT_PUBLIC_GLITCHTIP_DSN; do
  if ! grep -Eq "^${k}=[\"']?[^\"'[:space:]]" "${ENV_FILE}"; then
    echo "::error::${k} is missing or empty in ${ENV_SOURCE}. Set it to the GlitchTip project DSN (https://glitchtip.docs.plus) before deploying."
    exit 1
  fi
done

# Email must be an explicit choice. Without the last two, every
# unsubscribe link is rejected and the one-click header is dropped.
for k in EMAIL_PROVIDER EMAIL_FROM EMAIL_UNSUBSCRIBE_SECRET PUBLIC_RESTAPI_URL; do
  if ! grep -Eq "^${k}=[\"']?[^\"'[:space:]]" "${ENV_FILE}"; then
    echo "::error::${k} is missing or empty in ${ENV_SOURCE}. Email needs EMAIL_PROVIDER, EMAIL_FROM, EMAIL_UNSUBSCRIBE_SECRET and PUBLIC_RESTAPI_URL. Set it in the host env file, then redeploy."
    exit 1
  fi
done

# Private document media fails closed without it (#439). Never print the value.
media_secret=$(grep -E '^MEDIA_COOKIE_SECRET=' "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d "\"'" || true)
if [ "${#media_secret}" -lt 32 ]; then
  echo "::error::MEDIA_COOKIE_SECRET is missing or shorter than 32 characters in ${ENV_SOURCE}. Without it, no one can load a Private document's media. Set it (openssl rand -hex 32), then redeploy."
  exit 1
fi

# Redis runs with --requirepass (#438). Never print the value.
redis_password=$(grep -E '^REDIS_PASSWORD=' "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d "\"'" || true)
if [ "${#redis_password}" -lt 32 ]; then
  echo "::error::REDIS_PASSWORD is missing or shorter than 32 characters in ${ENV_SOURCE}. Redis requires it. Set it (openssl rand -hex 32) here and in .env.observability, then redeploy."
  exit 1
fi

# The webapp bakes its VAPID key at build; a mismatch silently breaks push (#609).
# Both empty passes. `|| true` stops pipefail from ending the step on an absent key.
# Compose takes the last line of a repeated key, so read the last line too.
vapid_public=$(grep -E '^VAPID_PUBLIC_KEY=' "${ENV_FILE}" | tail -n 1 | cut -d= -f2- | tr -d "\"'" || true)
next_vapid_public=$(grep -E '^NEXT_PUBLIC_VAPID_PUBLIC_KEY=' "${ENV_FILE}" | tail -n 1 | cut -d= -f2- | tr -d "\"'" || true)
if [ "${vapid_public}" != "${next_vapid_public}" ]; then
  echo "::error::VAPID_PUBLIC_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY differ in ${ENV_SOURCE}. Every push send fails with 403. Set both to the same public key, then rebuild and redeploy."
  exit 1
fi
