import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Label } from '@/components/ui/label'
import type { ReactNode } from 'react'

/** Choix exclusif (boutons segmentés), toujours une valeur sélectionnée. */
export function Choice<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = 'default',
}: {
  value: T
  options: readonly { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  label?: string
  size?: 'default' | 'lg'
}) {
  const group = (
    <ToggleGroup
      type="single"
      variant="outline"
      size={size === 'lg' ? 'lg' : 'default'}
      value={String(value)}
      onValueChange={(v) => {
        const found = options.find((o) => String(o.value) === v)
        if (found) onChange(found.value)
      }}
      className="flex-wrap justify-start"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={String(o.value)}
          value={String(o.value)}
          title={o.title}
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
  if (!label) return group
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      {group}
    </div>
  )
}
