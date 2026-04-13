param(
  [string]$TenantId = "00000000-0000-0000-0000-000000000001",
  [int]$Port = 18080,
  [string]$DbHost = $(if ($env:PGHOST) { $env:PGHOST } else { "localhost" }),
  [int]$DbPort = $(if ($env:PGPORT) { [int]$env:PGPORT } else { 5432 }),
  [string]$DbUser = $(if ($env:PGUSER) { $env:PGUSER } else { "postgres" }),
  [string]$DbPassword = $(if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "211314" }),
  [string]$DbName = $(if ($env:PGDATABASE) { $env:PGDATABASE } else { "postgres" })
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$nodePath = "D:\Program Files\nodejs\node.exe"
if (-not (Test-Path $nodePath)) {
  throw "Node executable not found at: $nodePath"
}

function Invoke-JsonRequest {
  param(
    [System.Net.Http.HttpClient]$Client,
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers,
    [string]$JsonBody = ""
  )

  $httpMethod = New-Object System.Net.Http.HttpMethod($Method.ToUpperInvariant())
  $request = New-Object System.Net.Http.HttpRequestMessage($httpMethod, $Url)
  foreach ($key in $Headers.Keys) {
    $request.Headers.Add($key, [string]$Headers[$key])
  }

  if ($JsonBody) {
    $request.Content = New-Object System.Net.Http.StringContent($JsonBody, [System.Text.Encoding]::UTF8, "application/json")
  }

  $response = $Client.SendAsync($request).Result
  $bodyRaw = $response.Content.ReadAsStringAsync().Result
  $bodyObj = $null
  if ($bodyRaw) {
    try {
      $bodyObj = $bodyRaw | ConvertFrom-Json
    } catch {
      $bodyObj = $null
    }
  }

  [pscustomobject]@{
    status_code = [int]$response.StatusCode
    body_raw = $bodyRaw
    body = $bodyObj
  }
}

