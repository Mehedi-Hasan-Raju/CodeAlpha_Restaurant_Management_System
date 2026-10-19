const { io } = require('socket.io-client');

const base = 'http://localhost:4000';
const email = process.argv[2] || 'kitchen@restropos.com';
const password = process.argv[3] || 'kitchen123';

(async () => {
  const r = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const { token, error } = await r.json();
  if (!token) return console.log('Login failed:', error);

  const socket = io(base, { auth: { token } });
  socket.on('connect', () => console.log('Connected as', email, '- waiting for events...'));
  socket.on('connect_error', (e) => console.log('Connect error:', e.message));
  socket.on('order:created', (o) => console.log('order:created ', `#${o.id}`, o.status, o.type, o.tableName || '', 'total', o.total));
  socket.on('order:updated', (o) => console.log('order:updated ', `#${o.id}`, o.status, o.type, o.tableName || '', 'total', o.total));
  socket.on('table:changed', (t) => console.log('table:changed ', JSON.stringify(t)));
})();