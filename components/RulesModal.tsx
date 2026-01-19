import React from 'react';
import { X, Scroll, Zap, Skull, Ghost, Move } from 'lucide-react';
import clsx from 'clsx';

interface RulesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-red-900/20 relative flex flex-col">

                {/* Header */}
                <div className="sticky top-0 bg-slate-900/95 backdrop-blur p-4 border-b border-slate-800 flex justify-between items-center z-10">
                    <h2 className="text-2xl font-horror text-red-500 tracking-wider flex items-center gap-2">
                        <Scroll size={24} /> THE RITUAL GUIDE
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6 text-slate-300">

                    {/* Section 1: The Basics */}
                    <section>
                        <h3 className="text-xl font-bold text-slate-100 mb-2 flex items-center gap-2">
                            <Skull className="text-slate-500" size={20} /> Objective
                        </h3>
                        <p className="leading-relaxed text-lg">
                            Guess the hidden word. <span className="text-red-400 font-bold">5 mistakes = Game Over.</span>
                        </p>
                    </section>

                    {/* Section 2: Curse Points */}
                    <section className="bg-slate-950/50 p-4 rounded border border-slate-800">
                        <h3 className="text-xl font-bold text-purple-400 mb-3 flex items-center gap-2">
                            <Zap size={20} /> Earn Points (CP)
                        </h3>
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                <div className="text-slate-400 text-xs uppercase">Correct</div>
                                <div className="text-purple-400 font-bold text-lg">+3</div>
                            </div>
                            <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                <div className="text-slate-400 text-xs uppercase">Streak</div>
                                <div className="text-purple-400 font-bold text-lg">+3</div>
                            </div>
                            <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                <div className="text-slate-400 text-xs uppercase">Multi</div>
                                <div className="text-purple-400 font-bold text-lg">+4</div>
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Powers / Owers */}
                    <section>
                        <h3 className="text-xl font-bold text-orange-400 mb-4 flex items-center gap-2">
                            <Ghost size={20} /> Powers
                        </h3>
                        <div className="grid grid-cols-2 gap-3">

                            {/* Fog */}
                            <div className="p-3 border border-purple-500/30 bg-purple-900/10 rounded flex flex-col justify-between">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-purple-300">FOG</span>
                                    <span className="text-xs font-bold bg-purple-900 px-2 py-0.5 rounded text-purple-200">20 CP</span>
                                </div>
                                <p className="text-xs text-slate-400">Blinds opponent for 5s.</p>
                            </div>

                            {/* Mix */}
                            <div className="p-3 border border-orange-500/30 bg-orange-900/10 rounded flex flex-col justify-between">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-orange-300">MIX</span>
                                    <span className="text-xs font-bold bg-orange-900 px-2 py-0.5 rounded text-orange-200">20 CP</span>
                                </div>
                                <p className="text-xs text-slate-400">Scrambles keyboard for 5s.</p>
                            </div>

                            {/* Heal */}
                            <div className="p-3 border border-green-500/30 bg-green-900/10 rounded flex flex-col justify-between">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-green-300">HEAL</span>
                                    <span className="text-xs font-bold bg-green-900 px-2 py-0.5 rounded text-green-200">40 CP</span>
                                </div>
                                <p className="text-xs text-slate-400">Removes 1 mistake.</p>
                            </div>

                            {/* Jumpscare */}
                            <div className="p-3 border border-red-500/30 bg-red-900/10 rounded flex flex-col justify-between">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-red-500">SCARE</span>
                                    <span className="text-xs font-bold bg-red-900 px-2 py-0.5 rounded text-red-200">WIN</span>
                                </div>
                                <p className="text-xs text-slate-400">Jumpscare a victim.</p>
                            </div>

                        </div>
                    </section>

                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-950 text-center">
                    <button
                        onClick={onClose}
                        className="px-8 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold transition-colors"
                    >
                        CLOSE GUIDE
                    </button>
                </div>
            </div>
        </div>
    );
};
