const { PeerServer } = require('peer');

const port = process.env.PORT || 9000;

const peerServer = PeerServer({
    port: port,
    path: '/hangman',
    corsOptions: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

console.log(`💀 Curse Server running on port ${port} :: Path /hangman`);

peerServer.on('connection', (client) => {
    console.log(`Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
    console.log(`Client disconnected: ${client.getId()}`);
});
