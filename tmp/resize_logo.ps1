Add-Type -AssemblyName System.Drawing
$imagePath = "C:\Users\dave_\.gemini\antigravity\scratch\lasecre\Logo.png"
$outputPath = "C:\Users\dave_\.gemini\antigravity\scratch\lasecre\Logo_small.png"

$img = [System.Drawing.Image]::FromFile($imagePath)
$newImg = New-Object System.Drawing.Bitmap(800, 800)
$graph = [System.Drawing.Graphics]::FromImage($newImg)

# Professional quality settings
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$graph.DrawImage($img, 0, 0, 800, 800)
$newImg.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$img.Dispose()
$newImg.Dispose()
$graph.Dispose()
