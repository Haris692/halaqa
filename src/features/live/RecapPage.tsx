import { BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { verseRanges } from '@/core/live/tools'
import { parseVerseKey, parseWordId, type QuranWord, type SurahText } from '@/core/quran/types'
import { useAuth, isStaff } from '@/features/auth/store'
import { errorMessage } from '@/features/auth/errors'
import { Notice, PageShell } from '@/features/ui/PageShell'
import { useAsync } from '@/lib/useAsync'
import { loadMeta, loadSurah } from '@/services/quran-data'
import { mySessions, sessionRecap, type Recap } from '@/services/tools'

/**
 * Récapitulatif de fin de séance : passages travaillés, corrections reçues, versets validés.
 * L'élève voit le sien ; le prof, celui de chaque élève venu.
 */
export function RecapPage() {
  const { t } = useTranslation('live')
  const { id = '' } = useParams()
  const profile = useAuth((s) => s.profile)
  const recap = useAsync(async () => {
    const r = await sessionRecap(id)
    const surahs = [...new Set(r.students.flatMap((s) => s.verses.map((v) => parseVerseKey(v).surah)))]
    const [meta, texts] = await Promise.all([loadMeta(), Promise.all(surahs.map(loadSurah))])
    return { r, meta, texts: new Map(texts.map((x) => [x.surah, x])) }
  }, [id])

  const back = profile && isStaff(profile) ? (recap.status === 'ready' ? `/prof/classe/${recap.value.r.session.class_id}` : '/prof') : '/progression'
  if (recap.status === 'loading') return <p className="p-6 text-muted-foreground">{t('common:loading')}</p>
  if (recap.status === 'error') {
    return (
      <PageShell title={t('recap.title')} back={back}>
        <Notice tone="error">{errorMessage(t, recap.error)}</Notice>
      </PageShell>
    )
  }
  const { r, meta, texts } = recap.value
  const s = r.session
  const date = s.started_at ? new Date(s.started_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  const teacherView = profile && isStaff(profile)

  return (
    <PageShell title={t('recap.title')} back={back} wide={!!teacherView}>
      <header className="flex flex-col gap-1">
        <p className="text-lg font-semibold">{s.title || s.class_name}</p>
        <p className="text-sm text-muted-foreground">
          {s.class_name}
          {date && ` · ${date}`}
          {s.teacher_name && ` · ${s.teacher_name}`}
        </p>
        {s.passage && (
          <p className="text-sm">
            {t('recap.passage', { passage: `${meta[s.passage.surah - 1]?.translit ?? s.passage.surah} ${s.passage.from}–${s.passage.to}` })}
          </p>
        )}
        {s.tajweed_focus && <p className="text-sm">{t('recap.rule', { rule: t(`reader:tajweed.${s.tajweed_focus}`, { defaultValue: s.tajweed_focus }) })}</p>}
      </header>
      {r.students.length === 0 && <Notice>{t('recap.nothingWorked')}</Notice>}
      <div className={teacherView ? 'grid gap-4 lg:grid-cols-2' : 'flex flex-col gap-4'}>
        {r.students.map((st) => (
          <StudentRecap key={st.student_id} recap={r} student={st} texts={texts} teacherView={!!teacherView} />
        ))}
      </div>
      {!teacherView && <Notice>{t('recap.homework')}</Notice>}
    </PageShell>
  )
}

function StudentRecap({
  recap,
  student,
  texts,
  teacherView,
}: {
  recap: Recap
  student: Recap['students'][number]
  texts: Map<number, SurahText>
  teacherView: boolean
}) {
  const { t } = useTranslation('live')
  const wordOf = (id: string): QuranWord | undefined => {
    const w = parseWordId(id as `${number}:${number}:${number}`)
    return texts.get(w.surah)?.verses.find((v) => v.n === w.verse)?.words.find((x) => x.p === w.position)
  }
  const reviewLink = (verse: string) => {
    const { surah, verse: n } = parseVerseKey(verse as `${number}:${number}`)
    const q = new URLSearchParams({ v: String(n), bilan: recap.session.id, titre: recap.session.title || recap.session.class_name })
    if (teacherView) q.set('eleve', student.student_id)
    return `/lire/${surah}?${q.toString()}`
  }
  const first = student.verses[0]
  const results = new Map(student.results.map((x) => [x.verse, x.result]))

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label={student.display_name}>
      {teacherView && <h2 className="text-base font-semibold">{student.display_name}</h2>}

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold tracking-wide text-green-deep uppercase">{t('recap.worked')}</h3>
        {student.verses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('recap.nothingWorked')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {verseRanges(student.verses).map((range) => (
              <Link key={range} to={reviewLink(range.split('-')[0]!)} className="rounded-lg border border-border px-2 py-1 text-sm hover:bg-muted">
                {range}
              </Link>
            ))}
          </div>
        )}
        {student.results.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...results].map(([verse, result]) => (
              <Badge key={verse} variant={result === 'validated' ? 'default' : 'secondary'}>
                {verse} · {t(`recap.${result}`)}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold tracking-wide text-green-deep uppercase">{t('recap.corrections')}</h3>
        {student.corrections.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('recap.noCorrections')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {student.corrections.map((c) => {
              const word = wordOf(c.word)
              return (
                <li key={c.id} className="flex items-start gap-3 rounded-lg bg-destructive/5 px-3 py-2">
                  <span className="quran shrink-0 text-2xl leading-tight text-[var(--corr-error)]" dir="rtl">
                    {word?.t ?? ''}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">
                      {t(`errorTypes.${c.error_type}`)}
                      {c.tajweed_rule && ` — ${t(`tajweedRules.${c.tajweed_rule}`, { defaultValue: c.tajweed_rule })}`}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {c.verse}
                      {c.author_role === 'peer' && ` · ${t('recap.peer')}`}
                      {c.status === 'pending' && ` · ${t('recap.pending')}`}
                    </span>
                    {c.comment && <span className="block">{c.comment}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {first && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {student.annotations > 0 && <p className="text-sm text-muted-foreground">{t('recap.annotations', { count: student.annotations })}</p>}
          <Button asChild size="sm" variant="outline" className="ms-auto">
            <Link to={reviewLink(first)}>
              <BookOpen /> {t('recap.review_on_text')}
            </Link>
          </Button>
        </div>
      )}
    </section>
  )
}

/** « Mes séances » : les séances terminées de l'élève, avec leur récapitulatif. */
export function MySessionsList() {
  const { t } = useTranslation('live')
  const list = useAsync(() => mySessions(), [])
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-green-deep">{t('recap.mySessions')}</h2>
      {list.status === 'error' && <Notice tone="error">{errorMessage(t, list.error)}</Notice>}
      {list.status === 'ready' && list.value.length === 0 && <p className="text-sm text-muted-foreground">{t('recap.noSessions')}</p>}
      {list.status === 'ready' && list.value.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {list.value.map((s) => (
            <li key={s.id}>
              <Link to={`/seance/${s.id}/bilan`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.title || s.class_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.started_at ? new Date(s.started_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                  </span>
                </span>
                <Badge variant="secondary">{t('recap.correctionsCount', { count: s.corrections })}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
