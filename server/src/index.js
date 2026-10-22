import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager(io);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', rooms: roomManager.rooms.size });
});

app.get('/api/rooms', (req, res) => {
  res.json(roomManager.getPublicRoomsList());
});

io.on('connection', (socket) => {
  // Send initial public rooms list
  socket.emit('public_rooms_update', roomManager.getPublicRoomsList());

  socket.on('request_public_rooms', () => {
    socket.emit('public_rooms_update', roomManager.getPublicRoomsList());
  });

  socket.on('create_room', (payload, callback) => {
    const res = roomManager.createRoom(socket, payload || {});
    if (typeof callback === 'function') callback(res);
  });

  socket.on('join_room', (payload, callback) => {
    const res = roomManager.joinRoom(socket, payload || {});
    if (typeof callback === 'function') callback(res);
  });

  socket.on('leave_room', () => {
    roomManager.leaveCurrentRoom(socket);
  });

  socket.on('add_bot', () => {
    roomManager.addBot(socket);
  });

  socket.on('remove_player', (targetId) => {
    roomManager.removePlayerOrBot(socket, targetId);
  });

  socket.on('regenerate_map', (regionCount) => {
    roomManager.regenerateLobbyMap(socket, regionCount);
  });

  socket.on('start_game', () => {
    roomManager.startGame(socket);
  });

  socket.on('initial_pick', (territoryId) => {
    roomManager.handleInitialPick(socket, territoryId);
  });

  socket.on('select_territories', (payload) => {
    roomManager.handleSelectTerritories(socket, payload || {});
  });

  socket.on('throw_eraser', (payload) => {
    roomManager.handleThrowEraser(socket, payload || {});
  });

  socket.on('start_attack', (payload) => {
    roomManager.handleStartAttack(socket, payload || {});
  });

  socket.on('rps_choice', (choice) => {
    roomManager.handleRpsChoice(socket, choice);
  });

  socket.on('return_to_lobby', () => {
    roomManager.returnToLobby(socket);
  });

  socket.on('disconnect', () => {
    roomManager.leaveCurrentRoom(socket);
  });
});

// Serve static frontend build in production (for Oracle Cloud deployment)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) res.status(200).send('Silgi Savaşları Backend API Çalışıyor.');
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Silgi Savaşları Sunucusu çalışıyor: http://localhost:${PORT}`);
});
