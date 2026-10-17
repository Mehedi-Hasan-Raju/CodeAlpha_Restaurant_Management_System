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

// 404 for unknown routes
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// one place for all errors
app.use((err, req, res, next) => {
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