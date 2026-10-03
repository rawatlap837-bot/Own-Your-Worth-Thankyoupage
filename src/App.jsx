import { useEffect, useRef, useState, useCallback } from 'react'
import {
    CheckCircle2,
    MessageCircle,
    Play,
    Pause,
    Volume2,
    VolumeX,
    RotateCcw,
    AlertCircle,
} from 'lucide-react'

const WHATSAPP_GROUP_LINK =
    'https://chat.whatsapp.com/JUMpqQUF19SLpL09hiCLFi?s=cl&p=i&mlu=4&ilr=4'

const VIMEO_VIDEO_ID = '1224533583'

function formatTime(seconds = 0) {
    if (!Number.isFinite(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
}

export default function App() {
    const iframeRef = useRef(null)
    const playerRef = useRef(null)
    const progressBarRef = useRef(null)
    const feedbackTimeoutRef = useRef(null)
    const isScrubbingRef = useRef(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isMuted, setIsMuted] = useState(true)
    const [ready, setReady] = useState(false)
    const [ended, setEnded] = useState(false)
    const [embedError, setEmbedError] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [feedbackIcon, setFeedbackIcon] = useState(null)

    useEffect(() => {
        let cancelled = false

        function initPlayer() {
            if (cancelled || !iframeRef.current || !window.Vimeo) return
            const player = new window.Vimeo.Player(iframeRef.current)
            playerRef.current = player

            player
                .ready()
                .then(() => {
                    if (cancelled) return
                    setReady(true)
                })
                .catch((err) => {
                    console.warn(
                        "Vimeo player failed to connect — check the video's embed privacy settings on vimeo.com (Settings → Privacy → Where can this be embedded).",
                        err,
                    )
                    setEmbedError(true)
                })

            player.setVolume(0).catch(() => { })

            player
                .getDuration()
                .then((d) => {
                    if (!cancelled) setDuration(d)
                })
                .catch(() => { })

            player.on('play', () => {
                setIsPlaying(true)
                setEnded(false)
            })
            player.on('pause', () => setIsPlaying(false))
            player.on('ended', () => {
                setIsPlaying(false)
                setEnded(true)
            })
            player.on('timeupdate', (data) => {
                if (!isScrubbingRef.current) {
                    setCurrentTime(data.seconds)
                    if (data.duration) setDuration(data.duration)
                }
            })
        }

        if (window.Vimeo && window.Vimeo.Player) {
            initPlayer()
        } else {
            const existing = document.querySelector(
                'script[src="https://player.vimeo.com/api/player.js"]',
            )
            if (existing) {
                existing.addEventListener('load', initPlayer)
            } else {
                const script = document.createElement('script')
                script.src = 'https://player.vimeo.com/api/player.js'
                script.async = true
                script.addEventListener('load', initPlayer)
                script.addEventListener('error', () => setEmbedError(true))
                document.body.appendChild(script)
            }
        }

        return () => {
            cancelled = true
            if (playerRef.current) {
                playerRef.current.unload().catch(() => { })
            }
            if (feedbackTimeoutRef.current) {
                clearTimeout(feedbackTimeoutRef.current)
            }
        }
    }, [])

    const flashFeedbackIcon = (icon) => {
        setFeedbackIcon(icon)
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
        feedbackTimeoutRef.current = setTimeout(() => setFeedbackIcon(null), 500)
    }

    const togglePlay = () => {
        if (!playerRef.current) return
        if (isPlaying) {
            playerRef.current.pause().catch((err) => console.warn('Pause failed:', err))
            flashFeedbackIcon('pause')
        } else {
            playerRef.current.play().catch((err) => {
                console.warn('Play failed — likely an embed privacy restriction:', err)
                setEmbedError(true)
            })
            flashFeedbackIcon('play')
        }
    }

    const toggleMute = () => {
        if (!playerRef.current) return
        const nextMuted = !isMuted
        playerRef.current.setVolume(nextMuted ? 0 : 1).catch(() => { })
        setIsMuted(nextMuted)
    }

    const replay = async () => {
        if (!playerRef.current) return
        try {
            await playerRef.current.setCurrentTime(0)
            await playerRef.current.setVolume(isMuted ? 0 : 1)
            await playerRef.current.play()
            setEnded(false)
        } catch (e) {
            setEnded(false)
        }
    }

    const getTimeFromClientX = useCallback(
        (clientX) => {
            const bar = progressBarRef.current
            if (!bar || !duration) return 0
            const rect = bar.getBoundingClientRect()
            const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
            return ratio * duration
        },
        [duration],
    )

    const seekToClientX = useCallback(
        (clientX) => {
            const time = getTimeFromClientX(clientX)
            setCurrentTime(time)
            if (playerRef.current) {
                playerRef.current.setCurrentTime(time).catch(() => { })
            }
        },
        [getTimeFromClientX],
    )

    const handleProgressPointerDown = (e) => {
        if (!ready || !duration) return
        e.stopPropagation()
        isScrubbingRef.current = true
        seekToClientX(e.clientX)

        const handleMove = (moveEvent) => {
            seekToClientX(moveEvent.clientX)
        }
        const handleUp = (upEvent) => {
            seekToClientX(upEvent.clientX)
            isScrubbingRef.current = false
            window.removeEventListener('pointermove', handleMove)
            window.removeEventListener('pointerup', handleUp)
        }
        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleUp)
    }

    const progressPercent = duration ? Math.min((currentTime / duration) * 100, 100) : 0

    const vimeoSrc =
        `https://player.vimeo.com/video/${VIMEO_VIDEO_ID}` +
        `?controls=0&muted=1&autopause=0&title=0&byline=0&portrait=0` +
        `&dnt=1&transparent=0&keyboard=0&pip=0&playsinline=1`

    return (
        <section className="relative min-h-screen overflow-hidden bg-ink pb-8 pt-12 md:pb-12 md:pt-12">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/4 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amethyst/30 blur-[130px] animate-drift"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-40 -right-16 h-[26rem] w-[26rem] rounded-full bg-gold/20 blur-[120px] animate-drift"
                style={{ animationDelay: '3s' }}
            />

            <div className="relative mx-auto flex max-w-2xl flex-col items-center px-6 text-center md:px-10">
                <div className="animate-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-amethyst-pale">
                    <CheckCircle2 className="h-4 w-4 text-gold" strokeWidth={1.75} />
                    Your Seat Is Reserved
                </div>

                <h1
                    className="animate-rise mt-8 font-display text-[30px] font-medium leading-[1.2] text-cream sm:text-5xl"
                    style={{ animationDelay: '0.12s' }}
                >
                    Thank You. You're In.
                </h1>

                <p
                    className="animate-rise mt-6 max-w-md font-body text-amethyst-pale/90"
                    style={{ animationDelay: '0.3s' }}
                >
                    Check your email for your confirmation and the Zoom link. Watch this quick
                    video while you're here, then join the WhatsApp community below to connect
                    with the other women joining you, get reminders, and be the first to know if
                    anything changes.
                </p>

                <div className="animate-rise mt-10 w-full" style={{ animationDelay: '0.45s' }}>
                    <div className="relative mx-auto aspect-video w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]">
                        <iframe
                            ref={iframeRef}
                            src={vimeoSrc}
                            className="absolute left-1/2 top-1/2 h-[108%] w-[108%] -translate-x-1/2 -translate-y-1/2"
                            style={{ border: 0 }}
                            title="Thank you — watch this quick video"
                            allow="autoplay; fullscreen"
                        />

                        {!embedError && !ended && (
                            <button
                                type="button"
                                onClick={togglePlay}
                                disabled={!ready}
                                aria-label={isPlaying ? 'Pause video' : 'Play video'}
                                className="absolute inset-0 z-[5] cursor-pointer disabled:cursor-default"
                            />
                        )}

                        {feedbackIcon && (
                            <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center">
                                <style>{`
                    @keyframes thankYouVideoIconFlash {
                        0% { opacity: 0; transform: scale(0.85); }
                        15% { opacity: 1; transform: scale(1); }
                        75% { opacity: 1; transform: scale(1); }
                        100% { opacity: 0; transform: scale(1.05); }
                    }
                    `}</style>
                                <span
                                    className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-cream backdrop-blur"
                                    style={{ animation: 'thankYouVideoIconFlash 500ms ease-out' }}
                                >
                                    {feedbackIcon === 'play' ? (
                                        <Play className="h-6 w-6 translate-x-[1px]" strokeWidth={2} />
                                    ) : (
                                        <Pause className="h-6 w-6" strokeWidth={2} />
                                    )}
                                </span>
                            </div>
                        )}

                        {embedError && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-ink px-6 text-center">
                                <AlertCircle className="h-8 w-8 text-gold" strokeWidth={1.75} />
                                <p className="font-body text-sm text-cream/90">
                                    This video can't be controlled from this page yet.
                                </p>
                                <p className="font-body text-xs text-amethyst-pale/70">
                                    On vimeo.com, open this video's Settings → Privacy → "Where can this be embedded" and set it to Anywhere (or add this domain).
                                </p>
                            </div>
                        )}

                        {!embedError && ended && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-ink">
                                <button
                                    type="button"
                                    onClick={replay}
                                    aria-label="Replay video"
                                    className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-ink shadow-[0_10px_30px_-8px_rgba(217,164,65,0.6)] transition hover:scale-105 hover:bg-gold-soft"
                                >
                                    <RotateCcw className="h-6 w-6" strokeWidth={2} />
                                </button>
                                <span className="font-body text-sm text-cream/90">Watch again</span>

                                <button
                                    type="button"
                                    onClick={toggleMute}
                                    aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                                    className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-cream backdrop-blur transition hover:bg-black/80"
                                >
                                    {isMuted ? (
                                        <VolumeX className="h-5 w-5" strokeWidth={2} />
                                    ) : (
                                        <Volume2 className="h-5 w-5" strokeWidth={2} />
                                    )}
                                </button>
                            </div>
                        )}

                        {!embedError && !ended && (
                            <>
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />

                                <div
                                    ref={progressBarRef}
                                    onPointerDown={handleProgressPointerDown}
                                    role="slider"
                                    aria-label="Video progress"
                                    aria-valuemin={0}
                                    aria-valuemax={Math.floor(duration) || 0}
                                    aria-valuenow={Math.floor(currentTime)}
                                    className="absolute inset-x-0 bottom-9 z-20 flex h-5 cursor-pointer touch-none items-center px-3 sm:bottom-11 sm:px-4"
                                >
                                    <div className="relative h-1.5 w-full rounded-full bg-white/30 sm:h-2">
                                        <div
                                            className="absolute inset-y-0 left-0 rounded-full bg-gold"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                        <div
                                            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-cream bg-gold shadow sm:h-4 sm:w-4"
                                            style={{ left: `${progressPercent}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={togglePlay}
                                            disabled={!ready}
                                            aria-label={isPlaying ? 'Pause video' : 'Play video'}
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/55 text-cream ring-1 ring-white/10 backdrop-blur transition hover:bg-black/75 active:scale-95 disabled:opacity-50 sm:h-8 sm:w-8"
                                        >
                                            {isPlaying ? (
                                                <Pause className="h-3.5 w-3.5" strokeWidth={2} />
                                            ) : (
                                                <Play className="h-3.5 w-3.5 translate-x-[1px]" strokeWidth={2} />
                                            )}
                                        </button>
                                        <span className="truncate rounded-full bg-black/40 px-2 py-0.5 font-body text-[10px] tabular-nums text-cream/90 backdrop-blur">
                                            {formatTime(currentTime)} / {formatTime(duration)}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={toggleMute}
                                        disabled={!ready}
                                        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/55 text-cream ring-1 ring-white/10 backdrop-blur transition hover:bg-black/75 active:scale-95 disabled:opacity-50 sm:h-8 sm:w-8"
                                    >
                                        {isMuted ? (
                                            <VolumeX className="h-3.5 w-3.5" strokeWidth={2} />
                                        ) : (
                                            <Volume2 className="h-3.5 w-3.5" strokeWidth={2} />
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <a
                    href={WHATSAPP_GROUP_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="animate-rise group mt-10 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-8 py-4 font-body text-base font-semibold text-ink shadow-[0_10px_30px_-8px_rgba(37,211,102,0.5)] transition-all hover:scale-[1.02] hover:bg-[#22c15e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream"
                    style={{ animationDelay: '0.6s' }}
                >
                    <MessageCircle className="h-5 w-5" strokeWidth={2} />
                    Join the WhatsApp Group
                </a>

            </div>
        </section>
    )
}
