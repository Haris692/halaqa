import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionQualityIndicator,
  useConnectionState,
  useIsMuted,
  useIsSpeaking,
  useLocalParticipant,
  useLocalParticipantPermissions,
  useRoomContext,
  useTracks,
  VideoTrack,
  isTrackReference,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react'
import { ConnectionQuality, ConnectionState, RoomEvent, Track, type RemoteTrackPublication } from 'livekit-client'
import {
  ChevronDown,
  ChevronUp,
  Hand,
  LayoutDashboard,
  LogOut,
  Mic,
  MicOff,
  Signal,
  SignalLow,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { formatTimer, stepRemaining } from '@/core/live/live'
import { parseVerseKey } from '@/core/quran/types'
import { useAuth } from '@/features/auth/store'
import { errorMessage } from '@/features/auth/errors'
import { cn } from '@/lib/utils'
import { chooseRoom, liveToken, updateMe, type LiveParticipant, type LiveState } from '@/services/live'
import { myParticipant, useLive } from './store'

const Dashboard = lazy(() => import('./Dashboard').then((m) => ({ default: m.Dashboard })))

/**
 * Panneau de séance : visio de la salle où l'on se trouve, minuteur, main levée.
 * Il reste monté pendant que l'élève navigue dans le lecteur : changer de page ou de
 * salle ne fait perdre ni la connexion ni la position de lecture.
 */
export function LiveDock() {
  const { t } = useTranslation('live')
  const state = useLive((s) => s.state)
  const sessionId = useLive((s) => s.sessionId)
  const error = useLive((s) => s.error)
  const prefs = useLive((s) => s.prefs)
  const dockOpen = useLive((s) => s.dockOpen)
  const dashboardOpen = useLive((s) => s.dashboardOpen)
  const profile = useAuth((s) => s.profile)
  const me = myParticipant(state, profile?.id)
  const teacher = !!state && state.session.teacher_id === profile?.id
  const [conn, setConn] = useState<{ token: string; url: string; roomId: string } | null>(null)
  const [connError, setConnError] = useState<string | null>(null)

  // nouveau jeton à chaque changement de salle (décidé par la base) : LiveKit se reconnecte seul
  const roomId = me?.room_id ?? null
  useEffect(() => {
    if (!sessionId || !roomId) {
      setConn(null)
      return
    }
    let alive = true
    liveToken(sessionId).then(
      (r) => {
        if (alive) {
          setConn({ token: r.token, url: r.url, roomId: r.room_id })
          setConnError(null)
        }
      },
      (e: unknown) => {
        if (alive) setConnError(errorMessage(t, e))
      },
    )
    return () => {
      alive = false
    }
  }, [sessionId, roomId, t])

  // raccourci clavier du tableau de bord (prof) : Alt+D
  useEffect(() => {
    if (!teacher) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        useLive.getState().setDashboardOpen(!useLive.getState().dashboardOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [teacher])

  // le panneau ne doit jamais couvrir le texte : la page lui réserve sa place (voir index.css)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.live = dockOpen ? 'open' : 'closed'
    return () => {
      delete root.dataset.live
    }
  }, [dockOpen])

  if (!sessionId) return null
  const room = state?.rooms.find((r) => r.id === roomId)

  return (
    <>
      <Announcement state={state} />
      <section
        aria-label={t('dock.label')}
        className={cn(
          'fixed right-2 bottom-20 z-40 flex w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-xl backdrop-blur',
          // grand écran : à gauche, dans la marge que la page lui réserve ; le panneau traduction reste à droite
          'md:bottom-24 lg:right-auto lg:left-4',
        )}
      >
        <header className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{room?.name ?? t('dock.connecting')}</p>
            <p className="truncate text-xs text-muted-foreground">{state?.session.class_name}</p>
          </div>
          {state && <StepTimer state={state} />}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => useLive.getState().setDockOpen(!dockOpen)}
            aria-label={dockOpen ? t('dock.collapse') : t('dock.expand')}
            aria-expanded={dockOpen}
          >
            {dockOpen ? <ChevronDown /> : <ChevronUp />}
          </Button>
        </header>

        {(error || connError) && <p className="px-3 py-2 text-xs text-destructive">{error ?? connError}</p>}

        {conn ? (
          <LiveKitRoom
            token={conn.token}
            serverUrl={conn.url}
            connect
            audio={prefs.mic}
            video={prefs.camera && !prefs.audioOnly}
            options={{ adaptiveStream: true, dynacast: true }}
            onError={(e) => {
              // micro ou caméra refusés par le navigateur : on reste dans la séance, en écoute
              if (e.name === 'NotAllowedError' || /permission denied|not allowed/i.test(e.message)) {
                useLive.getState().setPrefs({ mic: false, camera: false })
                setConnError(t('dock.deviceDenied'))
              } else setConnError(errorMessage(t, e))
            }}
            className="flex flex-col"
          >
            <RoomAudioRenderer />
            <PermissionWatcher />
            {dockOpen && state && <Tiles state={state} />}
            {dockOpen && state && me && <RoomChooser state={state} me={me} />}
            {dockOpen && state && <FocusVerse state={state} />}
            <Controls state={state} me={me} teacher={teacher} />
          </LiveKitRoom>
        ) : (
          <p className="px-3 py-3 text-sm text-muted-foreground">{t('dock.connecting')}</p>
        )}
      </section>
      {teacher && dashboardOpen && (
        <Suspense fallback={null}>
          <Dashboard />
        </Suspense>
      )}
    </>
  )
}

