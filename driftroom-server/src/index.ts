import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || "http://localhost:3000" },
});

type QueuedUser = { socketId: string; nickname: string; sessionId: string };
type ActiveRoom = {
  roomId: string;
  users: [QueuedUser, QueuedUser];
  category: string;
};

const queues = new Map<string, QueuedUser[]>();
const rooms = new Map<string, ActiveRoom>();
const socketRoom = new Map<string, string>();

function getQueue(category: string) {
  if (!queues.has(category)) queues.set(category, []);
  return queues.get(category)!;
}

function broadcastPresence() {
  io.emit("presence-count", { count: io.engine.clientsCount });
}

function tryMatch(category: string) {
  const queue = getQueue(category);

  for (let i = queue.length - 1; i >= 0; i--) {
    if (!io.sockets.sockets.get(queue[i].socketId)) queue.splice(i, 1);
  }

  let i = 0;
  while (i < queue.length) {
    const a = queue[i];
    let matchIndex = -1;

    for (let j = i + 1; j < queue.length; j++) {
      if (queue[j].sessionId !== a.sessionId) {
        matchIndex = j;
        break;
      }
    }

    if (matchIndex === -1) {
      i++;
      continue;
    }

    const b = queue[matchIndex];
    queue.splice(matchIndex, 1);
    queue.splice(i, 1);

    const roomId = `${category}-${a.socketId}-${b.socketId}`;
    rooms.set(roomId, { roomId, users: [a, b], category });
    socketRoom.set(a.socketId, roomId);
    socketRoom.set(b.socketId, roomId);

    io.sockets.sockets.get(a.socketId)?.join(roomId);
    io.sockets.sockets.get(b.socketId)?.join(roomId);

    io.to(a.socketId).emit("matched", {
      roomId,
      partner: b.nickname,
      category,
      initiator: true,
    });
    io.to(b.socketId).emit("matched", {
      roomId,
      partner: a.nickname,
      category,
      initiator: false,
    });
  }
}

function leaveQueue(socketId: string) {
  for (const queue of queues.values()) {
    const idx = queue.findIndex((u) => u.socketId === socketId);
    if (idx !== -1) queue.splice(idx, 1);
  }
}

function leaveRoom(socketId: string, notifyPartner: boolean) {
  const roomId = socketRoom.get(socketId);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (room && notifyPartner) {
    const partner = room.users.find((u) => u.socketId !== socketId);
    if (partner) io.to(partner.socketId).emit("partner-left");
  }
  rooms.delete(roomId);
  socketRoom.delete(socketId);
  if (room) {
    for (const u of room.users) socketRoom.delete(u.socketId);
  }
}

io.on("connection", (socket) => {
  broadcastPresence();

  socket.on(
    "join-queue",
    ({
      nickname,
      category,
      sessionId,
    }: {
      nickname: string;
      category: string;
      sessionId: string;
    }) => {
      leaveQueue(socket.id);
      const queue = getQueue(category);
      queue.push({ socketId: socket.id, nickname, sessionId });
      tryMatch(category);
    },
  );

  socket.on("send-message", ({ text }: { text: string }) => {
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const sender = room.users.find((u) => u.socketId === socket.id);
    socket.to(roomId).emit("message", {
      text,
      from: sender?.nickname ?? "unknown",
      time: new Date().toISOString(),
    });
  });

  socket.on("webrtc-offer", ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;
    socket.to(roomId).emit("webrtc-offer", { sdp });
  });

  socket.on("webrtc-answer", ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;
    socket.to(roomId).emit("webrtc-answer", { sdp });
  });

  socket.on(
    "webrtc-ice-candidate",
    ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const roomId = socketRoom.get(socket.id);
      if (!roomId) return;
      socket.to(roomId).emit("webrtc-ice-candidate", { candidate });
    },
  );

  socket.on("leave-room", () => leaveRoom(socket.id, true));
  socket.on("leave-queue", () => leaveQueue(socket.id));

  socket.on("disconnect", () => {
    leaveQueue(socket.id);
    leaveRoom(socket.id, true);
    broadcastPresence();
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`driftroom server on :${PORT}`));
