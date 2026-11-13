import { BookOpen, ChevronDown, EyeOff, Home, Languages, Palette, Settings, Type } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MASK_LEVELS, type MaskLevel } from '@/core/memorization/memorization'
import { useSettings, type ReaderMode } from '@/features/settings/store'
import { Choice } from '@/features/ui/Choice'
import { cn } from '@/lib/utils'

export function ReaderToolbar({
  title,
  subtitle,
  onTitleClick,
  mode,
  onModeChange,
  onOpenSettings,
  tajweedAvailable = true,
}: {
  title: string
  subtitle?: string
  onTitleClick: () => void
  mode: ReaderMode
  onModeChange: (m: ReaderMode) => void
  onOpenSettings: () => void
  tajweedAvailable?: boolean
}) {
  const { t } = useTranslation('reader')
  const s = useSettings()
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-2 py-1.5 sm:gap-2">
        <Button asChild variant="ghost" size="icon-touch" aria-label={t('toolbar.home')}>
          <Link to="/">
            <Home />
          </Link>
        </Button>
        <button
          type="button"
          onClick={onTitleClick}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-lg px-2 py-1 text-start hover:bg-muted"
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold text-green-deep">{title}</span>
            {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>

        <div className="hidden sm:block">
          <Choice
            value={mode}
            onChange={onModeChange}
            options={[
              { value: 'reading', label: <Type />, title: t('toolbar.reading') },
              { value: 'mushaf', label: <BookOpen />, title: t('toolbar.mushaf') },
            ]}
          />
        </div>
        <Button
          variant="ghost"
          size="icon-touch"
          className="sm:hidden"
          onClick={() => onModeChange(mode === 'reading' ? 'mushaf' : 'reading')}
          aria-label={mode === 'reading' ? t('toolbar.mushaf') : t('toolbar.reading')}
        >
          {mode === 'reading' ? <BookOpen /> : <Type />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={s.mask === 'full' ? 'ghost' : 'secondary'}
              size="icon-touch"
              aria-label={t('toolbar.memorize')}
              title={t('toolbar.memorize')}
            >
              <EyeOff />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(92vw,22rem)]">
            <Choice
              label={t('toolbar.memorize')}
              value={s.mask}
              onChange={(mask: MaskLevel) => s.set({ mask })}
              options={MASK_LEVELS.map((m) => ({ value: m, label: t(`mask.${m}`) }))}
            />
            <p className="mt-2 text-xs text-muted-foreground">{t('mask.hint')}</p>
            {mode === 'mushaf' && s.mask === 'first' && <p className="mt-1 text-xs text-muted-foreground">{t('mask.mushafFirst')}</p>}
          </PopoverContent>
        </Popover>

        <Button
          variant={s.tajweed ? 'secondary' : 'ghost'}
          size="icon-touch"
          onClick={() => s.set({ tajweed: !s.tajweed })}
          disabled={!tajweedAvailable}
          aria-pressed={s.tajweed}
          aria-label={t('toolbar.tajweed')}
          title={tajweedAvailable ? t('toolbar.tajweed') : t('toolbar.tajweedReadingOnly')}
        >
          <Palette />
        </Button>
        <Button
          variant={s.panelOpen ? 'secondary' : 'ghost'}
          size="icon-touch"
          onClick={() => s.set({ panelOpen: !s.panelOpen })}
          aria-pressed={s.panelOpen}
          aria-label={t('toolbar.commentary')}
          title={t('toolbar.commentary')}
        >
          <Languages />
        </Button>
        <Button variant="ghost" size="icon-touch" onClick={onOpenSettings} aria-label={t('toolbar.settings')}>
          <Settings />
        </Button>
      </div>
      <div className={cn('h-0.5 bg-gradient-to-r from-transparent via-gold/60 to-transparent')} />
    </header>
  )
}
