@echo off
echo Uploading tarball to VPS...
cd /d "C:\Users\SISI\Documents\skidr.io fork"
pscp -pw yELys6TZvJzT! spermrace-deploy.tar.gz root@93.180.133.94:/tmp/
echo.
echo Upload complete!
pause
