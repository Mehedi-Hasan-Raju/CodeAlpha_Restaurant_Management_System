const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function init(server) {
  io = new Server(server, { cors: { origin: 'http://localhost:3000' } });

  // only logged-in users may connect
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join('staff');
  });
}

// send an event to every connected staff screen
const emit = (event, payload) => {
  if (io) io.to('staff').emit(event, payload);
};

module.exports = { init, emit };