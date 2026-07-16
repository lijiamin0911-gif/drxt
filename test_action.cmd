@echo off
echo === DB Status ===
curl -s --max-time 15 "https://drxt.hxddxt.top/api/db/status"
echo.
echo === getUsers ===
curl -s --max-time 15 -X POST "https://drxt.hxddxt.top/api/db" -H "Content-Type: application/json" -d "{\"method\":\"getUsers\",\"params\":[]}"
echo.
echo === getProducts Count ===
curl -s --max-time 15 -X POST "https://drxt.hxddxt.top/api/db" -H "Content-Type: application/json" -d "{\"method\":\"getProducts\",\"params\":[]}" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d.toString().trim());console.log('Products count:',j.length)}catch(e){console.log('Products:',d.toString().substring(0,100))}})"
echo.
echo DONE
