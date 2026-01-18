import { useState, useRef, useCallback, useEffect } from 'react';
import { socketService } from '../services/socketService';
import { NetworkAction, Player, WordData } from '../types';

export const useMultiplayer = (
  onGameStart: (wordData: WordData) => void,
  onWorldUpdate: (players: Player[]) => void,
  onSpell: (spellId: 'FOG' | 'SCRAMBLE' | 'JUMPSCARE', casterName: string) => void,
  onSpellLog: (spellId: string, casterName: string, targetName: string) => void
) => {
  // Local Identity
  const [myId, setMyId] = useState<string | null>(null); // Ideally we use socket.id
  const [myName, setMyName] = useState<string>('Unknown Soul');
  const [amIHost, setAmIHost] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  // Roster
  const [players, setPlayers] = useState<Player[]>([]);

  // Refs for callbacks
  const playersRef = useRef<Player[]>([]);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Helper to fetch name from ref
  const resolveName = useCallback((id: string) => {
    return playersRef.current.find(p => p.id === id)?.name || "Unknown Soul";
  }, []);

  // --- Broadcast Helper ---
  // In Socket.IO, we send "action" to server, server broadcasts to room.
  // We ALSO need to handle the action locally because "broadcast" usually sends to everyone ELSE.
  // OR we can ask the server to emit to everyone including sender. 
  // Let's assume server emits to others, so we might need local handling for some things.
  // BUT the simplest pattern is: Send to Server -> Server Broadcasts to ALL (including sender).
  // Socket.IO "io.to(room).emit" does that. 
  // "socket.to(room).emit" sends to everyone EXCEPT sender.
  // My server implementation: "socket.to(roomId).emit" -> Everyone ELSE.
  // So: WE MUST APPLY ACTION LOCALLY TOO.

  const broadcast = useCallback((action: NetworkAction) => {
    if (currentRoomId) {
      socketService.emitAction(currentRoomId, action);
    }
  }, [currentRoomId]);

  // --- Initialization ---

  // Connects to the Socket Server
  const connectSocket = useCallback(() => {
    // Allow env var override
    const envSocketUrl = import.meta.env.VITE_SOCKET_URL;
    const envPeerHost = import.meta.env.VITE_PEER_HOST; // Legacy support

    const defaultUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:9000'
      : 'https://hangman-server.onrender.com';

    let socketUrl = defaultUrl;
    if (envSocketUrl) {
      socketUrl = envSocketUrl;
    } else if (envPeerHost) {
      socketUrl = `https://${envPeerHost}`;
    }

    console.log("Connecting to Socket:", socketUrl);
    socketService.connect(socketUrl);

    setConnectionStatus('CONNECTING');

    // Attach Listeners for State Management (Reliable)
    if (socketService.socket) {
      socketService.socket.on('connect', () => {
        console.log("Socket Connected Event");
        setConnectionStatus('CONNECTED');
      });
      socketService.socket.on('disconnect', () => {
        console.log("Socket Disconnected");
        setConnectionStatus('DISCONNECTED');
      });
      socketService.socket.on('connect_error', (err) => {
        console.error("Socket Error:", err);
        setConnectionStatus('DISCONNECTED');
      });
    }

  }, []);

  useEffect(() => {
    connectSocket();
    return () => {
      // Clean up listeners? socketService.disconnect() kills the socket so listeners die with it usually.
      socketService.disconnect();
    }
  }, []); // Run once on mount

  // --- Host Logic ---
  const createGame = (name: string) => {
    if (!socketService.socket) return;

    setMyName(name);
    setAmIHost(true);

    const newRoomId = Math.floor(100000 + Math.random() * 900000).toString();
    setCurrentRoomId(newRoomId);

    socketService.createRoom(newRoomId);
    setConnectionStatus('CONNECTED'); // Confirm connection
    setMyId(socketService.socket.id || 'host');

    // Initialize me in the list
    const me: Player = {
      id: socketService.socket.id || 'host',
      name: name,
      isHost: true,
      status: 'LOBBY',
      mistakes: 0,
      roundScore: 0
    };
    setPlayers([me]);
    onWorldUpdate([me]);
  };

  // --- Client Logic ---
  const joinLobby = (roomId: string, name: string) => {
    if (!socketService.socket) return;

    setMyName(name);
    setAmIHost(false);
    setCurrentRoomId(roomId);

    socketService.joinRoom(roomId);
    setConnectionStatus('CONNECTED');
    setMyId(socketService.socket.id || 'client');

    // Send JOIN_REQUEST (Server relays to existing players)
    // Wait a moment for join to register? No, just emit.
    // Actually, since we broadcast to "others", the Host will receive this.
    const action: NetworkAction = {
      type: 'JOIN_REQUEST',
      payload: { name }
    };
    socketService.emitAction(roomId, action);
  };

  // --- Incoming Data Handling ---

  const handleIncomingAction = useCallback((action: NetworkAction) => {
    // 1. Host Logic: New Joiner
    if (action.type === 'JOIN_REQUEST' && amIHost) {
      const senderId = (action.payload as any).senderId;
      const newPlayerName = action.payload.name;

      const newPlayer: Player = {
        id: senderId || 'unknown',
        name: newPlayerName,
        isHost: false,
        status: 'LOBBY',
        mistakes: 0
      };

      setPlayers(prev => {
        // 1. Check if EXACT same player ID is already here (Idempotency)
        if (prev.find(p => p.id === newPlayer.id)) return prev;

        // 2. Check if NAME is already taken (Ghost / Reconnect Logic)
        // If name exists, we assume it's the same user reconnecting or a stale ghost.
        // We REMOVE the old one and ADD the new one.
        const filtered = prev.filter(p => p.name !== newPlayerName);

        const updated = [...filtered, newPlayer];

        // Broadcast NEW LIST to everyone
        const updateAction: NetworkAction = {
          type: 'PLAYER_UPDATE',
          payload: { players: updated }
        };
        broadcast(updateAction); // To everyone else
        // Also update myself (Host)
        onWorldUpdate(updated);
        return updated;
      });
    }
    else if (action.type === 'PLAYER_UPDATE') {
      setPlayers(action.payload.players);
      onWorldUpdate(action.payload.players);
    }
    else if (action.type === 'GAME_START') {
      onGameStart(action.payload.wordData);
    }
    else if (action.type === 'GLOBAL_TICK') {
      setPlayers(action.payload.players);
      onWorldUpdate(action.payload.players);
    }
    else if (action.type === 'CAST_SPELL') {
      const { spellId, casterName, targetId } = action.payload;
      const targetName = resolveName(targetId);
      onSpellLog(spellId, casterName, targetName);
      if (targetId === socketService.socket?.id) {
        onSpell(spellId as any, casterName);
      }
    }
    else if (action.type === 'UPDATE_MY_STATUS') {
      // Host receives this from Client
      if (amIHost) {
        // Client sent "I updated my status".
        // Host updates central state and broadcasts GLOBAL_TICK.
        const senderId = (action.payload as any).senderId;
        setPlayers(prev => {
          const updated = prev.map(p => {
            if (p.id === senderId) {
              return { ...p, status: action.payload.status, mistakes: action.payload.mistakes };
            }
            return p;
          });
          broadcast({ type: 'GLOBAL_TICK', payload: { players: updated } });
          onWorldUpdate(updated);
          return updated;
        });
      }
    }
    else if (action.type === 'PLAYER_LEFT') {
      const { playerId } = action.payload;

      setPlayers(prev => {
        const updated = prev.filter(p => p.id !== playerId);

        // If I am Host, I need to broadcast this change to ensure sync
        if (amIHost) {
          const updateAction: NetworkAction = {
            type: 'PLAYER_UPDATE',
            payload: { players: updated }
          };
          broadcast(updateAction);
          onWorldUpdate(updated);
        } else {
          // If I am client, I should verify if the Host just left
          const host = prev.find(p => p.isHost);
          if (host && host.id === playerId) {
            console.warn("HOST DISCONNECTED");
            setConnectionStatus('DISCONNECTED'); // Trigger disconnect UI
            // Optionally trigger a specialized "Host Left" callback if desired
          }
          onWorldUpdate(updated);
        }
        return updated;
      });
    }

  }, [amIHost, broadcast, onGameStart, onSpell, onSpellLog, onWorldUpdate, resolveName]);

  useEffect(() => {
    socketService.onAction(handleIncomingAction);
    return () => {
      socketService.offAction();
    }
  }, [handleIncomingAction]);


  // --- Actions ---

  const startGame = (wordData: WordData) => {
    if (!amIHost) return;
    const startAction: NetworkAction = { type: 'GAME_START', payload: { wordData } };
    broadcast(startAction);
    onGameStart(wordData); // Local start

    setPlayers(prev => {
      const updated = prev.map(p => ({ ...p, status: 'PLAYING', mistakes: 0 } as Player));
      const tick: NetworkAction = { type: 'GLOBAL_TICK', payload: { players: updated } };
      broadcast(tick);
      onWorldUpdate(updated); // Local update
      return updated;
    });
  };

  const updateMyStatus = (status: Player['status'], mistakes: number) => {
    if (amIHost) {
      // Host updates self and broadcasts
      setPlayers(prev => {
        const updated = prev.map(p => {
          if (p.id === socketService.socket?.id) { // OR myId
            return { ...p, status, mistakes };
          }
          return p;
        });
        broadcast({ type: 'GLOBAL_TICK', payload: { players: updated } });
        onWorldUpdate(updated);
        return updated;
      });
    } else {
      // Client sends request to Host
      // MUST include ID so Host knows who it is.
      const action: NetworkAction = {
        type: 'UPDATE_MY_STATUS',
        payload: { status, mistakes, senderId: socketService.socket?.id } as any
      };
      broadcast(action); // Sends to Host (and others, but Host handles it)
    }
  };

  const castSpell = (spellId: 'FOG' | 'SCRAMBLE' | 'JUMPSCARE', targetId: string) => {
    const action: NetworkAction = {
      type: 'CAST_SPELL',
      payload: { spellId, casterName: myName, targetId }
    };

    broadcast(action);

    // Local Log
    const targetName = resolveName(targetId);
    onSpellLog(spellId, myName, targetName);

    // Local Effect (Self-cast)
    if (targetId === socketService.socket?.id) {
      onSpell(spellId, myName);
    }
  };

  // Wrapper for Join that includes Sender ID
  const joinLobbyWithId = (roomId: string, name: string) => {
    if (!socketService.socket) return;
    joinLobby(roomId, name);
    // We need to override the simplistic joinLobby above to include ID
    // Actually, I put the logic in `joinLobby` but forgot `senderId`.
    // Let's re-define `joinLobby` here properly to match the usage. - Wait, `joinLobby` is the exported function.

    // Redefining the logic inside the exported function:
    // See reference above. 
    // I will rely on the `joinLobby` defined above but I need to patch the payload.

    // Let's patch `joinLobby`'s emit:
    const action: NetworkAction = {
      type: 'JOIN_REQUEST',
      payload: { name, senderId: socketService.socket.id } as any
    };
    socketService.emitAction(roomId, action);
  };


  return {


    initializePeer: (name: string, asHost: boolean) => {
      if (asHost) {
        createGame(name);
      } else {
        // Just set name, waiting for joinLobby call
        setMyName(name);
      }
    },

    joinLobby: joinLobbyWithId,
    startGame,
    updateMyStatus,
    castSpell,
    myId,
    roomId: currentRoomId,
    players,
    connectionStatus,
    amIHost
  };
};
