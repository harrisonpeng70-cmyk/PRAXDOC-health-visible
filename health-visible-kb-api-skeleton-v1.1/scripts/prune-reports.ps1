param(
  [string]$ReportDir = "reports",
  [int]$KeepReports = 20
)

$ErrorActionPreference = "Stop"

if ($KeepReports -lt 1) {
  throw "KeepReports must be >= 1"
}

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$reportDirectory = Join-Path $projectRoot $ReportDir

if (-not (Test-Path $reportDirectory)) {
  Write-Output "Reports directory does not exist. Nothing to prune."
  exit 0
}

$files = Get-ChildItem -Path $reportDirectory -Filter "preflight-report-*.md" -File |
  Sort-Object LastWriteTime -Descending

if ($files.Count -le $KeepReports) {
  Write-Output ("No prune needed. total=" + $files.Count + ", keep=" + $KeepReports)
  exit 0
}

$removeList = $files | Select-Object -Skip $KeepReports
foreach ($file in $removeList) {
  Remove-Item -LiteralPath $file.FullName -Force
}

Write-Output ("Pruned reports: " + $removeList.Count)
Write-Output ("Kept reports: " + $KeepReports)
