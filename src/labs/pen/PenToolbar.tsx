import { useTranslation } from 'react-i18next'
import { STROKE_COLORS, type StrokeColor, type WordMark } from '@/core/annotations/strokes'
import type { MushafFont } from '@/features/reader/MushafPageView'
import { COLOR_HEX } from '@/features/annotations/StrokeLayer'
import { Field, Segmented, Slider } from '../ui'

export type Tool = 'none' | 'pen' | 'laser' | 'mark' | 'eraser'

export interface PenView {
  mode: 'mushaf' | 'reading'
  page: 1 | 604
  font: MushafFont
  mushafAnchor: 'page' | 'word'
  readingAnchor: 'verse' | 'word'
  zoom: number
}

type Width = 'fine' | 'medium' | 'thick'

export function PenToolbar(props: {
  role: 'prof' | 'eleve'
  view: PenView
  onView: (v: PenView) => void
  tool: Tool
  onTool: (t: Tool) => void
  canDraw: boolean
  color: StrokeColor
  onColor: (c: StrokeColor) => void
  width: Width
  onWidth: (w: Width) => void
  markKind: WordMark['kind']
  onMarkKind: (k: WordMark['kind']) => void
  rangeMode: boolean
  onRangeMode: (v: boolean) => void
  studentPen: boolean
  onStudentPen: (v: boolean) => void
  onClear: () => void
}) {
  const { t } = useTranslation('labs')
  const { view, onView } = props
  const set = (patch: Partial<PenView>) => onView({ ...view, ...patch })

  const tools: { value: Tool; label: string }[] = [
    { value: 'none', label: t('pen.tool.none') },
    ...(props.canDraw
      ? ([
          { value: 'pen', label: t('pen.tool.pen') },
          { value: 'laser', label: t('pen.tool.laser') },
          { value: 'eraser', label: t('pen.tool.eraser') },
        ] as const)
      : []),
    { value: 'mark', label: t('pen.tool.mark') },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold-soft bg-white/60 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field label={t('pen.mode')}>
          <Segmented
            value={view.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'mushaf', label: t('pen.modeMushaf') },
              { value: 'reading', label: t('pen.modeReading') },
            ]}
          />
        </Field>
        <Field label={t('pen.page')}>
          <Segmented value={view.page} onChange={(page) => set({ page })} options={[1, 604].map((p) => ({ value: p as 1 | 604, label: String(p) }))} />
        </Field>
        {view.mode === 'mushaf' ? (
          <>
            <Field label={t('pen.font')}>
              <Segmented
                value={view.font}
                onChange={(font) => set({ font })}
                options={[
                  { value: 'v2', label: t('pen.fontV2') },
                  { value: 'unicode', label: t('pen.fontUnicode') },
                ]}
              />
            </Field>
            <Field label={t('pen.anchor')}>
              <Segmented
                value={view.mushafAnchor}
                onChange={(mushafAnchor) => set({ mushafAnchor })}
                options={[
                  { value: 'page', label: t('pen.anchorPage') },
                  { value: 'word', label: t('pen.anchorWord') },
                ]}
              />
            </Field>
          </>
        ) : (
          <Field label={t('pen.anchor')}>
            <Segmented
              value={view.readingAnchor}
              onChange={(readingAnchor) => set({ readingAnchor })}
              options={[
                { value: 'verse', label: t('pen.anchorVerse') },
                { value: 'word', label: t('pen.anchorWord') },
              ]}
            />
          </Field>
        )}
        <Field label={t('pen.zoom', { pct: Math.round(view.zoom * 100) })}>
          <Slider value={view.zoom} min={0.5} max={2} step={0.05} onChange={(zoom) => set({ zoom })} />
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-4 border-t border-gold-soft/60 pt-3">
        <Field label={t('pen.toolLabel')}>
          <Segmented value={props.tool} onChange={props.onTool} options={tools} />
        </Field>
        <Field label={t('pen.color')}>
          <div className="flex gap-2">
            {STROKE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={t(`pen.colors.${c}`)}
                onClick={() => props.onColor(c)}
                className={`h-9 w-9 rounded-full border-2 ${props.color === c ? 'border-ink' : 'border-transparent'}`}
                style={{ background: COLOR_HEX[c] }}
              />
            ))}
          </div>
        </Field>
        {(props.tool === 'pen' || props.tool === 'laser') && (
          <Field label={t('pen.width')}>
            <Segmented
              value={props.width}
              onChange={props.onWidth}
              options={(['fine', 'medium', 'thick'] as const).map((w) => ({ value: w, label: t(`pen.widths.${w}`) }))}
            />
          </Field>
        )}
        {props.tool === 'mark' && (
          <>
            <Field label={t('pen.markKind')}>
              <Segmented
                value={props.markKind}
                onChange={props.onMarkKind}
                options={[
                  { value: 'highlight', label: t('pen.markHighlight') },
                  { value: 'underline', label: t('pen.markUnderline') },
                ]}
              />
            </Field>
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" checked={props.rangeMode} onChange={(e) => props.onRangeMode(e.target.checked)} />
              {t('pen.rangeMode')}
            </label>
          </>
        )}
        {props.role === 'prof' && (
          <div className="ms-auto flex flex-wrap items-center gap-3">
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" checked={props.studentPen} onChange={(e) => props.onStudentPen(e.target.checked)} />
              {t('pen.allowStudent')}
            </label>
            <button
              type="button"
              onClick={props.onClear}
              className="min-h-9 rounded-lg border border-red-700/40 px-3 text-sm text-red-800 hover:bg-red-50"
            >
              {t('pen.clear')}
            </button>
          </div>
        )}
        {props.role === 'eleve' && !props.canDraw && <p className="text-xs text-ink/60">{t('pen.penDisabled')}</p>}
      </div>
    </div>
  )
}
