import { useEffect } from 'react'
import { useSettings } from './store'

/** Applique le thème choisi (clair, nuit, contraste élevé) sur <html>. */
export function useApplyTheme() {
  const theme = useSettings((s) => s.theme)
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('contrast', theme === 'contrast')
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'dark' ? '#14130f' : theme === 'contrast' ? '#000000' : '#1f4d3a')
  }, [theme])
}
