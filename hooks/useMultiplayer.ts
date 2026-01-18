import { useState, useRef, useCallback, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { NetworkAction, Player, WordData } from '../types';

export const useMultiplayer = (
  onGameStart: (wordData: WordData) => void,
  onWorldUpdate: (players: Player[]) => void,
  onSpell: (spellId: 'FOG' | 'SCRAMBLE' | 'JUMPSCARE', casterName: string) => void,
  onSpellLog: (spellId: string, casterName: string, targetName: string) => void
) => {
  // Local Identity
  const [myId, setMyId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>('Unknown Soul');
  const [amIHost, setAmIHost] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');

  // Roster
  const [players, setPlayers] = useState<Player[]>([]);

  // Refs
  const peerRef = useRef<Peer | null>(null);
  const hostConnRef = useRef<DataConnection | null>(null); // For Client -> Host
  const clientConnsRef = useRef<DataConnection[]>([]);     // For Host -> Clients
  const playersRef = useRef<Player[]>([]);

  // Sync ref
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Helper to fetch name from ref (safe for callbacks)
  const resolveName = useCallback((id: string) => {
    return playersRef.current.find(p => p.id === id)?.name || "Unknown Soul";
  }, []);

  // --- 4. Broadcast Helper ---
  const broadcast = useCallback((action: NetworkAction, excludeId?: string) => {
    clientConnsRef.current.forEach(conn => {
      if (conn.peer !== excludeId && conn.open) {
        conn.send(action);
      }
    });
  }, []);

  // --- 1. Initialization ---
  const initializePeer = useCallback((name: string, asHost: boolean) => {
    if (peerRef.current) return;

    // Generate a simple 6-digit code for Host
    // We strive for numbers, but on public server collisions are possible.
    const generateId = () => Math.floor(100000 + Math.random() * 900000).toString();
    const customId = asHost ? generateId() : undefined;

    // Config options with ROBUST STUN servers for Mobile/Cross-Network connectivity
    const peerConfig: any = {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ]
      }
    };

    // Check for custom server config from Env
    const envHost = import.meta.env.VITE_PEER_HOST;
    const envPort = import.meta.env.VITE_PEER_PORT;
    const envPath = import.meta.env.VITE_PEER_PATH;
    const envSecure = import.meta.env.VITE_PEER_SECURE;

    if (envHost) {
      console.log("Using Custom Peer Server:", envHost);
      peerConfig.host = envHost;
      peerConfig.port = envPort ? parseInt(envPort) : 443;
      peerConfig.path = envPath || '/hangman';
      peerConfig.secure = envSecure === 'true';
    }

    // Initial creation
    createPeer(customId, peerConfig, name, asHost);

  }, []);

  const createPeer = (id: string | undefined, config: any, name: string, asHost: boolean) => {
    const peer = new Peer(id, config);
    peerRef.current = peer;
    setMyName(name);
    setAmIHost(asHost);

    peer.on('open', (openId) => {
      console.log('Opened Peer:', openId);
      setMyId(openId);

      if (asHost) {
        setPlayers([{
          id: openId,
          name,
          isHost: true,
          status: 'LOBBY',
          mistakes: 0
        }]);
      }
    });

    peer.on('connection', (conn) => {
      handleIncomingConnection(conn, asHost);
    });

    peer.on('error', (err: any) => {
      console.error("Peer Error", err);

      // Auto-retry on ID collision
      if (err.type === 'unavailable-id' && asHost) {
        console.log("ID Taken, retrying with new ID...");
        peer.destroy();
        peerRef.current = null;
        const newId = Math.floor(100000 + Math.random() * 900000).toString();
        // Short delay to prevent loop tight spinning
        setTimeout(() => createPeer(newId, config, name, asHost), 500);
        return;
      }

      setConnectionStatus('DISCONNECTED');
    });
  };

  // --- 2. Host Logic: Handling Incoming Joins ---
  const handleIncomingConnection = (conn: DataConnection, isHost: boolean) => {
    if (!isHost) return;

    conn.on('open', () => {
      console.log("Host: New Client Connected", conn.peer);
      clientConnsRef.current.push(conn);
    });

    conn.on('data', (data: any) => {
      const action = data as NetworkAction;
      handleNetworkData_Host(action, conn);
    });

    conn.on('close', () => {
      console.log("Host: Client Disconnected", conn.peer);
      clientConnsRef.current = clientConnsRef.current.filter(c => c.peer !== conn.peer);
      setPlayers(prev => {
        const newList = prev.filter(p => p.id !== conn.peer);
        broadcast({ type: 'PLAYER_UPDATE', payload: { players: newList } });
        return newList;
      });
    });
  };

  const handleNetworkData_Host = (action: NetworkAction, conn: DataConnection) => {
    if (action.type === 'JOIN_REQUEST') {
      // Add new player to roster
      const newPlayer: Player = {
        id: conn.peer,
        name: action.payload.name,
        isHost: false,
        status: 'LOBBY',
        mistakes: 0
      };

      setPlayers(prev => {
        const exists = prev.find(p => p.id === newPlayer.id);
        if (exists) return prev;
        const updatedList = [...prev, newPlayer];

        conn.send({ type: 'JOIN_ACCEPT', payload: { players: updatedList } } as NetworkAction);
        broadcast({ type: 'PLAYER_UPDATE', payload: { players: updatedList } }, conn.peer);

        // Also broadcast to other clients
        clientConnsRef.current.forEach(c => {
          if (c.peer !== conn.peer) {
            c.send({ type: 'PLAYER_UPDATE', payload: { players: updatedList } } as NetworkAction);
          }
        });

        return updatedList;
      });
    } else if (action.type === 'UPDATE_MY_STATUS') {
      setPlayers(prev => {
        const updatedList = prev.map(p => {
          if (p.id === conn.peer) {
            return { ...p, status: action.payload.status, mistakes: action.payload.mistakes };
          }
          return p;
        });
        broadcast({ type: 'GLOBAL_TICK', payload: { players: updatedList } });
        return updatedList;
      });
    } else if (action.type === 'CAST_SPELL') {
      const { spellId, casterName, targetId } = action.payload;
      const targetName = resolveName(targetId);

      // 1. Broadcast to Everyone (so they see the Log)
      broadcast(action);

      // 2. Local Log (Host sees it too)
      onSpellLog(spellId, casterName, targetName);

      // 3. Local Effect (If Host is target)
      if (peerRef.current?.id === targetId) {
        onSpell(spellId as any, casterName);
      }
    }
  };


  // --- 3. Client Logic: Connecting to Host ---
  const joinLobby = (hostId: string, name: string) => {
    if (!peerRef.current) return;
    if (hostConnRef.current) hostConnRef.current.close();

    const conn = peerRef.current.connect(hostId);
    hostConnRef.current = conn;
    setConnectionStatus('CONNECTING');

    conn.on('open', () => {
      setConnectionStatus('CONNECTED');
      console.log("Client: Connected to Host");
      conn.send({ type: 'JOIN_REQUEST', payload: { name } } as NetworkAction);
    });

    conn.on('data', (data: any) => {
      handleNetworkData_Client(data as NetworkAction);
    });

    conn.on('close', () => {
      setConnectionStatus('DISCONNECTED');
      setPlayers([]);
    });

    conn.on('error', (err) => {
      console.error("Connection Error", err);
      setConnectionStatus('DISCONNECTED');
    });
  };

  const handleNetworkData_Client = (action: NetworkAction) => {
    if (action.type === 'JOIN_ACCEPT') {
      setPlayers(action.payload.players);
      onWorldUpdate(action.payload.players);
    } else if (action.type === 'PLAYER_UPDATE') {
      setPlayers(action.payload.players);
      onWorldUpdate(action.payload.players);
    } else if (action.type === 'GAME_START') {
      onGameStart(action.payload.wordData);
    } else if (action.type === 'GLOBAL_TICK') {
      setPlayers(action.payload.players);
      onWorldUpdate(action.payload.players);
    } else if (action.type === 'CAST_SPELL') {
      // Resolve Name
      const targetName = resolveName(action.payload.targetId);

      // 1. Log It
      onSpellLog(action.payload.spellId, action.payload.casterName, targetName);

      // 2. Trigger Effect if I am target
      if (action.payload.targetId === peerRef.current?.id) {
        onSpell(action.payload.spellId as any, action.payload.casterName);
      }
    }
  };


  // --- 4. Shared Actions ---
  const startGame = (wordData: WordData) => {
    if (!amIHost) return;
    broadcast({ type: 'GAME_START', payload: { wordData } });
    setPlayers(prev => {
      const updated = prev.map(p => ({ ...p, status: 'PLAYING', mistakes: 0 } as Player));
      broadcast({ type: 'GLOBAL_TICK', payload: { players: updated } });
      return updated;
    });
  };

  const updateMyStatus = (status: Player['status'], mistakes: number) => {
    if (amIHost) {
      setPlayers(prev => {
        const updated = prev.map(p => {
          if (p.id === peerRef.current?.id) {
            return { ...p, status, mistakes };
          }
          return p;
        });
        broadcast({ type: 'GLOBAL_TICK', payload: { players: updated } });
        return updated;
      });
    } else {
      if (hostConnRef.current) {
        hostConnRef.current.send({ type: 'UPDATE_MY_STATUS', payload: { status, mistakes } } as NetworkAction);
      }
    }
  };

  const castSpell = (spellId: 'FOG' | 'SCRAMBLE' | 'JUMPSCARE', targetId: string) => {
    const action: NetworkAction = { type: 'CAST_SPELL', payload: { spellId, casterName: myName, targetId } };

    if (amIHost) {
      // Host Logic: Broadcast to everyone
      broadcast(action);

      // Local Log
      const targetName = resolveName(targetId);
      onSpellLog(spellId, myName, targetName);

      // Local Effect (Self-cast)
      if (targetId === peerRef.current?.id) {
        onSpell(spellId, myName);
      }
    } else {
      // Client sends to Host (who routes it)
      if (hostConnRef.current) {
        hostConnRef.current.send(action);
      }
    }
  };

  return {
    initializePeer,
    joinLobby,
    startGame,
    updateMyStatus,
    castSpell,
    myId,
    players,
    connectionStatus,
    amIHost
  };
};
