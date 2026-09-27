import { useEffect, useRef, useState } from 'react'
import { playReveal, playSpin } from '../lib/ceremony.ts'

const ROW = 76

type SpinRequest = {
  id: number
  names: string[]
  targets: string[]
}

type Props = {
  names: string[]
  request: SpinRequest
  sound: boolean
  onProgress: (names: string[]) => void
  onDone: () => void
}

function shuffle(list: string[]): string[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const swap = Math.floor(Math.random() * (i + 1))
    const current = copy[i]
    copy[i] = copy[swap] ?? current
    copy[swap] = current
  }
  return copy
}

function buildStrip(pool: string[], winner: string): string[] {
  const others = shuffle(pool.filter((name) => name !== winner))
  const source = others.length > 0 ? others : [winner]
  const strip: string[] = []
  const length = Math.max(24, source.length)
  for (let i = 0; i < length; i += 1) strip.push(source[i % source.length] ?? winner)
  strip.push(winner)
  return strip
}

export function NameReel({ names, request, sound, onProgress, onDone }: Props) {
  const idle = names.length > 0 ? names.slice(0, 3) : ['السحب']
  const [strip, setStrip] = useState(idle)
  const [index, setIndex] = useState(0)
  const [duration, setDuration] = useState(0)
  const [revealed, setRevealed] = useState<string[]>([])
  const [live, setLive] = useState(false)
  const soundOn = useRef(sound)
  useEffect(() => {
    soundOn.current = sound
  }, [sound])

  useEffect(() => {
    if (request.id === 0) return
    let cancelled = false
    const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const turn = reduced ? 40 : 2800
    const pause = reduced ? 30 : 700
    const pool = request.names
    const sequence = request.targets

    void (async () => {
      const landed: string[] = []
      setRevealed([])
      onProgress([])
      setLive(true)
      if (soundOn.current && !reduced) playSpin()
      for (const winner of sequence) {
        if (cancelled) return
        const next = buildStrip(pool.length > 0 ? pool : sequence, winner)
        setDuration(0)
        setIndex(0)
        setStrip(next)
        await sleep(40)
        if (cancelled) return
        setDuration(turn)
        setIndex(next.length - 1)
        await sleep(turn + 80)
        if (cancelled) return
        landed.push(winner)
        setRevealed([...landed])
        onProgress([...landed])
        if (soundOn.current && !reduced) playReveal()
        await sleep(pause)
      }
      if (!cancelled) {
        setLive(false)
        onDone()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [onDone, onProgress, request])

  const shown = request.id === 0 ? idle : strip

  return (
    <div className="reel-wrap">
      <div className={`reel-stage${live ? ' is-live' : ''}`} data-testid="name-reel">
        <div className="reel-window">
          <div
            className="reel-strip"
            style={{
              transform: `translateY(${ROW - index * ROW}px)`,
              transitionDuration: `${duration}ms`,
            }}
          >
            {shown.map((name, item) => (
              <div key={`${name}-${item}`} className={item === index ? 'reel-row is-focus' : 'reel-row'}>
                <bdi dir="ltr">{name}</bdi>
              </div>
            ))}
          </div>
          <div className="reel-focus" aria-hidden="true" />
        </div>
      </div>
      <p className="wheel-caption" data-testid="wheel-status" aria-live="polite">
        {live ? (
          `الأسماء تمر · الفائز ${Math.min(revealed.length + 1, request.targets.length)} من ${request.targets.length}`
        ) : revealed.length > 0 ? (
          <>
            توقف الاختيار عند <bdi dir="ltr">{revealed[revealed.length - 1]}</bdi>
          </>
        ) : names.length > 0 ? (
          'نافذة الأسماء جاهزة. ابدأ السحب عندما يكتمل الجمهور.'
        ) : (
          'تظهر الأسماء في النافذة بعد حفظ النتيجة.'
        )}
      </p>
    </div>
  )
}