function StepTimer({ state }: { state: LiveState }) {
  const { t } = useTranslation('live')
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const step = state.plan[state.session.current_step]
  const left = stepRemaining(step, state.session.step_started_at, now)
  if (!step || left === null) return null
  return (
    <span
      className={cn('rounded-md px-1.5 py-0.5 text-xs tabular-nums', left < 0 ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground')}
      title={step.title ?? t(`steps.${step.key}`)}
    >
      {formatTimer(left)}
    </span>
  )
}

/** Le serveur retire puis rend le droit de publier (talqîn) : on rallume le micro si l'élève l'avait. */
function PermissionWatcher() {
  const permissions = useLocalParticipantPermissions()
  const { localParticipant } = useLocalParticipant()
  const wantMic = useLive((s) => s.prefs.mic)
  const canPublish = permissions?.canPublish ?? true
  useEffect(() => {
    if (canPublish && wantMic && !localParticipant.isMicrophoneEnabled) void localParticipant.setMicrophoneEnabled(true).catch(() => undefined)
  }, [canPublish, wantMic, localParticipant])
  return null
}

function Tiles({ state }: { state: LiveState }) {
  const audioOnly = useLive((s) => s.prefs.audioOnly)
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false })
  const roomCtx = useRoomContext()

  // audio seul : ne recevoir aucune vidéo (connexions faibles)
  useEffect(() => {
    const apply = () => {
      for (const p of roomCtx.remoteParticipants.values())
        for (const pub of p.videoTrackPublications.values()) (pub as RemoteTrackPublication).setSubscribed(!audioOnly)
    }
    apply()
    roomCtx.on(RoomEvent.TrackPublished, apply)
    return () => {
      roomCtx.off(RoomEvent.TrackPublished, apply)
    }
  }, [audioOnly, roomCtx])

  const floor = state.session.floor_user
  // celui qui a la parole d'abord, puis le prof, puis les autres
  const sorted = useMemo(
    () =>
      [...tracks].sort((a, b) => {
        const score = (x: TrackReferenceOrPlaceholder) =>
          x.participant.identity === floor ? 0 : x.participant.identity === state.session.teacher_id ? 1 : 2
        return score(a) - score(b)
      }),
    [tracks, floor, state.session.teacher_id],
  )
  return (
    <div className="grid max-h-[40dvh] grid-cols-2 gap-1.5 overflow-y-auto p-2">
      {sorted.map((ref) => (
        <Tile
          key={ref.participant.identity}
          trackRef={ref}
          spotlight={ref.participant.identity === floor}
          info={state.participants.find((p) => p.user_id === ref.participant.identity)}
          audioOnly={audioOnly}
        />
      ))}
    </div>
  )
}

