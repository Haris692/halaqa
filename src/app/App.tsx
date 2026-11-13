import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router'
import { useTranslation } from 'react-i18next'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { useApplyTheme } from '@/features/settings/useApplyTheme'
import { ContinueTestPage } from './pages/ContinueTestPage'
import { HomePage } from './pages/HomePage'
import { MushafReaderPage, SurahReaderPage } from './pages/ReaderPage'
import { TrainingHubPage } from './pages/TrainingHubPage'
import { TrainingPage } from './pages/TrainingPage'

// Les labos de la phase 0 sont chargés à la demande : ils n'alourdissent pas le lecteur.
const LabsHome = lazy(() => import('@/labs/LabsHome').then((m) => ({ default: m.LabsHome })))
const HighlightLab = lazy(() => import('@/labs/highlight/HighlightLab').then((m) => ({ default: m.HighlightLab })))
const PenLab = lazy(() => import('@/labs/pen/PenLab').then((m) => ({ default: m.PenLab })))
// Les écrans de comptes ne sont chargés que lorsqu'on les ouvre.
const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const JoinPage = lazy(() => import('@/features/auth/JoinPage').then((m) => ({ default: m.JoinPage })))
const AccountPage = lazy(() => import('@/features/auth/AccountPage').then((m) => ({ default: m.AccountPage })))
const PrivacyPage = lazy(() => import('@/features/auth/PrivacyPage').then((m) => ({ default: m.PrivacyPage })))
const TeacherHomePage = lazy(() => import('@/features/classes/TeacherPages').then((m) => ({ default: m.TeacherHomePage })))
const ClassPage = lazy(() => import('@/features/classes/TeacherPages').then((m) => ({ default: m.ClassPage })))
const StudentPage = lazy(() => import('@/features/classes/TeacherPages').then((m) => ({ default: m.StudentPage })))
const MyProgressPage = lazy(() => import('@/features/classes/TeacherPages').then((m) => ({ default: m.MyProgressPage })))
const AdminPage = lazy(() => import('@/features/admin/AdminPage').then((m) => ({ default: m.AdminPage })))

const STAFF = ['teacher', 'admin'] as const

export function App() {
  useApplyTheme()
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lire/:surah" element={<SurahReaderPage />} />
        <Route path="/page/:page" element={<MushafReaderPage />} />
        <Route path="/entrainement" element={<TrainingHubPage />} />
        <Route path="/entrainement/continuer" element={<ContinueTestPage />} />
        <Route path="/entrainement/sourate/:surah" element={<TrainingPage />} />
        <Route element={<Lazy />}>
          <Route path="/connexion" element={<LoginPage />} />
          <Route path="/rejoindre/:code?" element={<JoinPage />} />
          <Route path="/confidentialite" element={<PrivacyPage />} />
          <Route path="/compte" element={<RequireAuth><AccountPage /></RequireAuth>} />
          <Route path="/progression" element={<RequireAuth roles={['student']}><MyProgressPage /></RequireAuth>} />
          <Route path="/prof" element={<RequireAuth roles={STAFF}><TeacherHomePage /></RequireAuth>} />
          <Route path="/prof/classe/:id" element={<RequireAuth roles={STAFF}><ClassPage /></RequireAuth>} />
          <Route path="/prof/eleve/:id" element={<RequireAuth roles={STAFF}><StudentPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminPage /></RequireAuth>} />
        </Route>
        <Route path="/labs" element={<LabsLayout />}>
          <Route index element={<LabsHome />} />
          <Route path="surlignage" element={<HighlightLab />} />
          <Route path="crayon" element={<PenLab />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function Lazy() {
  const { t } = useTranslation()
  return (
    <Suspense fallback={<p className="p-6 text-muted-foreground">{t('loading')}</p>}>
      <Outlet />
    </Suspense>
  )
}

/** Les labos de la phase 0 gardent leur bandeau d'origine. */
function LabsLayout() {
  const { t } = useTranslation()
  return (
    <>
      <header className="flex items-center justify-between border-b border-gold-soft bg-green-deep px-4 py-2 text-white">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold">{t('appName')}</span>
          <span className="text-xs text-gold-soft">{t('tagline')}</span>
        </Link>
      </header>
      <Suspense fallback={<p className="p-4 text-muted-foreground">{t('loading')}</p>}>
        <Outlet />
      </Suspense>
    </>
  )
}
