#!/bin/bash
# This is a bash script to automate the process of running a development server.
# Written by: Hossein Marzban

# Check if node_modules directory exists
if [ ! -d "node_modules" ]; then
  echo "node_modules directory not found. Installing dependencies..."
  yarn
  if [ $? -eq 0 ]; then
    echo "Dependencies installed successfully."
  else
    echo "Failed to install dependencies. Exiting script."
    exit 1
  fi
fi


# Change directory to the server package
cd packages/hocuspocus.server

# Set the NODE_ENV variable to 'development'
export NODE_ENV=development

# Check if .env file exists
if [ ! -f .env ]; then
    echo ".env file not found. Creating one from .env.example..."
    cp .env.example .env
    if [ $? -eq 0 ]; then
        echo ".env file created successfully."
    else
        echo "Failed to create .env file. Exiting script."
        exit 1
    fi
fi

# Load .env file
set -a
source ./.env
set +a

# Ensure PG_HOST and PG_PORT are set and not empty
if [ -z "$PG_HOST" ] || [ -z "$PG_PORT" ]; then
  echo "PG_HOST or PG_PORT is not set. Please ensure you have these variables set in your .env file."
  exit 1
fi

# Use nc (netcat) to check if the port is open
nc -z "$PG_HOST" "$PG_PORT"

# Check the exit code of the previous command
if [ $? -eq 0 ]; then
  echo "PostgreSQL is running on $PG_HOST:$PG_PORT"
else
  echo "No PostgreSQL database found on $PG_HOST:$PG_PORT"
  echo "Please run your PostgreSQL server. We cannot connect to the PostgreSQL server; also please ensure you added PG_HOST and PG_PORT correctly in your .env file."
  echo "If you don't have PostgreSQL installed, please download it or run a Docker PostgreSQL database."
  exit 1
fi

# Run npm prisma:init:migrations and wait until it's finished
echo "Running npm run prisma:init:migrations"
npm run prisma:init:migrations

# Ensure that the previous command was successful before continuing
# If not, the script will exit with the error code from the last command
if [ $? -ne 0 ]; then
    echo "npm run prisma:init:migrations failed with error code $?"
    exit $?
fi

# Run prisma:migrate:dev in the current directory
echo "Running prisma:migrate:dev"
npm run prisma:migrate:dev

# Check if the prisma:migrate:dev was successful
if [ $? -ne 0 ]; then
    echo "npm run prisma:migrate:dev failed with error code $?"
    exit $?
fi

# Run npm run dev and npm run dev:ws simultaneously in the background
echo "Running npm run dev and npm run dev:ws"
(npm run dev:pg &)
(npm run dev:ws &)

# Wait for a while to let the backend server start
# sleep 10

# Change directory to the frontend package
cd ../webapp

# Run the frontend server
echo "Running npm run dev for the frontend"
npm run dev

# End of script
