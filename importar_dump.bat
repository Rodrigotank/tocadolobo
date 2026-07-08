@echo off
chcp 65001
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p43r0moc@ --default-character-set=utf8mb4 tocadolobo < tocadolobo_dump.sql
echo Importacao concluida!
pause
