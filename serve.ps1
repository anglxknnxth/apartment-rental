# Maliit na local server para sa Rent Receipt page.
# Kailangan ito para makuha ng page ang data sa Google Sheet (hinaharang ng Google ang file://).
# Gamitin: i-double-click ang "Buksan Resibo.bat". Isara ang window para i-stop.
param([switch]$NoBrowser)

$root = (Split-Path -Parent $MyInvocation.MyCommand.Path).TrimEnd('\') + '\'

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.json' = 'application/json'
}

# Hanapin ang bakanteng port simula 8765
$port = 8765
while ($true) {
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:$port/")
  try { $listener.Start(); break }
  catch {
    $port++
    if ($port -gt 8800) {
      Write-Host 'Walang bakanteng port (8765-8800).'
      Read-Host 'Pindutin ang Enter para isara'
      exit 1
    }
  }
}

$url = "http://localhost:$port/index.html"
Write-Host ''
Write-Host "  Rent Receipt Generator: $url"
Write-Host '  Huwag isara ang window na ito habang ginagamit ang page.'
Write-Host '  Isara ang window para i-stop.'
Write-Host ''
if (-not $NoBrowser) { Start-Process $url }

$badChars = [IO.Path]::GetInvalidFileNameChars()
function Test-SafeName($name) {
  return $name -and $name.Trim() -eq $name -and $name -notmatch '\.\.' -and $name.IndexOfAny($badChars) -lt 0
}

function Send-Json($res, $status, $json) {
  $res.StatusCode = $status
  $res.ContentType = 'application/json; charset=utf-8'
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

# POST /save?tenant=<pangalan>&file=<filename>.jpeg (o .pdf)
# Sine-save ang file sa Rent\<tenant>\ (ginagawa ang folder kung wala pa) at laging nag-o-overwrite.
function Save-Receipt($req, $res) {
  # Custom header = kailangan ng CORS preflight, kaya hindi ito matatawag ng ibang website
  if ($req.Headers['X-Rent-Save'] -ne '1') { return Send-Json $res 403 '{"ok":false,"error":"forbidden"}' }

  $tenant = $req.QueryString['tenant']
  $file = $req.QueryString['file']
  if (-not (Test-SafeName $tenant) -or -not (Test-SafeName $file) -or -not ($file.ToLower().EndsWith('.jpeg') -or $file.ToLower().EndsWith('.pdf'))) {
    return Send-Json $res 400 '{"ok":false,"error":"invalid name"}'
  }
  if ($req.ContentLength64 -le 0 -or $req.ContentLength64 -gt 50MB) {
    return Send-Json $res 400 '{"ok":false,"error":"invalid size"}'
  }

  $dir = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $tenant))
  $path = [IO.Path]::GetFullPath([IO.Path]::Combine($dir, $file))
  if (-not $path.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    return Send-Json $res 400 '{"ok":false,"error":"invalid path"}'
  }

  $ms = New-Object IO.MemoryStream
  $req.InputStream.CopyTo($ms)
  [void][IO.Directory]::CreateDirectory($dir)
  [IO.File]::WriteAllBytes($path, $ms.ToArray())

  $relPath = $path.Substring($root.Length).Replace('\', '\\').Replace('"', '\"')
  Write-Host "  Na-save: $($path.Substring($root.Length))"
  Send-Json $res 200 "{""ok"":true,""path"":""$relPath""}"
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    if ($ctx.Request.Url.AbsolutePath -eq '/save') {
      if ($ctx.Request.HttpMethod -eq 'POST') { Save-Receipt $ctx.Request $res } else { $res.StatusCode = 405 }
      continue
    }

    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'index.html' }
    $path = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $rel))

    # Mga file lang sa loob ng Rent folder ang puwedeng i-serve
    if ($path.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $path -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($path)
      $ext = [IO.Path]::GetExtension($path).ToLower()
      if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] } else { $res.ContentType = 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-store')
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.Close()
  }
}
