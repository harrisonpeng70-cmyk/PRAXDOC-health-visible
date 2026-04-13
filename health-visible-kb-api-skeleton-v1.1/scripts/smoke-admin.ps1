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
      -Headers @{ "x-tenant-id" = $TenantId; "x-request-id" = "smoke-admin-health-$i" }

    if ($health.status_code -eq 200) {
      $isReady = $true
      break
    }

    Start-Sleep -Milliseconds 500
  }

  if (-not $isReady) {
    throw "API did not become ready on port $Port."
  }

  $adminHeaders = @{
    "x-tenant-id" = $TenantId
    "x-actor-id" = "smoke-admin"
    "x-actor-type" = "admin"
  }
  $doctorHeaders = @{
    "x-tenant-id" = $TenantId
    "x-actor-id" = "smoke-doctor"
    "x-actor-type" = "doctor"
  }

  $domain = "smoke-admin-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')).example"
  $domainQ = [Uri]::EscapeDataString($domain)
  $createBody = @{
    source_name = "Smoke Admin Source"
    source_domain = $domain
    source_type = "guideline"
    trust_level = 4
    enabled = $true
  } | ConvertTo-Json -Compress

  $doctorDenied = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/admin/policy-overview" `
    -Headers ($doctorHeaders + @{ "x-request-id" = "smoke-admin-doctor-denied" })

  $policyOverview = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/admin/policy-overview" `
    -Headers ($adminHeaders + @{ "x-request-id" = "smoke-admin-policy-overview" })

  $listBeforeCreate = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/admin/source-whitelist?page=1&page_size=5" `
    -Headers ($adminHeaders + @{ "x-request-id" = "smoke-admin-list-before" })

  $create = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/admin/source-whitelist" `
    -Headers ($adminHeaders + @{ "x-request-id" = "smoke-admin-create" }) `
    -JsonBody $createBody

  $createdWhitelistId = if ($create.body -and $create.body.data) { [string]$create.body.data.whitelist_id } else { "" }

  $duplicate = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/admin/source-whitelist" `
    -Headers ($adminHeaders + @{ "x-request-id" = "smoke-admin-duplicate" }) `
    -JsonBody $createBody

  $patch = $null
  if ($createdWhitelistId) {
    $patch = Invoke-JsonRequest `
      -Client $client `
      -Method "PATCH" `
      -Url "http://localhost:$Port/kb/v1/admin/source-whitelist/$createdWhitelistId" `
      -Headers ($adminHeaders + @{ "x-request-id" = "smoke-admin-patch-disable" }) `
      -JsonBody '{"enabled":false}'
  } else {
    $patch = [pscustomobject]@{ status_code = 0; body_raw = ""; body = $null }
  }

  $disabledFiltered = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/admin/source-whitelist?enabled=false&search=$domainQ&page=1&page_size=10" `
    -Headers ($adminHeaders + @{ "x-request-id" = "smoke-admin-disabled-filter" })

  $results = @(
    [pscustomobject]@{
      case = "doctor_access_denied"
      status = $doctorDenied.status_code
      detail = if ($doctorDenied.body) { [string]$doctorDenied.body.error_hint } else { "" }
      passed =
        $doctorDenied.status_code -eq 403 -and
        $doctorDenied.body.error_hint -eq "actor_type_not_allowed"
    },
    [pscustomobject]@{
      case = "policy_overview_admin"
      status = $policyOverview.status_code
      detail = if ($policyOverview.body -and $policyOverview.body.data) { [string]$policyOverview.body.data.runtime_flags.admin_actor_required } else { "" }
      passed =
        $policyOverview.status_code -eq 200 -and
        $policyOverview.body.status -eq "success" -and
        $policyOverview.body.data.runtime_flags.admin_actor_required -eq $true
    },
    [pscustomobject]@{
      case = "whitelist_list"
      status = $listBeforeCreate.status_code
      detail = if ($listBeforeCreate.body -and $listBeforeCreate.body.data) { [string]$listBeforeCreate.body.data.page } else { "" }
      passed =
        $listBeforeCreate.status_code -eq 200 -and
        $listBeforeCreate.body.status -eq "success" -and
        $null -ne $listBeforeCreate.body.data.items
    },
    [pscustomobject]@{
      case = "whitelist_create"
      status = $create.status_code
      detail = if ($create.body -and $create.body.data) { [string]$create.body.data.source_domain } else { "" }
      passed =
        $create.status_code -eq 200 -and
        $create.body.status -eq "success" -and
        $create.body.data.source_domain -eq $domain
    },
    [pscustomobject]@{
      case = "whitelist_duplicate"
      status = $duplicate.status_code
      detail = if ($duplicate.body) { [string]$duplicate.body.error_hint } else { "" }
      passed =
        $duplicate.status_code -eq 409 -and
        $duplicate.body.error_hint -eq "whitelist_domain_exists"
    },
    [pscustomobject]@{
      case = "whitelist_patch_disable"
      status = $patch.status_code
      detail = if ($patch.body -and $patch.body.data) { [string]$patch.body.data.enabled } else { "" }
      passed =
        $patch.status_code -eq 200 -and
        $patch.body.data.enabled -eq $false
    },
    [pscustomobject]@{
      case = "whitelist_disabled_filter"
      status = $disabledFiltered.status_code
      detail = if ($disabledFiltered.body -and $disabledFiltered.body.data) { [string]$disabledFiltered.body.data.total } else { "" }
      passed =
        $disabledFiltered.status_code -eq 200 -and
        $disabledFiltered.body.data.total -ge 1 -and
        (@($disabledFiltered.body.data.items | Where-Object { $_.source_domain -eq $domain }).Count -ge 1)
    }
  )

  $results | Format-Table -AutoSize
  $results | ConvertTo-Json -Depth 4

  if (@($results | Where-Object { -not $_.passed }).Count -gt 0) {
    throw "Smoke test failed."
  }

  Write-Output "Smoke test passed."
} finally {
  if ($serverJob) {
    Stop-Job -Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job -Job $serverJob -Force -ErrorAction SilentlyContinue
  }
}
