import { ArrowLeft, Check, Eye, RotateCcw, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { pickRandomVerse } from '@/core/memorization/memorization'
import { parseVerseKey, type SurahText, type VerseKey } from '@/core/quran/types'
import { useSurahPlayback } from '@/features/player/useSurahPlayback'
import { VerseText } from '@/features/reader/VerseText'
import { useProgress, useSettings } from '@/features/settings/store'
import { useAsync } from '@/lib/useAsync'
import { loadMeta, loadSurah } from '@/services/quran-data'

/**
 * Test « continue le verset » : un verset tiré au hasard parmi les sourates
 * apprises ; l'élève poursuit de mémoire, puis le texte s'affiche pour vérifier.
 */
export function ContinueTestPage() {
  const { t } = useTranslation('training')
  const learned = useProgress((p) => p.learned)
  const fontSize = useSettings((s) => s.fontSize)
  const meta = useAsync(loadMeta, [])
  const counts = useMemo(
    () => new Map(meta.status === 'ready' ? meta.value.map((m) => [m.n, m.verses] as const) : []),
    [meta],
  )
  const [key, setKey] = useState<VerseKey | null>(null)
  const [history, setHistory] = useState<VerseKey[]>([])
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState({ known: 0, review: 0 })

  const draw = useCallback(() => {
    const next = pickRandomVerse(learned, counts, Math.random, history.slice(-10))
    setKey(next)
    setRevealed(false)
    if (next) setHistory((h) => [...h, next])
  }, [learned, counts, history])

  useEffect(() => {
    if (!key && counts.size) draw()
  }, [counts, key, draw])

  const surah = key ? parseVerseKey(key).surah : null
  const text = useAsync(() => (surah ? loadSurah(surah) : Promise.resolve(null)), [surah])
  const surahMeta = surah && meta.status === 'ready' ? meta.value[surah - 1]! : null
  const playback = useSurahPlayback(surah, surahMeta?.verses ?? 0)

  if (!learned.length) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3 p-6">
        <p>{t('continue.noLearned')}</p>
        <Button asChild size="touch">
          <Link to="/entrainement">{t('continue.chooseSurahs')}</Link>
        </Button>
      </div>
    )
  }

  const verse = key && text.status === 'ready' && text.value ? findVerse(text.value, parseVerseKey(key).verse) : null

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-touch" aria-label={t('common:back')}>
          <Link to="/entrainement">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="flex-1 text-xl font-semibold text-green-deep">{t('continue.title')}</h1>
        <Badge variant="secondary">✓ {score.known}</Badge>
        <Badge variant="outline">↺ {score.review}</Badge>
      </header>

      {key && surahMeta && verse && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <p className="text-center text-sm text-muted-foreground">
              {t('continue.where', { surah: surahMeta.translit, verse: verse.n })}
            </p>
            {!revealed ? (
              <>
                <p className="quran text-center text-green-deep" style={{ fontSize }}>
                  {verse.words[0]!.t} …
                </p>
                <p className="text-center text-sm">{t('continue.instruction')}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="outline"
                    size="touch"
                    disabled={!playback.player}
                    onClick={() => playback.player?.playWord(key, 1)}
                  >
                    <Volume2 /> {t('continue.listenStart')}
                  </Button>
                  <Button size="touch" onClick={() => setRevealed(true)}>
                    <Eye /> {t('continue.reveal')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize }}>
                  <VerseText surah={surahMeta.n} verse={verse} verseActive={false} activeWord={null} />
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    size="touch"
                    onClick={() => {
                      setScore((s) => ({ ...s, known: s.known + 1 }))
                      draw()
                    }}
                  >
                    <Check /> {t('continue.known')}
                  </Button>
                  <Button
                    variant="outline"
                    size="touch"
                    onClick={() => {
                      setScore((s) => ({ ...s, review: s.review + 1 }))
                      draw()
                    }}
                  >
                    <RotateCcw /> {t('continue.review')}
                  </Button>
                  <Button asChild variant="ghost" size="touch">
                    <Link to={`/lire/${surahMeta.n}?v=${verse.n}`}>{t('continue.openReader')}</Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const findVerse = (text: SurahText, n: number) => text.verses.find((v) => v.n === n) ?? null
