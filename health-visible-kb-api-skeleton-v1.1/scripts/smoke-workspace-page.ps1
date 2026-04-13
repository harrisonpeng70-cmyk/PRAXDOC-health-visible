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

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$nodePath = "D:\Program Files\nodejs\node.exe"
if (-not (Test-Path $nodePath)) {
  throw "Node executable not found at: $nodePath"
}

function Invoke-Request {
  param(
    [string]$Url,
    [hashtable]$Headers = @{}
  )

  try {
    $resp = Invoke-WebRequest -Uri $Url -Method Get -Headers $Headers -TimeoutSec 15 -UseBasicParsing
    [pscustomobject]@{
      status_code = [int]$resp.StatusCode
      body = [string]$resp.Content
    }
  } catch {
    $http = $_.Exception.Response
    if ($http) {
      $reader = New-Object System.IO.StreamReader($http.GetResponseStream())
      $body = $reader.ReadToEnd()
      [pscustomobject]@{
        status_code = [int]$http.StatusCode
        body = [string]$body
      }
    } else {
      throw
    }
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

  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    $health = Invoke-Request -Url "http://localhost:$Port/kb/v1/health" -Headers @{
      "x-tenant-id" = $TenantId
      "x-request-id" = "smoke-workspace-page-health-$i"
    }
    if ($health.status_code -eq 200) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }

  if (-not $ready) {
    throw "API did not become ready on port $Port."
  }

  $page = Invoke-Request -Url "http://localhost:$Port/client-workspace-page-v1/index.html"
  $routePage = Invoke-Request -Url "http://localhost:$Port/client-workspace-page-v1/route.html"
  $cardsPage = Invoke-Request -Url "http://localhost:$Port/client-workspace-page-v1/cards.html"
  $draftPage = Invoke-Request -Url "http://localhost:$Port/client-workspace-page-v1/draft.html"
  $tasksPage = Invoke-Request -Url "http://localhost:$Port/client-workspace-page-v1/tasks.html"
  $feedbackPage = Invoke-Request -Url "http://localhost:$Port/client-workspace-page-v1/feedback.html"
  $results = @(
    [pscustomobject]@{
      case = "workspace_page_static_200"
      status = $page.status_code
      detail = if ($page.body -match "Client Workspace Page v1") { "title_found" } else { "title_missing" }
      passed = $page.status_code -eq 200 -and ($page.body -match "Client Workspace Page v1")
    },
    [pscustomobject]@{
      case = "workspace_route_page_static_200"
      status = $routePage.status_code
      detail = if ($routePage.body -match "Workspace Route View v1") { "title_found" } else { "title_missing" }
      passed = $routePage.status_code -eq 200 -and ($routePage.body -match "Workspace Route View v1")
    },
    [pscustomobject]@{
      case = "workspace_cards_page_static_200"
      status = $cardsPage.status_code
      detail = if ($cardsPage.body -match "Cards Route Page") { "title_found" } else { "title_missing" }
      passed = $cardsPage.status_code -eq 200 -and ($cardsPage.body -match "Cards Route Page")
    },
    [pscustomobject]@{
      case = "workspace_draft_page_static_200"
      status = $draftPage.status_code
      detail = if ($draftPage.body -match "Draft Route Page") { "title_found" } else { "title_missing" }
      passed = $draftPage.status_code -eq 200 -and ($draftPage.body -match "Draft Route Page")
    },
    [pscustomobject]@{
      case = "workspace_tasks_page_static_200"
      status = $tasksPage.status_code
      detail = if ($tasksPage.body -match "Tasks Route Page") { "title_found" } else { "title_missing" }
      passed = $tasksPage.status_code -eq 200 -and ($tasksPage.body -match "Tasks Route Page")
    },
    [pscustomobject]@{
      case = "workspace_feedback_page_static_200"
      status = $feedbackPage.status_code
      detail = if ($feedbackPage.body -match "Feedback Route Page") { "title_found" } else { "title_missing" }
      passed = $feedbackPage.status_code -eq 200 -and ($feedbackPage.body -match "Feedback Route Page")
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
