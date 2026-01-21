export interface WordData {
  word: string;
  hint: string; // Legacy/Primary hint
  hints?: string[]; // Progressive hints (5 total)
  visual_hint_css?: string; // Abstract CSS art hint
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
}

export interface GameState {
  status: GameStatus;
  wordData: WordData | null;
  guessedLetters: string[];
  wrongGuesses: number;
}

// Multiplayer Types

export interface Player {
  id: string; // Peer ID
  name: string;
  isHost: boolean;
  isBot?: boolean; // AI Controlled
  status: 'LOBBY' | 'PLAYING' | 'WON' | 'LOST' | 'SPECTATING';
  mistakes: number; // 0-6
  roundScore: number; // CP earned this round for tournament scoring
  totalTime: number; // ms taken to win rounds (New Metric)
  guessedLetters: string[]; // For Spectator Mode
  spectatingId?: string; // Who they are watching (if dead/won)
}

export type NetworkAction =
  // Lobby Actions
  | { type: 'JOIN_REQUEST'; payload: { name: string } }
  | { type: 'JOIN_ACCEPT'; payload: { players: Player[] } } // Sent to new joiner
  | { type: 'JOIN_ACCEPT'; payload: { players: Player[] } } // Sent to new joiner
  | { type: 'PLAYER_UPDATE'; payload: { players: Player[] } } // Sync lobby list
  | { type: 'PLAYER_LEFT'; payload: { playerId: string } }

  // Game Control (Host -> All)
  | { type: 'GAME_START'; payload: { wordData: WordData; round: number } }

  // Game Progress (Client -> Host -> All)
  | { type: 'UPDATE_MY_STATUS'; payload: { status: Player['status']; mistakes: number; totalTime?: number } }
  | { type: 'GLOBAL_TICK'; payload: { players: Player[] } } // Broadcast of all states
  | { type: 'CAST_SPELL'; payload: { spellId: 'FOG' | 'SCRAMBLE' | 'JUMPSCARE'; casterName: string; targetId: string } }
  | { type: 'SOUL_MEND'; payload: { playerId: string } }

  // Legacy (Optional keep for reference, but likely replacing)
  | { type: 'ROUND_COUNTDOWN'; payload: { count: number | null } }
  | { type: 'RESTART'; payload: null };

export interface MultiplayerState {
  isMultiplayer: boolean;
  me: Player;
  otherPlayers: Player[]; // List of everyone else
  connectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
}

// --- Dungeon Master Types ---
export interface GameMasterResponse {
  narrative: string;
  attitude: 'Sadistic' | 'Helpful' | 'Cryptic' | 'Bored';
  rule_change?: 'NONE' | 'VOWELS_DISABLED' | 'Invert_Controls' | 'Double_Damage';
  atmosphere?: 'NONE' | 'RED_FOG' | 'GLITCH' | 'DARKNESS';
}

