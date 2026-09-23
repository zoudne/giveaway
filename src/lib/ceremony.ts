let audio: AudioContext | null = null

function context(): AudioContext | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null
  audio = audio ?? new window.AudioContext()
  if (audio.state === 'suspended') void audio.resume()
  return audio
}

function tone(freq: number, duration: number, type: OscillatorType, level: number, at = 0) {
  const current = context()
  if (!current) return
  const osc = current.createOscillator()
  const gain = current.createGain()
  const start = current.currentTime + at
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(level, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(current.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

export function armCeremony() {
  context()
}

export function playSpin() {
  tone(146, 0.45, 'triangle', 0.04)
  tone(220, 0.7, 'sine', 0.03, 0.05)
}

export function playReveal() {
  tone(523, 0.16, 'sine', 0.055)
  tone(659, 0.2, 'sine', 0.045, 0.07)
  tone(784, 0.38, 'sine', 0.04, 0.14)
}
