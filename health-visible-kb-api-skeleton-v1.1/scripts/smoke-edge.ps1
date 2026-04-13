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

  if ($JsonBody -ne "") {
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
      -Headers @{ "x-tenant-id" = $TenantId; "x-request-id" = "smoke-edge-health-$i" }

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

  $retrieveEmpty = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/retrieve/search" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-edge-retrieve-empty" }) `
    -JsonBody '{"query_text":"no-match-token-xyz123","filters":{"topics":["unknown_topic"]},"top_k":3}'

  $entryNotFound = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/entries/11111111-1111-1111-1111-111111111111" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-edge-entry-404" })

  $auditNotFound = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/audit/logs/11111111-1111-1111-1111-111111111111" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-edge-audit-404" })

  $auditPageInvalid = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/audit/logs?page=0&page_size=1" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-edge-audit-page0" })

  $conflictsInvalid = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/conflicts?severity_gte=6" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-edge-conflict-invalid" })

  $invalidJsonRequestId = "smoke-edge-invalid-json"
  $invalidJson = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/sources" `
    -Headers ($baseHeaders + @{ "x-request-id" = $invalidJsonRequestId }) `
    -JsonBody "{"

  $results = @(
    [pscustomobject]@{
      case = "retrieve_empty_success"
      status = $retrieveEmpty.status_code
      detail = if ($retrieveEmpty.body) { [string]$retrieveEmpty.body.data.state } else { "" }
      passed =
        $retrieveEmpty.status_code -eq 200 -and
        $retrieveEmpty.body.status -eq "success" -and
        $retrieveEmpty.body.data.state -eq "empty" -and
        $retrieveEmpty.body.data.hits.Count -eq 0
    },
    [pscustomobject]@{
      case = "entry_not_found_404"
      status = $entryNotFound.status_code
      detail = if ($entryNotFound.body) { [string]$entryNotFound.body.error_hint } else { "" }
      passed =
        $entryNotFound.status_code -eq 404 -and
        $entryNotFound.body.error_hint -eq "entry_not_found"
    },
    [pscustomobject]@{
      case = "audit_not_found_404"
      status = $auditNotFound.status_code
      detail = if ($auditNotFound.body) { [string]$auditNotFound.body.error_hint } else { "" }
      passed =
        $auditNotFound.status_code -eq 404 -and
        $auditNotFound.body.error_hint -eq "audit_not_found"
    },
    [pscustomobject]@{
      case = "audit_page_invalid_400"
      status = $auditPageInvalid.status_code
      detail = if ($auditPageInvalid.body) { [string]$auditPageInvalid.body.error_hint } else { "" }
      passed =
        $auditPageInvalid.status_code -eq 400 -and
        $auditPageInvalid.body.error_hint -eq "payload_validation_failed"
    },
    [pscustomobject]@{
      case = "conflicts_invalid_400"
      status = $conflictsInvalid.status_code
      detail = if ($conflictsInvalid.body) { [string]$conflictsInvalid.body.error_hint } else { "" }
      passed =
        $conflictsInvalid.status_code -eq 400 -and
        $conflictsInvalid.body.error_hint -eq "payload_validation_failed"
    },
    [pscustomobject]@{
      case = "invalid_json_400_with_request_id"
      status = $invalidJson.status_code
      detail = if ($invalidJson.body -and $invalidJson.body.data) { [string]$invalidJson.body.data.request_id } else { "" }
      passed =
        $invalidJson.status_code -eq 400 -and
        $invalidJson.body.error_hint -eq "KB-4001" -and
        $invalidJson.body.data.request_id -eq $invalidJsonRequestId
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
