@echo off
echo === Test saveUser through deployed API ===

echo Step 1: Get current users
curl -s --max-time 15 -X POST "https://drxt.hxddxt.top/api/db" -H "Content-Type: application/json" -d "{\"method\":\"getUsers\",\"params\":[]}"
echo.

echo Step 2: Save a new test user
curl -s --max-time 15 -X POST "https://drxt.hxddxt.top/api/db" -H "Content-Type: application/json" -d "{\"method\":\"saveUser\",\"params\":[{\"id\":\"u_test\",\"username\":\"测试持久化\",\"role\":\"admin\",\"isActive\":true,\"pin\":\"2222\",\"createdAt\":\"2026-07-16T00:00:00.000Z\"},{\"id\":\"u_admin\",\"name\":\"admin\",\"role\":\"admin\"}]}"
echo.
echo Status above

echo Step 3: Read back
timeout /t 3 /nobreak >nul
curl -s --max-time 15 -X POST "https://drxt.hxddxt.top/api/db" -H "Content-Type: application/json" -d "{\"method\":\"getUsers\",\"params\":[]}"
echo.

echo Step 4: Delete test user
curl -s --max-time 15 -X POST "https://drxt.hxddxt.top/api/db" -H "Content-Type: application/json" -d "{\"method\":\"deleteUser\",\"params\":[\"u_test\",\"测试持久化\",{\"id\":\"u_admin\",\"name\":\"admin\",\"role\":\"admin\"}]}"
echo.
echo DONE
