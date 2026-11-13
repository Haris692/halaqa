import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { progressMap, SELF_STATUSES, statusOf, VERSE_STATUSES, type VerseStatus } from '@/core/progress/progress'
import { errorMessage } from '@/features/auth/errors'
import { isStaff, useAuth } from '@/features/auth/store'
import { Notice } from '@/features/ui/PageShell'
import { useQuery } from '@/lib/query'
import { cn } from '@/lib/utils'
import { listNotes, listProgress, saveNote, setVerseStatus } from '@/services/accounts'

/** Notes des professeurs pour une sourate (filtrées par RLS : les siennes, ou celles de ses profs). */
export function useSurahNotes(surah: number) {
  const signedIn = useAuth((s) => s.status === 'signedIn')
  return useQuery(signedIn ? `notes:${surah}` : null, () => listNotes(surah))
}

/** Onglet « Notes du prof » : le prof écrit la sienne, l'élève lit celles de ses profs. */
export function TeacherNotesTab({ surah, verse }: { surah: number; verse: number }) {
  const { t } = useTranslation('reader')
  const profile = useAuth((s) => s.profile)
  const notes = useSurahNotes(surah)
  if (!profile) return null
  if (notes.status === 'loading') return <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
  if (notes.status === 'error') return <Notice tone="error">{errorMessage(t, notes.error)}</Notice>
  const forVerse = notes.value.filter((n) => n.ayah === verse)

  if (isStaff(profile)) {
    const mine = forVerse.find((n) => n.teacher_id === profile.id)
    return <NoteEditor key={`${surah}:${verse}`} teacherId={profile.id} surah={surah} verse={verse} initial={mine?.content ?? ''} />
  }
  if (forVerse.length === 0) return <p className="text-sm text-muted-foreground">{t('notes.none')}</p>
  return (
    <div className="flex flex-col gap-4">
      {forVerse.map((n) => (
        <article key={n.id} className="flex flex-col gap-1">
          <p className="text-base leading-relaxed whitespace-pre-line">{n.content}</p>
          <footer className="border-t border-border pt-1 text-xs text-muted-foreground">
            {t('notes.by', { name: n.teacher?.display_name ?? '—' })}
          </footer>
        </article>
      ))}
    </div>
  )
}

function NoteEditor({ teacherId, surah, verse, initial }: { teacherId: string; surah: number; verse: number; initial: string }) {
  const { t } = useTranslation('reader')
  const [text, setText] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | { error: string }>('idle')
  useEffect(() => {
    setText(initial)
  }, [initial])

  const save = async () => {
    setState('saving')
    try {
      await saveNote(teacherId, surah, verse, text)
      setState('saved')
    } catch (err) {
      setState({ error: errorMessage(t, err) })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setState('idle')
        }}
        maxLength={5000}
        rows={6}
        placeholder={t('notes.placeholder')}
        aria-label={t('notes.editLabel')}
        className="text-base"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={state === 'saving' || text.trim() === initial.trim()}>
          {text.trim() || !initial ? t('notes.save') : t('notes.delete')}
        </Button>
        {state === 'saved' && <span className="text-xs text-green-deep">{t('notes.saved')}</span>}
      </div>
      {typeof state === 'object' && <Notice tone="error">{state.error}</Notice>}
      <p className="text-xs text-muted-foreground">{t('notes.visibility')}</p>
    </div>
  )
}

/** Statut du verset pour l'élève connecté (dans le panneau du lecteur). */
export function MyVerseStatus({ surah, verse }: { surah: number; verse: number }) {
  const { t } = useTranslation('account')
  const profile = useAuth((s) => s.profile)
  const studentId = profile?.role === 'student' ? profile.id : null
  const progress = useQuery(studentId ? `progress:${studentId}` : null, () => listProgress(studentId!))
  const [error, setError] = useState<string | null>(null)
  if (!studentId || progress.status !== 'ready') return null
  const current = statusOf(progressMap(progress.value), surah, verse)

  const set = async (status: VerseStatus) => {
    setError(null)
    try {
      await setVerseStatus(studentId, [{ surah, ayah: verse, status }])
    } catch (err) {
      setError(errorMessage(t, err))
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">{t('status.label')}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('status.label')}>
        {VERSE_STATUSES.map((s) => {
          // un verset validé par le prof ne peut repasser qu'à « à revoir »
          const editable = SELF_STATUSES.includes(s) && (current !== 'acquired' || s === 'review')
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={current === s}
              disabled={!editable && current !== s}
              onClick={() => editable && current !== s && void set(s)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-opacity',
                current === s ? `st-${s} ring-2 ring-ring/40` : 'border border-border text-muted-foreground',
                !editable && current !== s && 'opacity-40',
              )}
            >
              {t(`status.${s}`)}
            </button>
          )
        })}
      </div>
      {current === 'acquired' && <p className="text-xs text-muted-foreground">{t('status.validated')}</p>}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}
