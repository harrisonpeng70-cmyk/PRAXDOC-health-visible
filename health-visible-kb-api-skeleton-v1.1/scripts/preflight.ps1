param(
  [string]$NpmPath = "D:\Program Files\nodejs\npm.cmd",
  [string]$ReportDir = "reports",
  [int]$KeepReports = 20
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not (Test-Path $NpmPath)) {
  throw "npm executable not found at: $NpmPath"
}

Set-Location $projectRoot

function Invoke-NpmStep {
  param(
    [string]$Name,
    [string[]]$CommandArgs
  )

  $startedAt = Get-Date
  Write-Host "===== START: $Name ====="
  $stepOutput = & $NpmPath @CommandArgs 2>&1
  $stepOutput | Out-Host
  $exitCode = $LASTEXITCODE
  $endedAt = Get-Date
  Write-Host "===== END: $Name (exit=$exitCode) ====="

  [pscustomobject]@{
    step = $Name
    command = "$NpmPath $($CommandArgs -join ' ')"
    exit_code = $exitCode
    started_at = $startedAt.ToString("yyyy-MM-dd HH:mm:ssK")
    ended_at = $endedAt.ToString("yyyy-MM-dd HH:mm:ssK")
    duration_seconds = [math]::Round(($endedAt - $startedAt).TotalSeconds, 2)
    output = ($stepOutput | Out-String).Trim()
    passed = ($exitCode -eq 0)
  }
}

function Write-PreflightReport {
  param(
    [string]$Root,
    [string]$Dir,
    [datetime]$RunStartedAt,
    [datetime]$RunEndedAt,
    [object[]]$StepResults,
    [bool]$Passed
  )

  $reportDirectory = Join-Path $Root $Dir
  if (-not (Test-Path $reportDirectory)) {
    New-Item -ItemType Directory -Path $reportDirectory | Out-Null
  }

  $timestamp = $RunStartedAt.ToString("yyyyMMdd-HHmmss")
  $reportPath = Join-Path $reportDirectory ("preflight-report-" + $timestamp + ".md")

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# Preflight Report")
  $lines.Add("")
  $lines.Add("- generated_at: " + (Get-Date).ToString("yyyy-MM-dd HH:mm:ssK"))
  $lines.Add("- workspace: " + $Root)
  $lines.Add("- run_started_at: " + $RunStartedAt.ToString("yyyy-MM-dd HH:mm:ssK"))
  $lines.Add("- run_ended_at: " + $RunEndedAt.ToString("yyyy-MM-dd HH:mm:ssK"))
  $lines.Add("- total_duration_seconds: " + [math]::Round(($RunEndedAt - $RunStartedAt).TotalSeconds, 2))
  $lines.Add("- overall_status: " + $(if ($Passed) { "passed" } else { "failed" }))
  $lines.Add("")
  $lines.Add("| step | command | exit_code | duration_seconds | passed |")
  $lines.Add("| --- | --- | ---: | ---: | --- |")

  foreach ($item in $StepResults) {
    $lines.Add("| " + $item.step + " | " + $item.command + " | " + $item.exit_code + " | " + $item.duration_seconds + " | " + $item.passed + " |")
  }

  foreach ($item in $StepResults) {
    $lines.Add("")
    $lines.Add("## Step: " + $item.step)
    $lines.Add("")
    $lines.Add("- status: " + $(if ($item.passed) { "passed" } else { "failed" }))
    $lines.Add("- started_at: " + $item.started_at)
    $lines.Add("- ended_at: " + $item.ended_at)
    $lines.Add("- duration_seconds: " + $item.duration_seconds)
    $lines.Add("- command: " + $item.command)
    $lines.Add("")
    $lines.Add('```text')
    if ([string]::IsNullOrWhiteSpace($item.output)) {
      $lines.Add("(no output)")
    } else {
      foreach ($line in ($item.output -split "`r?`n")) {
        $lines.Add($line)
      }
    }
    $lines.Add('```')
  }

  Set-Content -Path $reportPath -Value $lines -Encoding UTF8
  return $reportPath
}

function Prune-OldReports {
  param(
    [string]$Root,
    [string]$Dir,
    [int]$Keep
  )

  if ($Keep -lt 1) {
    throw "KeepReports must be >= 1"
  }

  $reportDirectory = Join-Path $Root $Dir
  if (-not (Test-Path $reportDirectory)) {
    return 0
  }

  $files = Get-ChildItem -Path $reportDirectory -Filter "preflight-report-*.md" -File |
    Sort-Object LastWriteTime -Descending

  if ($files.Count -le $Keep) {
    return 0
  }

  $removeList = $files | Select-Object -Skip $Keep
  foreach ($file in $removeList) {
    Remove-Item -LiteralPath $file.FullName -Force
  }

  return $removeList.Count
}

$steps = @(
  @{ name = "typecheck"; args = @("run", "check") },
  @{ name = "build"; args = @("run", "build") },
  @{ name = "smoke_all"; args = @("run", "smoke:all") }
)

$runStartedAt = Get-Date
$results = @()
foreach ($s in $steps) {
  $result = Invoke-NpmStep -Name $s.name -CommandArgs $s.args
  $results += $result
  if (-not $result.passed) {
    break
  }
}
$runEndedAt = Get-Date
$overallPassed = (($results | Where-Object { -not $_.passed }).Count -eq 0)

$reportPath = Write-PreflightReport `
  -Root $projectRoot `
  -Dir $ReportDir `
  -RunStartedAt $runStartedAt `
  -RunEndedAt $runEndedAt `
  -StepResults $results `
  -Passed $overallPassed

$summary = $results | Select-Object step, command, exit_code, duration_seconds, passed
$summary | Format-Table -AutoSize
$summary | ConvertTo-Json -Depth 4
Write-Output ("Preflight report: " + $reportPath)
$prunedCount = Prune-OldReports -Root $projectRoot -Dir $ReportDir -Keep $KeepReports
Write-Output ("Preflight pruned reports: " + $prunedCount)

if (-not $overallPassed) {
  throw "Preflight failed."
}

Write-Output "Preflight passed."
