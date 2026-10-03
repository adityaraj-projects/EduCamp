Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot "..\public\assets\branding\app_logo.png"
$iconsDir = Join-Path $PSScriptRoot "..\public\icons"
$publicDir = Join-Path $PSScriptRoot "..\public"

if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

$sourceImg = [System.Drawing.Bitmap]::FromFile($sourcePath)

function Resize-Image {
    param (
        [System.Drawing.Bitmap]$source,
        [int]$targetWidth,
        [int]$targetHeight,
        [string]$outputPath,
        [System.Drawing.Color]$bgColor = [System.Drawing.Color]::Transparent,
        [double]$scaleFactor = 1.0
    )

    $destBitmap = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Fill background if specified
    if ($bgColor -ne [System.Drawing.Color]::Transparent) {
        $brush = New-Object System.Drawing.SolidBrush($bgColor)
        $graphics.FillRectangle($brush, 0, 0, $targetWidth, $targetHeight)
        $brush.Dispose()
    } else {
        $graphics.Clear([System.Drawing.Color]::Transparent)
    }

    # Calculate centered position with optional scale factor (for maskable safe zone)
    $drawW = [int]($targetWidth * $scaleFactor)
    $drawH = [int]($targetHeight * $scaleFactor)
    $drawX = [int](($targetWidth - $drawW) / 2)
    $drawY = [int](($targetHeight - $drawH) / 2)

    $destRect = New-Object System.Drawing.Rectangle($drawX, $drawY, $drawW, $drawH)
    $graphics.DrawImage($source, $destRect, 0, 0, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel)

    $destBitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $destBitmap.Dispose()

    Write-Host "Created: $outputPath ($targetWidth x $targetHeight)"
}

# Theme Color: #16113A (R: 22, G: 17, B: 58)
$themeColor = [System.Drawing.Color]::FromArgb(255, 22, 17, 58)

# 1. Standard 192x192 transparent icon (any)
Resize-Image -source $sourceImg -targetWidth 192 -targetHeight 192 -outputPath (Join-Path $iconsDir "icon-192.png")

# 2. Standard 512x512 transparent icon (any)
Resize-Image -source $sourceImg -targetWidth 512 -targetHeight 512 -outputPath (Join-Path $iconsDir "icon-512.png")

# 3. Maskable 512x512 icon (with 80% safe zone and #16113A theme background)
Resize-Image -source $sourceImg -targetWidth 512 -targetHeight 512 -outputPath (Join-Path $iconsDir "icon-maskable-512.png") -bgColor $themeColor -scaleFactor 0.82

# 4. Apple Touch Icon 180x180 (with #16113A theme background for iOS Safari home screen)
Resize-Image -source $sourceImg -targetWidth 180 -targetHeight 180 -outputPath (Join-Path $iconsDir "apple-touch-icon.png") -bgColor $themeColor -scaleFactor 0.90

# 5. Favicon 64x64
Resize-Image -source $sourceImg -targetWidth 64 -targetHeight 64 -outputPath (Join-Path $publicDir "favicon.png")

$sourceImg.Dispose()
Write-Host "All PWA icons generated successfully from EduCamp app_logo.png!"
