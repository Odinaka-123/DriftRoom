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

const queues = new Map<string, QueuedUser[]>(); // category -> waiting users
const rooms = new Map<string, ActiveRoom>(); // roomId -> room
const socketRoom = new Map<string, string>(); // socketId -> roomId

function getQueue(category: string) {
  if (!queues.has(category)) queues.set(category, []);
  return queues.get(category)!;
}

function tryMatch(category: string) {
  const queue = getQueue(category);

  // Clear out any dead sockets first so they don't block matching.
  for (let i = queue.length - 1; i >= 0; i--) {
    if (!io.sockets.sockets.get(queue[i].socketId)) queue.splice(i, 1);
  }

  // Try to pair the front of the queue with the first compatible partner
  // (different sessionId) further down the queue — this avoids the
  // self-match issue where two tabs from the same browser pair with
  // each other.
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
      // No compatible partner for `a` yet — leave it in the queue and move on.
      i++;
      continue;
    }

    const b = queue[matchIndex];
    // Remove b first (higher index) then a, to keep indices valid.
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
    });
    io.to(b.socketId).emit("matched", {
      roomId,
      partner: a.nickname,
      category,
    });

    // Don't advance `i` — a new user now sits at this index; loop will recheck it.
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

  socket.on("leave-room", () => leaveRoom(socket.id, true));

  socket.on("leave-queue", () => leaveQueue(socket.id));

  socket.on("disconnect", () => {
    leaveQueue(socket.id);
    leaveRoom(socket.id, true);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`driftroom server on :${PORT}`));
