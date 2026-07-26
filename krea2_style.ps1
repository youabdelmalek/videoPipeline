<#
  Krea 2 style-reference generation via the ComfyUI HTTP API.

  Usage:
    .\krea2_style.ps1 -Image "1.png" -Prompt "cute cat"
    .\krea2_style.ps1 -Image "C:\path\wolves.png" -Prompt "cute cat" -Steps 8 -Seed 123 -Strength 0.9

  Steps (all over the API):
    1. POST /upload/image  -> puts the reference image in ComfyUI/input/
    2. POST /prompt        -> queues the style-reference workflow
    3. GET  /history/{id}  -> waits for completion
    4. GET  /view          -> downloads the generated image
#>
param(
    [Parameter(Mandatory=$true)][string]$Image,
    [Parameter(Mandatory=$true)][string]$Prompt,
    [string]$Server   = "http://127.0.0.1:8188",
    [int]   $Seed     = 42,
    [int]   $Steps    = 8,
    [double]$Strength = 1.0,
    [string]$Out      = "krea2_out.png"
)

$ErrorActionPreference = "Stop"

function Send-Image([string]$Server, [string]$Path) {
    if (-not (Test-Path $Path)) { throw "Image not found: $Path" }
    $name     = [System.IO.Path]::GetFileName($Path)
    $fileBytes= [System.IO.File]::ReadAllBytes($Path)
    $boundary = [System.Guid]::NewGuid().ToString("N")
    $header   = "--$boundary`r`nContent-Disposition: form-data; name=`"image`"; filename=`"$name`"`r`nContent-Type: application/octet-stream`r`n`r`n"
    $footer   = "`r`n--$boundary--`r`n"
    $ms = New-Object System.IO.MemoryStream
    $hb = [System.Text.Encoding]::ASCII.GetBytes($header)
    $fb = [System.Text.Encoding]::ASCII.GetBytes($footer)
    $ms.Write($hb, 0, $hb.Length)
    $ms.Write($fileBytes, 0, $fileBytes.Length)
    $ms.Write($fb, 0, $fb.Length)
    $body = $ms.ToArray()
    $ms.Dispose()
    $resp = Invoke-RestMethod -Uri "$Server/upload/image" -Method Post `
              -ContentType "multipart/form-data; boundary=$boundary" -Body $body
    return $resp.name
}

Write-Host "[1/4] uploading $Image ..."
$imgName = Send-Image $Server $Image
Write-Host "      -> input/$imgName"

Write-Host "[2/4] queueing prompt: '$Prompt'"
$wf = @{
  "1"  = @{ class_type = "UNETLoader";           inputs = @{ unet_name = "krea2_turbo_fp8_scaled.safetensors"; weight_dtype = "default" } }
  "2"  = @{ class_type = "LoraLoaderModelOnly";   inputs = @{ lora_name = "krea2_style_reference.safetensors"; strength_model = $Strength; model = @("1",0) } }
  "3"  = @{ class_type = "Krea2OstrisEditModelPatch"; inputs = @{ model = @("2",0); kv_cache = $false } }
  "4"  = @{ class_type = "CLIPLoader";            inputs = @{ clip_name = "qwen3vl_4b_fp8_scaled.safetensors"; type = "krea2"; device = "default" } }
  "5"  = @{ class_type = "VAELoader";             inputs = @{ vae_name = "qwen_image_vae.safetensors" } }
  "6"  = @{ class_type = "LoadImage";             inputs = @{ image = $imgName } }
  "7"  = @{ class_type = "TextEncodeKrea2OstrisEdit"; inputs = @{ clip = @("4",0); prompt = $Prompt; vae = @("5",0); image1 = @("6",0) } }
  "8"  = @{ class_type = "TextEncodeKrea2OstrisEdit"; inputs = @{ clip = @("4",0); prompt = "" } }
  "9"  = @{ class_type = "EmptySD3LatentImage";   inputs = @{ width = 1024; height = 1024; batch_size = 1 } }
  "10" = @{ class_type = "KSampler";              inputs = @{ seed = $Seed; steps = $Steps; cfg = 1.0; sampler_name = "euler"; scheduler = "beta"; denoise = 1.0; model = @("3",0); positive = @("7",0); negative = @("8",0); latent_image = @("9",0) } }
  "11" = @{ class_type = "VAEDecode";             inputs = @{ samples = @("10",0); vae = @("5",0) } }
  "12" = @{ class_type = "SaveImage";             inputs = @{ images = @("11",0); filename_prefix = "Krea2StyleRef" } }
}
$payload = @{ prompt = $wf; client_id = [System.Guid]::NewGuid().ToString("N") } | ConvertTo-Json -Depth 20
$queued  = Invoke-RestMethod -Uri "$Server/prompt" -Method Post -ContentType "application/json" -Body $payload
$pid_    = $queued.prompt_id
if (-not $pid_) { throw "queue rejected: $($queued | ConvertTo-Json -Depth 5)" }
Write-Host "      -> prompt_id $pid_"

Write-Host "[3/4] waiting for completion ..."
$outImg = $null
while ($true) {
    $hist = Invoke-RestMethod -Uri "$Server/history/$pid_" -Method Get
    if ($hist.$pid_) {
        foreach ($node in $hist.$pid_.outputs.PSObject.Properties.Value) {
            if ($node.images) { foreach ($im in $node.images) { $outImg = $im } }
        }
        break
    }
    Start-Sleep -Seconds 1
}
if (-not $outImg) { throw "job finished but produced no image" }

Write-Host "[4/4] downloading result ..."
$q = "filename=$([uri]::EscapeDataString($outImg.filename))&subfolder=$([uri]::EscapeDataString($outImg.subfolder))&type=$([uri]::EscapeDataString($outImg.type))"
Invoke-WebRequest -Uri "$Server/view?$q" -OutFile $Out | Out-Null
Write-Host "done -> $Out  (also in ComfyUI/output/$($outImg.filename))"
