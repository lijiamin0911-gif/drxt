$body = @{ method = "getUsers"; args = @() } | ConvertTo-Json -Compress
$headers = @{ "Content-Type" = "application/json" }
try {
    $r = Invoke-WebRequest -Uri "https://drxt.hxddxt.top/api/db" -Method POST -Headers $headers -Body $body -TimeoutSec 30
    "STATUS: $($r.StatusCode)"
    $r.Content
} catch {
    $status = [int]$_.Exception.Response.StatusCode
    "STATUS: $status"
    $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    $reader.ReadToEnd()
}
