import React from 'react';
import clsx from 'clsx';
import { Play } from 'lucide-react';
import { Player } from '../../types';
import { GameScene } from '../Scene';

interface GameOverProps {
    players: Player[];
    myId: string;
    amIHost: boolean;
    onNewGame: () => void;
}

export function GameOver({ players, myId, amIHost, onNewGame }: GameOverProps) {
    // Calculate leaderboard based on Time (Lowest is Best)
    const sortedPlayers = [...players].sort((a, b) => (a.totalTime || 0) - (b.totalTime || 0));
    const top3 = sortedPlayers.slice(0, 3);

    return (
        <div className="relative w-full h-screen bg-gradient-to-br from-slate-950 via-red-950/20 to-slate-950 overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 z-0 opacity-30">
                <GameScene wrongGuesses={0} isWon={true} isLost={false} />
            </div>

            <div className="relative z-10 max-w-2xl w-full mx-4 bg-black/90 backdrop-blur-xl border-2 border-red-600 rounded-lg shadow-2xl shadow-red-600/50 p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-6xl font-horror text-red-600 tracking-wider mb-2 drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]">
                        TOURNAMENT OVER
                    </h1>
                    <p className="text-slate-400 text-lg">5 Rounds Complete</p>
                </div>

                {/* Leaderboard */}
                <div className="space-y-4 mb-8">
                    {top3.map((player, index) => {
                        const medals = ['🥇', '🥈', '🥉'];
                        const colors = ['text-yellow-400', 'text-slate-300', 'text-orange-400'];
                        const bgColors = ['bg-yellow-950/30', 'bg-slate-900/30', 'bg-orange-950/30'];
                        const borderColors = ['border-yellow-600/50', 'border-slate-500/50', 'border-orange-600/50'];

                        return (
                            <div
                                key={player.id}
                                className={clsx(
                                    "flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                                    bgColors[index],
                                    borderColors[index],
                                    index === 0 && "ring-2 ring-yellow-500/50 scale-105"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-4xl">{medals[index]}</span>
                                    <div>
                                        <div className={clsx("text-2xl font-horror", colors[index])}>
                                            {player.name}
                                        </div>
                                        <div className="text-xs text-slate-500 uppercase tracking-wider">
                                            {index === 0 ? 'CHAMPION' : index === 1 ? 'RUNNER-UP' : '3RD PLACE'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={clsx("text-2xl font-horror drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]", colors[index])}>
                                        {((player.totalTime || 0) / 1000).toFixed(2)}s
                                    </div>
                                    <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">TOTAL TIME</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Other Players */}
                {sortedPlayers.length > 3 && (
                    <div className="mb-6 border-t border-slate-800 pt-4">
                        <h3 className="text-slate-500 text-sm uppercase tracking-wider mb-2">Other Players</h3>
                        <div className="space-y-1">
                            {sortedPlayers.slice(3).map((player, index) => (
                                <div key={player.id} className="flex justify-between text-sm text-slate-400 py-1">
                                    <span>{index + 4}. {player.name}</span>
                                    <span>{player.roundScore || 0} CP</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* New Game Button (Host Only) */}
                {amIHost && (
                    <button
                        onClick={onNewGame}
                        className="w-full py-4 bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-bold text-xl rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/50 hover:scale-105"
                    >
                        <Play size={24} /> NEW TOURNAMENT
                    </button>
                )}

                {/* Non-host message */}
                {!amIHost && (
                    <div className="text-center text-slate-500 text-sm uppercase tracking-widest animate-pulse">
                        Waiting for host to start new tournament...
                    </div>
                )}
            </div>
        </div>
    );
}
