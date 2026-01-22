import * as Tone from 'tone';
import { ComposerData } from '../services/composer';

class AudioEngineImplementation {
    private synths: Tone.PolySynth[] = [];
    private sequences: Tone.Part[] = [];
    private isInitialized = false;
    private isPlaying = false;

    async init() {
        if (this.isInitialized) return;
        await Tone.start();
        this.isInitialized = true;
        console.log("Audio Engine Initialized");
    }

    stop() {
        this.sequences.forEach(seq => {
            seq.stop();
            seq.dispose();
        });
        this.sequences = [];

        this.synths.forEach(synth => {
            synth.releaseAll();
            synth.dispose();
        });
        this.synths = [];

        Tone.Transport.stop();
        Tone.Transport.cancel();
        this.isPlaying = false;
    }

    async playComposition(data: ComposerData) {
        if (!this.isInitialized) await this.init();

        // Stop previous
        this.stop();

        Tone.Transport.bpm.value = data.bpm;

        // Create instruments
        data.instruments.forEach(inst => {
            // 1. Create Synth
            const synth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: inst.oscillator as any },
                envelope: inst.envelope
            }).toDestination();

            // Add effects based on mood? (Hardcoded for now: Reverb is always nice for horror)
            const reverb = new Tone.Reverb(2.5).toDestination();
            synth.connect(reverb);

            // 2. Create Part
            const part = new Tone.Part((time, noteInfo: any) => {
                if (noteInfo.note) {
                    synth.triggerAttackRelease(noteInfo.note, noteInfo.duration, time);
                }
            }, inst.notes).start(0);

            part.loop = true;
            part.loopEnd = "4m"; // Loop every 4 measures

            this.synths.push(synth);
            this.sequences.push(part);
        });

        Tone.Transport.start();
        this.isPlaying = true;
    }
}

export const AudioEngine = new AudioEngineImplementation();
