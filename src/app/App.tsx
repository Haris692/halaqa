import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { useTranslation } from 'react-i18next'
import { HighlightLab } from '@/labs/highlight/HighlightLab'
import { LabsHome } from '@/labs/LabsHome'
import { PenLab } from '@/labs/pen/PenLab'

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <TopBar />
      <Routes>
        <Route path="/" element={<LabsHome />} />
        <Route path="/labs/surlignage" element={<HighlightLab />} />
        <Route path="/labs/crayon" element={<PenLab />} />
      </Routes>
    </BrowserRouter>
  )
}

function TopBar() {
  const { t } = useTranslation()
  return (
    <header className="flex items-center justify-between border-b border-gold-soft bg-green-deep px-4 py-2 text-white">
      <Link to="/" className="flex items-baseline gap-2">
        <span className="text-lg font-semibold">{t('appName')}</span>
        <span className="text-xs text-gold-soft">{t('tagline')}</span>
      </Link>
    </header>
  )
}
