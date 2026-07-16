param(
  [string]$ReferenceDir = "C:\Users\vikas\.codex\attachments\e2caf055-7e81-400a-8f84-5d1fc8b7f410",
  [int]$CropTop = 102,
  [int]$Step = 4,
  [double]$MaxRms = 30
)

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$cases = @(
  @{
    Name = 'attendance'; Reference = 'image-2.png'; Live = 'tmp-live-attendance.png'; MaxRms = 30; IgnoreRects = @();
    Regions = @(
      @{ Name = 'sidebar'; X = 0; Y = 0; W = 218; H = 914; MaxRms = 31 },
      @{ Name = 'header'; X = 218; Y = 0; W = 1700; H = 64; MaxRms = 27 },
      @{ Name = 'content-card'; X = 252; Y = 62; W = 1630; H = 835; MaxRms = 33 }
    )
  },
  @{
    Name = 'dashboard'; Reference = 'image-3.png'; Live = 'tmp-live-dashboard.png'; MaxRms = 30; IgnoreRects = @(@{ X = 1440; Y = 470; W = 470; H = 435 });
    Regions = @(
      @{ Name = 'sidebar'; X = 0; Y = 0; W = 218; H = 914; MaxRms = 31 },
      @{ Name = 'header'; X = 218; Y = 0; W = 1700; H = 64; MaxRms = 26 },
      @{ Name = 'kpis'; X = 252; Y = 120; W = 1630; H = 250; MaxRms = 36 }
    )
  },
  @{
    Name = 'tickets'; Reference = 'image-4.png'; Live = 'tmp-live-tickets.png'; MaxRms = 30; IgnoreRects = @();
    Regions = @(
      @{ Name = 'sidebar'; X = 0; Y = 0; W = 218; H = 914; MaxRms = 31 },
      @{ Name = 'header'; X = 218; Y = 0; W = 1700; H = 64; MaxRms = 26 },
      @{ Name = 'table'; X = 280; Y = 365; W = 1580; H = 545; MaxRms = 35 }
    )
  },
  @{
    Name = 'requests'; Reference = 'image-5.png'; Live = 'tmp-live-requests.png'; MaxRms = 30; IgnoreRects = @();
    Regions = @(
      @{ Name = 'sidebar'; X = 0; Y = 0; W = 218; H = 914; MaxRms = 31 },
      @{ Name = 'header'; X = 218; Y = 0; W = 1700; H = 64; MaxRms = 27 },
      @{ Name = 'table'; X = 280; Y = 182; W = 1580; H = 575; MaxRms = 34 }
    )
  }
)

function Get-RmsDifference {
  param(
    [string]$ReferencePath,
    [string]$LivePath,
    [int]$CropTop,
    [int]$Step,
    [object[]]$IgnoreRects,
    [object]$Region = $null
  )

  $ref = [System.Drawing.Bitmap]::FromFile($ReferencePath)
  $live = [System.Drawing.Bitmap]::FromFile($LivePath)
  try {
    $startX = if ($Region) { [int]$Region.X } else { 0 }
    $startY = if ($Region) { [int]$Region.Y } else { 0 }
    $width = if ($Region) { [int]$Region.W } else { [Math]::Min($ref.Width, $live.Width) }
    $height = if ($Region) { [int]$Region.H } else { [Math]::Min($ref.Height - $CropTop, $live.Height) }
    $width = [Math]::Min($width, [Math]::Min($ref.Width - $startX, $live.Width - $startX))
    $height = [Math]::Min($height, [Math]::Min($ref.Height - $CropTop - $startY, $live.Height - $startY))
    if ($width -le 0 -or $height -le 0) {
      throw "Invalid compare dimensions for $ReferencePath and $LivePath"
    }

    $sum = 0.0
    $count = 0
    for ($y = 0; $y -lt $height; $y += $Step) {
      for ($x = 0; $x -lt $width; $x += $Step) {
        $screenX = $startX + $x
        $screenY = $startY + $y
        $ignored = $false
        foreach ($rect in $IgnoreRects) {
          if ($screenX -ge $rect.X -and $screenX -lt ($rect.X + $rect.W) -and $screenY -ge $rect.Y -and $screenY -lt ($rect.Y + $rect.H)) {
            $ignored = $true
            break
          }
        }
        if ($ignored) { continue }

        $a = $ref.GetPixel($screenX, $screenY + $CropTop)
        $b = $live.GetPixel($screenX, $screenY)
        $sum += [Math]::Pow($a.R - $b.R, 2)
        $sum += [Math]::Pow($a.G - $b.G, 2)
        $sum += [Math]::Pow($a.B - $b.B, 2)
        $count += 3
      }
    }
    if ($count -eq 0) { throw "No comparable pixels for $ReferencePath and $LivePath" }
    return [Math]::Round([Math]::Sqrt($sum / $count), 2)
  } finally {
    $ref.Dispose()
    $live.Dispose()
  }
}

$failures = @()
foreach ($case in $cases) {
  $referencePath = Join-Path $ReferenceDir $case.Reference
  $livePath = Join-Path $root $case.Live
  if (!(Test-Path $referencePath)) {
    $failures += "Missing reference image: $referencePath"
    continue
  }
  if (!(Test-Path $livePath)) {
    $failures += "Missing live screenshot: $livePath"
    continue
  }

  $limit = if ($case.MaxRms) { [double]$case.MaxRms } else { $MaxRms }
  $rms = Get-RmsDifference $referencePath $livePath $CropTop $Step $case.IgnoreRects
  Write-Host "$($case.Name): RMS=$rms limit=$limit"
  if ($rms -gt $limit) {
    $failures += "$($case.Name) visual RMS $rms exceeds $limit"
  }

  foreach ($region in $case.Regions) {
    $regionRms = Get-RmsDifference $referencePath $livePath $CropTop $Step $case.IgnoreRects $region
    Write-Host "  $($region.Name): RMS=$regionRms limit=$($region.MaxRms)"
    if ($regionRms -gt [double]$region.MaxRms) {
      $failures += "$($case.Name)/$($region.Name) visual RMS $regionRms exceeds $($region.MaxRms)"
    }
  }
}

$badReference = Join-Path $ReferenceDir 'image-1.png'
$attendanceLive = Join-Path $root 'tmp-live-attendance.png'
if ((Test-Path $badReference) -and (Test-Path $attendanceLive)) {
  $badRms = Get-RmsDifference $badReference $attendanceLive $CropTop $Step @()
  Write-Host "generated-prototype-vs-attendance: RMS=$badRms minimum=45"
  if ($badRms -lt 45) {
    $failures += "Generated prototype reference is too visually close to WorkTrack attendance; negative guard is ineffective."
  }
}

if ($failures.Count) {
  Write-Error ($failures -join [Environment]::NewLine)
  exit 1
}

Write-Host "Reference screen comparison passed."
