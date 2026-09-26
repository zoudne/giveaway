import { useEffect, useRef, useState } from 'react'
import { playReveal, playSpin } from '../lib/ceremony.ts'

const COLORS = ['#1f7a45', '#f4ead2', '#d7a441', '#143528', '#efe2c2', '#0e5c36']

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

function markOffset(count: number): number {
  if (count <= 8) return 72
  if (count <= 16) return 68
  if (count <= 24) return 62
  return 54
}

function shortName(name: string, maxChars: number): string {
  const at = name.startsWith('@')
  const body = at ? name.slice(1) : name
  const trimmed = body.length > maxChars ? `${body.slice(0, maxChars - 1)}…` : body
  return at ? `@${trimmed}` : trimmed
}

function buildSlices(pool: string[], winner: string): { slices: string[]; index: number } {
  const picked = pool.filter((name) => name !== winner)
  for (let i = picked.length - 1; i > 0; i -= 1) {
    const swap = Math.floor(Math.random() * (i + 1))
    const current = picked[i]
    picked[i] = picked[swap] ?? current
    picked[swap] = current
  }
  const index = Math.floor(Math.random() * (picked.length + 1))
  picked.splice(index, 0, winner)
  return { slices: picked.length > 0 ? picked : ['السحب'], index: picked.length > 0 ? index : 0 }
}

function slicePath(index: number, total: number): string {
  const angle = (Math.PI * 2) / total
  const start = index * angle - Math.PI / 2
  const end = start + angle
  const radius = 148
  const x1 = 160 + radius * Math.cos(start)
  const y1 = 160 + radius * Math.sin(start)
  const x2 = 160 + radius * Math.cos(end)
  const y2 = 160 + radius * Math.sin(end)
  const large = angle > Math.PI ? 1 : 0
  return `M160 160 L${x1} ${y1} A${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`
}

export function PrizeWheel({ names, request, sound, onProgress, onDone }: Props) {
  const idle = names.length > 0 ? names : ['السعودية', 'الكويت', 'الفائز', 'السحب']
  const [slices, setSlices] = useState(idle)
  const [rotation, setRotation] = useState(0)
  const [duration, setDuration] = useState(0)
  const [revealed, setRevealed] = useState<string[]>([])
  const [spotlight, setSpotlight] = useState<number | null>(null)
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
    const turn = reduced ? 40 : 3400
    const pause = reduced ? 30 : 700
    const pool = request.names
    const sequence = request.targets

    void (async () => {
      const landed: string[] = []
      setRevealed([])
      setSpotlight(null)
      onProgress([])
      setLive(true)
      if (soundOn.current && !reduced) playSpin()
      for (const winner of sequence) {
        if (cancelled) return
        const built = buildSlices(pool.length > 0 ? pool : sequence, winner)
        setSpotlight(null)
        setSlices(built.slices)
        await sleep(50)
        if (cancelled) return
        const slice = 360 / built.slices.length
        const jitter = (Math.random() - 0.5) * slice * 0.12
        const desired = -((built.index + 0.5) * slice + jitter)
        setDuration(turn)
        setRotation((current) => {
          const steps = ((current - desired) % 360 + 360) % 360
          return current - (360 * 6 + steps)
        })
        await sleep(turn + 90)
        if (cancelled) return
        landed.push(winner)
        setSpotlight(built.index)
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

  const shown = request.id === 0 ? idle : slices
  const count = Math.max(shown.length, 1)
  const markY = markOffset(count)

  return (
    <div className="wheel-wrap">
      <div className={`wheel-stage${live ? ' is-live' : ''}`} data-testid="prize-wheel">
        <div className="pointer" aria-hidden="true">
          <svg viewBox="0 0 36 48" width="36" height="48">
            <path d="M18 48 3 16a15 15 0 1 1 30 0Z" fill="#f8e7c0" />
            <circle cx="18" cy="14" r="4.5" fill="#8a5a16" />
          </svg>
        </div>
        {Array.from({ length: 22 }, (_, index) => (
          <i key={index} className="bulb" style={{ ['--a' as string]: `${index * (360 / 22)}deg` }} />
        ))}
        <div
          className="rotor"
          data-testid="wheel-rotor"
          style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${duration}ms` }}
        >
          <svg viewBox="0 0 320 320" role="img" aria-label="قرص السحب">
            <circle cx="160" cy="160" r="154" fill="#24180a" />
            {shown.map((name, index) => {
              const tone = index % COLORS.length
              const ink = tone === 1 || tone === 2 || tone === 4 ? '#142016' : '#f6f1e4'
              const angle = (index + 0.5) * (360 / count)
              const turns = ((angle % 360) + 360) % 360
              const flip = turns >= 180
              const visible = spotlight === index
              const y = visible ? 78 : markY
              return (
                <g key={`${index}-${visible ? name : 'mark'}`}>
                  <path d={slicePath(index, count)} fill={COLORS[index % COLORS.length]} />
                  <g transform={`rotate(${angle} 160 160)`}>
                    <text
                      x="160"
                      y={y}
                      textAnchor="middle"
                      direction="ltr"
                      fill={ink}
                      fontSize={visible ? 14 : 11}
                      fontWeight="700"
                      fontFamily="IBM Plex Sans, Segoe UI, Tahoma, sans-serif"
                      transform={flip ? `rotate(90 160 ${y})` : `rotate(-90 160 ${y})`}
                    >
                      {visible ? shortName(name, 12) : '●'}
                    </text>
                  </g>
                </g>
              )
            })}
            <circle cx="160" cy="160" r="152" fill="none" stroke="#f0d7a2" strokeWidth="8" />
          </svg>
        </div>
        <div className="hub" aria-hidden="true">
          سحب
        </div>
      </div>
      <p className="wheel-caption" data-testid="wheel-status" aria-live="polite">
        {live ? (
          `القرص يدور · الفائز ${Math.min(revealed.length + 1, request.targets.length)} من ${request.targets.length}`
        ) : revealed.length > 0 ? (
          <>
            توقف القرص عند <bdi dir="ltr">{revealed[revealed.length - 1]}</bdi>
          </>
        ) : names.length > 0 ? (
          'القرص جاهز. ابدأ السحب عندما يكتمل الجمهور.'
        ) : (
          'يظهر المشاركون على القرص بعد حفظ النتيجة.'
        )}
      </p>
    </div>
  )
}