function Tile({
  trackRef,
  spotlight,
  info,
  audioOnly,
}: {
  trackRef: TrackReferenceOrPlaceholder
  spotlight: boolean
  info: LiveParticipant | undefined
  audioOnly: boolean
}) {
  const { t } = useTranslation('live')
  const p = trackRef.participant
  const speaking = useIsSpeaking(p)
  const micMuted = useIsMuted({ participant: p, source: Track.Source.Microphone })
  const { quality } = useConnectionQualityIndicator({ participant: p })
  const showVideo = !audioOnly && isTrackReference(trackRef) && !trackRef.publication.isMuted
  const name = info?.display_name ?? p.name ?? '—'

  return (
    <div
      className={cn(
        'relative aspect-video overflow-hidden rounded-lg bg-muted ring-2 ring-transparent transition-shadow',
        speaking && 'ring-green-soft',
        spotlight && 'col-span-2 ring-gold',
      )}
    >
      {showVideo ? (
        <VideoTrack trackRef={trackRef} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-green-deep text-lg font-semibold text-white">
            {name.slice(0, 1).toUpperCase()}
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-[11px] text-white">
        {micMuted ? <MicOff className="size-3 shrink-0" aria-label={t('tile.muted')} /> : <Volume2 className="size-3 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">
          {name}
          {p.isLocal ? ` (${t('tile.you')})` : ''}
        </span>
        {info?.hand_raised_at && <Hand className="size-3 shrink-0 text-gold-soft" aria-label={t('tile.hand')} />}
        {quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost ? (
          <SignalLow className="size-3 shrink-0 text-destructive" aria-label={t('tile.poor')} />
        ) : (
          <Signal className="size-3 shrink-0 opacity-70" aria-label={t('tile.good')} />
        )}
      </div>
      {spotlight && <span className="absolute top-1 left-1 rounded bg-gold px-1.5 text-[10px] font-semibold text-white">{t('tile.floor')}</span>}
    </div>
  )
}

/** Mode « libre choix » : l'élève voit les salles et leur occupation. */
function RoomChooser({ state, me }: { state: LiveState; me: LiveParticipant }) {
  const { t } = useTranslation('live')
  const [error, setError] = useState<string | null>(null)
  if (state.session.room_mode !== 'free' || me.is_teacher) return null
  const breakouts = state.rooms.filter((r) => r.kind === 'breakout')
  if (breakouts.length === 0) return null
  const count = (roomId: string) => state.participants.filter((p) => p.room_id === roomId && !p.is_teacher).length
  return (
    <div className="flex flex-col gap-1 border-t border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{t('dock.chooseRoom')}</p>
      <div className="flex flex-wrap gap-1">
        {breakouts.map((r) => (
          <Button
            key={r.id}
            size="sm"
            variant={me.room_id === r.id ? 'default' : 'outline'}
            disabled={me.room_id === r.id || count(r.id) >= r.capacity}
            onClick={() => chooseRoom(state.session.id, r.id).catch((e: unknown) => setError(errorMessage(t, e)))}
          >
            {r.name} ({count(r.id)}/{r.capacity})
          </Button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/** Verset surligné par le prof : un bouton pour y aller. */
function FocusVerse({ state }: { state: LiveState }) {
  const { t } = useTranslation('live')
  const navigate = useNavigate()
  const focus = state.session.focus_verse
  if (!focus) return null
  const { surah, verse } = parseVerseKey(focus as `${number}:${number}`)
  return (
    <button
      type="button"
      onClick={() => navigate(`/lire/${surah}?v=${verse}`)}
      className="mx-2 mb-1 rounded-lg bg-hl-verse px-3 py-1.5 text-start text-sm text-ink hover:bg-hl-word"
    >
      {t('dock.focus', { verse: focus })}
    </button>
  )
}

function Controls({ state, me, teacher }: { state: LiveState | null; me: LiveParticipant | undefined; teacher: boolean }) {
  const { t } = useTranslation('live')
  const navigate = useNavigate()
  const { localParticipant } = useLocalParticipant()
  const permissions = useLocalParticipantPermissions()
  const connection = useConnectionState()
  const prefs = useLive((s) => s.prefs)
  const canPublish = permissions?.canPublish ?? true
  const handUp = !!me?.hand_raised_at

  const toggleMic = async () => {
    const next = !localParticipant.isMicrophoneEnabled
    useLive.getState().setPrefs({ mic: next })
    await localParticipant.setMicrophoneEnabled(next).catch(() => undefined)
  }
  const toggleCam = async () => {
    const next = !localParticipant.isCameraEnabled
    useLive.getState().setPrefs({ camera: next })
    await localParticipant.setCameraEnabled(next).catch(() => undefined)
  }
  const toggleHand = () => {
    if (!state || !me) return
    void updateMe(state.session.id, me.user_id, { hand_raised_at: handUp ? null : new Date().toISOString() })
  }

  return (
    <div className="flex items-center gap-1 border-t border-border px-2 py-2">
      <Button
        variant={localParticipant.isMicrophoneEnabled ? 'secondary' : 'outline'}
        size="icon-touch"
        onClick={toggleMic}
        disabled={!canPublish}
        aria-label={localParticipant.isMicrophoneEnabled ? t('controls.micOff') : t('controls.micOn')}
        title={canPublish ? undefined : t('controls.floorTaken')}
      >
        {localParticipant.isMicrophoneEnabled ? <Mic /> : <MicOff />}
      </Button>
      <Button
        variant={localParticipant.isCameraEnabled ? 'secondary' : 'outline'}
        size="icon-touch"
        onClick={toggleCam}
        disabled={!canPublish || prefs.audioOnly}
        aria-label={localParticipant.isCameraEnabled ? t('controls.camOff') : t('controls.camOn')}
      >
        {localParticipant.isCameraEnabled ? <Video /> : <VideoOff />}
      </Button>
      {!teacher && (
        <Button variant={handUp ? 'default' : 'outline'} size="icon-touch" onClick={toggleHand} aria-pressed={handUp} aria-label={handUp ? t('controls.handDown') : t('controls.handUp')}>
          <Hand />
        </Button>
      )}
      {teacher && (
        <Button variant="outline" size="touch" className="px-3" onClick={() => useLive.getState().setDashboardOpen(true)} title="Alt+D">
          <LayoutDashboard /> {t('controls.dashboard')}
        </Button>
      )}
      <span className="ms-auto text-[11px] text-muted-foreground">
        {connection === ConnectionState.Connected ? '' : t(`connection.${connection}`, { defaultValue: connection })}
      </span>
      <Button
        variant="ghost"
        size="icon-touch"
        className="text-destructive"
        aria-label={t('controls.leave')}
        onClick={() => {
          useLive.getState().leave()
          navigate('/')
        }}
      >
        <LogOut />
      </Button>
    </div>
  )
}

/** Dernière annonce du prof : affichée en haut de l'écran pendant quelques secondes. */
function Announcement({ state }: { state: LiveState | null }) {
  const { t } = useTranslation('live')
  const latest = state?.announcements[0]
  const [shown, setShown] = useState<string | null>(null)
  const [seen, setSeen] = useState<string | null>(latest?.id ?? null)
  useEffect(() => {
    if (!latest || latest.id === seen) return
    setSeen(latest.id)
    // une annonce plus vieille qu'une minute (arrivée en cours de séance) n'est pas rejouée
    if (Date.now() - Date.parse(latest.created_at) > 60_000) return
    setShown(latest.body)
  }, [latest, seen])
  useEffect(() => {
    if (!shown) return
    const id = setTimeout(() => setShown(null), 12_000)
    return () => clearTimeout(id)
  }, [shown])
  if (!shown) return null
  return (
    <div role="alert" className="fixed inset-x-0 top-3 z-50 mx-auto w-[min(32rem,calc(100vw-1rem))] rounded-xl border border-gold bg-card px-4 py-3 shadow-lg">
      <p className="text-xs font-semibold text-gold">{t('dock.announcement')}</p>
      <p className="text-base">{shown}</p>
    </div>
  )
}
