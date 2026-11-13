import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { TAJWEED_FAMILIES, RULES_BY_FAMILY, type TajweedFamily } from '@/core/tajweed/rules'
import { Choice } from '@/features/ui/Choice'
import { FONT_MAX, FONT_MIN, useSettings, type Theme } from './store'

export function SettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation('reader')
  const s = useSettings()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(92vw,26rem)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('settings.title')}</SheetTitle>
          <SheetDescription>{t('settings.saved')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          <Choice
            label={t('settings.theme')}
            value={s.theme}
            onChange={(theme: Theme) => s.set({ theme })}
            options={[
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
              { value: 'contrast', label: t('settings.themeContrast') },
            ]}
          />
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">{t('settings.fontSize', { px: s.fontSize })}</Label>
            <Slider
              value={[s.fontSize]}
              min={FONT_MIN}
              max={FONT_MAX}
              step={1}
              onValueChange={([v]) => v !== undefined && s.set({ fontSize: v })}
            />
            <p className="quran text-center text-green-deep" style={{ fontSize: s.fontSize }}>
              بِسۡمِ ٱللَّهِ
            </p>
            <p className="text-xs text-muted-foreground">{t('settings.pinchHint')}</p>
          </div>
          <Separator />
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-2">
              <span>{t('settings.tajweed')}</span>
              <Switch checked={s.tajweed} onCheckedChange={(tajweed) => s.set({ tajweed })} />
            </label>
            {s.tajweed && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-muted-foreground">{t('settings.tajweedOnly')}</Label>
                  <Select
                    value={s.tajweedOnly ?? 'all'}
                    onValueChange={(v) => s.set({ tajweedOnly: v === 'all' ? null : (v as TajweedFamily) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('settings.tajweedAll')}</SelectItem>
                      {TAJWEED_FAMILIES.map((f) => (
                        <SelectItem key={f} value={f}>
                          {t(`tajweed.${f}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <TajweedLegend />
                <p className="text-xs text-muted-foreground">{t('settings.tajweedNote')}</p>
              </>
            )}
          </div>
          <Separator />
          <Button variant="outline" onClick={s.reset}>
            {t('settings.reset')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Légende : un exemple de couleur par famille de règles. */
export function TajweedLegend() {
  const { t } = useTranslation('reader')
  return (
    <ul className="tj-on grid grid-cols-2 gap-1.5 text-sm">
      {TAJWEED_FAMILIES.map((f) => (
        <li key={f} className="flex items-center gap-2">
          <span className={`tj tj-${RULES_BY_FAMILY[f][0]} text-lg leading-none`} aria-hidden>
            ●
          </span>
          {t(`tajweed.${f}`)}
        </li>
      ))}
    </ul>
  )
}
