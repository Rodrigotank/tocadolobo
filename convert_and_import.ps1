$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$dumpPath = "c:\Users\Administrador\Documents\TRAE\TOCADOLOBO\tocadolobo_dump.sql"
$utf8DumpPath = "c:\Users\Administrador\Documents\TRAE\TOCADOLOBO\tocadolobo_dump_utf8_fixed.sql"

# Step 1: Drop and recreate the database
& $mysqlPath -u root -p43r0moc@ -e "DROP DATABASE IF EXISTS tocadolobo; CREATE DATABASE tocadolobo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Step 2: Read the file as Windows-1252 and write it as UTF-8
$win1252 = [System.Text.Encoding]::GetEncoding('Windows-1252')
$utf8 = [System.Text.Encoding]::UTF8
$fileContent = [System.IO.File]::ReadAllBytes($dumpPath)
$win1252String = $win1252.GetString($fileContent)
[System.IO.File]::WriteAllText($utf8DumpPath, $win1252String, $utf8)

# Step 3: Import the fixed UTF-8 dump
Get-Content $utf8DumpPath | & $mysqlPath -u root -p43r0moc@ --default-character-set=utf8mb4 tocadolobo

Write-Host "Import completed!" -ForegroundColor Green
