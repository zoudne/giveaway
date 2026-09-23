import { useEffect, useState } from 'react'

const COLORS = ['#1f7a45', '#f4ead2', '#d7a441', '#143528', '#efe2c2', '#0e5c36']

type SpinRequest = {
  id: number
  names: string[]
  targets: string[]
}

type Props = {
  names: string[]
  request: SpinRequest
  onDone: () => void
}

function shortName(name: string): string {
  const at = name.startsWith('@')
  const body = at ? name.slice(1) : name
  const trimmed = body.length > 12 ? `${body.slice(0, 11)}…` : body
  return at ? `@${trimmed}` : trimmed
}

function buildSlices(pool: string[], winner: string): { slices: string[]; index: number } {
  const others = pool.filter((name) => name !== winner)
  const picked = others.slice(0, 11)
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

export function PrizeWheel({ names, request, onDone }: Props) {
  const idle = names.length > 0 ? names.slice(0, 12) : ['السحب', 'الفائز', 'القرص', 'الجائزة']
  const [slices, setSlices] = useState(idle)
  const [rotation, setRotation] = useState(0)
  const [duration, setDuration] = useState(0)
  const [revealed, setRevealed] = useState<string[]>([])
  const [live, setLive] = useState(false)

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
      setRevealed([])
      setLive(true)
      for (const winner of sequence) {
        if (cancelled) return
        const built = buildSlices(pool.length > 0 ? pool : sequence, winner)
        setSlices(built.slices)
        await sleep(50)
        if (cancelled) return
        const slice = 360 / built.slices.length
        const jitter = (Math.random() - 0.5) * slice * 0.35
        const desired = -((built.index + 0.5) * slice + jitter)
        setDuration(turn)
        setRotation((current) => {
          const steps = ((current - desired) % 360 + 360) % 360
          return current - (360 * 6 + steps)
        })
        await sleep(turn + 90)
        if (cancelled) return
        setRevealed((current) => [...current, winner])
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
  }, [onDone, request])

  const shown = request.id === 0 ? idle : slices
  const count = Math.max(shown.length, 1)

  return (
    <div className="wheel-wrap">
      <div className={`wheel-stage${live ? ' is-live' : ''}`} data-testid="prize-wheel">
        <div className="pointer" aria-hidden="true" />
        {Array.from({ length: 18 }, (_, index) => (
          <i key={index} className="bulb" style={{ ['--a' as string]: `${index * 20}deg` }} />
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
              return (
                <g key={`${name}-${index}`}>
                  <path d={slicePath(index, count)} fill={COLORS[index % COLORS.length]} />
                  <g transform={`rotate(${angle} 160 160)`}>
                    <text
                      x="160"
                      y="72"
                      textAnchor="middle"
                      direction="ltr"
                      fill={ink}
                      fontSize={count > 8 ? 13 : 16}
                      fontWeight="700"
                      fontFamily="IBM Plex Sans Arabic, Segoe UI, Tahoma, sans-serif"
                      transform={flip ? 'rotate(90 160 72)' : 'rotate(-90 160 72)'}
                    >
                      {shortName(name)}
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
          `القرص يدور على الفائز ${revealed.length + 1}`
        ) : revealed.length > 0 ? (
          <>
            توقف القرص عند <bdi dir="ltr">{revealed[revealed.length - 1]}</bdi>
          </>
        ) : names.length > 0 ? (
          'القرص جاهز. أدره لاختيار الفائزين.'
        ) : (
          'يظهر المشاركون على القرص بعد اكتمال الشروط.'
        )}
      </p>
    </div>
  )
}
