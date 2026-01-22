import React, { useState } from 'react';
import { Loader2, Copy } from 'lucide-react';
import { Player } from '../../types';
import { PlayerList } from '../PlayerList';
import ShaderBackground from '../ShaderBackground';

interface LobbyProps {
    gameMode: 'MENU' | 'SINGLE' | 'LOBBY_SETUP' | 'LOBBY_HOST' | 'LOBBY_JOIN';
    setGameMode: (mode: 'MENU' | 'SINGLE' | 'LOBBY_SETUP' | 'LOBBY_HOST' | 'LOBBY_JOIN') => void;
    roomId: string | null;
    players: Player[];
    myId: string;
    onStartGame: (difficulty: 'Easy' | 'Medium' | 'Hard') => void;
    joinLobby: (roomId: string, name: string) => void;
    loadingDifficulty: 'Easy' | 'Medium' | 'Hard' | null;
    connectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
    gameLog: { id: number; content: React.ReactNode }[];
    username: string;
}

export function Lobby({
    gameMode,
    setGameMode,
    roomId,
    players,
    myId,
    onStartGame,
    joinLobby,
    loadingDifficulty,
    connectionStatus,
    gameLog,
    username
}: LobbyProps) {
    const [joinInputId, setJoinInputId] = useState('');

    const copyToClipboard = () => {
        if (roomId) {
            navigator.clipboard.writeText(roomId);
            // Optional: Toast or feedback? App doesn't seem to pass toast handler here. 
            // Maybe add local state for "Copied!" text if needed, but keeping it simple as per original.
        }
    };

    return (
        <div className="w-full h-screen bg-slate-950/50 flex flex-col md:flex-row gap-4 p-4 overflow-y-auto">
            {/* Background Shader */}
            <ShaderBackground
                active={true}
                mood="anticipation"
            />
            {/* Left: Setup Panel */}
            <div className="flex-1 flex flex-col items-center justify-center bg-black/50 border border-slate-800 rounded relative min-h-[300px]">
                <button onClick={() => setGameMode('MENU')} className="absolute top-4 left-4 text-slate-500 hover:text-white">Exit</button>

                <h2 className="text-3xl font-horror mb-6 text-red-500">LOBBY</h2>

                {gameMode === 'LOBBY_HOST' ? (
                    <div className="text-center w-full max-w-md">
                        <p className="text-slate-400 mb-2">Ritual Code:</p>
                        {roomId ? (
                            <div className="flex items-center gap-2 bg-slate-900 p-4 rounded border border-slate-600 mb-6">
                                <code className="text-2xl text-yellow-500 tracking-wider flex-1 overflow-hidden text-ellipsis">{roomId}</code>
                                <button onClick={copyToClipboard} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white"><Copy size={20} /></button>
                            </div>
                        ) : <Loader2 className="animate-spin mx-auto mb-6" />}

                        {/* Difficulty Selection */}
                        <div className="w-full">
                            <p className="text-slate-400 mb-2 font-bold uppercase tracking-wider text-xs">Select Intensity to Begin</p>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => onStartGame('Easy')}
                                    disabled={!!loadingDifficulty || players.length < 1}
                                    className="py-4 bg-green-950/40 hover:bg-green-600 border border-green-800 hover:border-green-400 rounded font-bold text-xs md:text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    {loadingDifficulty === 'Easy' ? <Loader2 className="animate-spin mx-auto" /> : <span className="group-hover:text-white text-green-400">Initiate</span>}
                                </button>
                                <button
                                    onClick={() => onStartGame('Medium')}
                                    disabled={!!loadingDifficulty || players.length < 1}
                                    className="py-4 bg-yellow-950/40 hover:bg-yellow-600 border border-yellow-800 hover:border-yellow-400 rounded font-bold text-xs md:text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    {loadingDifficulty === 'Medium' ? <Loader2 className="animate-spin mx-auto" /> : <span className="group-hover:text-white text-yellow-400">Summon</span>}
                                </button>
                                <button
                                    onClick={() => onStartGame('Hard')}
                                    disabled={!!loadingDifficulty || players.length < 1}
                                    className="py-4 bg-red-950/40 hover:bg-red-600 border border-red-800 hover:border-red-400 rounded font-bold text-xs md:text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    {loadingDifficulty === 'Hard' ? <Loader2 className="animate-spin mx-auto" /> : <span className="group-hover:text-white text-red-400">Curse</span>}
                                </button>
                            </div>
                        </div>

                        {/* Error Display */}
                        {gameLog.length > 0 && gameLog[0].content && (
                            <div className="mt-4 p-4 bg-red-950/50 border-2 border-red-600 rounded-lg animate-pulse">
                                {gameLog[0].content}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center w-full max-w-md">
                        {connectionStatus === 'CONNECTED' && players.length > 0 ? (
                            <div className="animate-pulse text-green-500 font-bold text-xl mb-4">CONNECTED TO HOST</div>
                        ) : (
                            <>
                                <p className="text-slate-400 mb-2">Enter Host Code:</p>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        value={joinInputId}
                                        onChange={e => setJoinInputId(e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-600 p-3 rounded text-white"
                                        placeholder="Paste Code..."
                                    />
                                    <button
                                        onClick={() => joinLobby(joinInputId, username)}
                                        disabled={connectionStatus === 'CONNECTING' || !joinInputId}
                                        className="bg-blue-600 px-6 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {connectionStatus === 'CONNECTING' ? <Loader2 className="animate-spin" /> : 'JOIN'}
                                    </button>
                                </div>
                                {connectionStatus === 'DISCONNECTED' && joinInputId && (
                                    <p className="text-red-500 text-xs mt-2">
                                        {/* Only show if we tried and failed - simpler heuristic might be needed or just show status */}
                                    </p>
                                )}
                                {/* Connection Help */}
                                <p className="text-xs text-slate-600 mt-2">
                                    Stuck connecting? Ensure Host and you are on the same version/server.
                                </p>
                            </>
                        )}
                        <p className="text-slate-500">
                            {players.length > 0 ? "Waiting for host to start..." : "Enter code to join..."}
                        </p>
                    </div>
                )}
            </div>

            {/* Right: Roster */}
            <div className="w-full md:w-80">
                <PlayerList players={players} myId={myId} />
            </div>
        </div>
    );
}
