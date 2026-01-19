import React, { useEffect, useState } from 'react';
import { getLeaderboard, PlayerStats } from '../utils/supabase';
import { Trophy, Medal, Crown, Loader2, X } from 'lucide-react';
import clsx from 'clsx';

interface GlobalLeaderboardProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GlobalLeaderboard: React.FC<GlobalLeaderboardProps> = ({ isOpen, onClose }) => {
    const [leaderboard, setLeaderboard] = useState<PlayerStats[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            getLeaderboard().then(data => {
                setLeaderboard(data);
                setLoading(false);
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-950 border border-slate-800 w-full max-w-lg rounded-lg shadow-2xl relative flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <Trophy className="text-yellow-500" size={24} />
                        <h2 className="text-xl font-bold text-white tracking-widest uppercase">Global Leaderboard</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                            <Loader2 className="animate-spin mb-2" size={32} />
                            <span className="text-sm">Summoning spirits...</span>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900 sticky top-0 z-10 text-xs font-bold uppercase text-slate-500 tracking-wider">
                                <tr>
                                    <th className="p-4 w-16 text-center">Rank</th>
                                    <th className="p-4">Soul</th>
                                    <th className="p-4 text-right">Wins</th>
                                    <th className="p-4 text-right hidden sm:table-cell">Scares</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((player, index) => {
                                    const rank = index + 1;
                                    let rankIcon = <span className="font-mono text-slate-500">#{rank}</span>;
                                    let rowClass = "border-b border-slate-800/50 hover:bg-slate-900/30 transition-colors";
                                    let textClass = "text-slate-300";

                                    if (rank === 1) {
                                        rankIcon = <Crown size={20} className="text-yellow-500 mx-auto" />;
                                        rowClass = "bg-yellow-950/20 border-b border-yellow-900/30 hover:bg-yellow-900/20";
                                        textClass = "text-yellow-200 font-bold";
                                    } else if (rank === 2) {
                                        rankIcon = <Medal size={20} className="text-slate-300 mx-auto" />;
                                        rowClass = "bg-slate-800/20 border-b border-slate-700/30 hover:bg-slate-800/30";
                                        textClass = "text-slate-200 font-bold";
                                    } else if (rank === 3) {
                                        rankIcon = <Medal size={20} className="text-amber-700 mx-auto" />;
                                        rowClass = "bg-amber-950/20 border-b border-amber-900/30 hover:bg-amber-900/20";
                                        textClass = "text-amber-200 font-bold";
                                    }

                                    return (
                                        <tr key={player.id} className={rowClass}>
                                            <td className="p-4 text-center">{rankIcon}</td>
                                            <td className={clsx("p-4", textClass)}>
                                                {player.username || "Anonymous"}
                                            </td>
                                            <td className="p-4 text-right font-mono text-yellow-500/80">
                                                {player.wins}
                                            </td>
                                            <td className="p-4 text-right font-mono text-red-500/60 hidden sm:table-cell">
                                                {player.total_scares}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {leaderboard.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-500 italic">
                                            No souls have claimed victory yet...
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
