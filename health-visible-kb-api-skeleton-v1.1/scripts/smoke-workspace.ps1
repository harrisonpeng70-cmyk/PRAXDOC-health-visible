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
    [string]$Body = ""
  )

  $httpMethod = New-Object System.Net.Http.HttpMethod($Method.ToUpperInvariant())
  $request = New-Object System.Net.Http.HttpRequestMessage($httpMethod, $Url)
  foreach ($key in $Headers.Keys) {
    $request.Headers.Add($key, [string]$Headers[$key])
  }
  if (-not [string]::IsNullOrWhiteSpace($Body)) {
    $request.Content = New-Object System.Net.Http.StringContent($Body, [System.Text.Encoding]::UTF8, "application/json")
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
      -Headers @{ "x-tenant-id" = $TenantId; "x-request-id" = "smoke-workspace-health-$i" }
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

  $auto = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/workspace-summary?scenario=auto" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-auto" })

  $full = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_FULL_001/workspace-summary?scenario=full" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-full" })

  $filesOnly = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_FILES_001/workspace-summary?scenario=files_only" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-files-only" })

  $partial = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_PARTIAL_001/workspace-summary?scenario=partial" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-partial" })

  $empty = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_EMPTY_001/workspace-summary?scenario=empty" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-empty" })

  $errorResponse = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_ERROR_001/workspace-summary?scenario=error" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-error" })

  $invalid = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_INVALID_001/workspace-summary?scenario=bad" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-invalid" })

  $atomicAuto = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/atomic-profile?scenario=auto&limit=30" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-atomic-auto" })

  $atomicFull = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_FULL_001/atomic-profile?scenario=full&limit=25" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-atomic-full" })

  $atomicFilteredGroup = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/atomic-profile?scenario=auto&limit=50&atom_groups=trend" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-atomic-group" })

  $atomicFilteredFlag = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_PARTIAL_001/atomic-profile?scenario=partial&limit=50&quality_flags=needs_manual_review" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-atomic-flag" })

  $atomicInvalidFilter = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/atomic-profile?scenario=auto&atom_groups=invalid_group" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-atomic-invalid-filter" })

  $atomicInvalid = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_INVALID_001/atomic-profile?scenario=bad" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-atomic-invalid" })

  $cardsRoute = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/cards?scenario=auto" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-cards-route" })

  $draftRoute = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/draft?scenario=auto" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-draft-route" })

  $tasksRoute = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/tasks?scenario=auto" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-tasks-route" })

  $feedbackRoute = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/feedback?scenario=auto" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-feedback-route" })

  $uiActionBody = @{
    action_type = "go_cards"
    target_object_type = "workspace_route"
    target_object_id = "cards"
    metadata = @{
      source = "smoke_workflow"
    }
  } | ConvertTo-Json -Depth 5

  $uiAction = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/workspace-actions" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-ui-action" }) `
    -Body $uiActionBody

  $draftStubActionBody = @{
    action_type = "create_draft_stub"
    target_object_type = "workspace_route_page"
    target_object_id = "draft"
    metadata = @{
      source = "smoke_workflow"
    }
  } | ConvertTo-Json -Depth 5

  $draftStubAction = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/workspace-actions" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-draft-stub-action" }) `
    -Body $draftStubActionBody

  $taskStubActionBody = @{
    action_type = "create_task_stub"
    target_object_type = "workspace_route_page"
    target_object_id = "tasks"
    metadata = @{
      source = "smoke_workflow"
    }
  } | ConvertTo-Json -Depth 5

  $taskStubAction = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/workspace-actions" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-task-stub-action" }) `
    -Body $taskStubActionBody

  $feedbackStubActionBody = @{
    action_type = "create_feedback_stub"
    target_object_type = "workspace_route_page"
    target_object_id = "feedback"
    metadata = @{
      source = "smoke_workflow"
    }
  } | ConvertTo-Json -Depth 5

  $feedbackStubAction = Invoke-JsonRequest `
    -Client $client `
    -Method "POST" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/workspace-actions" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-feedback-stub-action" }) `
    -Body $feedbackStubActionBody

  $draftRouteAfterStub = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/draft?scenario=auto" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-draft-route-after-stub" })

  $feedbackRouteAfterStub = Invoke-JsonRequest `
    -Client $client `
    -Method "GET" `
    -Url "http://localhost:$Port/kb/v1/clients/C_AUTO_001/feedback?scenario=auto" `
    -Headers ($baseHeaders + @{ "x-request-id" = "smoke-workspace-feedback-route-after-stub" })

  $validPageStates = @("ready", "partial_ready", "empty")

  $results = @(
    [pscustomobject]@{
      case = "workspace_auto_db_path"
      status = $auto.status_code
      detail = if ($auto.body -and $auto.body.data) { [string]$auto.body.data.page_state } else { "" }
      passed =
        $auto.status_code -eq 200 -and
        ($auto.body.status -eq "success" -or $auto.body.status -eq "partial") -and
        $auto.body.data.client_profile.client_id -eq "C_AUTO_001" -and
        ($validPageStates -contains [string]$auto.body.data.page_state)
    },
    [pscustomobject]@{
      case = "workspace_full_ready"
      status = $full.status_code
      detail = if ($full.body -and $full.body.data) { [string]$full.body.data.page_state } else { "" }
      passed =
        $full.status_code -eq 200 -and
        $full.body.status -eq "success" -and
        $full.body.data.page_state -eq "ready" -and
        $full.body.data.document_list.Count -ge 1
    },
    [pscustomobject]@{
      case = "workspace_files_only_partial"
      status = $filesOnly.status_code
      detail = if ($filesOnly.body -and $filesOnly.body.data) { [string]$filesOnly.body.data.page_state } else { "" }
      passed =
        $filesOnly.status_code -eq 200 -and
        $filesOnly.body.status -eq "partial" -and
        $filesOnly.body.data.page_state -eq "partial_ready"
    },
    [pscustomobject]@{
      case = "workspace_partial_partial"
      status = $partial.status_code
      detail = if ($partial.body) { [string]$partial.body.error_hint } else { "" }
      passed =
        $partial.status_code -eq 200 -and
        $partial.body.status -eq "partial" -and
        $partial.body.data.page_state -eq "partial_ready"
    },
    [pscustomobject]@{
      case = "workspace_empty"
      status = $empty.status_code
      detail = if ($empty.body -and $empty.body.data) { [string]$empty.body.data.page_state } else { "" }
      passed =
        $empty.status_code -eq 200 -and
        $empty.body.status -eq "success" -and
        $empty.body.data.page_state -eq "empty" -and
        $empty.body.data.document_list.Count -eq 0
    },
    [pscustomobject]@{
      case = "workspace_error_503"
      status = $errorResponse.status_code
      detail = if ($errorResponse.body) { [string]$errorResponse.body.error_hint } else { "" }
      passed =
        $errorResponse.status_code -eq 503 -and
        $errorResponse.body.status -eq "failed" -and
        $errorResponse.body.error_hint -eq "workspace_summary_unavailable"
    },
    [pscustomobject]@{
      case = "workspace_invalid_query_400"
      status = $invalid.status_code
      detail = if ($invalid.body) { [string]$invalid.body.error_hint } else { "" }
      passed =
        $invalid.status_code -eq 400 -and
        $invalid.body.status -eq "failed" -and
        $invalid.body.error_hint -eq "payload_validation_failed"
    },
    [pscustomobject]@{
      case = "workspace_atomic_profile_auto"
      status = $atomicAuto.status_code
      detail = if ($atomicAuto.body -and $atomicAuto.body.data) { [string]$atomicAuto.body.data.atom_count } else { "" }
      passed =
        $atomicAuto.status_code -eq 200 -and
        ($atomicAuto.body.status -eq "success" -or $atomicAuto.body.status -eq "partial") -and
        $atomicAuto.body.data.client_id -eq "C_AUTO_001" -and
        $atomicAuto.body.data.atomic_standard_version -eq "health-visible-atom-v1" -and
        $atomicAuto.body.data.atom_count -ge 1 -and
        $atomicAuto.body.data.atoms.Count -le 30 -and
        -not [string]::IsNullOrWhiteSpace([string]$atomicAuto.body.data.atoms[0].atom_code) -and
        $null -ne $atomicAuto.body.data.atoms[0].quality_flags -and
        $atomicAuto.body.data.atoms[0].normalization_meta.rule_version -eq "atom-rule-v1.1"
    },
    [pscustomobject]@{
      case = "workspace_atomic_profile_full_limit"
      status = $atomicFull.status_code
      detail = if ($atomicFull.body -and $atomicFull.body.data) { [string]$atomicFull.body.data.atom_count } else { "" }
      passed =
        $atomicFull.status_code -eq 200 -and
        $atomicFull.body.status -eq "success" -and
        $atomicFull.body.data.client_id -eq "C_FULL_001" -and
        $atomicFull.body.data.atoms.Count -le 25 -and
        @($atomicFull.body.data.atoms | Where-Object { $_.normalized_unit -eq "%" }).Count -ge 1
    },
    [pscustomobject]@{
      case = "workspace_atomic_profile_group_filter"
      status = $atomicFilteredGroup.status_code
      detail = if ($atomicFilteredGroup.body -and $atomicFilteredGroup.body.data) { [string]$atomicFilteredGroup.body.data.atom_count } else { "" }
      passed =
        $atomicFilteredGroup.status_code -eq 200 -and
        ($atomicFilteredGroup.body.status -eq "success" -or $atomicFilteredGroup.body.status -eq "partial") -and
        $atomicFilteredGroup.body.data.atom_count -ge 1 -and
        @($atomicFilteredGroup.body.data.atoms | Where-Object { $_.atom_group -ne "trend" }).Count -eq 0 -and
        @($atomicFilteredGroup.body.data.applied_filters.atom_groups).Count -eq 1
    },
    [pscustomobject]@{
      case = "workspace_atomic_profile_flag_filter"
      status = $atomicFilteredFlag.status_code
      detail = if ($atomicFilteredFlag.body -and $atomicFilteredFlag.body.data) { [string]$atomicFilteredFlag.body.data.atom_count } else { "" }
      passed =
        $atomicFilteredFlag.status_code -eq 200 -and
        $atomicFilteredFlag.body.status -eq "partial" -and
        $atomicFilteredFlag.body.data.atom_count -ge 1 -and
        $atomicFilteredFlag.body.data.total_after_filter -ge $atomicFilteredFlag.body.data.atom_count -and
        @($atomicFilteredFlag.body.data.atoms | Where-Object { @($_.quality_flags) -notcontains "needs_manual_review" }).Count -eq 0
    },
    [pscustomobject]@{
      case = "workspace_atomic_profile_invalid_filter_400"
      status = $atomicInvalidFilter.status_code
      detail = if ($atomicInvalidFilter.body) { [string]$atomicInvalidFilter.body.error_hint } else { "" }
      passed =
        $atomicInvalidFilter.status_code -eq 400 -and
        $atomicInvalidFilter.body.status -eq "failed" -and
        $atomicInvalidFilter.body.error_hint -eq "payload_validation_failed"
    },
    [pscustomobject]@{
      case = "workspace_atomic_profile_invalid_400"
      status = $atomicInvalid.status_code
      detail = if ($atomicInvalid.body) { [string]$atomicInvalid.body.error_hint } else { "" }
      passed =
        $atomicInvalid.status_code -eq 400 -and
        $atomicInvalid.body.status -eq "failed" -and
        $atomicInvalid.body.error_hint -eq "payload_validation_failed"
    },
    [pscustomobject]@{
      case = "workspace_cards_route"
      status = $cardsRoute.status_code
      detail = if ($cardsRoute.body -and $cardsRoute.body.data) { [string]$cardsRoute.body.data.route } else { "" }
      passed =
        $cardsRoute.status_code -eq 200 -and
        ($cardsRoute.body.status -eq "success" -or $cardsRoute.body.status -eq "partial") -and
        $cardsRoute.body.data.route -eq "cards"
    },
    [pscustomobject]@{
      case = "workspace_draft_route"
      status = $draftRoute.status_code
      detail = if ($draftRoute.body -and $draftRoute.body.data) { [string]$draftRoute.body.data.route } else { "" }
      passed =
        $draftRoute.status_code -eq 200 -and
        ($draftRoute.body.status -eq "success" -or $draftRoute.body.status -eq "partial") -and
        $draftRoute.body.data.route -eq "draft"
    },
    [pscustomobject]@{
      case = "workspace_tasks_route"
      status = $tasksRoute.status_code
      detail = if ($tasksRoute.body -and $tasksRoute.body.data) { [string]$tasksRoute.body.data.route } else { "" }
      passed =
        $tasksRoute.status_code -eq 200 -and
        ($tasksRoute.body.status -eq "success" -or $tasksRoute.body.status -eq "partial") -and
        $tasksRoute.body.data.route -eq "tasks"
    },
    [pscustomobject]@{
      case = "workspace_feedback_route"
      status = $feedbackRoute.status_code
      detail = if ($feedbackRoute.body -and $feedbackRoute.body.data) { [string]$feedbackRoute.body.data.route } else { "" }
      passed =
        $feedbackRoute.status_code -eq 200 -and
        ($feedbackRoute.body.status -eq "success" -or $feedbackRoute.body.status -eq "partial") -and
        $feedbackRoute.body.data.route -eq "feedback"
    },
    [pscustomobject]@{
      case = "workspace_ui_action_record"
      status = $uiAction.status_code
      detail = if ($uiAction.body -and $uiAction.body.data) { [string]$uiAction.body.data.action_type } else { "" }
      passed =
        $uiAction.status_code -eq 200 -and
        $uiAction.body.status -eq "success" -and
        $uiAction.body.data.recorded -eq $true -and
        $uiAction.body.data.action_type -eq "go_cards"
    },
    [pscustomobject]@{
      case = "workspace_create_draft_stub"
      status = $draftStubAction.status_code
      detail = if ($draftStubAction.body -and $draftStubAction.body.data -and $draftStubAction.body.data.created_stub) { [string]$draftStubAction.body.data.created_stub.kind } else { "" }
      passed =
        $draftStubAction.status_code -eq 200 -and
        $draftStubAction.body.status -eq "success" -and
        $draftStubAction.body.data.action_type -eq "create_draft_stub" -and
        $draftStubAction.body.data.created_stub.kind -eq "draft_stub" -and
        -not [string]::IsNullOrWhiteSpace([string]$draftStubAction.body.data.created_stub.stub_id)
    },
    [pscustomobject]@{
      case = "workspace_create_task_stub"
      status = $taskStubAction.status_code
      detail = if ($taskStubAction.body -and $taskStubAction.body.data -and $taskStubAction.body.data.created_stub) { [string]$taskStubAction.body.data.created_stub.kind } else { "" }
      passed =
        $taskStubAction.status_code -eq 200 -and
        $taskStubAction.body.status -eq "success" -and
        $taskStubAction.body.data.action_type -eq "create_task_stub" -and
        $taskStubAction.body.data.created_stub.kind -eq "task_stub" -and
        -not [string]::IsNullOrWhiteSpace([string]$taskStubAction.body.data.created_stub.stub_id)
    },
    [pscustomobject]@{
      case = "workspace_create_feedback_stub"
      status = $feedbackStubAction.status_code
      detail = if ($feedbackStubAction.body -and $feedbackStubAction.body.data -and $feedbackStubAction.body.data.created_stub) { [string]$feedbackStubAction.body.data.created_stub.kind } else { "" }
      passed =
        $feedbackStubAction.status_code -eq 200 -and
        $feedbackStubAction.body.status -eq "success" -and
        $feedbackStubAction.body.data.action_type -eq "create_feedback_stub" -and
        $feedbackStubAction.body.data.created_stub.kind -eq "feedback_stub" -and
        -not [string]::IsNullOrWhiteSpace([string]$feedbackStubAction.body.data.created_stub.stub_id)
    },
    [pscustomobject]@{
      case = "workspace_draft_route_ready_after_stub"
      status = $draftRouteAfterStub.status_code
      detail = if ($draftRouteAfterStub.body -and $draftRouteAfterStub.body.data) { [string]$draftRouteAfterStub.body.data.route_ready } else { "" }
      passed =
        $draftRouteAfterStub.status_code -eq 200 -and
        ($draftRouteAfterStub.body.status -eq "success" -or $draftRouteAfterStub.body.status -eq "partial") -and
        $draftRouteAfterStub.body.data.route -eq "draft" -and
        $draftRouteAfterStub.body.data.route_ready -eq $true
    },
    [pscustomobject]@{
      case = "workspace_feedback_route_ready_after_stub"
      status = $feedbackRouteAfterStub.status_code
      detail = if ($feedbackRouteAfterStub.body -and $feedbackRouteAfterStub.body.data) { [string]$feedbackRouteAfterStub.body.data.route_ready } else { "" }
      passed =
        $feedbackRouteAfterStub.status_code -eq 200 -and
        ($feedbackRouteAfterStub.body.status -eq "success" -or $feedbackRouteAfterStub.body.status -eq "partial") -and
        $feedbackRouteAfterStub.body.data.route -eq "feedback" -and
        $feedbackRouteAfterStub.body.data.route_ready -eq $true
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
