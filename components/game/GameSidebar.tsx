import React, { useState } from 'react';
import clsx from 'clsx';
import { User, Users, HelpCircle, Loader2, Trophy, Skull, Scroll, RotateCcw, X, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { GameStatus, Player, WordData } from '../../types';
import { RulesModal } from '../RulesModal';
import { getRitualPhrase } from '../../services/powers';

interface GameSidebarProps {
    status: GameStatus;
    players: Player[];
    username: string;
    amIHost: boolean;
    spawnBot: () => void;
    setShowRules: (show: boolean) => void;
    showRules: boolean;
    loadingDifficulty: 'Easy' | 'Medium' | 'Hard' | null;
    wordData: WordData | null;
    guessedLetters: string[];
    displayGuessedLetters: string[];
    unlockedHints: number;
    revealedHints: number;
    gameMode: 'MENU' | 'SINGLE' | 'LOBBY_SETUP' | 'LOBBY_HOST' | 'LOBBY_JOIN';
    activeDebuffs: ('FOG' | 'SCRAMBLE')[];
    curseEnergy: number;
    wrongGuesses: number;
    handleGuess: (letter: string) => void;
    onCastSpell: (spell: 'FOG' | 'SCRAMBLE', targetId?: string) => void; // targetId handled internally by spellToCast logic if passed up? No, App handles it via castSpell. 
    // Wait, App.tsx had onCastSpell just taking 'spell'. Then it sets 'spellToCast' state. 
    // If I move 'spellToCast' state HERE, then I call 'castSpell' (prop) with targetId.
    // The 'onCastSpell' prop from App.tsx (if I kept it there) would just set state.
    // Better to move the "Target Selection" logic HERE to sidebar? Yes.
    // So I need a prop 'castSpell' (the actual action) and 'setHasScared' etc?
    // App.tsx 'onCastSpell' (line 727) does checks and sets 'spellToCast'.
    // App.tsx 'handlePlayerSelect' (line 765) calls 'castSpell'.
    // I should move 'spellToCast' state and 'handlePlayerSelect' logic to GameSidebar.
    // So I need 'castSpell' (network action) passed down.
    // And 'setHasScared' / 'setTotalScaresUsed' logic?
    // App.tsx handlePlayerSelect updates 'hasScared'.
    // I should pass a handler `performSpellAction(spell, targetId)` which does the network call and local state updates.
    performSpellAction: (spell: 'FOG' | 'SCRAMBLE', targetId: string) => void;

    onSoulMend: () => void;
    handleStartGame: (difficulty?: 'Easy' | 'Medium' | 'Hard') => void;
    handleOracle: () => void;
    handleRoast: () => void;
    handleGlitch: () => void;
    round: number;
    spectatingTargetId: string | null;
    setSpectatingTargetId: (id: string | null) => void;
    setSpectating: (id: string | null) => void;
    autoNextRoundCountdown: number | null;
    myId: string;
    targetPlayer: Player | null; // For spectating status in sidebar? No, sidebar doesn't show spectator window. 
    // Wait, Sidebar contained the "Target Selection Modal" (lines 1700+).
    // AND Sidebar contained "RulesModal" (line 1356).
    // AND Sidebar contained "Spectator Controls (If dead/won)" (line 1627).
    // AND Sidebar contained "Restart Button" (line 1612).
}

export function GameSidebar({
    status,
    players,
    username,
    amIHost,
    spawnBot,
    setShowRules,
    showRules,
    loadingDifficulty,
    wordData,
    guessedLetters,
    displayGuessedLetters,
    unlockedHints,
    revealedHints,
    gameMode,
    activeDebuffs,
    curseEnergy,
    wrongGuesses,
    handleGuess,
    performSpellAction, // Clean wrapper for App.tsx's castSpell + state updates
    onSoulMend,
    handleStartGame,
    handleOracle,
    handleRoast,
    handleGlitch,
    hasScared,
    round,
    spectatingTargetId,
    setSpectatingTargetId,
    setSpectating,
    autoNextRoundCountdown,
    myId,
}: GameSidebarProps) {

    // Local state for Ritual (Hints)
    const [showRitualInput, setShowRitualInput] = useState(false);
    const [ritualPhrase, setRitualPhrase] = useState('');
    const [userRitualInput, setUserRitualInput] = useState('');

    // Local state for Spell Targeting
    const [spellToCast, setSpellToCast] = useState<'FOG' | 'SCRAMBLE' | 'JUMPSCARE' | null>(null);
    const [lastSpellCastTime, setLastSpellCastTime] = useState(0);

    const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    const currentAlphabet = React.useMemo(() => {
        if (activeDebuffs.includes('SCRAMBLE')) {
            return [...ALPHABET].sort(() => Math.random() - 0.5);
        }
        return ALPHABET;
    }, [activeDebuffs]); // Removed scrambleSeed dep as it was local to App.tsx? 
    // If scrambleSeed is needed for scramble effect interval, it should be passed or managed. 
    // App.tsx line 571 used scrambleSeed. 
    // I will assume simple scramble for now or use a prop if strictly needed. 
    // Actually, scrambleSeed was just to force re-render. React.useMemo with activeDebuffs + a toggle prop might be enough logic if we want "Active Scramble".
    // For now, I'll rely on activeDebuffs.

    const initiateCastSpell = (spell: 'FOG' | 'SCRAMBLE' | 'JUMPSCARE') => {
        // Cooldown Check
        if (Date.now() - lastSpellCastTime < 10000) {
            // soundManager.playWrong(); // Need soundManager? Pass as prop or import? 
            // Importing soundManager might be side-effecty but cleaner than props.
            // Assuming soundManager is global/singleton.
            // import { soundManager } from '../../utils/SoundManager';
            // I will add the import.
            import('../../utils/SoundManager').then(({ soundManager }) => soundManager.playWrong());
            return;
        }

        const cost = spell === 'FOG' ? 20 : spell === 'SCRAMBLE' ? 20 : 0;

        if (spell !== 'JUMPSCARE' && curseEnergy < cost) {
            import('../../utils/SoundManager').then(({ soundManager }) => soundManager.playWrong());
            return;
        }

        if (spell === 'JUMPSCARE' && status !== GameStatus.WON) {
            import('../../utils/SoundManager').then(({ soundManager }) => soundManager.playWrong());
            return;
        }

        setSpellToCast(spell); // Enter selection mode
    };

    const executeSpell = (targetId: string) => {
        if (!spellToCast) return;
        performSpellAction(spellToCast, targetId);
        setSpellToCast(null);
        setLastSpellCastTime(Date.now());
    };

    return (
        <div className="relative w-full h-[60vh] lg:h-full lg:w-[450px] lg:shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col order-2 z-10 shadow-2xl">
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col">

                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-3xl font-horror text-red-600 tracking-wider">
                            CURSED<span className="text-slate-100">MAN</span>
                        </h1>
                        <div className="flex items-center gap-2">
                            {gameMode !== 'SINGLE' && (
                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                    <User size={12} /> <span className="uppercase tracking-wider font-bold">{username}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    {gameMode !== 'SINGLE' && (
                        <div className="flex items-center gap-2">
                            <div className="bg-slate-800 px-2 py-1 rounded text-xs text-slate-300 flex items-center gap-1">
                                <Users size={12} /> {players.length}
                            </div>
                            {amIHost && status === GameStatus.IDLE && (
                                <button
                                    onClick={spawnBot}
                                    className="px-2 py-1 bg-purple-900/50 hover:bg-purple-800 border border-purple-500/30 rounded text-[10px] text-purple-200 uppercase font-bold tracking-wider transition-colors"
                                >
                                    + ADD BOT
                                </button>
                            )}
                        </div>
                    )}
                    <button
                        onClick={() => setShowRules(true)}
                        className="ml-2 p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                        title="Rules & Powers"
                    >
                        <HelpCircle size={18} />
                    </button>
                </div>

                <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

                {/* Word Display Area */}
                <div className="mb-8 flex flex-col items-center justify-center min-h-[120px] bg-black/20 rounded-lg p-4 border border-slate-800/50">
                    {loadingDifficulty ? (
                        <div className="flex flex-col items-center animate-pulse gap-2">
                            <Loader2 size={32} className="text-red-700 animate-spin" />
                            <span className="font-horror text-xl text-red-800">SUMMONING...</span>
                        </div>
                    ) : (
                        <>
                            {/* Word Stats Bar */}
                            <div className="w-full flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                                <span className={clsx(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-dashed",
                                    wordData?.difficulty === 'Hard' ? 'border-red-800 text-red-500 bg-red-950/30' :
                                        wordData?.difficulty === 'Medium' ? 'border-yellow-800 text-yellow-500 bg-yellow-950/30' : 'border-green-800 text-green-500 bg-green-950/30'
                                )}>
                                    {wordData?.difficulty || '...'}
                                </span>
                            </div>

                            {/* The Letters */}
                            <div className="flex flex-wrap justify-center gap-2">
                                {(wordData?.word || '').split('').map((char, idx) => {
                                    if (char === ' ') return <div key={idx} className="w-3" />;
                                    // Logic for checking if guessed. Using displayGuessedLetters from props.
                                    const isGuessed = displayGuessedLetters.includes(char) || status === GameStatus.LOST;
                                    // Note: Logic in App.tsx was: isGuessed = displayGuessedLetters.includes(char) || status === LOST || (targetPlayer?.status === 'LOST');
                                    // We passed displayGuessedLetters which should handle the "targetPlayer" case if logic is upstream.
                                    // BUT status === LOST is global. targetPlayer status check is missing here if we don't pass targetPlayer status.
                                    // Simplification: We rely on displayGuessedLetters being correct.

                                    return (
                                        <span
                                            key={idx}
                                            className={clsx(
                                                "w-8 h-10 border-b-2 flex items-center justify-center text-2xl font-horror transition-all duration-300",
                                                isGuessed ? "border-slate-500 text-red-100" : "border-slate-800 text-transparent",
                                                // Red reveal specific logic
                                                (!isGuessed && (status === GameStatus.LOST || (spectatingTargetId && players.find(p => p.id === spectatingTargetId)?.status === 'LOST'))) && "text-red-600 border-red-900"
                                                // Wait, logic above was: if lost AND not guessed, show red.
                                                // I need to implement that condition.
                                            )}
                                        >
                                            {isGuessed ? char : (status === GameStatus.LOST ? char : '_')}
                                            {/* Wait, if LOST, we reveal? App.tsx logic:
                          isGuessed ? char : '_'
                          But className handles color.
                          If I want to REVEAL missing letters on loss:
                          App.tsx line 1393: {isGuessed ? char : '_'}
                          But line 1382: const isGuessed = display... || status === LOST ...
                          So if status is LOST, isGuessed becomes TRUE.
                          So it reveals automatically.
                          My logic led isGuessed to be true on LOST.
                      */}
                                        </span>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Hint Display */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-slate-500 text-xs uppercase font-bold tracking-widest">Ritual Clues</h3>
                    </div>

                    <div className="space-y-2">
                        {wordData?.hints ? (
                            Array.from({ length: 5 }).map((_, i) => {
                                const isUnlocked = i + 1 <= unlockedHints;
                                const isRevealed = i + 1 <= revealedHints;
                                if (!isUnlocked) return null;

                                return (
                                    <div key={i} className="bg-gradient-to-r from-purple-950/40 to-slate-900/40 p-3 rounded-lg border border-purple-500/30 animate-in slide-in-from-left">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Hint {i + 1}</span>
                                            {i === 0 && <span className="text-[10px] text-slate-500">(Free)</span>}
                                        </div>

                                        {isRevealed || i === 0 ? (
                                            <p className="text-slate-300 text-sm italic leading-relaxed">"{wordData.hints![i]}"</p>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                <p className="text-slate-500 text-sm italic blur-sm select-none">"The secrets of the void are hidden..."</p>
                                                <button
                                                    onClick={async () => {
                                                        const phrase = await getRitualPhrase();
                                                        setRitualPhrase(phrase);
                                                        setUserRitualInput('');
                                                        setShowRitualInput(true);
                                                    }}
                                                    className="w-full py-1 bg-purple-900/20 hover:bg-purple-900/50 border border-purple-500/50 text-purple-300 text-xs uppercase font-bold transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Scroll size={12} /> Perform Ritual to Reveal
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            wordData?.hint && (
                                <div className="bg-gradient-to-r from-purple-950/40 to-slate-900/40 p-3 rounded-lg border border-purple-500/30">
                                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Hint</span>
                                    <p className="text-slate-300 text-sm italic mt-1">"{wordData.hint}"</p>
                                </div>
                            )
                        )}
                    </div>

                    {/* Team Sacrifice Progress */}
                    {gameMode !== 'SINGLE' && wordData?.hints && unlockedHints < 5 && (
                        <div className="mt-3 bg-slate-900/30 p-2 rounded border border-slate-700/50">
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>Team Sacrifice</span>
                                <span>{Math.floor((players.reduce((s, p) => s + p.mistakes, 0) / (players.length * 6)) * 100)}%</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-600 to-red-600 transition-all duration-500"
                                    style={{ width: `${(players.reduce((s, p) => s + p.mistakes, 0) / (players.length * 6)) * 100}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-slate-500 text-center mt-1">
                                Next hint at {unlockedHints === 1 ? '20' : unlockedHints === 2 ? '40' : unlockedHints === 3 ? '60' : '80'}% • {unlockedHints}/5 hints
                            </p>
                        </div>
                    )}
                </div>

                {/* Status Messages */}
                <div className="h-8 flex items-center justify-center mb-6">
                    {status === GameStatus.WON && <div className="text-green-500 text-xl font-horror flex items-center gap-2 animate-bounce"><Trophy size={20} /> SOUL SAVED</div>}
                    {status === GameStatus.LOST && <div className="text-red-600 text-xl font-horror flex items-center gap-2 animate-pulse"><Skull size={20} /> CONSUMED</div>}
                </div>

                {/* Controls Section (KEYBOARD & SABOTAGE) */}
                <div className={clsx(
                    "relative transition-all duration-500 rounded-lg p-2 md:p-4 border border-slate-800 bg-black/40",
                    activeDebuffs.includes('FOG') && "blur-sm grayscale opacity-50 pointer-events-none border-red-900/50" // Precise Fog
                )}>
                    {activeDebuffs.includes('FOG') && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center text-red-600 font-horror text-4xl animate-pulse tracking-widest drop-shadow-lg">
                            BLINDED!
                        </div>
                    )}

                    {gameMode !== 'SINGLE' && gameMode !== 'DAILY' && (
                        <div className="mb-4 space-y-2">
                            <div className="flex items-center justify-between gap-3 bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                <div className="flex-1 flex items-center gap-2">
                                    <div className="text-xs text-slate-400 uppercase font-bold tracking-widest">
                                        CURSE POINTS
                                    </div>
                                    <div className="text-xl font-horror text-purple-400 animate-pulse tracking-widest shadow-purple-500/50 drop-shadow-md">
                                        {curseEnergy}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        disabled={curseEnergy < 15}
                                        onClick={() => initiateCastSpell('FOG')}
                                        className="bg-purple-900/30 hover:bg-purple-800 disabled:opacity-30 border border-purple-500/50 text-purple-300 text-xs uppercase font-bold px-4 py-3 rounded transition-colors flex flex-col items-center leading-tight min-w-[70px]"
                                    >
                                        <span>FOG</span>
                                        <span className="text-[10px] opacity-70">20pts</span>
                                    </button>
                                    <button
                                        disabled={curseEnergy < 20}
                                        onClick={() => initiateCastSpell('SCRAMBLE')}
                                        className="bg-orange-900/30 hover:bg-orange-800 disabled:opacity-30 border border-orange-500/50 text-orange-300 text-xs uppercase font-bold px-4 py-3 rounded transition-colors flex flex-col items-center leading-tight min-w-[70px]"
                                    >
                                        <span>MIX</span>
                                        <span className="text-[10px] opacity-70">20pts</span>
                                    </button>

                                    <button
                                        disabled={curseEnergy < 40 || wrongGuesses === 0}
                                        onClick={onSoulMend}
                                        className="bg-green-900/30 hover:bg-green-800 disabled:opacity-30 border border-green-500/50 text-green-300 text-xs uppercase font-bold px-4 py-3 rounded transition-colors flex flex-col items-center leading-tight min-w-[70px]"
                                    >
                                        <span>HEAL</span>
                                        <span className="text-[10px] opacity-70">40pts</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    disabled={curseEnergy < 15}
                                    onClick={handleOracle}
                                    className="flex-1 bg-cyan-900/30 hover:bg-cyan-800 disabled:opacity-30 border border-cyan-500/50 text-cyan-300 text-xs uppercase font-bold py-2 rounded transition-colors flex items-center justify-center gap-2"
                                    title="Ask the AI Oracle for a hint"
                                >
                                    <span>🔮 ORACLE</span>
                                    <span className="text-[10px] opacity-70">15pts</span>
                                </button>
                                <button
                                    disabled={curseEnergy < 10}
                                    onClick={handleRoast}
                                    className="flex-1 bg-red-900/30 hover:bg-red-800 disabled:opacity-30 border border-red-500/50 text-red-300 text-xs uppercase font-bold py-2 rounded transition-colors flex items-center justify-center gap-2"
                                    title="AI Roast an opponent"
                                >
                                    <span>🔥 ROAST</span>
                                    <span className="text-[10px] opacity-70">10pts</span>
                                </button>
                                <button
                                    disabled={curseEnergy < 25}
                                    onClick={handleGlitch}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 border border-slate-500 text-slate-300 text-xs uppercase font-bold py-2 rounded transition-colors flex items-center justify-center gap-2"
                                    title="Glitch the reality (Narrative Chaos)"
                                >
                                    <span>👾 GLITCH</span>
                                    <span className="text-[10px] opacity-70">25pts</span>
                                </button>
                            </div>
                        </div>
                    )}



                    {/* Keyboard */}
                    <div className="grid grid-cols-7 gap-1">
                        {currentAlphabet.map(letter => {
                            const isGuessed = guessedLetters.includes(letter);
                            const isCorrect = wordData?.word.includes(letter);
                            return (
                                <button
                                    key={letter}
                                    onClick={() => handleGuess(letter)}
                                    disabled={isGuessed || status !== GameStatus.PLAYING}
                                    className={clsx(
                                        "aspect-square rounded flex items-center justify-center font-bold text-sm border transition-all active:scale-95 touch-manipulation",
                                        isGuessed
                                            ? (isCorrect ? "bg-green-900/40 text-green-500 border-green-800" : "bg-slate-800/50 text-slate-600 border-transparent")
                                            : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
                                    )}
                                >
                                    {letter}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Restart Button */}
                {/* Restart / Return Button */}
                {
                    (
                        (gameMode === 'SINGLE' || (amIHost && players.every(p => p.status !== 'PLAYING'))) && status !== GameStatus.IDLE && status !== GameStatus.PLAYING && gameMode !== 'DAILY'
                    ) || (
                            gameMode === 'DAILY' && status !== GameStatus.IDLE && status !== GameStatus.PLAYING
                        ) ? (
                        <button
                            onClick={() => handleStartGame()}
                            className={clsx(
                                "mt-6 w-full py-3 text-white font-bold rounded flex items-center justify-center gap-2 transition-colors border-t",
                                gameMode === 'DAILY'
                                    ? "bg-slate-800 hover:bg-slate-700 border-slate-600"
                                    : "bg-red-900 hover:bg-red-800 border-red-700"
                            )}
                        >
                            {gameMode === 'DAILY' ? (
                                <><ArrowLeft size={18} /> RETURN TO MENU</>
                            ) : (
                                <><RotateCcw size={18} /> {status === GameStatus.WON || status === GameStatus.LOST ? `START ROUND ${round + 1}` : 'RESTART RITUAL'}</>
                            )}
                        </button>
                    ) : null
                }

                {/* Spectator Controls */}
                {
                    (status === GameStatus.WON || status === GameStatus.LOST) && !spectatingTargetId && gameMode !== 'SINGLE' && gameMode !== 'DAILY' && (
                        <div className="mt-4 p-4 bg-slate-900/80 border border-slate-700 rounded">
                            <h3 className="text-slate-400 text-xs uppercase font-bold mb-2">Spectate Players</h3>
                            <div className="flex flex-wrap gap-2">
                                {players.filter(p => p.id !== myId && p.status === 'PLAYING').map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => { setSpectatingTargetId(p.id); setSpectating(p.id); }}
                                        className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded flex items-center gap-2 border border-slate-600"
                                    >
                                        <User size={12} /> {p.name}
                                    </button>
                                ))}
                                {players.filter(p => p.id !== myId && p.status === 'PLAYING').length === 0 && (
                                    <span className="text-slate-600 text-xs italic">No active players to watch.</span>
                                )}
                            </div>
                        </div>
                    )
                }

                {
                    gameMode !== 'SINGLE' && !amIHost && status !== GameStatus.IDLE && status !== GameStatus.PLAYING && (
                        <div className="mt-6 text-center text-slate-500 text-xs uppercase tracking-widest animate-pulse">
                            {autoNextRoundCountdown !== null ? `Starting Round ${round + 1} in ${autoNextRoundCountdown}...` : "Waiting for all players..."}
                        </div>
                    )
                }

                {/* RITUAL SELECTION (Difficulty) */}
                {
                    (gameMode === 'SINGLE' || (amIHost && players.every(p => p.status !== 'PLAYING'))) && status !== GameStatus.IDLE && status !== GameStatus.PLAYING && gameMode !== 'DAILY' && (
                        <div className="mt-8 border-t border-slate-800 pt-6">
                            <h3 className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-4 text-center">Select Ritual Intensity</h3>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={() => handleStartGame('Easy')}
                                    className="py-3 bg-green-950/30 hover:bg-green-900/50 border border-green-800 hover:border-green-500 rounded text-green-400 font-bold text-xs uppercase tracking-wider transition-all"
                                >
                                    Initiate
                                </button>
                                <button
                                    onClick={() => handleStartGame('Medium')}
                                    className="py-3 bg-yellow-950/30 hover:bg-yellow-900/50 border border-yellow-800 hover:border-yellow-500 rounded text-yellow-400 font-bold text-xs uppercase tracking-wider transition-all"
                                >
                                    Summon
                                </button>
                                <button
                                    onClick={() => handleStartGame('Hard')}
                                    className="py-3 bg-red-950/30 hover:bg-red-900/50 border border-red-800 hover:border-red-500 rounded text-red-400 font-bold text-xs uppercase tracking-wider transition-all"
                                >
                                    Curse
                                </button>
                            </div>
                            <div className="flex justify-between px-2 mt-1 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                                <span>Easy</span>
                                <span>Medium</span>
                                <span>Hard</span>
                            </div>
                        </div>
                    )
                }

            </div>

            {/* Target Selection Modal (Dedicated Popup) */}
            {
                spellToCast && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-slate-900 border border-red-900 shadow-[0_0_50px_rgba(220,38,38,0.5)] rounded-lg w-full max-w-md p-6 flex flex-col gap-4">

                            <div className="text-center">
                                <h3 className="text-3xl font-horror text-red-600 tracking-wider mb-2">CAST {spellToCast}</h3>
                                <p className="text-slate-400 text-sm">Select a victim to curse...</p>
                            </div>

                            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                                {players.filter(p => p.id !== myId).map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => executeSpell(p.id)}
                                        disabled={p.status !== 'PLAYING'}
                                        className="bg-black/50 hover:bg-red-900/40 border border-slate-700 hover:border-red-500 p-4 rounded flex items-center justify-between group transition-all"
                                    >
                                        <span className="font-bold text-slate-200 group-hover:text-white flex items-center gap-2">
                                            <User size={16} /> {p.name}
                                        </span>
                                        {p.status !== 'PLAYING' ? (
                                            <span className="text-[10px] text-slate-600 uppercase">Eliminated</span>
                                        ) : (
                                            <span className="text-xs text-red-500 opacity-0 group-hover:opacity-100 uppercase font-bold tracking-widest transition-opacity">
                                                CURSE
                                            </span>
                                        )}
                                    </button>
                                ))}
                                {players.filter(p => p.id !== myId).length === 0 && (
                                    <div className="text-center text-slate-600 italic py-4">No victims available...</div>
                                )}
                            </div>

                            <button
                                onClick={() => setSpellToCast(null)}
                                className="mt-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold transition-colors"
                            >
                                CANCEL RITUAL
                            </button>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
