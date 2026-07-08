$dumpPath = "c:\Users\Administrador\Documents\TRAE\TOCADOLOBO\tocadolobo_dump.sql"
$lines = Get-Content -Path $dumpPath -Encoding UTF8
$insertLine = $lines[317] # Index 317 is line 318 in the file
Write-Host "Line 318 content:" -ForegroundColor Cyan
Write-Host $insertLine -ForegroundColor Yellow
