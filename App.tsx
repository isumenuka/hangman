import React, { useState, useEffect, useCallback } from 'react';
import { GameScene } from './components/Scene';
import { Lobby } from './components/game/Lobby';
import { GameOver } from './components/game/GameOver';
import { GameSceneOverlay } from './components/game/GameSceneOverlay';
import { GameSidebar } from './components/game/GameSidebar';
import { DailyChallenge } from './components/game/DailyChallenge';
import { generateWord, generateTournamentBatch } from './services/wordGenerator';
import { GameStatus, WordData, Player, AtmosphereType } from './types';
import { Play, RotateCcw, HelpCircle, Loader2, Trophy, Skull, Users, Copy, Link, User, ChevronLeft, ChevronRight, X, Eye, Scroll, Clock } from 'lucide-react';
import clsx from 'clsx';
import { soundManager } from './utils/SoundManager';
import { useMultiplayer } from './hooks/useMultiplayer';
import { PlayerList } from './components/PlayerList';
import { RulesModal } from './components/RulesModal';
import { Auth } from './components/Auth';
import { GlobalLeaderboard } from './components/GlobalLeaderboard';
import { updateGameStats, supabase, logGameHistory } from './utils/supabase';
import { consultGameMaster } from './services/gameMaster';
import { getBotAction } from './services/imposter';
import { getOracleHint, generateRoast, generateGlitchText, getRitualPhrase } from './services/powers';
import { composeTheme } from './services/composer';
import { AudioEngine } from './utils/AudioEngine';
import ShaderBackground from './components/ShaderBackground';

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
  const [loadingDifficulty, setLoadingDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | null>(null);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [username, setUsername] = useState('');

  // --- Gemini 2.0 Feature State ---
  const [wordQueue, setWordQueue] = useState<WordData[]>([]);
  const [prophecy, setProphecy] = useState<string | null>(null);
  const [showProphecy, setShowProphecy] = useState(false);
  const [showRitualInput, setShowRitualInput] = useState(false);
  const [ritualPhrase, setRitualPhrase] = useState('');
  const [userRitualInput, setUserRitualInput] = useState('');
  const [revealedHints, setRevealedHints] = useState(1);

  // --- Audio State ---
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  // --- GM State ---
  const [gmNarrative, setGmNarrative] = useState<string | null>(null);
  const [activeRule, setActiveRule] = useState<'NONE' | 'VOWELS_DISABLED' | 'Invert_Controls' | 'SILENCE'>('NONE');
  const [atmosphere, setAtmosphere] = useState<AtmosphereType>('NONE');

  // --- COMPOSER EFFECT ---
  useEffect(() => {
    if (!wordData || !audioEnabled) return;

    const compose = async () => {
      setIsComposing(true);
      try {
        console.log("Composing theme for:", wordData.word);
        const composition = await composeTheme(wordData.word, atmosphere);
        console.log("Composition ready:", composition);
        AudioEngine.playComposition(composition);
      } catch (e) {
        console.error("Composition failed", e);
      } finally {
        setIsComposing(false);
      }
    };
    compose();

    // Cleanup when word changes or component unmounts
    return () => {
      // Optional: AudioEngine.stop(); // Maybe keep playing until next track?
    };
  }, [wordData, atmosphere, audioEnabled]);


  // --- Multiplayer State ---
  const [gameMode, setGameMode] = useState<'MENU' | 'SINGLE' | 'LOBBY_SETUP' | 'LOBBY_HOST' | 'LOBBY_JOIN' | 'DAILY'>('MENU');
  const [joinInputId, setJoinInputId] = useState('');
  const [showMobileList, setShowMobileList] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // --- Sabotage State ---
  const [curseEnergy, setCurseEnergy] = useState(100);
  const [comboCount, setComboCount] = useState(0);

  const [activeDebuffs, setActiveDebuffs] = useState<('FOG' | 'SCRAMBLE')[]>([]);
  const [scrambleSeed, setScrambleSeed] = useState(0); // Triggers re-shuffle
  // const [spellToCast, setSpellToCast] = useState<'FOG' | 'SCRAMBLE' | 'JUMPSCARE' | null>(null); // MOVED TO SIDEBAR
  // const [lastSpellCastTime, setLastSpellCastTime] = useState(0); // MOVED TO SIDEBAR
  // Spectator State
  const [spectatingTargetId, setSpectatingTargetId] = useState<string | null>(null);
  const [autoNextRoundCountdown, setAutoNextRoundCountdown] = useState<number | null>(null);
  // Free Winner Powers (Tracking usage)
  const [winnerPowersUsed, setWinnerPowersUsed] = useState<{ FOG: boolean, SCRAMBLE: boolean, JUMPSCARE: boolean }>({ FOG: false, SCRAMBLE: false, JUMPSCARE: false });

  const handlePerformSpellAction = (spell: 'FOG' | 'SCRAMBLE' | 'JUMPSCARE', targetId: string) => {
    const cost = spell === 'FOG' ? 20 : spell === 'SCRAMBLE' ? 20 : 0;
    if (spell !== 'JUMPSCARE') {
      setCurseEnergy(prev => Math.max(0, prev - cost));
    }
    castSpell(spell, targetId);

    if (spell === 'JUMPSCARE') {
      setHasScared(true);
      setTotalScaresUsed(prev => prev + 1);
    }
    soundManager.playWin();
  };




  // Game Log (Persistant Notifications)
  const [gameLog, setGameLog] = useState<{ id: number, content: React.ReactNode }[]>([]);

  // Progressive Hints
  const [unlockedHints, setUnlockedHints] = useState(1);
  const [showHintUnlock, setShowHintUnlock] = useState(false);
  const [showVisualRiddle, setShowVisualRiddle] = useState(false); // Visual Hint Toggle
  const [hasScared, setHasScared] = useState(false); // Spam prevention

  // Round State
  const [round, setRound] = useState(1);
  const [roundStartTime, setRoundStartTime] = useState<number>(0);
  const [totalTimeTaken, setTotalTimeTaken] = useState(0); // My Accumulative Time
  const [totalScaresUsed, setTotalScaresUsed] = useState(0); // My Accumulative Scares
  const [showGameOver, setShowGameOver] = useState(false);
  const [showJumpscare, setShowJumpscare] = useState(false);
  const [currentJumpscareVideo, setCurrentJumpscareVideo] = useState('');
  const [showDailyLogic, setShowDailyLogic] = useState(false);

  // --- GM Logic ---
  const triggerGM = async () => {
    if (!wordData || !amIHost) return; // Only Host triggers GM in multiplayer
    try {
      const response = await consultGameMaster({
        word: wordData.word,
        guessedLetters,
        wrongGuesses,
        playerNames: players.map(p => p.name),
        recentAction: "Game Update",
        streak: comboCount
      });

      console.log("GM Spoke:", response);
      if (response.narrative) {
        setGmNarrative(response.narrative);
        // Broadcast narrative? For now local, but ideally host broadcasts narrative.
        // Since we are in Hackathon mode, local effect for Host or Sync is fine.
        // Let's keep it simple: Host sees it, maybe we sync later.
        setTimeout(() => setGmNarrative(null), 8000);
      }

      if (response.rule_change && response.rule_change !== 'NONE') {
        setActiveRule(response.rule_change as any);
        setTimeout(() => setActiveRule('NONE'), 30000); // 30s rule duration
      }

      if (response.atmosphere && response.atmosphere !== 'NONE') {
        setAtmosphere(response.atmosphere as any);
      }

    } catch (e) {
      console.error("GM Failed", e);
    }
  };

  // Trigger GM on specific events (e.g. every 3 guesses)
  useEffect(() => {
    if (status === GameStatus.PLAYING && guessedLetters.length > 0 && guessedLetters.length % 3 === 0) {
      triggerGM();
    }
  }, [guessedLetters.length, status]);



  // Callbacks for Network
  const handleGameStart = useCallback((data: WordData, newRound: number) => {
    setWordData(data);
    setGuessedLetters([]);
    setRound(newRound); // Sync Round
    setRoundStartTime(Date.now()); // Start Timer!
    setStatus(GameStatus.PLAYING);
    if (newRound === 1) {
      setTotalTimeTaken(0); // Reset time for new tournament
      setTotalScaresUsed(0); // Reset scares for new tournament
    }
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

  const handleMessage = useCallback((sender: string, text: string, isSystem?: boolean) => {
    // Logic: If Silence Rule is active, punish sender!
    if (activeRule === 'SILENCE' && !isSystem && sender === username) {
      // Ideally we check if 'sender' is ME. But sender is a string name here.
      // We rely on 'sender === username'. 
      // Punishment: Remove random revealed letter or Add Mistake?
      // Let's add Mistake for immediate impact.
      // But we need to call updateMyStatus? 
      // Simpler: Just Visual Feedback + Warning for now, mechanics are tricky inside callback.
      // ACTUALLY: We can trigger a "glitch" or sound.
      soundManager.playWrong();
      setGameLog(prev => [{ id: Date.now(), content: <span className="text-red-600 font-bold uppercase">THE SPIRIT DEMANDS SILENCE!</span> }, ...prev]);
      // Proceed to send message anyway, but maybe red?
    }

    const content = isSystem ? (
      <span className="text-red-500 font-bold uppercase tracking-widest animate-pulse border-l-2 border-red-500 pl-2 block my-1 shadow-[0_0_10px_rgba(220,38,38,0.5)]">{text}</span>
    ) : (
      <span className="text-blue-300">
        <span className="font-bold text-blue-500">{sender}:</span> {text}
      </span>
    );
    setGameLog(prev => [{ id: Date.now(), content }, ...prev]);
  }, [activeRule, username]);



  // ... render logic ... 

  // (In JSX, replacing the Toast block)


  // (In JSX, replacing the Toast block)



  const { initializePeer, joinLobby, startGame, updateMyStatus, castSpell, setSpectating, broadcastCountdown, spawnBot, updateBot, sendMessage, myId, currentRoomId: roomId, players, connectionStatus, amIHost } = useMultiplayer(handleGameStart, handleWorldUpdate, handleSpellReceived, handleSpellLog, handleMessage, handleCountdown);
  console.log('DEBUG: useMultiplayer result:', { /* spawnBot, updateBot, */ roomId, myId });

  // --- Gemini Power Handlers ---
  const handleOracle = async () => {
    if (!wordData || curseEnergy < 15) return;
    setCurseEnergy(prev => prev - 15);
    setGameLog(prev => [{ id: Date.now(), content: <span className="text-purple-400 italic">Consulting the Oracle...</span> }, ...prev]);

    // Using a timeout to not block UI if heavy? No, async is fine.
    try {
      const hint = await getOracleHint(wordData.word);
      // Oracle is personal or public? Use sendMessage for public.
      // Let's make it public fun.
      sendMessage(`THE ORACLE SPEAKS:\n${hint}`, false);
      // Actually false -> standard chat style, but maybe I want special formatting?
      // Let's pass "System" true for big impact.
      // sendMessage(`🔮 ORACLE: ${hint}`, true);
    } catch (e) { console.error(e); }
  };

  const handleRoast = async () => {
    if (curseEnergy < 10) return;
    setCurseEnergy(prev => prev - 10);
    const target = players.find(p => !p.isHost && p.status === 'PLAYING') || players[Math.floor(Math.random() * players.length)];
    if (!target) return;

    try {
      const roast = await generateRoast(target.name, target.mistakes, target.roundScore);
      sendMessage(`🔥 ${roast}`, true);
    } catch (e) { console.error(e); }
  };

  const handleGlitch = async () => {
    if (curseEnergy < 25) return;
    setCurseEnergy(prev => prev - 25);

    try {
      const glitch = await generateGlitchText();
      sendMessage(`👾 SYSTEM_ERR: ${glitch}`, true);
    } catch (e) { console.error(e); }
  };

  // --- Bot Control Loop ---
  useEffect(() => {
    if (!amIHost || status !== GameStatus.PLAYING || !wordData) return;

    const botInterval = setInterval(async () => {
      // Find active bots
      const activeBots = players.filter(p => p.isBot && p.status === 'PLAYING');
      if (activeBots.length === 0) return;

      // Pick a random bot to act (to avoid spamming if multiple)
      const bot = activeBots[Math.floor(Math.random() * activeBots.length)];

      try {
        const action = await getBotAction({
          botName: bot.name,
          wordLength: wordData.word.length,
          guessedLetters: bot.guessedLetters,
          chatHistory: [], // Chat not implemented yet
          gameState: 'PLAYING',
          difficulty: wordData.difficulty
        });

        if (action.type === 'GUESS') {
          const letter = action.content;
          if (bot.guessedLetters.includes(letter)) return; // Already guessed

          const isCorrect = wordData.word.includes(letter);
          const newGuessed = [...bot.guessedLetters, letter];
          const newMistakes = isCorrect ? bot.mistakes : bot.mistakes + 1;
          const newStatus = newMistakes >= MAX_MISTAKES ? 'LOST' : (wordData.word.split('').every(c => newGuessed.includes(c) || c === ' ') ? 'WON' : 'PLAYING');

          // Update Bot State
          updateBot(bot.id, {
            guessedLetters: newGuessed,
            mistakes: newMistakes,
            status: newStatus
          });

          // Log it
          if (isCorrect) {
            setGameLog(prev => [{ id: Date.now(), content: <span className="text-green-400">{bot.name} guessed {letter} (CORRECT)</span> }, ...prev]);
          } else {
            setGameLog(prev => [{ id: Date.now(), content: <span className="text-red-400">{bot.name} guessed {letter} (WRONG)</span> }, ...prev]);
          }
        }
        else if (action.type === 'CHAT') {
          setGameLog(prev => [{ id: Date.now(), content: <span className="text-blue-400 italic">{bot.name}: "{action.content}"</span> }, ...prev]);
        }

      } catch (e) {
        console.error("Bot Error", e);
      }

    }, 3000 + Math.random() * 4000); // Act every 3-7 seconds

    return () => clearInterval(botInterval);
  }, [amIHost, status, wordData, players]); // Re-run if players change (updateBot will trigger re-render)

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


        // Track Win Stats - MOVED TO TOURNAMENT END
        // updateGameStats(true, timeTaken, hasScared ? 1 : 0, username);

        // Log History
        logGameHistory({
          word: wordData?.word || '',
          difficulty: wordData?.difficulty || 'Unknown',
          result: 'WON',
          time_taken: timeTaken,
          scares_used: hasScared ? 1 : 0,
          user_id: username
        });
      } else if (isLost) {
        setStatus(GameStatus.LOST);
        soundManager.playLose();
        // Failed round adds penalty time? Or just accumulated time until loss? 
        // User said "lowest time to spend all round to guess curword".
        // If lost, maybe max time or penalty? For now, let's just count time spent trying.
        const timeTaken = Date.now() - roundStartTime;
        const newTotal = totalTimeTaken + timeTaken;
        setTotalTimeTaken(newTotal);

        updateMyStatus('LOST', wrongGuesses, guessedLetters, newTotal);


        // Track Loss Stats - MOVED TO TOURNAMENT END
        // updateGameStats(false, timeTaken, hasScared ? 1 : 0, username);

        // Log History
        logGameHistory({
          word: wordData?.word || '',
          difficulty: wordData?.difficulty || 'Unknown',
          result: 'LOST',
          time_taken: timeTaken,
          scares_used: hasScared ? 1 : 0,
          user_id: username
        });
      } else {
        // Still playing, report mistakes (and current accumulated time? No need until end)
        updateMyStatus('PLAYING', wrongGuesses, guessedLetters, totalTimeTaken);
      }
    }
  }, [guessedLetters, isWon, isLost, status, wrongGuesses]); // Added dependencies safely

  // Tournament End Stats Submission
  useEffect(() => {
    if (showGameOver && gameMode !== 'SINGLE') {
      const sortedPlayers = [...players].sort((a, b) => (a.totalTime || 0) - (b.totalTime || 0));
      const winner = sortedPlayers[0];

      // Am I the winner?
      const amIWinner = winner && winner.id === myId;

      // Submit Tournament Stats
      updateGameStats(amIWinner, totalTimeTaken, totalScaresUsed, username);
    }
  }, [showGameOver, gameMode, players, myId, totalTimeTaken, totalScaresUsed, username]);

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
      // UNLOCKED but NOT REVEALED
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

  const handleStartGame = async (difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium') => {
    if (loadingDifficulty) return;
    soundManager.playClick();
    setLoadingDifficulty(difficulty);

    // Check if we need to generate a new batch or pop from queue
    let dataToUse: WordData;
    let nextRound = round;

    try {
      if (status !== GameStatus.IDLE) {
        nextRound = round + 1;
      }

      // Logic: If queue empty OR Round 1, generate batch. 
      // If queue has items and we are just moving to next round, use queue.
      // BUT if user explicitly selected a difficulty, we should probably regenerate or filter?
      // For now, let's assume we regenerate batch if queue is empty or it's a new "Ritual".
      // Actually, since we are doing "Infinite Difficulty", maybe we should always generate if they pick?
      // Let's stick to the tournament batch logic: if queue exists, use it. 
      // WAIT: User said "sect one of them then use gemini". If they pick Easy, they want an Easy word NOW.
      // So if they make a choice, we should probably force generation of that difficulty.

      // Override: Always generate new batch if manually starting via difficulty buttons
      // Provide history for infinite difficulty?
      const history = { winRate: 0.5 }; // Simplification for now

      // Pass the selected difficulty to the batch generator
      const batch = await generateTournamentBatch(usedWords, history, difficulty);

      dataToUse = batch.words[0];
      setWordQueue(batch.words.slice(1));
      setProphecy(batch.prophecy);
      setShowProphecy(true); // SHOW PROPHECY!

      setRound(nextRound);

      setUnlockedHints(1);
      setRevealedHints(1);
      setHasScared(false);
      setWinnerPowersUsed({ FOG: false, SCRAMBLE: false, JUMPSCARE: false });

      // Track used words
      setUsedWords(prev => [...prev, dataToUse.word].slice(-200));

      const enhancedData: WordData = { ...dataToUse };

      if (gameMode === 'SINGLE') {
        setWordData(enhancedData);
        setGuessedLetters([]);
        setStatus(GameStatus.PLAYING);
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
      let detailedMsg = e.message || "Unknown error occurred.";

      if (e.message === "API_KEY_MISSING") {
        errorMsg = "🚫 MISSING API KEY";
        detailedMsg = "Please check your .env file and ensure VITE_GEMINI_API_KEY is set.";
      } else if (e.message?.includes("429") || e.message?.includes("Quota")) {
        errorMsg = "🚫 API QUOTA EXCEEDED";
        detailedMsg = "Gemini is tired. Please wait a moment.";
      }

      setGameLog(prev => [{
        id: Date.now(),
        content: (
          <div className="text-red-600 font-bold">
            <div className="text-lg mb-1">{errorMsg}</div>
            <div className="text-sm text-red-400 font-normal">{detailedMsg}</div>
          </div>
        )
      }, ...prev]);

    } finally {
      setLoadingDifficulty(null);
    }
  };


  // Sabotage Logic: Combo System (Consolidated)
  const handleGuess = useCallback((letter: string) => {
    // GM RULE ENFORCEMENT
    if (activeRule === 'VOWELS_DISABLED' && "AEIOU".includes(letter)) {
      soundManager.playWrong();
      // Optional: Shake effect or visual feedback
      return;
    }

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
    soundManager.playWin(); // Feedback sound
    if (spell === 'JUMPSCARE') {
      setHasScared(true);
      setTotalScaresUsed(prev => prev + 1);
    }
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

        {/* Daily Ritual Top Left */}
        <div className="fixed top-6 left-6 z-50">
          <button
            onClick={() => setGameMode('DAILY')}
            className="px-6 py-3 bg-purple-950/80 hover:bg-purple-900 text-purple-200 rounded-lg font-bold border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] flex items-center gap-3 backdrop-blur-md"
          >
            <Clock size={20} className="text-purple-400 animate-pulse" />
            <span className="tracking-widest uppercase text-sm">Daily Ritual</span>
          </button>
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

            <button
              onClick={() => setShowLeaderboard(true)}
              className="py-3 bg-yellow-950/40 hover:bg-yellow-900/60 text-yellow-500 rounded font-bold border-l-4 border-yellow-700 transition-all flex items-center justify-center gap-2"
            >
              <Trophy size={20} /> GLOBAL LEADERBOARD
            </button>


          </div>

          <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
          <GlobalLeaderboard isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
        </div>
      </div>
    );
  }

  // Lobby Name Setup

  if (gameMode === 'LOBBY_SETUP') {
    return (
      <div className="relative w-full h-screen bg-black flex items-center justify-center text-slate-100">
        {/* Background Shader */}
        <ShaderBackground
          active={true}
          mood="mysterious"
        />
        <div className="p-8 bg-slate-900/80 rounded border border-slate-700 w-full max-w-md backdrop-blur-sm z-10">
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
      <Lobby
        gameMode={gameMode}
        setGameMode={setGameMode}
        roomId={roomId}
        players={players}
        myId={myId}
        onStartGame={handleStartGame}
        joinLobby={joinLobby}
        loadingDifficulty={loadingDifficulty}
        connectionStatus={connectionStatus}
        gameLog={gameLog}
        username={username}
      />
    );
  }

  // --- Game Over / Winner Screen (After Round 5) ---
  if (showGameOver && gameMode !== 'SINGLE') {
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
      <GameOver
        players={players}
        myId={myId}
        amIHost={amIHost}
        onNewGame={handleNewGame}
      />
    );
  }

  // --- Daily Ritual Mode ---
  if (gameMode === 'DAILY') {
    return (
      <DailyChallenge
        username={username}
        onExit={() => setGameMode('MENU')}
      />
    );
  }

  // --- Main Game (Solo or Multiplayer) ---
  return (
    <div className="flex flex-col lg:flex-row w-full h-screen bg-slate-950 overflow-hidden text-slate-100">

      {/* 3D Scene Area */}
      {/* Mobile: Top 40%, Desktop: Flex Grow (Remaining Space) */}
      <div className="relative w-full h-[40vh] lg:h-full lg:flex-1 bg-black z-0 order-1 shadow-2xl lg:shadow-none">
        <GameSceneOverlay
          showJumpscare={showJumpscare}
          currentJumpscareVideo={currentJumpscareVideo}
          setShowJumpscare={setShowJumpscare}
          autoNextRoundCountdown={autoNextRoundCountdown}
          round={round}
          mySpectators={players.filter(p => p.spectatingId === myId)}
          gameLog={gameLog}
          showHintUnlock={showHintUnlock}
        />

        <GameScene isWon={status === GameStatus.WON || (!!targetPlayer && targetPlayer.status === 'WON')} isLost={status === GameStatus.LOST || (!!targetPlayer && targetPlayer.status === 'LOST')} wrongGuesses={displayWrongGuesses} />

        {/* Mobile-Only Overlays that MUST be on top of scene (like toasts) could go here, but avoiding for now to keep scene clean */}
      </div>

      <GameSidebar
        status={status}
        players={players}
        username={username}
        amIHost={amIHost}
        spawnBot={spawnBot}
        setShowRules={setShowRules}
        showRules={showRules}
        loadingDifficulty={loadingDifficulty}
        wordData={wordData}
        guessedLetters={guessedLetters}
        displayGuessedLetters={displayGuessedLetters}
        unlockedHints={unlockedHints}
        revealedHints={revealedHints}
        gameMode={gameMode}
        activeDebuffs={activeDebuffs}
        curseEnergy={curseEnergy}
        wrongGuesses={wrongGuesses}
        handleGuess={handleGuess}
        performSpellAction={handlePerformSpellAction}
        onSoulMend={onSoulMend}
        handleStartGame={handleStartGame}
        handleOracle={handleOracle}
        handleRoast={handleRoast}
        handleGlitch={handleGlitch}
        hasScared={hasScared}
        round={round}
        spectatingTargetId={spectatingTargetId}
        setSpectatingTargetId={setSpectatingTargetId}
        setSpectating={setSpectating}
        autoNextRoundCountdown={autoNextRoundCountdown}
        myId={myId}
        targetPlayer={targetPlayer}
      />

      {/* Spectator Window Modal */}
      {
        spectatingTargetId && targetPlayer && (
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
        )
      }

      {/* --- GM NARRATIVE OVERLAY --- */}
      {
        gmNarrative && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 pointer-events-none">
            <div className="bg-black/90 border-2 border-red-900/50 p-6 rounded-lg text-center shadow-2xl shadow-red-900/40 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="text-red-500 font-bold tracking-[0.3em] text-xs uppercase mb-2">THE SPIRIT WHISPERS</div>
              <p className="text-xl md:text-2xl text-slate-100 font-serif italic leading-relaxed">"{gmNarrative}"</p>
            </div>
          </div>
        )
      }

      {/* --- MOCK Prophecy Modal --- */}
      {showProphecy && prophecy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-1000">
          <div className="max-w-xl w-full text-center space-y-8 relative">
            {/* Ancient Scroll effect or just text */}
            <div className="text-red-600 font-horror text-4xl tracking-widest animate-pulse">THE PROPHECY</div>
            <div className="p-8 border-y-2 border-red-900/30 bg-red-950/10">
              <p className="text-2xl text-slate-200 font-serif italic leading-loose whitespace-pre-line">
                {prophecy}
              </p>
            </div>
            <button
              onClick={() => setShowProphecy(false)}
              className="px-8 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-800 text-red-200 font-bold uppercase tracking-widest transition-all hover:scale-105"
            >
              ACCEPT FATE
            </button>
          </div>
        </div>
      )}

      {/* --- RITUAL INPUT MODAL --- */}
      {showRitualInput && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-slate-900 border border-purple-900 p-6 rounded shadow-2xl shadow-purple-900/20">
            <h3 className="text-purple-400 font-bold uppercase tracking-widest text-center mb-4">Complete the Ritual</h3>
            <p className="text-slate-400 text-center text-sm mb-6">"Type the incantation exactly to unlock the knowledge."</p>

            <div className="bg-black/50 p-4 rounded mb-6 text-center border border-slate-800">
              <p className="text-xl text-purple-200 font-serif italic select-none pointer-events-none blur-[0.5px]">
                {ritualPhrase}
              </p>
            </div>

            <input
              autoFocus
              value={userRitualInput}
              onChange={(e) => setUserRitualInput(e.target.value)}
              className="w-full bg-black border border-purple-500/50 rounded p-3 text-center text-white mb-4 focus:outline-none focus:border-purple-400 font-mono"
              placeholder="Type the incantation..."
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowRitualInput(false)}
                className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold uppercase hover:bg-slate-700 rounded"
              >
                Cancel
              </button>
              <button
                disabled={userRitualInput.toLowerCase().trim() !== ritualPhrase.toLowerCase().trim()}
                onClick={() => {
                  soundManager.playWin();
                  setShowRitualInput(false);
                  setRevealedHints(h => h + 1);
                }}
                className="flex-1 py-3 bg-purple-900 hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase rounded border border-purple-500/50"
              >
                Break Seal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- GM RULE WARNING --- */}
      {
        activeRule !== 'NONE' && (
          <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 bg-red-950/80 border border-red-500 px-6 py-2 rounded-full animate-pulse">
            <span className="text-red-200 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <Skull size={16} /> CURSE ACTIVE: {activeRule.replace('_', ' ')}
            </span>
          </div>
        )
      }

      {/* --- ATMOSPHERE EFFECTS --- */}
      <div className={clsx(
        "fixed inset-0 pointer-events-none z-0 transition-all duration-1000",
        atmosphere === 'RED_FOG' && "bg-red-900/10 backdrop-blur-[1px]",
        atmosphere === 'DARKNESS' && "bg-black/60",
        atmosphere === 'GLITCH' && "invert opacity-10"
      )} />

    </div >
  );
}