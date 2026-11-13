import type { ReactNode } from 'react'

/** Petits contrôles pour les labos (shadcn/ui arrivera avec le vrai lecteur, phase 1). */

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gold-soft bg-white/60 p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-green-deep uppercase">{title}</h2>
      {children}
    </section>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink/70">{label}</span>
      {children}
    </label>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-paper-deep p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-md px-3 text-sm transition ${
            o.value === value ? 'bg-green-deep text-white shadow' : 'text-ink hover:bg-white/70'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'ghost'
  disabled?: boolean
}) {
  const styles =
    variant === 'primary'
      ? 'bg-green-deep text-white hover:bg-green-soft'
      : 'border border-green-deep/30 text-green-deep hover:bg-white/70'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-lg px-4 text-sm font-medium transition disabled:opacity-40 ${styles}`}
    >
      {children}
    </button>
  )
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <select
      className="min-h-9 rounded-md border border-gold-soft bg-white px-2"
      value={String(value)}
      onChange={(e) => {
        const found = options.find((o) => String(o.value) === e.target.value)
        if (found) onChange(found.value)
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <input
      type="range"
      className="accent-green-deep"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}
