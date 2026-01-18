import React from 'react';
import { Player } from '../types';
import { Skull, Trophy, User, ShieldAlert, Crown } from 'lucide-react';
import clsx from 'clsx';

interface PlayerListProps {
    players: Player[];
    myId: string | null;
    onPlayerSelect?: (playerId: string) => void;
    selectionMode?: boolean;
}

export const PlayerList: React.FC<PlayerListProps> = ({ players, myId, onPlayerSelect, selectionMode = false }) => {
    return (
        <div className="bg-black/80 backdrop-blur-md border border-slate-800 rounded-lg p-4 w-full h-full overflow-y-auto">
            <h3 className="text-red-500 font-horror text-xl mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Crown size={20} /> CURSED SOULS ({players.length})
            </h3>

            <div className="flex flex-col gap-2">
                {players.map(player => {
                    const isMe = player.id === myId;
                    const isDead = player.status === 'LOST' || player.status === 'SPECTATING';
                    const isWon = player.status === 'WON';

                    const canSelect = selectionMode && !isMe;

                    return (
                        <div
                            key={player.id}
                            onClick={() => canSelect && onPlayerSelect?.(player.id)}
                            className={clsx(
                                "relative p-3 rounded border flex items-center justify-between transition-all",
                                isMe ? "bg-slate-800/50 border-slate-600" : "bg-black/40 border-slate-900",
                                isDead && "opacity-50 grayscale border-red-900",
                                isWon && "border-green-600 bg-green-950/20",
                                canSelect && "cursor-crosshair hover:bg-red-900/40 hover:border-red-500 hover:scale-105 hover:shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-pulse"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                {isDead ? (
                                    <Skull size={20} className="text-red-700" />
                                ) : isWon ? (
                                    <Trophy size={20} className="text-green-500 animate-bounce" />
                                ) : (
                                    <User size={20} className={isMe ? "text-blue-400" : "text-slate-500"} />
                                )}

                                <div className="flex flex-col">
                                    <span className={clsx("font-bold text-sm", isDead ? "text-red-800 line-through" : "text-slate-200")}>
                                        {player.name} {isMe && "(YOU)"} {player.isHost && "👑"}
                                    </span>
                                    <span className="text-xs text-slate-500 uppercase tracking-wider">
                                        {player.status}
                                    </span>
                                </div>
                            </div>

                            {/* Health / Mistake Bar */}
                            {player.status === 'PLAYING' && (
                                <div className="flex gap-1">
                                    {[...Array(6)].map((_, i) => (
                                        <div
                                            key={i}
                                            className={clsx(
                                                "w-2 h-4 rounded-sm transition-colors",
                                                i < player.mistakes ? "bg-red-600" : "bg-slate-800"
                                            )}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
