#!/bin/bash

# Production monitoring script for Next.js application
# This script continuously monitors the application health and logs issues

set -e

# Configuration
APP_URL="http://localhost:3001"
HEALTH_ENDPOINT="/api/health"
LOG_FILE="./logs/monitor.log"
CHECK_INTERVAL=30  # seconds
MAX_FAILURES=3
ALERT_EMAIL=""  # Set this to receive email alerts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
CONSECUTIVE_FAILURES=0

# Logging function
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"

    # Also log to syslog if available
    if command -v logger >/dev/null 2>&1; then
        logger -t "docsy-monitor" "[$level] $message"
    fi
}

# Health check function
check_health() {
    local response_code
    local response_time
    local start_time=$(date +%s%N)

    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL$HEALTH_ENDPOINT" --max-time 10)
    local curl_exit_code=$?

    local end_time=$(date +%s%N)
    response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

    if [ $curl_exit_code -eq 0 ] && [ "$response_code" -eq 200 ]; then
        log_message "INFO" "Health check passed (${response_time}ms)"
        CONSECUTIVE_FAILURES=0
        return 0
    else
        log_message "ERROR" "Health check failed (HTTP: $response_code, Exit: $curl_exit_code, Time: ${response_time}ms)"
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        return 1
    fi
}

# System metrics function
collect_metrics() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    local memory_usage=$(free | grep '^Mem:' | awk '{printf "%.1f", $3/$2 * 100.0}')
    local disk_usage=$(df -h . | awk 'NR==2 {print $5}' | cut -d'%' -f1)

    log_message "METRICS" "CPU: ${cpu_usage}%, Memory: ${memory_usage}%, Disk: ${disk_usage}%"

    # Check for high resource usage
    if (( $(echo "$memory_usage > 80" | bc -l) )); then
        log_message "WARN" "High memory usage detected: ${memory_usage}%"
    fi

    if [ "$disk_usage" -gt 85 ]; then
        log_message "WARN" "High disk usage detected: ${disk_usage}%"
    fi
}

# PM2 status check
check_pm2_status() {
    local pm2_status=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="nextjs_production") | .pm2_env.status' 2>/dev/null || echo "unknown")

    if [ "$pm2_status" = "online" ]; then
        log_message "INFO" "PM2 process status: online"
    else
        log_message "ERROR" "PM2 process status: $pm2_status"
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    fi
}

# Alert function
send_alert() {
    local message=$1

    log_message "ALERT" "$message"

    # Send email if configured
    if [ -n "$ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "Docsy Application Alert" "$ALERT_EMAIL"
    fi

    # Slack webhook notification (if configured)
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Docsy Alert: $message\"}" \
            "$SLACK_WEBHOOK" > /dev/null 2>&1 || true
    fi
}

# Auto-recovery function
attempt_recovery() {
    log_message "WARN" "Attempting automatic recovery..."

    # Try PM2 restart
    if pm2 restart nextjs_production > /dev/null 2>&1; then
        log_message "INFO" "PM2 restart completed"
        sleep 30  # Wait for app to start

        if check_health; then
            log_message "INFO" "Recovery successful"
            send_alert "Application recovered automatically via PM2 restart"
            return 0
        fi
    fi

    # If PM2 restart failed, try reload
    if pm2 reload nextjs_production > /dev/null 2>&1; then
        log_message "INFO" "PM2 reload completed"
        sleep 30

        if check_health; then
            log_message "INFO" "Recovery successful via reload"
            send_alert "Application recovered automatically via PM2 reload"
            return 0
        fi
    fi

    log_message "ERROR" "Automatic recovery failed"
    return 1
}

# Cleanup function
cleanup() {
    log_message "INFO" "Monitor script stopping..."
    exit 0
}

# Signal handlers
trap cleanup SIGINT SIGTERM

# Main monitoring loop
main() {
    log_message "INFO" "Starting monitoring script (PID: $$, Interval: ${CHECK_INTERVAL}s)"

    # Create logs directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"

    while true; do
        # Check application health
        if ! check_health; then
            if [ $CONSECUTIVE_FAILURES -ge $MAX_FAILURES ]; then
                send_alert "Application health check failed $CONSECUTIVE_FAILURES consecutive times"

                # Attempt automatic recovery
                if attempt_recovery; then
                    CONSECUTIVE_FAILURES=0
                else
                    send_alert "Critical: Application is down and automatic recovery failed"
                    # Continue monitoring even after failure
                fi
            fi
        fi

        # Check PM2 status
        check_pm2_status

        # Collect system metrics (every 5 checks)
        if [ $(($(date +%s) % 150)) -eq 0 ]; then
            collect_metrics
        fi

        sleep $CHECK_INTERVAL
    done
}

# Help function
show_help() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -i, --interval SEC  Set check interval in seconds (default: 30)"
    echo "  -e, --email EMAIL   Set alert email address"
    echo "  -u, --url URL       Set application URL (default: http://localhost:3001)"
    echo ""
    echo "Example:"
    echo "  $0 --interval 60 --email admin@example.com"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -i|--interval)
            CHECK_INTERVAL="$2"
            shift 2
            ;;
        -e|--email)
            ALERT_EMAIL="$2"
            shift 2
            ;;
        -u|--url)
            APP_URL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Start monitoring
main
