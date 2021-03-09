@echo off

:: Change directory to etherpad-lite root
cd /D "%~dp0\.."

:: Is node installed?
cmd /C node -e "" || ( echo "Please install node.js ( https://nodejs.org )" && exit /B 1 )

:: By Hossein
@REM echo _
@REM echo Setting up wsgateway...
@REM IF NOT EXIST ws.router (
@REM   git clone https://github.com/HMarzban/wsgateway.git ws.router
@REM   cd /D "ws.router"
@REM   cmd /C npm ci || exit /B 1
@REM ) ELSE (
@REM   cd /D "ws.router"
@REM   git init 
@REM   git remote add origin https://github.com/HMarzban/wsgateway.git
@REM   git pull https://github.com/HMarzban/wsgateway.git main
@REM   cmd /C npm ci || exit /B 1
@REM ) 
@REM cd /D "%~dp0\.."54

echo _
echo Ensure that all dependencies are up to date...  If this is the first time you have run Etherpad please be patient.

mkdir node_modules
cd /D node_modules
mklink /D "ep_etherpad-lite" "..\src"

cd /D "ep_etherpad-lite"
cmd /C npm ci || exit /B 1

cd /D "%~dp0\.."

echo _
echo Clearing cache...
del /S var\minified*

@REM echo _
@REM echo Setting up settings.json...
@REM IF NOT EXIST settings.json (
@REM   echo Can't find settings.json.
@REM   echo Copying settings.json.template...
@REM   cmd /C copy settings.json.template settings.json || exit /B 1
@REM )

@REM echo _
@REM echo Installed Etherpad! To run Etherpad type start.bat
