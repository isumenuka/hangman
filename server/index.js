const express = require('express');
const { ExpressPeerServer } = require('peer');
const http = require('http');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 9000;

// Enable CORS for all origins (Crucial for Vercel -> Render communication)
app.use(cors());

// Health Check Endpoint (For Render)
app.get('/', (req, res) => {
    res.send({ status: 'Online', service: 'Curse Server', timestamp: new Date() });
});

const server = http.createServer(app);

const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/',
    allow_discovery: true,
    corsOptions: {
        origin: '*'
    }
});

// Mount PeerJS
app.use('/hangman', peerServer);

server.listen(port, () => {
    console.log(`💀 Curse Server running on port ${port}`);
    console.log(`   Health check available at http://localhost:${port}/`);
    console.log(`   PeerJS endpoint at http://localhost:${port}/hangman`);
});

peerServer.on('connection', (client) => {
    console.log(`Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
    console.log(`Client disconnected: ${client.getId()}`);
});
