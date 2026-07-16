curl -s --max-time 15 -X POST "https://drxt.hxddxt.top/api/db/debug" -H "Content-Type: application/json" -d "{\"test\":true}"
echo.
curl -s --max-time 15 -X POST "https://drxt.hxddxt.top/api/db" -H "Content-Type: application/json" -d "{\"method\":\"getUsers\",\"params\":[]}"
echo.
echo DONE
