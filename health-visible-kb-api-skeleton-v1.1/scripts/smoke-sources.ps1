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
      -Headers @{ "x-tenant-id" = $TenantId; "x-request-id" = "smoke-health-$i" }

    if ($health.status_code -eq 200) {
      $isReady = $true
      break
    }

    Start-Sleep -Milliseconds 500
  }

  if (-not $isReady) {
    throw "API did not become ready on port $Port."
  }

  $invalidTenant = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/sources" `
    -Headers @{
      "x-tenant-id" = "tenant_demo"
      "x-request-id" = "smoke-invalid-tenant"
      "x-actor-id" = "smoke"
      "x-actor-type" = "human"
    } `
    -JsonBody '{"source_name":"Smoke Invalid Tenant","source_domain":"who.int","source_type":"guideline","source_url":"https://who.int/doc"}'

  $blockedDomain = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/sources" `
    -Headers @{
      "x-tenant-id" = $TenantId
      "x-request-id" = "smoke-blocked-domain"
      "x-actor-id" = "smoke"
      "x-actor-type" = "human"
    } `
    -JsonBody '{"source_name":"Smoke Blocked Domain","source_domain":"evil.example","source_type":"guideline","source_url":"https://evil.example/doc"}'

  $allowedDomain = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/sources" `
    -Headers @{
      "x-tenant-id" = $TenantId
      "x-request-id" = "smoke-allowed-domain"
      "x-actor-id" = "smoke"
      "x-actor-type" = "human"
    } `
    -JsonBody '{"source_name":"Smoke Allowed Domain","source_domain":"who.int","source_type":"guideline","source_url":"https://who.int/doc"}'

  $results = @(
    [pscustomobject]@{
      case = "invalid_tenant"
      status = $invalidTenant.status_code
      error_hint = $invalidTenant.body.error_hint
      passed = ($invalidTenant.status_code -eq 400 -and $invalidTenant.body.error_hint -eq "tenant_id_invalid_uuid")
    },
    [pscustomobject]@{
      case = "blocked_domain"
      status = $blockedDomain.status_code
      error_hint = $blockedDomain.body.error_hint
      passed = ($blockedDomain.status_code -eq 422 -and $blockedDomain.body.error_hint -eq "source_blocked_by_whitelist")
    },
    [pscustomobject]@{
      case = "allowed_domain"
      status = $allowedDomain.status_code
      error_hint = $allowedDomain.body.error_hint
      passed = ($allowedDomain.status_code -eq 200 -and $allowedDomain.body.status -eq "success")
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
