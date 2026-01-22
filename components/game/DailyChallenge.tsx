import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WordData } from '../../types';
import { GameStatus } from '../../types';
import { getDailyWord, submitDailyAttempt, getDailyLeaderboard } from '../../services/dailyChallenge';
import { GameScene } from '../Scene';
import { GameSceneOverlay } from './GameSceneOverlay';
import { GameSidebar } from './GameSidebar';
import { Loader2, Trophy, Clock, Skull, ArrowLeft } from 'lucide-react';
import { soundManager } from '../../utils/SoundManager';
import { DailyAttempt, logGameHistory } from '../../utils/supabase';
import clsx from 'clsx';
import { generateWord } from '../../services/wordGenerator'; // Re-use for hint structure if needed or just minimal mock

interface DailyChallengeProps {
    username: string;
    onExit: () => void;
}

export const DailyChallenge: React.FC<DailyChallengeProps> = ({ username, onExit }) => {
    const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
    const [wordData, setWordData] = useState<WordData | null>(null);
    const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
    const [gameLog, setGameLog] = useState<{ id: number, content: React.ReactNode }[]>([]);
    const [loading, setLoading] = useState(true);
    const [leaderboard, setLeaderboard] = useState<DailyAttempt[]>([]);

    // Timer State
    const [startTime, setStartTime] = useState<number>(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<any>(null);

    // Derived State
    const wrongGuesses = guessedLetters.filter(l => wordData && !wordData.word.includes(l)).length;
    const isWon = wordData ? wordData.word.split('').filter(c => c !== ' ').every(c => guessedLetters.includes(c)) : false;
    const isLost = wrongGuesses >= 6; // strictly 6 mistakes for daily

    // Initial Load
    useEffect(() => {
        const loadDaily = async () => {
            setLoading(true);
            try {
                // 1. Fetch Word
                const word = await getDailyWord();
                if (!word) throw new Error("Could not summon daily ritual.");

                // Mock WordData structure since DB only stores string for now
                // Ideally we generate hints for it using Gemini if they are missing?
                // For now, minimal structure.
                setWordData({
                    word: word,
                    difficulty: 'Hard',
                    category: 'Daily Ritual',
                    hint: 'The spirits are silent today...', // TODO: Fetch hints
                    hints: ['A mystery from the void...', 'Focus your mind...']
                });

                // 2. Fetch Leaderboard
                const lb = await getDailyLeaderboard();
                setLeaderboard(lb);

            } catch (e) {
                console.error(e);
                setGameLog(prev => [{ id: Date.now(), content: <span className="text-red-500">FAILED TO CONNECT TO VOID</span> }, ...prev]);
            } finally {
                setLoading(false);
            }
        };
        loadDaily();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, []);

    // Game Loop (Win/Loss)
    useEffect(() => {
        if (status === GameStatus.PLAYING) {
            if (isWon) {
                setStatus(GameStatus.WON);
                clearInterval(timerRef.current);
                soundManager.playWin();

                // Submit Score
                submitDailyAttempt(username || 'Anonymous', elapsedTime);

                // Log History
                logGameHistory({
                    word: wordData?.word || '',
                    difficulty: 'DAILY',
                    result: 'WON',
                    time_taken: elapsedTime,
                    scares_used: 0,
                    user_id: username || 'Anonymous'
                });

                // Refresh Leaderboard
                getDailyLeaderboard().then(setLeaderboard);

            } else if (isLost) {
                setStatus(GameStatus.LOST);
                clearInterval(timerRef.current);
                soundManager.playLose();

                // Log History
                logGameHistory({
                    word: wordData?.word || '',
                    difficulty: 'DAILY',
                    result: 'LOST',
                    time_taken: elapsedTime,
                    scares_used: 0,
                    user_id: username || 'Anonymous'
                });
            }
        }
    }, [isWon, isLost, status, username, elapsedTime]);

    const handleStart = () => {
        if (!wordData) return;
        setStatus(GameStatus.PLAYING);
        setStartTime(Date.now());
        setElapsedTime(0);
        setGuessedLetters([]);
        soundManager.playClick();

        // Start Timer
        const start = Date.now();
        setStartTime(start);

        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            setElapsedTime(Date.now() - start);
        }, 33); // 30fps update
    };

    const handleGuess = (letter: string) => {
        if (status !== GameStatus.PLAYING || guessedLetters.includes(letter)) return;
        setGuessedLetters(prev => [...prev, letter]);

        // Sound
        if (wordData?.word.includes(letter)) soundManager.playCorrect();
        else soundManager.playWrong();
    };


    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black text-red-600 font-horror text-2xl animate-pulse">
                <Loader2 className="animate-spin mr-4" size={48} />
                SUMMONING DAILY RITUAL...
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col md:flex-row bg-slate-950 overflow-hidden">

            {/* Left: Leaderboard & Info (Lobby Style) */}
            {status === GameStatus.IDLE || status === GameStatus.WON || status === GameStatus.LOST ? (
                <div className="w-full md:w-1/3 bg-black/80 border-r border-slate-800 p-6 flex flex-col z-20">
                    <button onClick={onExit} className="self-start text-slate-500 hover:text-white flex items-center gap-2 mb-6">
                        <ArrowLeft size={16} /> BACK TO MENU
                    </button>

                    <h1 className="text-4xl font-horror text-red-600 mb-2">DAILY RITUAL</h1>
                    <p className="text-slate-400 text-sm mb-6">One Word. Infinite Glory.</p>

                    {/* Action Button */}
                    {status === GameStatus.IDLE ? (
                        <div className="mb-8">
                            <div className="bg-slate-900 p-4 rounded border border-slate-700 mb-4">
                                <p className="text-slate-300 text-sm text-center italic">
                                    "Today's ritual requires sacrifice. Are you prepared?"
                                </p>
                            </div>
                            <button
                                onClick={handleStart}
                                className="w-full py-4 bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-horror text-2xl tracking-widest rounded shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all hover:scale-105"
                            >
                                BEGIN RITUAL
                            </button>
                        </div>
                    ) : (
                        <div className="mb-8 text-center">
                            <h2 className={clsx("text-3xl font-horror mb-2", status === GameStatus.WON ? "text-green-500" : "text-red-600")}>
                                {status === GameStatus.WON ? "RITUAL COMPLETE" : "RITUAL FAILED"}
                            </h2>
                            {status === GameStatus.WON && (
                                <div className="text-4xl font-bold text-white mb-4">
                                    {(elapsedTime / 1000).toFixed(3)}s
                                </div>
                            )}
                            <button onClick={onExit} className="text-slate-500 hover:text-white underline">
                                Leave
                            </button>
                        </div>
                    )}

                    {/* Leaderboard */}
                    <div className="flex-1 overflow-y-auto">
                        <h3 className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-4 flex items-center gap-2">
                            <Trophy size={14} /> Top Sacrifices
                        </h3>
                        <div className="space-y-2">
                            {leaderboard.map((entry, idx) => (
                                <div key={entry.id} className={clsx(
                                    "flex justify-between items-center p-3 rounded border",
                                    idx === 0 ? "bg-yellow-950/30 border-yellow-700/50" : "bg-slate-900/50 border-slate-800"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <span className={clsx(
                                            "font-bold w-6 text-center",
                                            idx === 0 ? "text-yellow-500 text-xl" : "text-slate-500"
                                        )}>{idx + 1}</span>
                                        <span className={clsx(
                                            "font-bold",
                                            idx === 0 ? "text-yellow-200" : "text-slate-300"
                                        )}>{entry.user_id}</span>
                                    </div>
                                    <span className="font-mono text-slate-400">
                                        {(entry.time_taken / 1000).toFixed(2)}s
                                    </span>
                                </div>
                            ))}
                            {leaderboard.length === 0 && (
                                <p className="text-slate-600 text-xs text-center italic py-4">Be the first to complete the ritual...</p>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Game Area (Scene + Sidebar) */}
            <div className="flex-1 flex flex-col md:flex-row relative">
                {/* Timer Overlay */}
                {status === GameStatus.PLAYING && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-black/50 backdrop-blur border border-red-500/30 px-6 py-2 rounded-full flex items-center gap-3">
                        <Clock className="text-red-500 animate-pulse" size={20} />
                        <span className="text-2xl font-mono font-bold text-red-100">
                            {(elapsedTime / 1000).toFixed(2)}
                        </span>
                    </div>
                )}

                {/* 3D Scene */}
                <div className="relative w-full h-[40vh] md:h-full md:flex-1 bg-black">
                    <GameSceneOverlay
                        showJumpscare={false}
                        currentJumpscareVideo=""
                        setShowJumpscare={() => { }}
                        autoNextRoundCountdown={null}
                        round={1}
                        gameLog={gameLog}
                        mySpectators={[]}
                        showHintUnlock={false}
                    />
                    <GameScene
                        isWon={status === GameStatus.WON}
                        isLost={status === GameStatus.LOST}
                        wrongGuesses={wrongGuesses}
                    />
                </div>

                {/* Sidebar (Force Minimal Mode?) */}
                <GameSidebar
                    status={status}
                    players={[{ id: 'me', name: username, mistakes: wrongGuesses, status: isWon ? 'WON' : isLost ? 'LOST' : 'PLAYING' } as any]}
                    username={username}
                    amIHost={true}
                    spawnBot={() => { }}
                    setShowRules={() => { }}
                    showRules={false}
                    loadingDifficulty={null}
                    wordData={wordData}
                    guessedLetters={guessedLetters}
                    displayGuessedLetters={guessedLetters}
                    unlockedHints={1} // Only 1 hint for daily?
                    revealedHints={1}
                    gameMode={'SINGLE'} // Reuse Single logic for UI
                    activeDebuffs={[]}
                    curseEnergy={0}
                    wrongGuesses={wrongGuesses}
                    handleGuess={handleGuess}
                    performSpellAction={() => { }}
                    onSoulMend={() => { }}
                    handleStartGame={handleStart} // Retry?
                    handleOracle={() => { }} // Disable powers
                    handleRoast={() => { }}
                    handleGlitch={() => { }}
                    hasScared={false}
                    round={1}
                    spectatingTargetId={null}
                    setSpectatingTargetId={() => { }}
                    setSpectating={() => { }}
                    autoNextRoundCountdown={null}
                    myId={'me'}
                />
            </div>
        </div>
    );
};
