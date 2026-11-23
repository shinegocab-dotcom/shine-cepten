export type RingtoneMode = 'chime' | 'urgent_bell' | 'vibrate_only';

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  gainPeak: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffsetSec);

  gain.gain.setValueAtTime(0.0001, ctx.currentTime + startOffsetSec);
  gain.gain.exponentialRampToValueAtTime(gainPeak, ctx.currentTime + startOffsetSec + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startOffsetSec + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + startOffsetSec);
  osc.stop(ctx.currentTime + startOffsetSec + durationSec + 0.02);
}

export function playRideOfferAlert(mode: RingtoneMode): void {
  if (typeof window === 'undefined') return;

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (mode === 'urgent_bell') {
        navigator.vibrate([220, 100, 220, 100, 300]);
      } else if (mode === 'vibrate_only') {
        navigator.vibrate([300, 150, 300]);
      } else {
        navigator.vibrate([160, 80, 160]);
      }
    } catch {
      // Ignore vibration permission errors
    }
  }

  if (mode === 'vibrate_only') return;

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    if (mode === 'urgent_bell') {
      playTone(ctx, 880, 0, 0.16, 0.22);
      playTone(ctx, 1174.66, 0.18, 0.18, 0.25);
      playTone(ctx, 880, 0.4, 0.16, 0.22);
      playTone(ctx, 1174.66, 0.58, 0.24, 0.26);
    } else {
      playTone(ctx, 587.33, 0, 0.18, 0.18);
      playTone(ctx, 880, 0.19, 0.28, 0.2);
    }
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 1200);
  } catch {
    // Ignore autoplay policy restrictions until user interaction
  }
}
