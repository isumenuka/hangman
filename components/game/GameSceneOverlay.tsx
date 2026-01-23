import React from 'react';
import { GameStatus, Player } from '../../types';

interface GameSceneOverlayProps {
    showJumpscare: boolean;
    currentJumpscareVideo: string;
    setShowJumpscare: (show: boolean) => void;
    autoNextRoundCountdown: number | null;
    round: number;
    mySpectators: Player[];
    gameLog: { id: number; content: React.ReactNode }[];
    showHintUnlock: boolean;
}

export function GameSceneOverlay({
    showJumpscare,
    currentJumpscareVideo,
    setShowJumpscare,
    autoNextRoundCountdown,
    round,
    mySpectators,
    gameLog,
    showHintUnlock,
}: GameSceneOverlayProps) {
    return (
        <>
            {/* JUMPSCARE OVERLAY */}
            {showJumpscare && (
                <div className="absolute inset-0 z-[100] bg-black flex items-center justify-center">
                    <video
                        src={currentJumpscareVideo}
                        autoPlay
                        className="w-full h-full object-cover"
                        onEnded={() => setShowJumpscare(false)}
                    />
                </div>
            )}

            {/* Next Round Countdown Overlay */}
            {autoNextRoundCountdown !== null && (
                <div className="absolute inset-0 z-[50] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="text-center">
                        <h2 className="text-4xl font-horror text-red-500 mb-2">ROUND OVER</h2>
                        <p className="text-slate-300 mb-4">Prepare for the next ritual...</p>
                        <div className="text-6xl font-bold text-white animate-ping">{autoNextRoundCountdown}</div>
                    </div>
                </div>
            )}

            {/* Round Indicator (Top Center) */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[20] flex flex-col items-center pointer-events-none select-none">
                <div className="text-[10px] text-red-500 font-bold tracking-[0.3em] uppercase opacity-80 mb-[-5px]">CURRENT</div>
                <div className="text-4xl md:text-5xl font-horror text-red-600 tracking-wider drop-shadow-[0_0_15px_rgba(220,38,38,0.8)] animate-pulse">
                    ROUND {round}
                </div>
                {mySpectators.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-red-400 mt-2 animate-pulse bg-black/40 px-3 py-1 rounded-full border border-red-900/30">
                        <span>👁️</span> {mySpectators.length} watching you
                    </div>
                )}
            </div>

            {/* Persistent Game Log (Top Left of 3D Scene) */}
            <div className="absolute top-20 left-4 z-[10] w-full max-w-md pointer-events-none flex flex-col gap-1">
                {gameLog.map(item => (
                    <div key={item.id} className="font-horror text-sm tracking-widest drop-shadow-[0_2px_1px_rgba(0,0,0,1)] animate-in slide-in-from-left-4 fade-in duration-300">
                        {item.content}
                    </div>
                ))}
            </div>

            {/* Hint Unlock Notification */}
            {showHintUnlock && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] p-4 bg-red-900/80 border border-red-600 rounded-lg shadow-xl animate-in fade-in zoom-in duration-300 text-center">
                    <p className="font-horror text-3xl text-red-100 drop-shadow-lg">HINT UNLOCKED!</p>
                    <p className="text-red-300 text-sm mt-1">A new secret has been revealed...</p>
                </div>
            )}
        </>
    );
}
