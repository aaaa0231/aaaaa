// server.js
// Simple WebSocket chat server with rooms
const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const url = require('url');

const app = express();
app.use(express.static('public')); // optional: serve static files if you want

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

/*
Message format (JSON):
{ type: "join", room: "room1", name: "Alice" }
{ type: "chat", room: "room1", name: "Alice", text: "hello" }
{ type: "leave", room: "room1", name: "Alice" }
*/

const rooms = new Map(); // room -> Set(ws)

function broadcast(room, data, except) {
  const set = rooms.get(room);
  if (!set) return;
  const str = JSON.stringify(data);
  for (const ws of set) {
    if (ws !== except && ws.readyState === WebSocket.OPEN) {
      ws.send(str);
    }
  }
}

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => ws.isAlive = true);

  ws.on('message', (msg) => {
    let m;
    try { m = JSON.parse(msg); } catch (e) { return; }
    const { type, room, name, text } = m;

    if (type === 'join') {
      ws.room = room;
      ws.name = name || '匿名';
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room).add(ws);

      // notify joining user and others
      ws.send(JSON.stringify({ type: 'system', text: `Joined room ${room}` }));
      broadcast(room, { type: 'system', text: `${ws.name} さんが入室しました` }, ws);

    } else if (type === 'chat') {
      if (!room) return;
      broadcast(room, { type: 'chat', name: name || ws.name || '匿名', text }, ws);
    } else if (type === 'leave') {
      // handled by close
      ws.close();
    }
  });

  ws.on('close', () => {
    const room = ws.room;
    if (room && rooms.has(room)) {
      rooms.get(room).delete(ws);
      broadcast(room, { type: 'system', text: `${ws.name || '匿名'} さんが退室しました` }, ws);
      if (rooms.get(room).size === 0) rooms.delete(room);
    }
  });
});

// health ping
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// upgrade HTTP -> WS
server.on('upgrade', (req, socket, head) => {
  const pathname = url.parse(req.url).pathname;
  // accept connections on '/ws'
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Chat server listening on ${PORT}`));
