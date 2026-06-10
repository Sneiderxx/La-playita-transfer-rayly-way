@echo off
title La Playita - Sistema
echo Iniciando La Playita...

set DIR=%~dp0
set "DATABASE_URL=postgresql://postgres:Superjonz10$$@localhost:5432/la_playita"
set "JWT_SECRET=laplayita_secret_2024"
set "PORT=8080"
set "BASE_PATH=/"
set "TZ=America/Guatemala"
set "NODE_ENV=development"

echo Iniciando backend...
start "Backend" cmd /k "cd /d "%DIR%" && set "DATABASE_URL=postgresql://postgres:Superjonz10$$@localhost:5432/la_playita" && set "JWT_SECRET=laplayita_secret_2024" && set "PORT=8080" && set "BASE_PATH=/" && set "TZ=America/Guatemala" && pnpm --filter @workspace/api-server run start"

timeout /t 6 /nobreak

echo Iniciando frontend...
start "Frontend" cmd /k "cd /d "%DIR%" && set "PORT=5173" && set "BASE_PATH=/" && pnpm --filter @workspace/restaurant run dev"

timeout /t 4 /nobreak

echo Abriendo navegador...
start http://localhost:5173

echo Sistema listo. Cierra esta ventana cuando quieras.
pause
