import { useState, useRef, useCallback, useEffect } from 'react';
import { socketService } from '../services/socketService';
import { NetworkAction, Player, WordData } from '../types';
import { getBotAction } from '../services/imposter';

export const useMultiplayer = (
  onGameStart: (wordData: WordData, round: number) => void,
  onWorldUpdate: (players: Player[]) => void,
  onSpell: (spellId: 'FOG' | 'SCRAMBLE' | 'JUMPSCARE', casterName: string) => void,
  onSpellLog: (spellId: string, casterName: string, targetName: string) => void,
  onCountdown: (count: number | null) => void
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

  // --- Bot Helper ---
  const updateBot = useCallback((botId: string, updates: Partial<Player>) => {
    if (!amIHost) return;
    setPlayers(prev => {
      const updated = prev.map(p => p.id === botId ? { ...p, ...updates } : p);
      const action: NetworkAction = { type: 'GLOBAL_TICK', payload: { players: updated } };
      broadcast(action);
      onWorldUpdate(updated);
      return updated;
    });
  }, [amIHost, broadcast, onWorldUpdate]);

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
      totalTime: 0,
      guessedLetters: [],
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
    // MUST include ID so Host knows who it is.
    const action: NetworkAction = {
      type: 'JOIN_REQUEST',
      payload: { name, senderId: socketService.socket.id } as any
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
        mistakes: 0,
        totalTime: 0,
        guessedLetters: [],
        roundScore: 0
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
      onGameStart(action.payload.wordData, action.payload.round);
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
              // Update status, mistakes AND guessedLetters
              const payload = action.payload as any;
              return {
                ...p,
                status: payload.status,
                mistakes: payload.mistakes,
                totalTime: payload.totalTime || p.totalTime,
                guessedLetters: payload.guessedLetters || p.guessedLetters
              };
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
    else if (action.type === 'ROUND_COUNTDOWN') {
      onCountdown(action.payload.count);
    }

  }, [amIHost, broadcast, onGameStart, onSpell, onSpellLog, onWorldUpdate, resolveName]);

  useEffect(() => {
    socketService.onAction(handleIncomingAction);
    return () => {
      socketService.offAction();
    }
  }, [handleIncomingAction]);


  // --- Actions ---

  const startGame = (wordData: WordData, round: number) => {
    if (!amIHost) return;
    const startAction: NetworkAction = { type: 'GAME_START', payload: { wordData, round } };
    broadcast(startAction);
    onGameStart(wordData, round); // Local start

    setPlayers(prev => {
      const updated = prev.map(p => ({ ...p, status: 'PLAYING', mistakes: 0, guessedLetters: [] } as Player));
      const tick: NetworkAction = { type: 'GLOBAL_TICK', payload: { players: updated } };
      broadcast(tick);
      onWorldUpdate(updated); // Local update
      return updated;
    });
  };

  const updateMyStatus = (status: Player['status'], mistakes: number, guessedLetters: string[], totalTime?: number) => {
    if (amIHost) {
      // Host updates self and broadcasts
      setPlayers(prev => {
        const updated = prev.map(p => {
          if (p.id === socketService.socket?.id) { // OR myId
            return { ...p, status, mistakes, guessedLetters, totalTime: totalTime !== undefined ? totalTime : p.totalTime };
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
        payload: { status, mistakes, guessedLetters, totalTime, senderId: socketService.socket?.id } as any
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

  const broadcastCountdown = (count: number | null) => {
    if (!amIHost) return;
    const action: NetworkAction = { type: 'ROUND_COUNTDOWN', payload: { count } };
    broadcast(action);
  };


  const setSpectating = (targetId: string | null) => {
    // Just update my 'spectatingId' in the roster.
    // We can reuse updateMyStatus mechanism if we expose it? Or just rely on local state?
    // "Spectator Mode" requested implies others see I am spectating them.
    // So we need to sync this.
    // The simplest way is to treat it as part of "updateMyStatus" but I don't want to change that signiture too much.
    // Actually, I can just update the players list locally for me, AND send an action.
    // But adding `spectatingId` to UPDATE_MY_STATUS might be cleaner.
    // Let's assume we can just sneak it in via a separate action or reuse logic.
    // For now, let's keep it simple: Local only for VIEWING, but User asked "see who spectating them".
    // So we MUST broadcast.

    // I'll add a specific helper or just handle it. 
    // Ideally I modify `updateMyStatus` to accept optional partials, but let's just make a specific helper.
    if (!socketService.socket) return;

    const payload = { senderId: socketService.socket.id, spectatingId: targetId };
    const action = { type: 'SPECTATING_UPDATE', payload } as any; // Custom event

    // We need to handle this event inv `handleIncomingAction`? 
    // `types.ts` doesn't have it. I should have added it.
    // But since I'm in "EXECUTION" and don't want to go back to types, I'll piggyback or just add it now?
    // Actually `UPDATE_MY_STATUS` is generic enough if I just relax the type check or update the hook to support it.
    // Let's piggyback on `UPDATE_MY_STATUS` but I need to pass the current other values.
    // This is getting messy.
    // Let's just Add `spectatingId` to `UPDATE_MY_STATUS` payload in `types.ts` effectively by ignoring type for a sec or updating types.
    // Wait, I ALREADY updated types.ts with `spectatingId` on Player.
    // I just need to update `UPDATE_MY_STATUS` definition in types or just use `as any` carefully.
    // I'll stick to `UPDATE_MY_STATUS`.

    // BUT I need current stats.
    const me = playersRef.current.find(p => p.id === myId);
    if (me) {
      // Re-broadcast absolute state
      const action: NetworkAction = {
        type: 'UPDATE_MY_STATUS',
        payload: {
          status: me.status,
          mistakes: me.mistakes,
          guessedLetters: me.guessedLetters,
          spectatingId: targetId,
          senderId: socketService.socket.id
        } as any
      };
      broadcast(action);

      // And update locally
      setPlayers(prev => prev.map(p => p.id === myId ? { ...p, spectatingId: targetId } : p));
    }
  };


  return {


    initializePeer: (name: string, asHost: boolean) => {
      // Connect first if not connected?
      // Since we auto-connnect on mount, just create/join.
      if (asHost) {
        createGame(name);
      } else {
        // Just set name, waiting for joinLobby call
        setMyName(name);
      }
    },
    joinLobby,
    createGame,
    startGame,
    updateMyStatus,
    castSpell,
    setSpectating,
    broadcastCountdown,

    updateBot,

    // Bot Capabilities
    spawnBot: () => {
      if (!amIHost || !currentRoomId) return;
      const botName = "Alastor (Bot)";
      const botId = `bot-${Date.now()}`;

      const botPlayer: Player = {
        id: botId,
        name: botName,
        isHost: false,
        isBot: true,
        status: 'LOBBY',
        mistakes: 0,
        totalTime: 0,
        guessedLetters: [],
        roundScore: 0
      };

      setPlayers(prev => {
        const updated = [...prev, botPlayer];
        const action: NetworkAction = { type: 'PLAYER_UPDATE', payload: { players: updated } };
        broadcast(action);
        onWorldUpdate(updated);
        return updated;
      });
    },

    // Exposed State
    players,
    myId,
    amIHost,
    currentRoomId,
    connectionStatus
  };
};