$serverJob = $null
try {
  $serverJob = Start-Job -ScriptBlock {
    param($root, $node, $port, $dbHost, $dbPort, $dbUser, $dbPassword, $dbName)

    Set-Location $root
    $env:PORT = [string]$port
    $env:PGHOST = $dbHost
    $env:PGPORT = [string]$dbPort
    $env:PGUSER = $dbUser
    $env:PGPASSWORD = $dbPassword
    $env:PGDATABASE = $dbName

    & $node "dist/server.js"
  } -ArgumentList $projectRoot, $nodePath, $Port, $DbHost, $DbPort, $DbUser, $DbPassword, $DbName

  $client = New-Object System.Net.Http.HttpClient

  $isReady = $false
  for ($i = 0; $i -lt 20; $i++) {
    $health = Invoke-JsonRequest `
      -Client $client `
      -Method "GET" `
      -Url "http://localhost:$Port/kb/v1/health" `
      -Headers @{ "x-tenant-id" = $TenantId; "x-request-id" = "smoke-ra-health-$i" }

    if ($health.status_code -eq 200) {
      $isReady = $true
      break
    }

    Start-Sleep -Milliseconds 500
  }

  if (-not $isReady) {
    throw "API did not become ready on port $Port."
  }

  $baseHeaders = @{
    "x-tenant-id" = $TenantId
    "x-actor-id" = "smoke"
    "x-actor-type" = "doctor"
  }

  $retrievePartial = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/retrieve/search" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-ra-retrieve-partial" }) `
    -JsonBody '{"query_text":"micronutrient support","filters":{"layers":["L3"],"topics":["micronutrient_support_assessment"]},"top_k":5}'

  $retrieveReady = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/retrieve/search" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-ra-retrieve-ready" }) `
    -JsonBody '{"query_text":"diabetes screening","filters":{"layers":["L1"],"topics":["type2_diabetes_screening"]},"top_k":3}'

  $conflicts = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/conflicts?resolution_status=open&severity_gte=3" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-ra-conflicts" })

  $logs = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/audit/logs?page=1&page_size=5" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-ra-audit-logs" })

  $firstAuditId = $null
  if ($logs.body -and $logs.body.data -and $logs.body.data.items -and $logs.body.data.items.Count -gt 0) {
    $firstAuditId = [string]$logs.body.data.items[0].audit_id
  }

  $detail = $null
  if ($firstAuditId) {
    $detail = Invoke-JsonRequest `
      -Client $client `
      -Method "GET" `
      -Url "http://localhost:$Port/kb/v1/audit/logs/$firstAuditId" `
      -Headers ($baseHeaders + @{ "x-request-id" = "smoke-ra-audit-detail" })
  } else {
    $detail = [pscustomobject]@{ status_code = 0; body_raw = ""; body = $null }
  }

  $fromIso = [DateTime]::UtcNow.AddDays(-30).ToString("yyyy-MM-ddTHH:mm:ssZ")
  $toIso = [DateTime]::UtcNow.AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
  $fromQ = [Uri]::EscapeDataString($fromIso)
  $toQ = [Uri]::EscapeDataString($toIso)

  $stats = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/audit/stats?from=$fromQ&to=$toQ" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-ra-audit-stats" })

  $export = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/audit/export" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-ra-audit-export" }) `
    -JsonBody ('{"from":"' + $fromIso + '","to":"' + $toIso + '","format":"json"}')

  $invalidStats = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/audit/stats?from=bad&to=bad" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-ra-invalid-stats" })

  $results = @(
    [pscustomobject]@{
      case = "retrieve_partial_l3"
      status = $retrievePartial.status_code
      detail = if ($retrievePartial.body) { [string]$retrievePartial.body.error_hint } else { "" }
      passed =
        $retrievePartial.status_code -eq 200 -and
        $retrievePartial.body.status -eq "partial" -and
        $retrievePartial.body.data.state -eq "partial_ready" -and
        $retrievePartial.body.error_hint -eq "only_mid_low_confidence_evidence"
    },
    [pscustomobject]@{
      case = "retrieve_ready_l1"
      status = $retrieveReady.status_code
      detail = if ($retrieveReady.body) { [string]$retrieveReady.body.data.state } else { "" }
      passed =
        $retrieveReady.status_code -eq 200 -and
        $retrieveReady.body.status -eq "success" -and
        $retrieveReady.body.data.state -eq "ready"
    },
    [pscustomobject]@{
      case = "conflicts_open"
      status = $conflicts.status_code
      detail = if ($conflicts.body -and $conflicts.body.data) { [string]$conflicts.body.data.items.Count } else { "0" }
      passed =
        $conflicts.status_code -eq 200 -and
        $conflicts.body.data.items.Count -ge 1
    },
    [pscustomobject]@{
      case = "audit_logs_list"
      status = $logs.status_code
      detail = if ($logs.body -and $logs.body.data) { [string]$logs.body.data.total } else { "0" }
      passed =
        $logs.status_code -eq 200 -and
        $logs.body.data.total -ge 1 -and
        $logs.body.data.items.Count -ge 1
    },
    [pscustomobject]@{
      case = "audit_log_detail"
      status = $detail.status_code
      detail = if ($detail.body) { [string]$detail.body.data.audit_id } else { "" }
      passed =
        $firstAuditId -and
        $detail.status_code -eq 200 -and
        $detail.body.data.audit_id -eq $firstAuditId
    },
    [pscustomobject]@{
      case = "audit_stats"
      status = $stats.status_code
      detail = if ($stats.body -and $stats.body.data) { [string]$stats.body.data.total_actions } else { "0" }
      passed =
        $stats.status_code -eq 200 -and
        $stats.body.data.total_actions -ge 1
    },
    [pscustomobject]@{
      case = "audit_export_job"
      status = $export.status_code
      detail = if ($export.body -and $export.body.data) { [string]$export.body.data.job_id } else { "" }
      passed =
        $export.status_code -eq 200 -and
        $export.body.data.job_id
    },
    [pscustomobject]@{
      case = "audit_stats_invalid_400"
      status = $invalidStats.status_code
      detail = if ($invalidStats.body) { [string]$invalidStats.body.error_hint } else { "" }
      passed =
        $invalidStats.status_code -eq 400 -and
        $invalidStats.body.error_hint -eq "payload_validation_failed"
    }
  )

  $results | Format-Table -AutoSize
  $results | ConvertTo-Json -Depth 4

  if (($results | Where-Object { -not $_.passed }).Count -gt 0) {
    throw "Smoke test failed."
  }

  Write-Output "Smoke test passed."
} finally {
  if ($serverJob) {
    Stop-Job -Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job -Job $serverJob -Force -ErrorAction SilentlyContinue
  }
}
