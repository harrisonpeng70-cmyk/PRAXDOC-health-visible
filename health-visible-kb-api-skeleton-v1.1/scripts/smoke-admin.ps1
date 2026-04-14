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
  $lowTrustDomain = "smoke-admin-lowtrust-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')).example"
  $blockedSourceDomain = "smoke-admin-blocked-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')).example"
  $createBody = @{
    source_name = "Smoke Admin Source"
    source_domain = $domain
    source_type = "guideline"
    trust_level = 4
    enabled = $true
  } | ConvertTo-Json -Compress
  $lowTrustBody = @{
    source_name = "Smoke Admin Low Trust"
    source_domain = $lowTrustDomain
    source_type = "guideline"
    trust_level = 1
    enabled = $true
  } | ConvertTo-Json -Compress
  $blockedSourceBody = @{
    source_name = "Smoke Admin Blocked Source"
    source_domain = $blockedSourceDomain
    source_type = "guideline"
    source_url = "https://$blockedSourceDomain/doc"
  } | ConvertTo-Json -Compress

  $doctorDenied = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/admin/policy-overview" `
    -Headers ($doctorHeaders + @{ "x-request-id" = "smoke-admin-doctor-denied" })

  $policyConfigGet = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/admin/policy-config" `
    -Headers ($adminHeaders + @{ "x-request-id" = "smoke-admin-policy-config-get" })

  $restorePolicyBody = ""
  if ($policyConfigGet.body -and $policyConfigGet.body.data) {
    $restorePolicyBody = @{
      ingest_policy = $policyConfigGet.body.data.ingest_policy
      retrieve_policy = $policyConfigGet.body.data.retrieve_policy
    } | ConvertTo-Json -Depth 8 -Compress
  }

  $policyPatchBody = @{
    ingest_policy = @{
      whitelist_gate_enabled = $false
      trust_level_range = @{
        min = 2
        max = 5
      }
    }
    retrieve_policy = @{
      l3_requires_exploratory_label = $false
      no_l1_hit_error_hint = "admin_partial_override"
    }
  } | ConvertTo-Json -Depth 8 -Compress

  $policyConfigPatch = Invoke-JsonRequest `
    -Client $client `
    -Method "PATCH" `
    -Url "http://localhost:$Port/kb/v1/admin/policy-config" `
    -Headers ($adminHeaders + @{ "x-request-id" = "smoke-admin-policy-config-patch" }) `
    -JsonBody $policyPatchBody

  $policyOverview = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/admin/policy-overview" `
    -Headers ($adminHeaders + @{ "x-request-id" = "smoke-admin-policy-overview" })

  $lowTrustCreate = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/admin/source-whitelist" `
    -Headers ($adminHeaders + @{ "x-request-id" = "smoke-admin-low-trust-create" }) `
    -JsonBody $lowTrustBody

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

  $blockedSourceAllowed = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/sources" `
    -Headers ($adminHeaders + @{ "x-request-id" = "smoke-admin-gate-disabled-source" }) `
    -JsonBody $blockedSourceBody

  $retrievePartialOverride = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/retrieve/search" `
    -Headers ($doctorHeaders + @{ "x-request-id" = "smoke-admin-retrieve-partial-override" }) `
    -JsonBody '{"query_text":"micronutrient support","filters":{"layers":["L3"],"topics":["micronutrient_support_assessment"]},"top_k":5}'

  $policyRestore = $null
  if ($restorePolicyBody) {
    $policyRestore = Invoke-JsonRequest `
      -Client $client `
      -Method "PATCH" `
      -Url "http://localhost:$Port/kb/v1/admin/policy-config" `
      -Headers ($adminHeaders + @{ "x-request-id" = "smoke-admin-policy-config-restore" }) `
      -JsonBody $restorePolicyBody
  } else {
    $policyRestore = [pscustomobject]@{ status_code = 0; body_raw = ""; body = $null }
  }

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
      case = "policy_config_get"
      status = $policyConfigGet.status_code
      detail = if ($policyConfigGet.body -and $policyConfigGet.body.data) { [string]$policyConfigGet.body.data.ingest_policy.whitelist_gate_enabled } else { "" }
      passed =
        $policyConfigGet.status_code -eq 200 -and
        $policyConfigGet.body.status -eq "success" -and
        $null -ne $policyConfigGet.body.data.retrieve_policy.default_weights
    },
    [pscustomobject]@{
      case = "policy_config_patch"
      status = $policyConfigPatch.status_code
      detail = if ($policyConfigPatch.body -and $policyConfigPatch.body.data) { [string]$policyConfigPatch.body.data.retrieve_policy.no_l1_hit_error_hint } else { "" }
      passed =
        $policyConfigPatch.status_code -eq 200 -and
        $policyConfigPatch.body.data.ingest_policy.whitelist_gate_enabled -eq $false -and
        $policyConfigPatch.body.data.ingest_policy.trust_level_range.min -eq 2 -and
        $policyConfigPatch.body.data.retrieve_policy.l3_requires_exploratory_label -eq $false -and
        $policyConfigPatch.body.data.retrieve_policy.no_l1_hit_error_hint -eq "admin_partial_override"
    },
    [pscustomobject]@{
      case = "policy_overview_reflects_policy"
      status = $policyOverview.status_code
      detail = if ($policyOverview.body -and $policyOverview.body.data) { [string]$policyOverview.body.data.ingest_policy.whitelist_gate_enabled } else { "" }
      passed =
        $policyOverview.status_code -eq 200 -and
        $policyOverview.body.status -eq "success" -and
        $policyOverview.body.data.ingest_policy.whitelist_gate_enabled -eq $false -and
        $policyOverview.body.data.retrieve_policy.l3_requires_exploratory_label -eq $false -and
        $policyOverview.body.data.retrieve_policy.no_l1_hit_error_hint -eq "admin_partial_override"
    },
    [pscustomobject]@{
      case = "trust_level_range_enforced"
      status = $lowTrustCreate.status_code
      detail = if ($lowTrustCreate.body) { [string]$lowTrustCreate.body.error_hint } else { "" }
      passed =
        $lowTrustCreate.status_code -eq 400 -and
        $lowTrustCreate.body.error_hint -eq "whitelist_trust_level_out_of_range"
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
    },
    [pscustomobject]@{
      case = "source_gate_disabled_allows_non_whitelist"
      status = $blockedSourceAllowed.status_code
      detail = if ($blockedSourceAllowed.body -and $blockedSourceAllowed.body.data) { [string]$blockedSourceAllowed.body.data.is_whitelisted } else { "" }
      passed =
        $blockedSourceAllowed.status_code -eq 200 -and
        $blockedSourceAllowed.body.status -eq "success" -and
        $blockedSourceAllowed.body.data.is_whitelisted -eq $false
    },
    [pscustomobject]@{
      case = "retrieve_partial_hint_override"
      status = $retrievePartialOverride.status_code
      detail = if ($retrievePartialOverride.body) { [string]$retrievePartialOverride.body.error_hint } else { "" }
      passed =
        $retrievePartialOverride.status_code -eq 200 -and
        $retrievePartialOverride.body.status -eq "partial" -and
        $retrievePartialOverride.body.error_hint -eq "admin_partial_override" -and
        $retrievePartialOverride.body.data.hits.Count -ge 1 -and
        @($retrievePartialOverride.body.data.hits | Where-Object { $_.labels.Count -eq 0 }).Count -ge 1
    },
    [pscustomobject]@{
      case = "policy_restore"
      status = $policyRestore.status_code
      detail = if ($policyRestore.body -and $policyRestore.body.data) { [string]$policyRestore.body.data.ingest_policy.whitelist_gate_enabled } else { "" }
      passed =
        $policyRestore.status_code -eq 200 -and
        $policyRestore.body.status -eq "success"
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
