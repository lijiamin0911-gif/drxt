import http from 'http';
http.get('http://drxt.hxddxt.top/', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const m = d.match(/src="(\/assets\/[^"]+\.js)"/);
    if (m) console.log('JS bundle:', m[1]);
    else console.log('No JS bundle found');
    console.log('HTML snippet:', d.substring(0, 300));
  });
}).on('error', e => console.log('Error:', e.message));
