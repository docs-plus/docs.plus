#!/bin/sh
set -e

# Determine which PM2 processes to run based on ENVIRONMENT
if [ "$ENVIRONMENT" = "prod" ]; then
  PM2_PROCESSES="prod_rest,prod_ws"
elif [ "$ENVIRONMENT" = "stage" ]; then
  PM2_PROCESSES="stage_rest,stage_ws"
else
  # Default to stage if not specified
  PM2_PROCESSES="stage_rest,stage_ws"
fi

echo "🚀 Starting PM2 with processes: $PM2_PROCESSES"
echo "📊 Environment: $ENVIRONMENT"

# Run PM2 in runtime mode (foreground, Docker-friendly)
exec bunx pm2-runtime scripts/pm2.config.ts --only "$PM2_PROCESSES"

