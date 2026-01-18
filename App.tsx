import React, { useState, useEffect, useCallback } from 'react';
import { GameScene } from './components/Scene';
import { generateWord } from './services/gemini';
import { GameStatus, WordData, Player } from './types';
import { Play, RotateCcw, HelpCircle, Loader2, Trophy, Skull, Users, Copy, Link, User } from 'lucide-react';
import clsx from 'clsx';
import { soundManager } from './utils/SoundManager';
import { useMultiplayer } from './hooks/useMultiplayer';
import { PlayerList } from './components/PlayerList';
import { RulesModal } from './components/RulesModal';

const MAX_MISTAKES = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function App() {
  // --- Local Game State ---
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [username, setUsername] = useState('');

  // --- Multiplayer State ---
  const [gameMode, setGameMode] = useState<'MENU' | 'SINGLE' | 'LOBBY_SETUP' | 'LOBBY_HOST' | 'LOBBY_JOIN'>('MENU');
  const [joinInputId, setJoinInputId] = useState('');
  const [showMobileList, setShowMobileList] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // --- Sabotage State ---
  const [curseEnergy, setCurseEnergy] = useState(0);
  const [comboCount, setComboCount] = useState(0);

  const [activeDebuffs, setActiveDebuffs] = useState<('FOG' | 'SCRAMBLE')[]>([]);
  const [scrambleSeed, setScrambleSeed] = useState(0); // Triggers re-shuffle
  const [spellToCast, setSpellToCast] = useState<'FOG' | 'SCRAMBLE' | 'JUMPSCARE' | null>(null); // For targeting mode
  const [jumpscareVideo, setJumpscareVideo] = useState<string | null>(null);


  // Game Log (Persistant Notifications)
  const [gameLog, setGameLog] = useState<{ id: number, content: React.ReactNode }[]>([]);

  // Progressive Hints
  const [unlockedHints, setUnlockedHints] = useState(1);
  const [showHintUnlock, setShowHintUnlock] = useState(false);

  // Callbacks for Network
  const handleGameStart = useCallback((data: WordData) => {
    setWordData(data);
    setGuessedLetters([]);
    setStatus(GameStatus.PLAYING);
    setCurseEnergy(0);
    setActiveDebuffs([]);
    setUnlockedHints(1); // Reset hints on new game
    soundManager.playAmbient();
    soundManager.playClick();

    // Initial Log
    setGameLog([{ id: Date.now(), content: "THE RITUAL HAS BEGUN" }]);
  }, []);

  const handleWorldUpdate = useCallback((players: Player[]) => {
  }, []);

  const handleSpellReceived = useCallback((spellId: 'FOG' | 'SCRAMBLE' | 'JUMPSCARE', casterName: string) => {
    soundManager.playWrong();

    if (spellId === 'JUMPSCARE') {
      const videos = [
        'vlipsy-creepy-face-jump-scare-3hEsFXt9.mp4',
        'vlipsy-jump-scare-creepy-doll-nwbQ9bDF.mp4',
        'vlipsy-winterrowd-jump-scare-IGMSPmB8.mp4'
      ];
      setJumpscareVideo(videos[Math.floor(Math.random() * videos.length)]);
      return;
    }

    setActiveDebuffs(prev => [...prev, spellId]);
    let scrambleInterval: any;
    if (spellId === 'SCRAMBLE') {
      scrambleInterval = setInterval(() => setScrambleSeed(Math.random()), 1000);
    }
    setTimeout(() => {
      setActiveDebuffs(prev => prev.filter(d => d !== spellId));
      if (scrambleInterval) clearInterval(scrambleInterval);
    }, 5000);
  }, []);

  const handleSpellLog = useCallback((spellId: string, casterName: string, targetName: string) => {
    const logItem = (
      <span>
        <span className="text-white">{casterName}</span>
        <span className="text-red-500"> cursed </span>
        <span className="text-white">{targetName}</span>
        <span className="text-red-500"> ({spellId})</span>
      </span>
    );

    setGameLog(prev => {
      const newLog = [...prev, { id: Date.now(), content: logItem }];
      return newLog.slice(-8); // Keep last 8 messages
    });

    soundManager.playClick();
  }, []);



  // ... render logic ... 

  // (In JSX, replacing the Toast block)


  const { initializePeer, joinLobby, startGame, updateMyStatus, castSpell, myId, players, connectionStatus, amIHost } = useMultiplayer(handleGameStart, handleWorldUpdate, handleSpellReceived, handleSpellLog);

  // Derived State
  const wrongGuesses = guessedLetters.filter(l =>
    wordData && !wordData.word.includes(l)
  ).length;

  const isWon = wordData
    ? wordData.word.split('').filter(c => c !== ' ').every(c => guessedLetters.includes(c))
    : false;

  const isLost = wrongGuesses >= MAX_MISTAKES;

  // --- Effects ---

  // Game End Logic
  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      if (isWon) {
        setStatus(GameStatus.WON);
        soundManager.playWin();
        updateMyStatus('WON', wrongGuesses);
      } else if (isLost) {
        setStatus(GameStatus.LOST);
        soundManager.playLose();
        updateMyStatus('LOST', wrongGuesses);
      } else {
        // Still playing, report mistakes
        updateMyStatus('PLAYING', wrongGuesses);
      }
    }
  }, [guessedLetters, isWon, isLost, status, wrongGuesses]); // Added updateMyStatus to dep might be loop safe if stable

  // Audio effect for guess
  const prevGuessLength = React.useRef(0);
  useEffect(() => {
    if (guessedLetters.length > prevGuessLength.current && wordData) {
      const lastLetter = guessedLetters[guessedLetters.length - 1];
      if (wordData.word.includes(lastLetter)) {
        soundManager.playCorrect();
      } else {
        soundManager.playWrong();
      }
    }
    prevGuessLength.current = guessedLetters.length;
  }, [guessedLetters, wordData]);

  // Progressive Hint System: Track team sacrifice
  useEffect(() => {
    if (!wordData?.hints) return;

    let totalLost = 0;
    let totalLives = 0;

    if (gameMode === 'SINGLE') {
      // Single player: use own mistakes
      totalLost = wrongGuesses;
      totalLives = 6;
    } else {
      // Multiplayer: use team total
      totalLives = players.length * 6;
      totalLost = players.reduce((sum, p) => sum + p.mistakes, 0);
    }

    console.log('[Hint System]', { totalLost, totalLives, players: players.map(p => ({ name: p.name, mistakes: p.mistakes })) });

    const lossPercent = totalLives > 0 ? (totalLost / totalLives) * 100 : 0;

    let newHintCount = 1;
    if (lossPercent >= 80) newHintCount = 5;
    else if (lossPercent >= 60) newHintCount = 4;
    else if (lossPercent >= 40) newHintCount = 3;
    else if (lossPercent >= 20) newHintCount = 2;

    console.log('[Hint System]', { lossPercent: lossPercent.toFixed(1), currentHints: unlockedHints, newHintCount });

    if (newHintCount > unlockedHints) {
      console.log('[Hint System] UNLOCKING NEW HINT!', newHintCount);
      setUnlockedHints(newHintCount);
      setShowHintUnlock(true);
      soundManager.playWin();
      setTimeout(() => setShowHintUnlock(false), 2000);
    }
  }, [players, gameMode, wordData, unlockedHints, wrongGuesses]);


  // --- Computed for Mechanics ---
  const currentAlphabet = React.useMemo(() => {
    if (activeDebuffs.includes('SCRAMBLE')) {
      return [...ALPHABET].sort(() => Math.random() - 0.5);
    }
    return ALPHABET;
  }, [activeDebuffs, scrambleSeed]);

  // --- Actions ---

  const handleStartGame = async () => {
    if (loading) return;
    soundManager.playClick();
    setLoading(true);
    setStatus(GameStatus.IDLE);
    setUnlockedHints(1); // Reset hints on new game

    try {
      const data = await generateWord();

      // Add progressive hints (mock data for now)
      const enhancedData: WordData = {
        ...data,
        hints: [
          data.hint, // Hint 1 (Free)
          `Related to: ${data.difficulty} difficulty`, // Hint 2 (20%)
          `Category clue: Think carefully...`, // Hint 3 (40%)
          `Contains ${data.word.replace(/[A-Z]/g, '*').length} letters`, // Hint 4 (60%)
          `First letter is: ${data.word[0]}` // Hint 5 (80%)
        ]
      };

      if (gameMode === 'SINGLE') {
        setWordData(enhancedData);
        setGuessedLetters([]);
        setStatus(GameStatus.PLAYING);
        soundManager.playAmbient();
      } else if (amIHost) {
        // Host Broadcasts to everyone
        startGame(data);
        // Host sets their own local state via the callback/broadcast loop logic or manually:
        // In our hook, 'startGame' triggers broadcast. 
        // We also need to set local state. 
        setWordData(data);
        setGuessedLetters([]);
        setStatus(GameStatus.PLAYING);
        soundManager.playAmbient();
      }

    } catch (e) {
      console.error("Failed to start game", e);
    } finally {
      setLoading(false);
    }
  };


  // Sabotage Logic: Combo System (Consolidated)
  const handleGuess = useCallback((letter: string) => {
    if (status !== GameStatus.PLAYING || guessedLetters.includes(letter)) return;
    setGuessedLetters(prev => [...prev, letter]);

    const isCorrect = wordData?.word.includes(letter);
    const letterCount = wordData?.word.split('').filter(char => char === letter).length || 0;

    if (isCorrect) {
      setComboCount(prev => {
        const newCombo = prev + 1;

        // Calculate Energy Gain (Now Points)
        let energyGain = 3; // Base Correct Guess

        // Rule 1: Streak Bonus (2+ correct in a row)
        if (newCombo >= 2) energyGain += 3;

        // Rule 2: Multi-Hit Bonus (2+ letters revealed)
        if (letterCount >= 2) energyGain += 4;

        if (energyGain > 0) {
          setCurseEnergy(e => e + energyGain); // Uncapped points
        }

        return newCombo;
      });
      soundManager.playCorrect();
    } else {
      setComboCount(0); // Reset combo on miss
      setCurseEnergy(prev => Math.max(0, prev - 5)); // Penalty? No, just 0 gain. Actually maybe small penalty makes it harder? checking user request. User didn't specify penalty. I will leave it as no gain but reset combo.
      soundManager.playWrong();
    }
  }, [status, guessedLetters, wordData]);

  const onSoulMend = () => {
    if (curseEnergy < 20 || wrongGuesses === 0) return;
    setCurseEnergy(prev => prev - 20);
    // Heal logic: remove 1 wrong guess
    // We need to add a correct letter retroactively? Or just reduce wrongGuesses visually?
    // Actually, we track guessedLetters. To "heal", we remove the last wrong letter.
    const wrongLetters = guessedLetters.filter(l => wordData && !wordData.word.includes(l));
    if (wrongLetters.length > 0) {
      const lastWrong = wrongLetters[wrongLetters.length - 1];
      setGuessedLetters(prev => prev.filter(l => l !== lastWrong));
      soundManager.playWin();
    }
  };

  const onCastSpell = (spell: 'FOG' | 'SCRAMBLE' | 'JUMPSCARE') => {
    const cost = spell === 'FOG' ? 15 : spell === 'SCRAMBLE' ? 20 : 0;
    if (spell !== 'JUMPSCARE' && curseEnergy < cost) return;
    setSpellToCast(spell); // Enter selection mode
  };

  const handlePlayerSelect = (targetId: string) => {
    if (!spellToCast) return;
    const cost = spellToCast === 'FOG' ? 15 : spellToCast === 'SCRAMBLE' ? 20 : 0;

    // deduct points
    if (spellToCast !== 'JUMPSCARE') {
      setCurseEnergy(prev => Math.max(0, prev - cost));
    }

    castSpell(spellToCast, targetId);
    // setCurseEnergy(0); // No longer reset to 0
    setSpellToCast(null); // Exit selection mode
    soundManager.playWin(); // temporary sound for casting
    // Close mobile list if open
    setShowMobileList(false);
  };

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable typing in game if in menu or inputs
      if (gameMode !== 'SINGLE' && gameMode !== 'LOBBY_HOST' && gameMode !== 'LOBBY_JOIN') return;
      if (status !== GameStatus.PLAYING) return;

      const char = e.key.toUpperCase();
      if (ALPHABET.includes(char)) {
        handleGuess(char);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGuess, gameMode, status]);

  const copyToClipboard = () => {
    if (myId) {
      navigator.clipboard.writeText(myId);
      alert("Ritual Code copied!");
    }
  };

  const renderWord = () => {
    if (!wordData) return null;
    return (
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {wordData.word.split('').map((char, idx) => {
          if (char === ' ') return <div key={idx} className="w-6" />;
          const isGuessed = guessedLetters.includes(char) || status === GameStatus.LOST;
          return (
            <span
              key={idx}
              className={clsx(
                "w-8 h-10 md:w-12 md:h-14 border-b-4 flex items-center justify-center text-2xl md:text-4xl font-horror transition-all duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]",
                isGuessed ? "border-slate-500 text-red-100" : "border-slate-800 text-transparent",
                status === GameStatus.LOST && !guessedLetters.includes(char) && "text-red-600 border-red-900"
              )}
            >
              {isGuessed ? char : '_'}
            </span>
          );
        })}
      </div>
    );
  };

  // --- Views ---

  if (gameMode === 'MENU') {
    return (
      <div className="relative w-full h-screen bg-slate-950 overflow-hidden text-slate-100 flex items-center justify-center">
        <div className="absolute inset-0 z-0 opacity-50">
          <GameScene wrongGuesses={0} isWon={false} isLost={false} />
        </div>
        <div className="relative z-10 p-8 bg-black/80 backdrop-blur-md rounded-lg border border-red-900/50 text-center max-w-md w-full shadow-2xl shadow-red-900/20">
          <h1 className="text-6xl text-red-600 font-horror tracking-wider mb-2 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
            CURSED<span className="text-slate-100">MAN</span>
          </h1>
          <p className="text-slate-400 mb-8 italic">Choose your fate...</p>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => setGameMode('LOBBY_SETUP')}
              className="py-4 bg-red-950/80 hover:bg-red-900 text-red-100 rounded font-bold border-l-4 border-red-600 transition-all flex items-center justify-center gap-2"
            >
              <Users size={20} /> ENTER RITUAL (MULTIPLAYER)
            </button>

            <button
              onClick={() => setShowRules(true)}
              className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold border-l-4 border-slate-600 transition-all flex items-center justify-center gap-2"
            >
              <HelpCircle size={20} /> RITUAL GUIDE
            </button>
          </div>

          <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
        </div>
      </div>
    );
  }

  // Lobby Name Setup
  if (gameMode === 'LOBBY_SETUP') {
    return (
      <div className="relative w-full h-screen bg-black flex items-center justify-center text-slate-100">
        <div className="p-8 bg-slate-900 rounded border border-slate-700 w-full max-w-md">
          <button onClick={() => setGameMode('MENU')} className="text-slate-500 mb-4 hover:text-white">Back</button>
          <h2 className="text-2xl font-horror mb-4 text-red-500">IDENTIFY YOURSOUL</h2>
          <input
            className="w-full bg-black border border-slate-600 p-3 rounded mb-4 text-white focus:border-red-500 outline-none"
            placeholder="Enter Name..."
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={12}
          />
          <div className="flex gap-4">
            <button
              disabled={!username}
              onClick={() => {
                initializePeer(username, true);
                setGameMode('LOBBY_HOST');
              }}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded font-bold"
            >
              HOST RITUAL
            </button>
            <button
              disabled={!username}
              onClick={() => {
                initializePeer(username, false);
                setGameMode('LOBBY_JOIN');
              }}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-bold"
            >
              JOIN RITUAL
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Lobby / Waiting Room
  if ((gameMode === 'LOBBY_HOST' || gameMode === 'LOBBY_JOIN') && status === GameStatus.IDLE) {
    return (
      <div className="w-full h-screen bg-slate-950 flex flex-col md:flex-row gap-4 p-4 overflow-y-auto">
        {/* Left: Setup Panel */}
        <div className="flex-1 flex flex-col items-center justify-center bg-black/50 border border-slate-800 rounded relative min-h-[300px]">
          <button onClick={() => setGameMode('MENU')} className="absolute top-4 left-4 text-slate-500 hover:text-white">Exit</button>

          <h2 className="text-3xl font-horror mb-6 text-red-500">LOBBY</h2>

          {gameMode === 'LOBBY_HOST' ? (
            <div className="text-center w-full max-w-md">
              <p className="text-slate-400 mb-2">Ritual Code:</p>
              {myId ? (
                <div className="flex items-center gap-2 bg-slate-900 p-4 rounded border border-slate-600 mb-6">
                  <code className="text-2xl text-yellow-500 tracking-wider flex-1 overflow-hidden text-ellipsis">{myId}</code>
                  <button onClick={copyToClipboard} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white"><Copy size={20} /></button>
                </div>
              ) : <Loader2 className="animate-spin mx-auto mb-6" />}

              <button
                onClick={handleStartGame}
                disabled={loading || players.length < 1}
                className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded font-bold text-xl flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Play size={24} />}
                BEGIN RITUAL
              </button>
            </div>
          ) : (
            <div className="text-center w-full max-w-md">
              {connectionStatus === 'CONNECTED' ? (
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
                      disabled={connectionStatus === 'CONNECTING'}
                      className="bg-blue-600 px-6 rounded font-bold"
                    >
                      JOIN
                    </button>
                  </div>
                </>
              )}
              <p className="text-slate-500">Waiting for host to start...</p>
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

  // --- Main Game (Solo or Multiplayer) ---
  return (
    <div className="flex flex-col lg:flex-row w-full h-screen bg-slate-950 overflow-hidden text-slate-100">

      {/* 3D Scene Area */}
      {/* Mobile: Top 40%, Desktop: Flex Grow (Remaining Space) */}
      <div className="relative w-full h-[40vh] lg:h-full lg:flex-1 bg-black z-0 order-1 shadow-2xl lg:shadow-none">
        {/* JUMPSCARE OVERLAY */}
        {jumpscareVideo && (
          <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
            <video
              src={`/jumpscare/${jumpscareVideo}`}
              autoPlay
              className="w-full h-full object-cover"
              onEnded={() => setJumpscareVideo(null)}
              onError={() => setJumpscareVideo(null)}
            />
          </div>
        )}

        <GameScene isWon={status === GameStatus.WON} isLost={status === GameStatus.LOST} wrongGuesses={wrongGuesses} />

        {/* Persistent Game Log (Top Left of 3D Scene) */}
        <div className="absolute top-4 left-4 z-[10] w-full max-w-md pointer-events-none flex flex-col gap-1">
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

        {/* Mobile-Only Overlays that MUST be on top of scene (like toasts) could go here, but avoiding for now to keep scene clean */}
      </div>

      {/* UI Sidebar / Control Center */}
      {/* Mobile: Bottom 60%, Desktop: Fixed 450px Right Sidebar */}
      <div className="relative w-full h-[60vh] lg:h-full lg:w-[450px] lg:shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col order-2 z-10 shadow-2xl">

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col">

          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-horror text-red-600 tracking-wider">
                CURSED<span className="text-slate-100">MAN</span>
              </h1>
              {gameMode !== 'SINGLE' && (
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <User size={12} /> <span className="uppercase tracking-wider font-bold">{username}</span>
                </div>
              )}
            </div>
            {/* Desktop: Toggle Player List if needed, or just show it inline? Let's show inline at bottom */}
            {gameMode !== 'SINGLE' && (
              <div className="bg-slate-800 px-2 py-1 rounded text-xs text-slate-300 flex items-center gap-1">
                <Users size={12} /> {players.length}
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
            {loading ? (
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
                  {wordData?.word.split('').map((char, idx) => {
                    if (char === ' ') return <div key={idx} className="w-3" />;
                    const isGuessed = guessedLetters.includes(char) || status === GameStatus.LOST;
                    return (
                      <span
                        key={idx}
                        className={clsx(
                          "w-8 h-10 border-b-2 flex items-center justify-center text-2xl font-horror transition-all duration-300",
                          isGuessed ? "border-slate-500 text-red-100" : "border-slate-800 text-transparent",
                          status === GameStatus.LOST && !guessedLetters.includes(char) && "text-red-600 border-red-900"
                        )}
                      >
                        {isGuessed ? char : '_'}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Hint Display */}
          <div className="mb-6">
            <div className="space-y-2">
              {wordData?.hints ? (
                // Multi-hint system
                wordData.hints.slice(0, unlockedHints).map((hint, i) => (
                  <div key={i} className="bg-gradient-to-r from-purple-950/40 to-slate-900/40 p-3 rounded-lg border border-purple-500/30 animate-in slide-in-from-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Hint {i + 1}</span>
                      {i === 0 && <span className="text-[10px] text-slate-500">(Free)</span>}
                      {i > 0 && <span className="text-[10px] text-red-400">({i * 20}% Sacrifice)</span>}
                    </div>
                    <p className="text-slate-300 text-sm italic leading-relaxed">"{hint}"</p>
                  </div>
                ))
              ) : (
                // Fallback: Always show single hint if hints array doesn't exist
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
            {/* Fog Overlay Message */}
            {activeDebuffs.includes('FOG') && (
              <div className="absolute inset-0 z-50 flex items-center justify-center text-red-600 font-horror text-4xl animate-pulse tracking-widest drop-shadow-lg">
                BLINDED!
              </div>
            )}

            {/* Sabotage Shop */}
            {gameMode !== 'SINGLE' && (
              <div className="mb-4 flex items-center justify-between gap-3 bg-slate-900/50 p-2 rounded border border-slate-700/50">
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
                    onClick={() => onCastSpell('FOG')}
                    className="bg-purple-900/30 hover:bg-purple-800 disabled:opacity-30 border border-purple-500/50 text-purple-300 text-xs uppercase font-bold px-4 py-3 rounded transition-colors flex flex-col items-center leading-tight min-w-[70px]"
                  >
                    <span>FOG</span>
                    <span className="text-[10px] opacity-70">15pts</span>
                  </button>
                  <button
                    disabled={curseEnergy < 20}
                    onClick={() => onCastSpell('SCRAMBLE')}
                    className="bg-orange-900/30 hover:bg-orange-800 disabled:opacity-30 border border-orange-500/50 text-orange-300 text-xs uppercase font-bold px-4 py-3 rounded transition-colors flex flex-col items-center leading-tight min-w-[70px]"
                  >
                    <span>MIX</span>
                    <span className="text-[10px] opacity-70">20pts</span>
                  </button>
                  <button
                    disabled={curseEnergy < 20 || wrongGuesses === 0}
                    onClick={onSoulMend}
                    className="bg-green-900/30 hover:bg-green-800 disabled:opacity-30 border border-green-500/50 text-green-300 text-xs uppercase font-bold px-4 py-3 rounded transition-colors flex flex-col items-center leading-tight min-w-[70px]"
                  >
                    <span>HEAL</span>
                    <span className="text-[10px] opacity-70">20pts</span>
                  </button>
                  {status === GameStatus.WON && (
                    <button
                      onClick={() => onCastSpell('JUMPSCARE')}
                      className="bg-red-950/80 hover:bg-red-900 border border-red-600 text-red-500 hover:text-red-300 text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors animate-pulse"
                    >
                      Scare
                    </button>
                  )}
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
          {(gameMode === 'SINGLE' || amIHost) && status !== GameStatus.IDLE && status !== GameStatus.PLAYING && (
            <button
              onClick={handleStartGame}
              className="mt-6 w-full py-3 bg-red-900 hover:bg-red-800 text-white font-bold rounded flex items-center justify-center gap-2 transition-colors border-t border-red-700"
            >
              <RotateCcw size={18} /> RESTART RITUAL
            </button>
          )}
          {gameMode !== 'SINGLE' && !amIHost && status !== GameStatus.IDLE && status !== GameStatus.PLAYING && (
            <div className="mt-6 text-center text-slate-500 text-xs uppercase tracking-widest animate-pulse">
              Waiting for Host...
            </div>
          )}

          {/* Player List (Inline for Desktop Sidebar) */}
          {/* We can put it in a collapsable or just below if there's space. Let's make it a toggle or separate tab? 
                 Actually, just putting it at the bottom is safe since it scroll. */}
          {gameMode !== 'SINGLE' && (
            <div className="mt-8 border-t border-slate-800 pt-4">
              <PlayerList
                players={players}
                myId={myId}
                onPlayerSelect={handlePlayerSelect} // Re-enabled
                selectionMode={!!spellToCast}
              />
            </div>
          )}

        </div>

        {/* Persistent Game Log (Top Left) */}


        {/* Target Selection Modal (Dedicated Popup) */}
        {spellToCast && (
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
                    onClick={() => handlePlayerSelect(p.id)}
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
        )}
      </div>

    </div>
  );
}