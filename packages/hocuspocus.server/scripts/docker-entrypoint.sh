#!/bin/sh
set -e

# Determine which processes to run based on ENVIRONMENT
if [ "$ENVIRONMENT" = "prod" ]; then
  REST_NAME="prod_rest"
  WS_NAME="prod_ws"
elif [ "$ENVIRONMENT" = "stage" ]; then
  REST_NAME="stage_rest"
  WS_NAME="stage_ws"
else
  # Default to stage if not specified
  REST_NAME="stage_rest"
  WS_NAME="stage_ws"
fi

echo "🚀 Starting services..."
echo "📊 Environment: $ENVIRONMENT"
echo "📦 REST API: $REST_NAME"
echo "🔌 WebSocket: $WS_NAME"
echo ""

# Start PM2 daemon
bunx pm2 ping

# Start REST API with PM2
echo "Starting REST API..."
bunx pm2 start src/index.ts \
  --name "$REST_NAME" \
  --interpreter bun \
  --max-memory-restart 500M \
  --log logs/${REST_NAME}.log \
  --error logs/${REST_NAME}-error.log \
  --out logs/${REST_NAME}-out.log

# Start WebSocket with PM2
echo "Starting WebSocket server..."
bunx pm2 start src/hocuspocus.server.ts \
  --name "$WS_NAME" \
  --interpreter bun \
  --max-memory-restart 1G \
  --log logs/${WS_NAME}.log \
  --error logs/${WS_NAME}-error.log \
  --out logs/${WS_NAME}-out.log

# Wait for processes to start
sleep 2

# Show PM2 status
echo ""
echo "✅ Services started!"
bunx pm2 list

# Keep container running and tail logs
exec bunx pm2 logs --raw

