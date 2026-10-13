param(
  [string]$ServiceUrl = $env:WATERMARKS_SERVICE_URL
)
if ([string]::IsNullOrWhiteSpace($ServiceUrl)) { $ServiceUrl = "http://127.0.0.1:8765" }
try {
  $result = Invoke-RestMethod -Uri "$ServiceUrl/health" -Method Get -TimeoutSec 10
  Write-Output ("watermarks-remover reachable: " + ($result | ConvertTo-Json -Compress))
  exit 0
} catch {
  Write-Error "watermarks-remover is unavailable at $ServiceUrl. Start the local developer-only service before auditing assets."
  exit 1
}
