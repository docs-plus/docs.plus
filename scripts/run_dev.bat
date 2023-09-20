@echo off
REM This is a batch script to automate the process of running a development server.
REM Written by: Hossein Marzban

REM Check if node_modules directory exists
IF NOT EXIST "node_modules\" (
    echo node_modules directory not found. Installing dependencies...
    call yarn
    IF %ERRORLEVEL% NEQ 0 (
        echo Failed to install dependencies. Exiting script.
        exit /b 1
    ) ELSE (
        echo Dependencies installed successfully.
    )
)

REM Change directory to the server package
cd packages\hocuspocus.server

REM Set the NODE_ENV variable to 'development'
set NODE_ENV=development

REM Check if .env file exists
IF NOT EXIST ".env" (
    echo .env file not found. Creating one from .env.example...
    copy .env.example .env
    IF %ERRORLEVEL% NEQ 0 (
        echo Failed to create .env file. Exiting script.
        exit /b 1
    ) ELSE (
        echo .env file created successfully.
    )
)

REM Load .env file
FOR /F "tokens=*" %%G IN (.env) DO SET %%G

REM Ensure PG_HOST and PG_PORT are set and not empty
IF "%PG_HOST%"=="" (
    echo PG_HOST is not set. Please ensure you have this variable set in your .env file.
    exit /b 1
)
IF "%PG_PORT%"=="" (
    echo PG_PORT is not set. Please ensure you have this variable set in your .env file.
    exit /b 1
)

REM Use nc (netcat) to check if the port is open
nc -z %PG_HOST% %PG_PORT%
IF %ERRORLEVEL% NEQ 0 (
    echo No PostgreSQL database found on %PG_HOST%:%PG_PORT%
    echo Please run your PostgreSQL server. We cannot connect to the PostgreSQL server; also please ensure you added PG_HOST and PG_PORT correctly in your .env file.
    echo If you don't have PostgreSQL installed, please download it or run a Docker PostgreSQL database.
    exit /b 1
) ELSE (
    echo PostgreSQL is running on %PG_HOST%:%PG_PORT%
)

REM Run npm prisma:init:migrations and wait until it's finished
echo Running npm run prisma:init:migrations
npm run prisma:init:migrations
IF %ERRORLEVEL% NEQ 0 (
    echo npm run prisma:init:migrations failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

REM Run prisma:migrate:dev in the current directory
echo Running prisma:migrate:dev
npm run prisma:migrate:dev
IF %ERRORLEVEL% NEQ 0 (
    echo npm run prisma:migrate:dev failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

REM Run npm run dev and npm run dev:ws simultaneously in the background
echo Running npm run dev and npm run dev:ws
start /B npm run dev
start /B npm run dev:ws

REM Change directory to the frontend package
cd ..\webapp

REM Run the frontend server
echo Running npm run dev for the frontend
npm run dev

REM End of script
