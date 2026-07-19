import { useRef } from "react";

/**
 * Custom hook to play a synthesized referee whistle using the Web Audio API.
 * Synthesizes a realistic double-tone whistle with a rapid trill effect (35Hz LFO).
 * Requires no network requests or external asset files.
 */
export function useWhistle() {
  const play = async () => {
    if (typeof window === "undefined") return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const ctx = new AudioContextClass();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      const now = ctx.currentTime;

      // Bandpass filter to clean up harmonics and focus the sound
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2200;
      filter.Q.value = 2.5;

      // Whistle tone 1
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = 2050;

      // Whistle tone 2
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 2200;

      // LFO to create the rapid vibrato/trill beating effect
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 35; // 35Hz wobble

      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 18; // wobble range in Hz

      // Connect LFO to modulate oscillator frequencies
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      // Volume envelope (attack, sustain, release)
      const mainGain = ctx.createGain();
      mainGain.gain.setValueAtTime(0, now);
      mainGain.gain.linearRampToValueAtTime(0.2, now + 0.04); // Fast attack
      mainGain.gain.setValueAtTime(0.2, now + 0.55); // Sustain
      mainGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8); // Exponential decay

      // Connect everything
      osc1.connect(mainGain);
      osc2.connect(mainGain);
      mainGain.connect(filter);
      filter.connect(ctx.destination);

      // Start oscillators
      lfo.start(now);
      osc1.start(now);
      osc2.start(now);

      // Stop and clean up context
      lfo.stop(now + 0.85);
      osc1.stop(now + 0.85);
      osc2.stop(now + 0.85);

      // Close context after playback is complete to free up audio hardware
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 1000);
    } catch (err) {
      console.warn("Failed to play Web Audio whistle:", err);
    }
  };

  return { play };
}

