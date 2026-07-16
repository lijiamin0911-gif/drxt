import https from 'https';

const jsUrl = 'https://drxt.hxddxt.top/assets/index-DyotIIqe.js';
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);

const bundle = await new Promise((resolve, reject) => {
  https.get(jsUrl, { signal: controller.signal }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => resolve(d));
  }).on('error', reject);
}).finally(() => clearTimeout(timeout));

console.log('Bundle size:', bundle.length);

// Search for supabase references
const supabaseUrlMatch = bundle.match(/(https:\/\/[a-z]+\.[a-z]+\.[a-z]+supabase\.co)/);
if (supabaseUrlMatch) console.log('Supabase URL:', supabaseUrlMatch[1]);

// Search for JWT tokens (supabase anon key format)
const tokens = bundle.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g);
if (tokens) {
  console.log('Found', tokens.length, 'JWT tokens:');
  tokens.forEach((t, i) => console.log(`  Token ${i}: ${t.substring(0, 60)}...`));
}
