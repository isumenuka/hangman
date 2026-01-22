import React, { useState, useEffect } from 'react';
import { X, Trophy, Calendar } from 'lucide-react';
import { getDailyLeaderboard } from '../services/dailyChallenge';
import { DailyAttempt } from '../utils/supabase';
import clsx from 'clsx';

interface DailyLeaderboardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DailyLeaderboardModal: React.FC<DailyLeaderboardModalProps> = ({ isOpen, onClose }) => {
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [leaderboard, setLeaderboard] = useState<DailyAttempt[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadLeaderboard(selectedDate);
        }
    }, [isOpen, selectedDate]);

    const loadLeaderboard = async (date: string) => {
        setLoading(true);
        const data = await getDailyLeaderboard(date);
        setLeaderboard(data);
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-lg border border-red-900/50 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-800">
                    <h2 className="text-3xl font-horror text-red-600 flex items-center gap-3">
                        <Trophy size={32} className="text-yellow-500" />
                        DAILY LEADERBOARD
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Custom Date Selector - Grid of Recent Dates */}
                <div className="p-6 border-b border-slate-800">
                    <label className="text-slate-400 text-sm uppercase font-bold tracking-widest mb-3 block flex items-center gap-2">
                        <Calendar size={16} />
                        Select Challenge Date
                    </label>

                    {/* Recent Dates Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {[...Array(8)].map((_, i) => {
                            const date = new Date();
                            date.setDate(date.getDate() - i);
                            const dateStr = date.toISOString().split('T')[0];
                            const isToday = i === 0;
                            const isSelected = selectedDate === dateStr;

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => setSelectedDate(dateStr)}
                                    className={clsx(
                                        "px-3 py-2 rounded border transition-all text-sm font-bold",
                                        isSelected && "bg-purple-900 border-purple-500 text-purple-100 shadow-[0_0_15px_rgba(168,85,247,0.4)]",
                                        !isSelected && "bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700 hover:border-slate-500"
                                    )}
                                >
                                    {isToday ? (
                                        <div>
                                            <div className="text-xs">TODAY</div>
                                            <div className="text-[10px] text-purple-400">{date.getDate()}</div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="text-xs">{date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</div>
                                            <div className="text-[10px]">{date.getDate()}</div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <p className="text-slate-500 text-xs text-center">
                        {selectedDate === new Date().toISOString().split('T')[0]
                            ? '📅 Viewing Today\'s Challenge'
                            : `📜 ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                        }
                    </p>
                </div>

                {/* Leaderboard Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center text-slate-400 py-12">Loading...</div>
                    ) : leaderboard.length === 0 ? (
                        <div className="text-center text-slate-500 py-12">
                            <Trophy size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="text-lg">No attempts recorded for this date</p>
                            <p className="text-sm mt-2">Be the first to complete this ritual!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {leaderboard.map((entry, idx) => (
                                <div
                                    key={entry.id}
                                    className={clsx(
                                        "flex justify-between items-center p-4 rounded-lg border transition-all",
                                        idx === 0 && "bg-gradient-to-r from-yellow-950/40 to-yellow-900/20 border-yellow-700/50 shadow-[0_0_20px_rgba(234,179,8,0.2)]",
                                        idx === 1 && "bg-slate-800/50 border-slate-600",
                                        idx === 2 && "bg-orange-950/30 border-orange-800/40",
                                        idx > 2 && "bg-slate-900/50 border-slate-700"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <span
                                            className={clsx(
                                                "font-bold text-2xl w-12 text-center",
                                                idx === 0 && "text-yellow-400 text-3xl drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]",
                                                idx === 1 && "text-slate-300",
                                                idx === 2 && "text-orange-400",
                                                idx > 2 && "text-slate-500"
                                            )}
                                        >
                                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                                        </span>
                                        <span
                                            className={clsx(
                                                "font-bold text-lg",
                                                idx === 0 && "text-yellow-200",
                                                idx === 1 && "text-slate-200",
                                                idx === 2 && "text-orange-200",
                                                idx > 2 && "text-slate-400"
                                            )}
                                        >
                                            {entry.user_id}
                                        </span>
                                    </div>
                                    <span className="font-mono text-2xl text-white font-bold">
                                        {(entry.time_taken / 1000).toFixed(2)}s
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
