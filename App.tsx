import React, { useState, useEffect, useCallback } from 'react';
import { GameScene } from './components/Scene';
import { generateWord } from './services/wordGenerator';
import { GameStatus, WordData, Player } from './types';
import { Play, RotateCcw, HelpCircle, Loader2, Trophy, Skull, Users, Copy, Link, User, ChevronLeft, ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';
import { soundManager } from './utils/SoundManager';
import { useMultiplayer } from './hooks/useMultiplayer';
import { PlayerList } from './components/PlayerList';
import { RulesModal } from './components/RulesModal';
import { Auth } from './components/Auth';
import { updateGameStats, supabase } from './utils/supabase';

const MAX_MISTAKES = 5;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const JUMPSCARE_VIDEOS = [
  '/jumpscare/vlipsy-creepy-face-jump-scare-3hEsFXt9.mp4',
  '/jumpscare/vlipsy-jump-scare-creepy-doll-nwbQ9bDF.mp4',
  '/jumpscare/vlipsy-winterrowd-jump-scare-IGMSPmB8.mp4'
];

export default function App() {
  // --- Local Game State ---
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [loading, setLoading] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [username, setUsername] = useState('');



  // --- Multiplayer State ---
  const [gameMode, setGameMode] = useState<'MENU' | 'SINGLE' | 'LOBBY_SETUP' | 'LOBBY_HOST' | 'LOBBY_JOIN'>('MENU');
  const [joinInputId, setJoinInputId] = useState('');
  const [showMobileList, setShowMobileList] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // --- Sabotage State ---
  const [curseEnergy, setCurseEnergy] = useState(20);
  const [comboCount, setComboCount] = useState(0);

  const [activeDebuffs, setActiveDebuffs] = useState<('FOG' | 'SCRAMBLE')[]>([]);
  const [scrambleSeed, setScrambleSeed] = useState(0); // Triggers re-shuffle
  const [spellToCast, setSpellToCast] = useState<'FOG' | 'SCRAMBLE' | 'JUMPSCARE' | null>(null); // For targeting mode
  const [lastSpellCastTime, setLastSpellCastTime] = useState(0); // Cooldown Tracker
  // Spectator State
  const [spectatingTargetId, setSpectatingTargetId] = useState<string | null>(null);
  const [autoNextRoundCountdown, setAutoNextRoundCountdown] = useState<number | null>(null);
  // Free Winner Powers (Tracking usage)
  const [winnerPowersUsed, setWinnerPowersUsed] = useState<{ FOG: boolean, SCRAMBLE: boolean, JUMPSCARE: boolean }>({ FOG: false, SCRAMBLE: false, JUMPSCARE: false });




  // Game Log (Persistant Notifications)
  const [gameLog, setGameLog] = useState<{ id: number, content: React.ReactNode }[]>([]);

  // Progressive Hints
  const [unlockedHints, setUnlockedHints] = useState(1);
  const [showHintUnlock, setShowHintUnlock] = useState(false);
  const [hasScared, setHasScared] = useState(false); // Spam prevention

  // Round State
  const [round, setRound] = useState(1);
  const [roundStartTime, setRoundStartTime] = useState<number>(0);
  const [totalTimeTaken, setTotalTimeTaken] = useState(0); // My Accumulative Time
  const [showGameOver, setShowGameOver] = useState(false);
  const [showJumpscare, setShowJumpscare] = useState(false);
  const [currentJumpscareVideo, setCurrentJumpscareVideo] = useState('');

  // Callbacks for Network
  const handleGameStart = useCallback((data: WordData, newRound: number) => {
    setWordData(data);
    setGuessedLetters([]);
    setRound(newRound); // Sync Round
    setRoundStartTime(Date.now()); // Start Timer!
    setStatus(GameStatus.PLAYING);
    if (newRound === 1) setTotalTimeTaken(0); // Reset time for new tournament
    // setCurseEnergy(0); // KEPT POINTS PERSISTENT (User Request)
    setActiveDebuffs([]);
    setUnlockedHints(1); // Reset hints on new game
    setHasScared(false); // Reset scare usage
    setWinnerPowersUsed({ FOG: false, SCRAMBLE: false, JUMPSCARE: false }); // Reset free powers

    // Cap Carry-Over Energy (Balance Fix)
    setCurseEnergy(prev => Math.min(prev, 30));

    // Auto-Close Spectator

    // Auto-Close Spectator
    setSpectatingTargetId(null);
    setSpectating(null);

    soundManager.playAmbient();
    soundManager.playClick();

    // Initial Log
    setGameLog(prev => [{ id: Date.now(), content: "THE RITUAL HAS BEGUN" }, ...prev]);
  }, []);

  const handleWorldUpdate = useCallback((players: Player[]) => {
  }, []);

  const handleSpellReceived = useCallback((spellId: 'FOG' | 'SCRAMBLE' | 'JUMPSCARE', casterName: string) => {
    soundManager.playWrong();

    if (spellId === 'JUMPSCARE') {
      const randomVideo = JUMPSCARE_VIDEOS[Math.floor(Math.random() * JUMPSCARE_VIDEOS.length)];
      setCurrentJumpscareVideo(randomVideo);
      setShowJumpscare(true);
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

  const handleCountdown = useCallback((count: number | null) => {
    setAutoNextRoundCountdown(count);
  }, []);



  // ... render logic ... 

  // (In JSX, replacing the Toast block)


  // (In JSX, replacing the Toast block)


  const { initializePeer, joinLobby, startGame, updateMyStatus, castSpell, setSpectating, broadcastCountdown, myId, roomId, players, connectionStatus, amIHost } = useMultiplayer(handleGameStart, handleWorldUpdate, handleSpellReceived, handleSpellLog, handleCountdown);

  // Check if Round 5 is complete (all players won/lost)
  useEffect(() => {
    // Only Host manages flow
    if (!amIHost || gameMode === 'SINGLE' || players.length === 0) return;

    // Check if EVERYONE is finished (WON or LOST)
    const allFinished = players.every(p => p.status === 'WON' || p.status === 'LOST');

    if (allFinished && status !== GameStatus.IDLE && !showGameOver) {
      // Auto-Next Round Sequence
      if (autoNextRoundCountdown === null) {
        setAutoNextRoundCountdown(5); // Start 5s timer
        broadcastCountdown(5);
      } else if (autoNextRoundCountdown > 0) {
        const timer = setTimeout(() => {
          setAutoNextRoundCountdown(c => {
            const val = c !== null ? c - 1 : 0;
            broadcastCountdown(val);
            return val;
          });
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        // Timer hit 0
        if (round < 5) {
          handleStartGame(); // Auto next round
          setAutoNextRoundCountdown(null);
          broadcastCountdown(null);
        } else {
          setShowGameOver(true);
          setAutoNextRoundCountdown(null);
          broadcastCountdown(null);
        }
      }
    } else {
      // Reset if condition breaks (e.g. new player joins?)
      if (autoNextRoundCountdown !== null && !showGameOver) setAutoNextRoundCountdown(null);
    }
  }, [round, players, gameMode, showGameOver, amIHost, status, autoNextRoundCountdown]);

  // Derived State
  const wrongGuesses = guessedLetters.filter(l =>
    wordData && !wordData.word.includes(l)
  ).length;

  const isWon = wordData
    ? wordData.word.split('').filter(c => c !== ' ').every(c => guessedLetters.includes(c))
    : false;

  const isLost = wrongGuesses >= MAX_MISTAKES;

  // --- Effects ---

  // Autofill Username from Auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        const name = session.user.email.split('@')[0];
        setUsername(name);
      }
    });

    // Initial check
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUsername(user.email.split('@')[0]);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Game End Logic
  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      if (isWon) {
        setStatus(GameStatus.WON);
        soundManager.playWin();

        // Calculate Time
        const timeTaken = Date.now() - roundStartTime;
        const newTotal = totalTimeTaken + timeTaken;
        setTotalTimeTaken(newTotal);

        updateMyStatus('WON', wrongGuesses, guessedLetters, newTotal);

        // Track Win Stats
        updateGameStats(true, timeTaken, hasScared ? 1 : 0);
      } else if (isLost) {
        setStatus(GameStatus.LOST);
        soundManager.playLose();
        // Failed round adds penalty time? Or just accumulated time until loss? 
        // User said "lowest time to spend all round to guess curword".
        // If lost, maybe max time or penalty? For now, let's just count time spent trying.
        const timeTaken = Date.now() - roundStartTime;
        const newTotal = totalTimeTaken + timeTaken;
        // NOTE: If they lost, they technically didn't guess it. 
        // Maybe add penalty? User didn't specify. Assuming simply time spent.
        setTotalTimeTaken(newTotal);

        updateMyStatus('LOST', wrongGuesses, guessedLetters, newTotal);

        // Track Loss Stats
        updateGameStats(false, timeTaken, hasScared ? 1 : 0);
      } else {
        // Still playing, report mistakes (and current accumulated time? No need until end)
        updateMyStatus('PLAYING', wrongGuesses, guessedLetters, totalTimeTaken);
      }
    }
  }, [guessedLetters, isWon, isLost, status, wrongGuesses]); // Added dependencies safely

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

    // Race Condition Guard: If local state is reset (new round) but players list matches old round (stale mistakes),
    // skip this calculation to prevent false auto-unlocks.
    if (guessedLetters.length === 0 && totalLost > 0) {
      return;
    }

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
    // Increment Round if we are already playing/played
    let nextRound = round;
    if (status !== GameStatus.IDLE) {
      nextRound = round + 1;
      setRound(nextRound);
    } else {
      // If IDLE (first game?), default 1 or keep?
      // If we just loaded, round is 1.
    }

    setStatus(GameStatus.IDLE);
    setUnlockedHints(1); // Reset hints on new game

    try {
      const data = await generateWord(usedWords);

      // Track used words to prevent repetition in this session
      setUsedWords(prev => {
        const newHistory = [...prev, data.word];
        return newHistory.slice(-10); // Keep last 10
      });

      // Use AI hints if available, otherwise fallback to generated ones (safety)
      const finalHints = data.hints && data.hints.length === 5 ? data.hints : [
        data.hint,
        `Related to: ${data.difficulty} difficulty`,
        `Category clue: Think carefully...`,
        `Contains ${data.word.length} letters`,
        `First letter is: ${data.word[0]}`
      ];

      const enhancedData: WordData = {
        ...data,
        hints: finalHints
      };

      if (gameMode === 'SINGLE') {
        // ... unused logic kept for type safety ...
        setWordData(enhancedData);
      } else if (amIHost) {
        startGame(enhancedData, nextRound);
        setWordData(enhancedData);
        setGuessedLetters([]);
        setStatus(GameStatus.PLAYING);
        soundManager.playAmbient();
      }

    } catch (e: any) {
      console.error("Failed to start game", e);
      soundManager.playWrong();

      let errorMsg = "Ritual Failed: Could not summon a word.";
      let detailedMsg = "";

      if (e.message === "API_LIMIT_EXCEEDED" || e.message?.includes("429")) {
        errorMsg = "🚫 API QUOTA EXCEEDED";
        detailedMsg = "You've reached the free tier limit for the Gemini API. Please wait ~30 seconds and try again, or check your API quota at ai.google.dev";
      }

      setGameLog(prev => [{
        id: Date.now(),
        content: (
          <div className="text-red-600 font-bold">
            <div className="text-lg mb-1">{errorMsg}</div>
            {detailedMsg && <div className="text-sm text-red-400 font-normal">{detailedMsg}</div>}
          </div>
        )
      }, ...prev]);

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
          // Underdog Bonus (Balance Fix)
          if (wrongGuesses >= 4) energyGain *= 2;

          setCurseEnergy(e => e + energyGain); // Uncapped points
        }

        return newCombo;
      });
      soundManager.playCorrect();
    } else {
      setComboCount(0); // Reset combo on miss
      // setCurseEnergy(prev => Math.max(0, prev - 5)); // Penalty removed as per request
      soundManager.playWrong();
    }
  }, [status, guessedLetters, wordData]);

  const onSoulMend = () => {
    if (curseEnergy < 40 || wrongGuesses === 0) return;
    setCurseEnergy(prev => prev - 40);
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
    // Cooldown Check (Balance Fix)
    if (Date.now() - lastSpellCastTime < 10000) {
      soundManager.playWrong();
      setGameLog(prev => [{
        id: Date.now(),
        content: <span className="text-orange-500 font-bold">SPELL COOLDOWN! (Wait 10s)</span>
      }, ...prev]);
      return;
    }

    const cost = spell === 'FOG' ? 20 : spell === 'SCRAMBLE' ? 20 : 0;

    // Check constraints
    if (spell !== 'JUMPSCARE' && curseEnergy < cost) {
      soundManager.playWrong();
      setGameLog(prev => [{
        id: Date.now(),
        content: <span className="text-red-500 font-bold shake">NOT ENOUGH ENERGY! ({cost} CP)</span>
      }, ...prev]);
      return;
    }

    // Jumpscare Restriction: Only if YOU WON? Or cost?
    // User request implies manual selection. Letting it be free/selectable for now or check 'isWon'?
    // Screenshot said "WIN". Usually means "Only usable when you won".
    if (spell === 'JUMPSCARE' && status !== GameStatus.WON) {
      soundManager.playWrong();
      setGameLog(prev => [{
        id: Date.now(),
        content: <span className="text-red-500 font-bold">MUST WIN TO JUMPSCARE!</span>
      }, ...prev]);
      return;
    }

    setSpellToCast(spell); // Enter selection mode
  };

  const handlePlayerSelect = (targetId: string) => {
    if (!spellToCast) return;
    const cost = spellToCast === 'FOG' ? 20 : spellToCast === 'SCRAMBLE' ? 20 : 0;

    // deduct points
    if (spellToCast !== 'JUMPSCARE') {
      setCurseEnergy(prev => Math.max(0, prev - cost));
    }

    castSpell(spellToCast, targetId);
    // setCurseEnergy(0); // No longer reset to 0
    setSpellToCast(null); // Exit selection mode
    setLastSpellCastTime(Date.now()); // Start Cooldown
    soundManager.playWin(); // temporary sound for casting
    soundManager.playWin(); // temporary sound for casting
    if (spellToCast === 'JUMPSCARE') setHasScared(true);
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGuess, gameMode, status]);

  // Winner Power Logic
  const castWinnerSpell = (spell: 'FOG' | 'SCRAMBLE' | 'JUMPSCARE') => {
    if (!spectatingTargetId || status !== GameStatus.WON) return;
    if (winnerPowersUsed[spell]) return;

    // Cast spell directly on target (bypass point cost)
    castSpell(spell, spectatingTargetId);

    // Mark as used
    setWinnerPowersUsed(prev => ({ ...prev, [spell]: true }));

    soundManager.playWin(); // Feedback sound
    if (spell === 'JUMPSCARE') setHasScared(true);
  };

  // Spectator Helper
  const targetPlayer = spectatingTargetId ? players.find(p => p.id === spectatingTargetId) : null;
  // If spectating, use THEIR wrongGuesses, otherwise mine
  const displayWrongGuesses = targetPlayer ? targetPlayer.mistakes : wrongGuesses;
  // If spectating, we might want to see THEIR board?
  // We need to render THEIR word state.
  // We have `targetPlayer.guessedLetters`.
  const displayGuessedLetters = targetPlayer ? targetPlayer.guessedLetters : guessedLetters;

  // Also who is watching ME?
  const mySpectators = players.filter(p => p.spectatingId === myId).map(p => p.name);

  // Cycle Spectator
  const cycleSpectator = (direction: -1 | 1) => {
    if (!spectatingTargetId) return;

    // Get list of valid targets (ACTIVE players, excluding me)
    const validTargets = players.filter(p => p.id !== myId && p.status === 'PLAYING');
    if (validTargets.length === 0) return;

    const currentIndex = validTargets.findIndex(p => p.id === spectatingTargetId);
    if (currentIndex === -1) {
      // If current target is no longer valid (e.g. they died or disconnected), pick first
      setSpectatingTargetId(validTargets[0].id);
      setSpectating(validTargets[0].id);
      return;
    }

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = validTargets.length - 1;
    if (nextIndex >= validTargets.length) nextIndex = 0;

    const nextTarget = validTargets[nextIndex];
    setSpectatingTargetId(nextTarget.id);
    setSpectating(nextTarget.id);
  };

  // Auto-Switch Spectator on Win/Loss
  useEffect(() => {
    if (spectatingTargetId && targetPlayer && targetPlayer.status !== 'PLAYING') {
      // Allow a moment to see the result (Victory/Defeat)
      const timer = setTimeout(() => {
        // Re-check validity in case it changed during timeout
        const currentTarget = players.find(p => p.id === spectatingTargetId);
        if (!currentTarget || currentTarget.status !== 'PLAYING') {
          const validTargets = players.filter(p => p.id !== myId && p.status === 'PLAYING');
          if (validTargets.length > 0) {
            // Switch to next available
            setSpectatingTargetId(validTargets[0].id);
            setSpectating(validTargets[0].id);
          } else {
            // No one left, close
            setSpectatingTargetId(null);
            setSpectating(null);
          }
        }
      }, 2000); // 2 second delay
      return () => clearTimeout(timer);
    }
  }, [spectatingTargetId, targetPlayer, players, myId]);

  const copyToClipboard = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
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
                (status === GameStatus.LOST || (spectatingTargetId && targetPlayer?.status === 'LOST')) && !displayGuessedLetters.includes(char) && "text-red-600 border-red-900"
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
        {/* Auth Top Right */}
        <div className="fixed top-6 right-6 z-50">
          <Auth />
        </div>

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
              {roomId ? (
                <div className="flex items-center gap-2 bg-slate-900 p-4 rounded border border-slate-600 mb-6">
                  <code className="text-2xl text-yellow-500 tracking-wider flex-1 overflow-hidden text-ellipsis">{roomId}</code>
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

              {/* Error Display */}
              {gameLog.length > 0 && gameLog[0].content && (
                <div className="mt-4 p-4 bg-red-950/50 border-2 border-red-600 rounded-lg animate-pulse">
                  {gameLog[0].content}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center w-full max-w-md">
              {connectionStatus === 'CONNECTED' && players.length > 0 ? (
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
                      disabled={connectionStatus === 'CONNECTING' || !joinInputId}
                      className="bg-blue-600 px-6 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connectionStatus === 'CONNECTING' ? <Loader2 className="animate-spin" /> : 'JOIN'}
                    </button>
                  </div>
                  {connectionStatus === 'DISCONNECTED' && joinInputId && (
                    <p className="text-red-500 text-xs mt-2">
                      {/* Only show if we tried and failed - simpler heuristic might be needed or just show status */}
                    </p>
                  )}
                  {/* Connection Help */}
                  <p className="text-xs text-slate-600 mt-2">
                    Stuck connecting? Ensure Host and you are on the same version/server.
                  </p>
                </>
              )}
              <p className="text-slate-500">
                {players.length > 0 ? "Waiting for host to start..." : "Enter code to join..."}
              </p>
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

  // --- Game Over / Winner Screen (After Round 5) ---
  if (showGameOver && gameMode !== 'SINGLE') {
    // Calculate leaderboard based on Time (Lowest is Best)
    // Filter out those with 0 time (if any bug) or treat them as last?
    // Assuming everyone played.
    const sortedPlayers = [...players].sort((a, b) => (a.totalTime || 0) - (b.totalTime || 0));
    const top3 = sortedPlayers.slice(0, 3);

    const handleNewGame = () => {
      // Reset everything and go back to lobby
      setShowGameOver(false);
      setRound(1);
      setCurseEnergy(20);
      setStatus(GameStatus.IDLE);
      setWordData(null);
      setGuessedLetters([]);
      // Reset player scores would need to be broadcast by host
      soundManager.playClick();
    };

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
              onClick={handleNewGame}
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

  // --- Main Game (Solo or Multiplayer) ---
  return (
    <div className="flex flex-col lg:flex-row w-full h-screen bg-slate-950 overflow-hidden text-slate-100">

      {/* 3D Scene Area */}
      {/* Mobile: Top 40%, Desktop: Flex Grow (Remaining Space) */}
      <div className="relative w-full h-[40vh] lg:h-full lg:flex-1 bg-black z-0 order-1 shadow-2xl lg:shadow-none">
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

        <GameScene isWon={status === GameStatus.WON || (!!targetPlayer && targetPlayer.status === 'WON')} isLost={status === GameStatus.LOST || (!!targetPlayer && targetPlayer.status === 'LOST')} wrongGuesses={displayWrongGuesses} />

        {/* Spectator Overlay */}


        {/* Next Round Countdown Overlay */}
        {autoNextRoundCountdown !== null && (
          <div className="absolute inset-0 z-[50] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center">
              <h2 className="text-4xl font-horror text-red-500 mb-2">ROUND OVER</h2>
              <p className="text-slate-300 mb-4">Prepare for the next ritual...</p>
              <div className="text-6xl font-bold text-white animate-ping">{autoNextRoundCountdown}</div>
            </div>
          </div>
        )
        }

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
              <div className="flex items-center gap-2">
                {gameMode !== 'SINGLE' && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <User size={12} /> <span className="uppercase tracking-wider font-bold">{username}</span>
                    <User size={12} /> <span className="uppercase tracking-wider font-bold">{username}</span>
                  </div>
                )}
              </div>
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
                    const isGuessed = displayGuessedLetters.includes(char) || status === GameStatus.LOST || (targetPlayer?.status === 'LOST');
                    return (
                      <span
                        key={idx}
                        className={clsx(
                          "w-8 h-10 border-b-2 flex items-center justify-center text-2xl font-horror transition-all duration-300",
                          isGuessed ? "border-slate-500 text-red-100" : "border-slate-800 text-transparent",
                          (status === GameStatus.LOST || (targetPlayer?.status === 'LOST')) && !displayGuessedLetters.includes(char) && "text-red-600 border-red-900"
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
              <div className="mb-4 space-y-2">
                {/* Main Powers Row */}
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
                      onClick={() => onCastSpell('FOG')}
                      className="bg-purple-900/30 hover:bg-purple-800 disabled:opacity-30 border border-purple-500/50 text-purple-300 text-xs uppercase font-bold px-4 py-3 rounded transition-colors flex flex-col items-center leading-tight min-w-[70px]"
                    >
                      <span>FOG</span>
                      <span className="text-[10px] opacity-70">20pts</span>
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
                      disabled={curseEnergy < 40 || wrongGuesses === 0}
                      onClick={onSoulMend}
                      className="bg-green-900/30 hover:bg-green-800 disabled:opacity-30 border border-green-500/50 text-green-300 text-xs uppercase font-bold px-4 py-3 rounded transition-colors flex flex-col items-center leading-tight min-w-[70px]"
                    >
                      <span>HEAL</span>
                      <span className="text-[10px] opacity-70">40pts</span>
                    </button>
                  </div>
                </div>

                {/* Scare Button - Separate Row Below */}
                {status === GameStatus.WON && (
                  <button
                    disabled={hasScared}
                    onClick={() => onCastSpell('JUMPSCARE')}
                    className={clsx(
                      "w-full border-2 text-sm uppercase font-bold px-4 py-3 rounded transition-colors flex items-center justify-center gap-2",
                      hasScared
                        ? "bg-slate-900 border-slate-700 text-slate-500 cursor-not-allowed opacity-50"
                        : "bg-red-950/80 hover:bg-red-900 border-red-600 text-red-300 hover:text-red-100 animate-pulse"
                    )}
                  >
                    {hasScared ? "ALREADY SCARED" : "💀 JUMPSCARE"}
                  </button>
                )}
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

          {/* Restart Button - HIDDEN for Host in Multiplayer if not everyone finished (controlled by auto-logic) */}
          {/* Actually, Host can force start if they really want? But user asked "Wait for all". Let's hide it or disable it. */}
          {(gameMode === 'SINGLE' || (amIHost && players.every(p => p.status !== 'PLAYING'))) && status !== GameStatus.IDLE && status !== GameStatus.PLAYING && (
            <button
              onClick={handleStartGame}
              // Disable if countdown is running to prevent double click? Or let it override?
              className="mt-6 w-full py-3 bg-red-900 hover:bg-red-800 text-white font-bold rounded flex items-center justify-center gap-2 transition-colors border-t border-red-700"
            >
              <RotateCcw size={18} /> {status === GameStatus.WON || status === GameStatus.LOST ? `START ROUND ${round + 1}` : 'RESTART RITUAL'}
            </button>
          )}


          {/* Spectator Controls (If dead/won) */}
          {(status === GameStatus.WON || status === GameStatus.LOST) && !spectatingTargetId && gameMode !== 'SINGLE' && (
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
          )}

          {gameMode !== 'SINGLE' && !amIHost && status !== GameStatus.IDLE && status !== GameStatus.PLAYING && (
            <div className="mt-6 text-center text-slate-500 text-xs uppercase tracking-widest animate-pulse">
              {autoNextRoundCountdown !== null ? `Starting Round ${round + 1} in ${autoNextRoundCountdown}...` : "Waiting for all players..."}
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

      {/* Spectator Window Modal */}
      {spectatingTargetId && targetPlayer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-300">
          <div className="w-full max-w-5xl bg-slate-950 border-2 border-red-600 rounded-lg shadow-2xl shadow-red-900/50 flex flex-col h-[85vh] overflow-hidden">

            {/* Window Header */}
            <div className="flex items-center justify-between p-2 md:p-4 bg-red-950/30 border-b border-red-900/50 shrink-0">
              <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                <button onClick={() => cycleSpectator(-1)} className="p-2 bg-black/40 hover:bg-red-900/40 rounded text-red-200 transition-colors shrink-0">
                  <ChevronLeft size={20} />
                </button>
                <div className="text-center overflow-hidden">
                  <div className="text-[10px] md:text-xs text-red-400 font-bold tracking-[0.2em] uppercase truncate">SPECTATING</div>
                  <div className="text-lg md:text-2xl font-horror text-white tracking-wider truncate max-w-[120px] md:max-w-xs">{targetPlayer.name}</div>
                </div>
                <button onClick={() => cycleSpectator(1)} className="p-2 bg-black/40 hover:bg-red-900/40 rounded text-red-200 transition-colors shrink-0">
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="flex items-center gap-2 md:gap-4 shrink-0">
                {/* Status Badge */}
                <div className={clsx(
                  "px-2 py-1 md:px-3 md:py-1 rounded text-[10px] md:text-xs font-bold uppercase tracking-wider border",
                  targetPlayer.status === 'WON' ? "bg-green-950 text-green-400 border-green-800" :
                    targetPlayer.status === 'LOST' ? "bg-red-950 text-red-400 border-red-800" :
                      "bg-blue-950 text-blue-400 border-blue-800"
                )}>
                  {targetPlayer.status}
                </div>

                <button
                  onClick={() => { setSpectatingTargetId(null); setSpectating(null); }}
                  className="p-2 md:px-4 md:py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded font-bold transition-colors border border-slate-600 flex items-center justify-center"
                >
                  <span className="hidden md:inline">CLOSE VIEW</span>
                  <X size={20} className="md:hidden" />
                </button>
              </div>
            </div>

            {/* Window Body */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

              {/* Visuals (Scene) */}
              <div className="flex-1 bg-black relative min-h-[30vh] md:min-h-[40vh]">
                <GameScene
                  isWon={targetPlayer.status === 'WON'}
                  isLost={targetPlayer.status === 'LOST'}
                  wrongGuesses={targetPlayer.mistakes}
                />
              </div>

              {/* Controls / Info (Right Panel) */}
              <div className="w-full lg:w-[400px] bg-slate-900/50 border-t lg:border-t-0 lg:border-l border-slate-800 p-6 flex flex-col overflow-y-auto">

                {/* Target's Word Progress */}
                <div className="mb-8">
                  <h3 className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-4">Target's Ritual</h3>
                  <div className="flex flex-wrap justify-center gap-2">
                    {wordData?.word.split('').map((char, idx) => {
                      if (char === ' ') return <div key={idx} className="w-4" />;
                      const isGuessed = targetPlayer.guessedLetters.includes(char) || targetPlayer.status === 'LOST';
                      // Checking "LOST" logic to reveal word if they lost
                      return (
                        <span
                          key={idx}
                          className={clsx(
                            "w-8 h-10 border-b-2 flex items-center justify-center text-xl font-horror transition-all",
                            isGuessed ? "border-slate-500 text-slate-200" : "border-slate-800 text-transparent",
                            (targetPlayer.status === 'LOST') && !targetPlayer.guessedLetters.includes(char) && "text-red-600 border-red-900"
                          )}
                        >
                          {isGuessed ? char : '_'}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Target's Inputs (Keyboard) */}
                <div className="mb-6">
                  <h3 className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-4">Keyboard State</h3>
                  <div className="grid grid-cols-7 gap-1 opacity-80 pointer-events-none">
                    {ALPHABET.map(letter => {
                      const isGuessed = targetPlayer.guessedLetters.includes(letter);
                      const isCorrect = wordData?.word.includes(letter);
                      return (
                        <div
                          key={letter}
                          className={clsx(
                            "aspect-square rounded flex items-center justify-center font-bold text-xs border",
                            isGuessed
                              ? (isCorrect ? "bg-green-900/40 text-green-500 border-green-800" : "bg-red-900/30 text-red-500 border-red-900/50")
                              : "bg-slate-800 text-slate-600 border-slate-700"
                          )}
                        >
                          {letter}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Winner Powers & Mistakes */}
                <div className="mt-auto space-y-4">
                  {status === GameStatus.WON && (
                    <div className="bg-red-950/20 p-4 rounded border border-red-900/30">
                      <h3 className="text-red-400 text-[10px] uppercase font-bold tracking-widest mb-3 flex items-center gap-2">
                        <Trophy size={12} /> Winner Powers
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => castWinnerSpell('FOG')}
                          disabled={winnerPowersUsed.FOG}
                          className={clsx(
                            "flex-1 py-2 text-[10px] font-bold uppercase rounded border transition-all",
                            winnerPowersUsed.FOG
                              ? "bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed"
                              : "bg-purple-900/40 hover:bg-purple-800 text-purple-300 border-purple-500/50"
                          )}
                        >
                          Fog
                        </button>
                        <button
                          onClick={() => castWinnerSpell('SCRAMBLE')}
                          disabled={winnerPowersUsed.SCRAMBLE}
                          className={clsx(
                            "flex-1 py-2 text-[10px] font-bold uppercase rounded border transition-all",
                            winnerPowersUsed.SCRAMBLE
                              ? "bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed"
                              : "bg-orange-900/40 hover:bg-orange-800 text-orange-300 border-orange-500/50"
                          )}
                        >
                          Mix
                        </button>
                        <button
                          onClick={() => castWinnerSpell('JUMPSCARE')}
                          disabled={winnerPowersUsed.JUMPSCARE}
                          className={clsx(
                            "flex-1 py-2 text-[10px] font-bold uppercase rounded border transition-all",
                            winnerPowersUsed.JUMPSCARE
                              ? "bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed"
                              : "bg-red-900/40 hover:bg-red-800 text-red-300 border-red-500/50"
                          )}
                        >
                          Scare
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2 text-center italic">
                        1 free use per round.
                      </p>
                    </div>
                  )}

                  <div className="bg-slate-800/50 p-4 rounded text-center">
                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Mistakes</div>
                    <div className="text-3xl font-horror text-red-500">{targetPlayer.mistakes} / {MAX_MISTAKES}</div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}