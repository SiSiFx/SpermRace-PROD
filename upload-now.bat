@echo off
setlocal
echo Uploading tarball to VPS...

REM No secrets in repo. Set VPS_IP/VPS_USER in env (or edit locally).
set "VPS_IP=%VPS_IP%"
if "%VPS_IP%"=="" set "VPS_IP=REPLACE_WITH_VPS_IP"
set "VPS_USER=%VPS_USER%"
if "%VPS_USER%"=="" set "VPS_USER=root"

REM Run from repo root so spermrace-deploy.tar.gz is resolved correctly.
cd /d "%~dp0"

pscp spermrace-deploy.tar.gz %VPS_USER%@%VPS_IP%:/tmp/
echo.
echo Upload complete!
pause
