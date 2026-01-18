const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
const port = process.env.PORT || 9000;

// Enable CORS for all origins (Crucial for Vercel -> Render communication)
app.use(cors());

// Health Check Endpoint (For Render)
app.get('/', (req, res) => {
    res.send({ status: 'Online', service: 'Curse Server (Socket.IO)', timestamp: new Date() });
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for now
        methods: ["GET", "POST"]
    }
});

// Store room state potentially? For now, we utilize Socket.IO rooms.
// We can store generic state if needed, but Socket.IO rooms handle the grouping.

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // --- Lobby / Room Logic ---

    // Host creates a room
    socket.on('create_room', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} created room ${roomId}`);
        // Optionally store that this socket is the host of roomId
    });

    // Client joins a room
    socket.on('join_room', (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room && room.size > 0) {
            socket.join(roomId);
            console.log(`Socket ${socket.id} joined room ${roomId}`);
            // Notify the host (or everyone) that a new player joined
            // In the PeerJS version, the client sent a JOIN_REQUEST.
            // Here we can just letting them be in the room is step 1.
            // Actual game logic payload will follow.
        } else {
             // For now we can emit an error or just let them fail to connect
             socket.emit('error', { message: 'Room not found' });
        }
    });

    // --- General Broadcast Relay ---
    // The previous architecture had specific event types.
    // We can genericize: Client sends event -> Server relays to Room.

    socket.on('broadcast', (data) => {
        // data should contain { roomId, event, payload }
        // or just rely on the socket being in the room.

        // If the client sends { roomId, ...msg }
        if (data.roomId) {
            // Broadcast to everyone ELSE in the room
            socket.to(data.roomId).emit('message', data);
        }
    });

    // We can also support specific events to match the frontend logic better if we want stricter types.
    // But a generic 'message' or 'action' event is flexible.
    
    // Let's support the existing action types by just relaying them.
    // The frontend sends "action" objects.
    
    socket.on('game_action', (data) => {
        const { roomId, action } = data;
        // Broadcast to everyone else in the room
        if (roomId) {
            socket.to(roomId).emit('game_action', action);
        }
    });
    
    // Special case for joining:
    // When a client joins, they might need to send a "JOIN_REQUEST" to the host.
    // The host is just another socket in the room.
    // So 'game_action' with type 'JOIN_REQUEST' works if everyone receives it.

    socket.on('disconnect', () => {
        console.log("User Disconnected", socket.id);
    });
});

server.listen(port, () => {
    console.log(`💀 Curse Server (Socket.IO) running on port ${port}`);
});
