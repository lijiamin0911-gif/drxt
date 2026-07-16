@echo off
echo === Step 1: Read current users ===
curl -s --max-time 15 -X POST "https://drxt.hxddxt.top/api/db" -H "Content-Type: application/json" -d "{\"method\":\"getUsers\",\"params\":[]}" > D:\drxt_repo\users_before.txt
node -e "const u=require('fs').readFileSync('D:\\drxt_repo\\users_before.txt','utf8');const j=JSON.parse(u);console.log('Before:',j.length+' users, names:',j.map(x=>x.username).join(', '))"
echo.
echo === Step 2: Save a modified user list (add a new user) ===
node -e "
const u=require('fs').readFileSync('D:\\drxt_repo\\users_before.txt','utf8');
const users=JSON.parse(u);
users.push({id:'u_test','username':'测试账号','role':'admin','isActive':true,'pin':'2222','createdAt':new Date().toISOString()});
const http=require('http');
const data=JSON.stringify({method:'setLocalData',params:['db_users',users]});
const opts={hostname:'drxt.hxddxt.top',path:'/api/db',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}};
const req=http.request(opts,res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>{console.log('Save status:',res.statusCode);console.log('Save response:',b.substring(0,200))})});
req.on('error',e=>console.log('Error:',e.message));
req.write(data);
req.end();
"
echo.
echo === Step 3: Read back to verify ===
timeout /t 3 /nobreak >nul
curl -s --max-time 15 -X POST "https://drxt.hxddxt.top/api/db" -H "Content-Type: application/json" -d "{\"method\":\"getUsers\",\"params\":[]}" > D:\drxt_repo\users_after.txt
node -e "const u=require('fs').readFileSync('D:\\drxt_repo\\users_after.txt','utf8');const j=JSON.parse(u);console.log('After:',j.length+' users, names:',j.map(x=>x.username).join(', '))"
echo DONE
