const COLORS = ['#e8b86a', '#f6e2b8', '#3dba74', '#fffaf0', '#e07a62', '#8fd7a8']

export function Confetti({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 46 }, (_, index) => (
        <i
          key={index}
          style={{
            ['--x' as string]: `${(index * 53) % 100}%`,
            ['--drift' as string]: `${((index % 9) - 4) * 16}px`,
            ['--delay' as string]: `${(index % 12) * 0.045}s`,
            ['--dur' as string]: `${1.7 + (index % 5) * 0.22}s`,
            ['--c' as string]: COLORS[index % COLORS.length],
          }}
        />
      ))}
    </div>
  )
}
