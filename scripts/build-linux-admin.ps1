# ============================================================================
# MobSec Studio — Linux AppImage builder (requires admin/Developer Mode)
# ============================================================================
#
# USAGE:
#   Right-click this file → "Run with PowerShell"  (UAC prompt will appear)
#   OR open an elevated PowerShell and run:
#     Set-ExecutionPolicy Bypass -Scope Process -Force
#     & "D:\mobsec\scripts\build-linux-admin.ps1"
#
# WHY admin?
#   electron-builder's AppImage packager creates POSIX symlinks inside the
#   staging directory (e.g. .DirIcon → icon.png). Windows requires either
#   Developer Mode or admin elevation for symlink creation. This script
#   enables Developer Mode once, then builds.
# ============================================================================

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

# ── 1. Verify elevation ──────────────────────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host ""
    Write-Host "  ERROR: This script must run as Administrator." -ForegroundColor Red
    Write-Host "  Right-click the file and choose 'Run with PowerShell'," -ForegroundColor Yellow
    Write-Host "  then click Yes in the UAC prompt." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 1
}

Write-Host ""
Write-Host "  MobSec Studio — Linux Build Helper" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ── 2. Enable Developer Mode (allows symlink creation for non-admin users) ──
Write-Host "  [1/3] Enabling Windows Developer Mode..." -ForegroundColor Yellow
$regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock"
if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}
Set-ItemProperty -Path $regPath -Name "AllowDevelopmentWithoutDevLicense" -Value 1 -Type DWord -Force
Set-ItemProperty -Path $regPath -Name "AllowAllTrustedApps"                -Value 1 -Type DWord -Force
Write-Host "      Developer Mode enabled." -ForegroundColor Green

# ── 3. Ensure pnpm is on PATH ────────────────────────────────────────────────
Write-Host "  [2/3] Checking pnpm..." -ForegroundColor Yellow
try {
    $pnpmVersion = & pnpm --version 2>&1
    Write-Host "      pnpm $pnpmVersion found." -ForegroundColor Green
} catch {
    Write-Host "      pnpm not found — add it to PATH and retry." -ForegroundColor Red
    Read-Host "  Press Enter to close"
    exit 1
}

# ── 4. Build ─────────────────────────────────────────────────────────────────
Write-Host "  [3/3] Running pnpm build:linux:appimage ..." -ForegroundColor Yellow
Write-Host ""
Set-Location $projectRoot
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
$env:WIN_CSC_LINK = ""

pnpm build:linux:appimage

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "  ✓ Linux build succeeded!" -ForegroundColor Green
    $artifacts = Get-ChildItem "$projectRoot\release\0.1.0-beta.1\" -Filter "*.AppImage" -ErrorAction SilentlyContinue
    foreach ($f in $artifacts) {
        $sizeMB = [math]::Round($f.Length / 1MB, 1)
        Write-Host "    $($f.Name)  ($sizeMB MB)" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "  Output directory: $projectRoot\release\0.1.0-beta.1\" -ForegroundColor DarkGray
} else {
    Write-Host ""
    Write-Host "  ✗ Build failed (exit code $LASTEXITCODE). See output above." -ForegroundColor Red
}

Write-Host ""
Read-Host "  Press Enter to close"
