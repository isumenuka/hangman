// A procedural audio synthesizer for horror sounds
// Uses Web Audio API to avoid external asset dependencies

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    // Audio disabled
  }

  private ensureContext() {
    // No-op
  }

  // Creepy ambient drone
  playAmbient() {
    return () => { };
  }

  playClick() {
    // No-op
  }

  playCorrect() {
    // No-op
  }

  playWrong() {
    // No-op
  }

  playWin() {
    // No-op
  }

  playLose() {
    // No-op
  }
}


export const soundManager = new SoundManager();
