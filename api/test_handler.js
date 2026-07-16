// Vercel minimal test
const express = require('express');
const app = express();
app.get('/api/health', (req, res) => res.json({ok: 1}));
module.exports = app;
