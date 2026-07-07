$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = (Get-Location).Path
$assetsDir = Join-Path $root "assets"
$resDir = Join-Path $root "android\app\src\main\res"

$iconOnlyPath = Join-Path $assetsDir "icon-only.png"
$iconForegroundPath = Join-Path $assetsDir "icon-foreground.png"

if (!(Test-Path $iconOnlyPath)) {
  throw "Missing assets/icon-only.png"
}

if (!(Test-Path $iconForegroundPath)) {
  Write-Host "assets/icon-foreground.png missing, using icon-only.png as fallback."
  $iconForegroundPath = $iconOnlyPath
}

$safeIconOnly = Join-Path $assetsDir "_safe_icon_only.png"
$safeForeground = Join-Path $assetsDir "_safe_icon_foreground.png"

function New-PaddedPng {
  param(
    [string]$InputPath,
    [string]$OutputPath,
    [double]$Scale,
    [bool]$Transparent
  )

  $size = 1024
  $src = [System.Drawing.Image]::FromFile($InputPath)
  $bmp = [System.Drawing.Bitmap]::new(
    $size,
    $size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $g = [System.Drawing.Graphics]::FromImage($bmp)

  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  if ($Transparent) {
    $g.Clear([System.Drawing.Color]::Transparent)
  } else {
    $g.Clear([System.Drawing.Color]::White)
  }

  $maxBox = [int]($size * $Scale)
  $ratio = [Math]::Min($maxBox / $src.Width, $maxBox / $src.Height)
  $targetW = [int]($src.Width * $ratio)
  $targetH = [int]($src.Height * $ratio)
  $x = [int](($size - $targetW) / 2)
  $y = [int](($size - $targetH) / 2)

  $g.DrawImage($src, $x, $y, $targetW, $targetH)
  $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose()
  $bmp.Dispose()
  $src.Dispose()
}

function Resize-Png {
  param(
    [string]$InputPath,
    [string]$OutputPath,
    [int]$Size,
    [bool]$Transparent
  )

  $src = [System.Drawing.Image]::FromFile($InputPath)
  $bmp = [System.Drawing.Bitmap]::new(
    $Size,
    $Size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $g = [System.Drawing.Graphics]::FromImage($bmp)

  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  if ($Transparent) {
    $g.Clear([System.Drawing.Color]::Transparent)
  } else {
    $g.Clear([System.Drawing.Color]::White)
  }

  $g.DrawImage($src, 0, 0, $Size, $Size)
  $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose()
  $bmp.Dispose()
  $src.Dispose()
}

# Logo padding. Lower = smaller logo.
# If icon still looks cropped, change 0.50 to 0.45.
New-PaddedPng -InputPath $iconOnlyPath -OutputPath $safeIconOnly -Scale 0.50 -Transparent $false
New-PaddedPng -InputPath $iconForegroundPath -OutputPath $safeForeground -Scale 0.50 -Transparent $true

$densities = @(
  @{ Dir = "mipmap-mdpi";    Legacy = 48;  Foreground = 108 },
  @{ Dir = "mipmap-hdpi";    Legacy = 72;  Foreground = 162 },
  @{ Dir = "mipmap-xhdpi";   Legacy = 96;  Foreground = 216 },
  @{ Dir = "mipmap-xxhdpi";  Legacy = 144; Foreground = 324 },
  @{ Dir = "mipmap-xxxhdpi"; Legacy = 192; Foreground = 432 }
)

foreach ($density in $densities) {
  $dir = Join-Path $resDir $density.Dir
  New-Item -ItemType Directory -Path $dir -Force | Out-Null

  Resize-Png -InputPath $safeIconOnly -OutputPath (Join-Path $dir "ic_launcher.png") -Size $density.Legacy -Transparent $false
  Resize-Png -InputPath $safeIconOnly -OutputPath (Join-Path $dir "ic_launcher_round.png") -Size $density.Legacy -Transparent $false
  Resize-Png -InputPath $safeForeground -OutputPath (Join-Path $dir "ic_launcher_foreground.png") -Size $density.Foreground -Transparent $true
}

$adaptiveDir = Join-Path $resDir "mipmap-anydpi-v26"
New-Item -ItemType Directory -Path $adaptiveDir -Force | Out-Null

$adaptiveXml = @'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'@

Set-Content -Path (Join-Path $adaptiveDir "ic_launcher.xml") -Value $adaptiveXml -Encoding UTF8
Set-Content -Path (Join-Path $adaptiveDir "ic_launcher_round.xml") -Value $adaptiveXml -Encoding UTF8

$valuesDir = Join-Path $resDir "values"
New-Item -ItemType Directory -Path $valuesDir -Force | Out-Null

$backgroundXml = @'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>
'@

Set-Content -Path (Join-Path $valuesDir "ic_launcher_background.xml") -Value $backgroundXml -Encoding UTF8

Write-Host "Android icons generated successfully."