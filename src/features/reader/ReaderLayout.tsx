import { useState, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { QuranIndex, SurahMeta } from '@/core/quran/types'
import { CommentaryPanel } from '@/features/commentary/CommentaryPanel'
import { GoToDialog } from '@/features/navigation/GoToDialog'
import { SettingsSheet } from '@/features/settings/SettingsSheet'
import { useSettings, type ReaderMode } from '@/features/settings/store'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { ReaderToolbar } from './ReaderToolbar'

/**
 * Cadre commun aux deux modes : le Coran occupe l'essentiel de l'écran ;
 * outils, traduction et tafsir restent discrets et repliables.
 */
export function ReaderLayout({
  title,
  subtitle,
  mode,
  onModeChange,
  meta,
  index,
  currentSurah,
  panel,
  mainRef,
  tajweedAvailable,
  player,
  children,
}: {
  title: string
  subtitle?: string
  mode: ReaderMode
  onModeChange: (m: ReaderMode) => void
  meta: readonly SurahMeta[]
  index: QuranIndex
  currentSurah: number
  /** sourate et verset affichés dans le panneau traduction / tafsir */
  panel: { meta: SurahMeta; verse: number } | null
  mainRef?: RefObject<HTMLElement>
  tajweedAvailable?: boolean
  player: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation('reader')
  const [goTo, setGoTo] = useState(false)
  const [settings, setSettings] = useState(false)
  const panelOpen = useSettings((s) => s.panelOpen)
  const set = useSettings((s) => s.set)
  const desktop = useIsDesktop()

  return (
    <div className="flex min-h-dvh flex-col">
      <ReaderToolbar
        title={title}
        {...(subtitle ? { subtitle } : {})}
        onTitleClick={() => setGoTo(true)}
        mode={mode}
        onModeChange={onModeChange}
        onOpenSettings={() => setSettings(true)}
        tajweedAvailable={tajweedAvailable ?? true}
      />
      <div className="flex flex-1">
        <main ref={mainRef} className="min-w-0 flex-1 touch-pan-y px-3 pt-3 pb-8">
          {children}
        </main>
        {desktop && panelOpen && panel && (
          <aside className="sticky top-14 h-[calc(100dvh-3.5rem-4.5rem)] w-[26rem] shrink-0 overflow-y-auto border-s border-border bg-card/60 p-4">
            <CommentaryPanel meta={panel.meta} verse={panel.verse} />
          </aside>
        )}
      </div>
      {player}
      {!desktop && panel && (
        <Sheet open={panelOpen} onOpenChange={(panelOpen) => set({ panelOpen })} modal={false}>
          <SheetContent side="bottom" className="max-h-[55dvh] overflow-y-auto rounded-t-2xl">
            <SheetHeader className="pb-0">
              <SheetTitle className="sr-only">{t('commentary.title')}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <CommentaryPanel meta={panel.meta} verse={panel.verse} />
            </div>
          </SheetContent>
        </Sheet>
      )}
      <GoToDialog open={goTo} onOpenChange={setGoTo} meta={meta} index={index} currentSurah={currentSurah} />
      <SettingsSheet open={settings} onOpenChange={setSettings} />
    </div>
  )
}
