$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

function Get-DotEnvValue {
  param(
    [Parameter(Mandatory)]
    [string] $Path,
    [Parameter(Mandatory)]
    [string] $Name
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  $prefix = "$Name="
  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_.StartsWith($prefix) } |
    Select-Object -Last 1

  if (-not $line) {
    return $null
  }

  return $line.Substring($prefix.Length).Trim().Trim('"').Trim("'")
}

$configuredUrl = $env:VITE_SUPABASE_URL
if (-not $configuredUrl) {
  $configuredUrl = Get-DotEnvValue `
    -Path (Join-Path $projectRoot '.env.local') `
    -Name 'VITE_SUPABASE_URL'
}

$useLocalSupabase = (
  -not $configuredUrl `
  -or $configuredUrl -match 'your-project-ref' `
  -or $configuredUrl -match '^https?://(localhost|127\.0\.0\.1)(:|/)'
)

$supabaseStarted = $false

try {
  if ($useLocalSupabase) {
    Write-Host 'Starting the Supabase local development stack...'
    & pnpm exec supabase start
    if ($LASTEXITCODE -ne 0) {
      throw "Supabase failed to start (exit code $LASTEXITCODE)."
    }
    $supabaseStarted = $true
  }
  else {
    Write-Host "Using hosted Supabase from VITE_SUPABASE_URL."
  }

  Write-Host 'Starting the HowseHowld app at http://localhost:5173...'
  & docker compose up --build app
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose stopped with exit code $LASTEXITCODE."
  }
}
finally {
  Write-Host 'Stopping the HowseHowld app...'
  & docker compose down

  if ($supabaseStarted) {
    Write-Host 'Stopping the Supabase local development stack...'
    & pnpm exec supabase stop
  }
}
