import https from 'https';

function post(body) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'drxt.hxddxt.top',
      path: '/api/db',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 12000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')) });
    req.write(data);
    req.end();
  });
}

// 1. 创建测试用户
const testUser = {
  id: 'u_rls_test_' + Date.now(),
  username: 'rls_test_user',
  role: 'receptionist',
  isActive: true,
  pin: '9999',
  createdAt: new Date().toISOString()
};
console.log('Step 1: saveUser...');
const r1 = await post({ method: 'saveUser', args: [testUser, { id: 'u_admin', name: 'admin', role: 'admin' }] });
console.log('  status:', r1.status, 'body:', r1.body.substring(0, 200));

// 2. 等待 3 秒，等 Vercel 容器同步
await new Promise(r => setTimeout(r, 3000));

// 3. 读回
console.log('Step 2: getUsers (after 3s)...');
const r2 = await post({ method: 'getUsers', args: [] });
console.log('  status:', r2.status);
const users = JSON.parse(r2.body);
const found = users.find(u => u.id === testUser.id);
console.log('  total users:', users.length);
console.log('  test user found in Supabase?', found ? '✅ YES' : '❌ NO');
if (found) {
  console.log('  test user:', JSON.stringify(found));
} else {
  console.log('  users list:');
  users.forEach(u => console.log('    -', u.id, u.username, u.role));
}
