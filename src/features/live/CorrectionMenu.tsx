import { Check, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ERROR_TYPES, TAJWEED_ERROR_RULES, verseOfWord, visibleCorrections, type Correction, type ErrorType } from '@/core/live/tools'
import { parseWordId } from '@/core/quran/types'
import { errorMessage } from '@/features/auth/errors'
import { cn } from '@/lib/utils'
import { addVerseResult } from '@/services/tools'
import { useBoard } from './board'
import { displayName, useRoomInfo } from './room'

const WIDTH = 320

/**
 * Menu rapide sur un mot : type d'erreur (et règle de tajwid), commentaire facultatif,
 * « verset validé » / « à revoir ». Montre aussi les erreurs déjà relevées sur le mot.
 */
export function CorrectionMenu() {
  const { t } = useTranslation('live')
  const menu = useBoard((s) => s.menu)
  const tool = useBoard((s) => s.tool)
  const review = useBoard((s) => s.review)
  const focus = useBoard((s) => s.focusStudent)
  const corrections = useBoard((s) => s.corrections)
  const info = useRoomInfo()
  const [comment, setComment] = useState('')
  const [askRule, setAskRule] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    setComment('')
    setAskRule(false)
    setNote(null)
  }, [menu?.word])
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useBoard.getState().set({ menu: null })
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

  if (!menu) return null
  const close = () => useBoard.getState().set({ menu: null })
  const { verse, position } = parseWordId(menu.word)
  const existing = visibleCorrections(corrections, focus).filter((c) => c.word === menu.word)
  const canAdd = !review && !!info && tool === 'correct' && !!focus && focus !== info.me
  const name = displayName(info, focus)

  const save = (error_type: ErrorType, tajweed_rule: string | null = null) => {
    if (!focus) return
    void useBoard.getState().addCorrection({ student_id: focus, word: menu.word, error_type, tajweed_rule, comment: comment || null })
    close()
  }
  const result = async (r: 'validated' | 'review') => {
    if (!info || !focus) return
    const vk = verseOfWord(menu.word)
    try {
      await addVerseResult(info.sessionId, focus, vk, r)
      setNote(t('correction.resultSaved', { verse: vk, result: t(`correction.${r}`) }))
    } catch (e) {
      setNote(errorMessage(t, e))
    }
  }

  const left = Math.min(Math.max(8, menu.x - WIDTH / 2), window.innerWidth - WIDTH - 8)
  const top = Math.min(menu.y + 8, window.innerHeight - (canAdd ? 420 : 240))

  return createPortal(
    <>
      <div className="fixed inset-0 z-50" onPointerDown={close} aria-hidden />
      <div
        role="dialog"
        aria-label={t('correction.title', { verse, position })}
        className="fixed z-50 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm shadow-xl"
        style={{ left, top: Math.max(8, top), width: WIDTH }}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t('correction.title', { verse: `${parseWordId(menu.word).surah}:${verse}`, position })}</p>
            {name && <p className="text-xs text-muted-foreground">{t('correction.for', { name })}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label={t('correction.close')}>
            <X />
          </Button>
        </div>

        {existing.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">{t('correction.existing')}</p>
            {existing.map((c) => (
              <ExistingCorrection key={c.id} c={c} />
            ))}
          </div>
        )}

        {canAdd && !askRule && (
          <>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('correction.comment')} maxLength={500} />
            <div className="grid grid-cols-2 gap-1.5">
              {ERROR_TYPES.map((type) => (
                <Button key={type} variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal py-1.5" onClick={() => (type === 'tajweed' ? setAskRule(true) : save(type))}>
                  {t(`errorTypes.${type}`)}
                </Button>
              ))}
            </div>
          </>
        )}
        {canAdd && askRule && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">{t('correction.chooseRule')}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {TAJWEED_ERROR_RULES.map((rule) => (
                <Button key={rule} variant="outline" size="sm" onClick={() => save('tajweed', rule)}>
                  {t(`tajweedRules.${rule}`)}
                </Button>
              ))}
            </div>
          </div>
        )}

        {canAdd && info?.isTeacher && (
          <div className="flex gap-1.5 border-t border-border pt-2">
            <Button size="sm" className="flex-1" onClick={() => void result('validated')}>
              <Check /> {t('correction.validated')}
            </Button>
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => void result('review')}>
              {t('correction.review')}
            </Button>
          </div>
        )}
        {note && <p className="text-xs text-muted-foreground" role="status">{note}</p>}
      </div>
    </>,
    document.body,
  )
}

function ExistingCorrection({ c }: { c: Correction }) {
  const { t } = useTranslation('live')
  const info = useRoomInfo()
  const review = useBoard((s) => s.review)
  const pending = c.status === 'pending'
  const canConfirm = !review && info?.isTeacher && pending
  const canDelete = !review && (info?.isTeacher || (pending && c.author_id === info?.me))
  return (
    <div className={cn('flex items-start gap-2 rounded-lg px-2 py-1.5', pending ? 'bg-orange-500/10' : 'bg-destructive/10')}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {t(`errorTypes.${c.error_type}`)}
          {c.tajweed_rule && ` — ${t(`tajweedRules.${c.tajweed_rule}`, { defaultValue: c.tajweed_rule })}`}
        </p>
        {c.comment && <p className="text-xs">{c.comment}</p>}
        {pending && <p className="text-xs text-muted-foreground">{t('correction.byPeer')}</p>}
      </div>
      {canConfirm && (
        <Button size="icon" variant="ghost" onClick={() => void useBoard.getState().confirmCorrection(c.id)} aria-label={t('correction.confirm')} title={t('correction.confirm')}>
          <Check />
        </Button>
      )}
      {canDelete && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => void useBoard.getState().removeCorrection(c.id)}
          aria-label={info?.isTeacher ? t('correction.cancel') : t('correction.withdraw')}
          title={info?.isTeacher ? t('correction.cancel') : t('correction.withdraw')}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  )
}
