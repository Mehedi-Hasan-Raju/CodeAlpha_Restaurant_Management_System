require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./prisma');

const app = express();

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'connected' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/items', require('./routes/items'));
app.use('/api/addons', require('./routes/addons'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/orders', require('./routes/orders'));
// 404 for unknown routes
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// one place for all errors
app.use((err, req, res, next) => {
  if (err.code === 'P2002') return res.status(409).json({ error: 'Already exists (duplicate value)' });
  if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
  if (err.code === 'P2003') return res.status(409).json({ error: 'This record is in use, or a related id is invalid' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 4000;

async function connectDB() {
  await prisma.$connect();
  console.log('Database connected');
}

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

startServer();