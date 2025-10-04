// server.js
// minimal WebSocket signaling server for rooms
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const server = http.createServer();
const wss = new WebSocket.Server({ noServer: true });

const rooms = new Map(); // roomId -> Set of ws

function broadcastToRoom(roomId, from, data) {
  const set = rooms.get(roomId);
  if(!set) return;
  for(const ws of set) {
    if(ws !== from && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }
}

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', ()=> ws.isAlive = true);

  ws.on('message', message => {
    let msg;
    try { msg = JSON.parse(message); } catch(e){ return; }
    const {type, room, payload} = msg;
    if(type === 'join') {
      ws.room = room;
      ws.id = payload && payload.id ? payload.id : Math.random().toString(36).slice(2,9);
      if(!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room).add(ws);
      // notify others
      broadcastToRoom(room, ws, { type:'peer-join', id: ws.id });
      ws.send(JSON.stringify({ type:'joined', id: ws.id }));
      console.log(`ws ${ws.id} joined ${room}`);
    } else if(['offer','answer','ice','signal'].includes(type)) {
      // relay to other peers in room
      broadcastToRoom(ws.room, ws, { type, from: ws.id, payload });
    } else if(type === 'leave') {
      ws.close();
    }
  });

  ws.on('close', () => {
    if(ws.room && rooms.has(ws.room)) {
      rooms.get(ws.room).delete(ws);
      broadcastToRoom(ws.room, ws, { type:'peer-leave', id: ws.id });
      if(rooms.get(ws.room).size === 0) rooms.delete(ws.room);
    }
  });
});

// HTTP upgrade
server.on('upgrade', (req, socket, head) => {
  const pathname = url.parse(req.url).pathname;
  if(pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log('Signaling server running on', PORT));

// keepalive
setInterval(()=> {
  wss.clients.forEach(ws => {
    if(ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);
