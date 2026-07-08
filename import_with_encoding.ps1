$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$dumpPath = "c:\Users\Administrador\Documents\TRAE\TOCADOLOBO\tocadolobo_dump.sql"

# Step 1: Drop and recreate the database
& $mysqlPath -u root -p43r0moc@ -e "DROP DATABASE IF EXISTS tocadolobo; CREATE DATABASE tocadolobo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Step 2: Read the dump file as UTF-8 and pipe to mysql
$utf8 = [System.Text.Encoding]::UTF8
$fileContent = [System.IO.File]::ReadAllBytes($dumpPath)
$utf8Content = $utf8.GetString($fileContent)
$utf8Content | & $mysqlPath -u root -p43r0moc@ --default-character-set=utf8mb4 tocadolobo

Write-Host "Import completed!" -ForegroundColor Green
