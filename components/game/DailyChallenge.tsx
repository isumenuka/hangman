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
    const [hasAttempted, setHasAttempted] = useState(false);
    const [showTimer, setShowTimer] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [yesterdayWinners, setYesterdayWinners] = useState<DailyAttempt[]>([]);

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
                const dailyData = await getDailyWord();
                console.log('[DailyChallenge] Fetched Data:', dailyData);

                if (!dailyData) throw new Error("Could not summon daily ritual.");

                // Robust Hints Fallback
                const safeHints = (dailyData.hints && dailyData.hints.length >= 5)
                    ? dailyData.hints
                    : [
                        'The void whispers...',
                        'Look closer at the shadows...',
                        'A pattern emerges...',
                        'The end is drawing near...',
                        'S_C_I_I_E' // Fallback
                    ];

                setWordData({
                    word: dailyData.word,
                    difficulty: 'Hard',
                    category: 'Daily Ritual',
                    hint: safeHints[0],
                    hints: safeHints
                });

                // 2. Fetch Leaderboard
                const lb = await getDailyLeaderboard();
                setLeaderboard(lb);

                // 3. Check if user already attempted today
                if (username) {
                    const userAttempt = lb.find(a => a.user_id === username);
                    if (userAttempt) {
                        setHasAttempted(true);
                    }
                }

                // 4. Fetch yesterday's top 3 winners
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayDate = yesterday.toISOString().split('T')[0];
                const yesterdayLeaderboard = await getDailyLeaderboard(yesterdayDate);
                setYesterdayWinners(yesterdayLeaderboard.slice(0, 3));

            } catch (e) {
                console.error(e);
                setGameLog(prev => [{ id: Date.now(), content: <span className="text-red-500">CONNECTION SEVERED. USING LOCAL RITUAL.</span> }, ...prev]);
                // Fallback Word
                setWordData({
                    word: 'SACRIFICE',
                    difficulty: 'Medium',
                    category: 'Daily Ritual',
                    hint: 'A necessary loss...',
                    hints: [
                        'First hint: It requires giving something up.',
                        'Second hint: A holy offering.',
                        'Third hint: To kill for a god.',
                        'Fourth hint: One word, nine letters.',
                        'Fifth hint: S_C_I_I_E'
                    ]
                });
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
        setShowTimer(true);
        soundManager.playClick();

        // Fade out timer after 3 seconds
        setTimeout(() => {
            setShowTimer(false);
        }, 3000);

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

    // Keyboard Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (status !== GameStatus.PLAYING) return;
            const char = e.key.toUpperCase();
            if (/^[A-Z]$/.test(char)) {
                handleGuess(char);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [status, guessedLetters, wordData]);


    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black text-red-600 font-horror text-2xl animate-pulse">
                <Loader2 className="animate-spin mr-4" size={48} />
                SUMMONING DAILY RITUAL...
            </div>
        );
    }

    return (
        <div className="w-full h-screen bg-slate-950 overflow-hidden relative flex flex-col">

            {/* IDLE / MENU STATE (Lobby Style Overlay) */}
            {status === GameStatus.IDLE && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="max-w-md w-full bg-slate-900/95 backdrop-blur-md rounded-lg border border-red-900/50 p-8 shadow-2xl shadow-red-900/20">
                        <button onClick={onExit} className="self-start text-slate-500 hover:text-white flex items-center gap-2 mb-6">
                            <ArrowLeft size={16} /> BACK TO MENU
                        </button>

                        <h1 className="text-4xl font-horror text-red-600 mb-2">DAILY RITUAL</h1>
                        <p className="text-slate-400 text-sm mb-6">One Word. Infinite Glory.</p>

                        {/* Yesterday's Champions */}
                        {yesterdayWinners.length > 0 && (
                            <div className="mb-6 bg-slate-950/50 border border-yellow-700/30 rounded-lg p-4">
                                <h3 className="text-yellow-500 text-xs uppercase font-bold tracking-widest mb-3 flex items-center gap-2">
                                    <Trophy size={14} /> Yesterday's Champions
                                </h3>
                                <div className="space-y-2">
                                    {yesterdayWinners.map((winner, idx) => (
                                        <div key={winner.id} className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">
                                                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                                                </span>
                                                <span className={clsx(
                                                    "font-bold text-sm",
                                                    idx === 0 && "text-yellow-200",
                                                    idx === 1 && "text-slate-300",
                                                    idx === 2 && "text-orange-300"
                                                )}>
                                                    {winner.user_id}
                                                </span>
                                            </div>
                                            <span className="font-mono text-slate-400 text-sm">
                                                {(winner.time_taken / 1000).toFixed(2)}s
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mb-8">
                            {hasAttempted ? (
                                <div className="bg-yellow-950/30 border border-yellow-700/50 p-4 rounded text-center">
                                    <p className="text-yellow-400 font-bold mb-2">⚠️ Already Attempted</p>
                                    <p className="text-slate-400 text-sm">You've already completed today's ritual. Come back tomorrow!</p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-slate-900 p-4 rounded border border-slate-700 mb-4">
                                        <p className="text-slate-300 text-sm text-center italic">
                                            "Today's ritual requires sacrifice. Are you prepared?"
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleStart}
                                        className="w-full py-4 bg-gradient-to-r from-red-900 to-red-700 hover:text-white text-red-100 font-horror text-2xl tracking-widest rounded shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all hover:scale-105"
                                    >
                                        BEGIN RITUAL
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ACTIVE GAME LAYOUT (Matches App.tsx) */}
            <div className="flex flex-col lg:flex-row w-full h-full">

                {/* 3D Scene Area */}
                <div className="relative w-full h-[40vh] lg:h-full lg:flex-1 bg-black z-0 order-1 shadow-2xl lg:shadow-none">
                    {/* Daily Timer Overlay */}
                    {status === GameStatus.PLAYING && (
                        <div className="absolute top-4 left-4 z-20 bg-black/50 backdrop-blur border border-red-500/30 px-6 py-2 rounded-full flex items-center gap-3 pointer-events-none">
                            <Clock className="text-red-500 animate-pulse" size={20} />
                            <span className="text-2xl font-mono font-bold text-red-100">
                                {(elapsedTime / 1000).toFixed(2)}
                            </span>
                        </div>
                    )}

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

                {/* Sidebar */}
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
                    unlockedHints={wrongGuesses + 1}
                    revealedHints={wrongGuesses + 1}
                    gameMode={'DAILY'}
                    activeDebuffs={[]}
                    curseEnergy={0}
                    wrongGuesses={wrongGuesses}
                    handleGuess={handleGuess}
                    performSpellAction={() => { }}
                    onSoulMend={() => { }}
                    handleStartGame={() => { }} // No restart in Daily
                    handleOracle={() => { }}
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
