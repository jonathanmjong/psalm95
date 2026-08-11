import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveFandomRace } from '../hooks/useLiveFandomRace'
import { useFandomStats } from '../hooks/useFandomStats'
import { useUserProfile } from '../hooks/useUserProfile'
import { usePageMeta } from '../hooks/usePageMeta'
import { ShareButton } from '../components/ShareButton'
import { msUntilWeeklyReset, formatCountdown } from '../lib/dates'
import type { Artist } from '../types'

const PERIODS = [
  { key: 'weeklyVotes', label: 'This week' },
  { key: 'monthlyVotes', label: 'This month' },
  { key: 'yearlyVotes', label: 'This year' },
] as const

function useCountdown() {
  const [ms, setMs] = useState(() => msUntilWeeklyReset())
  useEffect(() => {
    const t = setInterval(() => setMs(msUntilWeeklyReset()), 30_000)
    return () => clearInterval(t)
  }, [])
  return ms
}

const prefersMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches

/**
 * FLIP re-order for the board: remembers each row's offset, and when live counters
 * re-sort the list, starts the row at its old offset and lets CSS glide it to the new
 * one. Rows keep their DOM identity (keyed by artist id) and every row is the same
 * fixed height, so nothing reflows — only transforms animate.
 *
 * `resetKey` (the selected period) wipes the remembered offsets, so switching period
 * re-orders instantly instead of animating a whole-board reshuffle.
 */
function useRowSlide(resetKey: string) {
  const listRef = useRef<HTMLDivElement>(null)
  const offsets = useRef(new Map<string, number>())

  useLayoutEffect(() => {
    offsets.current.clear()
  }, [resetKey])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const animate = prefersMotion()
    const next = new Map<string, number>()
    for (const row of list.querySelectorAll<HTMLElement>('[data-row-id]')) {
      const id = row.dataset.rowId
      if (!id) continue
      const top = row.offsetTop
      next.set(id, top)
      const previous = offsets.current.get(id)
      if (!animate || previous === undefined || previous === top) continue
      row.classList.remove('row-slide')
      row.style.transform = `translateY(${previous - top}px)`
      requestAnimationFrame(() => {
        row.classList.add('row-slide')
        row.style.transform = ''
      })
    }
    offsets.current = next
    // No dependency array on purpose: the row order can change on any commit of this
    // page, and the number tweens live in child state so they never re-run this.
  })

  return listRef
}

export function Fandoms() {
  const { profile } = useUserProfile()
  const [periodKey, setPeriodKey] = useState<(typeof PERIODS)[number]['key']>('weeklyVotes')
  // Live raw vote counters — these do move the instant a vote is cast, unlike the
  // hourly composite score, which is never animated.
  const { artists, loading } = useLiveFandomRace(periodKey)
  const stats = useFandomStats()
  const resetMs = useCountdown()
  const finalHours = resetMs < 6 * 3_600_000

  usePageMeta({
    title: 'Fandom leaderboard | PsalmTune',
    description:
      'Which fandom is voting hardest? Ranked by fan votes this week, month, and year — rally your fellow stans and out-vote them.',
    path: '/fandoms',
  })

  const ranked = artists
    .filter((a) => a.fandomName)
    .map((a) => ({ artist: a, votes: (a[periodKey] as number) ?? 0 }))
    .sort((x, y) => y.votes - x.votes)

  // Underdog: most weekly votes among fandoms ranked outside the top 5.
  const underdog = ranked.length > 6 ? [...ranked.slice(5)].sort((a, b) => b.votes - a.votes)[0] : null

  // The signed-in user's own fandom and its live standing, for the brag/rally card.
  const myIndex = profile?.biasArtistId ? ranked.findIndex((r) => r.artist.id === profile.biasArtistId) : -1
  const mine = myIndex >= 0 ? ranked[myIndex] : null
  const myGapToNext = mine && myIndex > 0 ? ranked[myIndex - 1].votes - mine.votes : 0

  const listRef = useRowSlide(periodKey)

  const medal = (rank: number) =>
    rank === 1
      ? 'text-yellow-400'
      : rank === 2
        ? 'text-slate-400'
        : rank === 3
          ? 'text-amber-600'
          : 'text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]'

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-gradient text-4xl font-extrabold tracking-tight">Fandom leaderboard</h1>
        <p className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Which fandom is voting hardest? Rally your fellow stans and out-vote them.
        </p>
      </header>

      {/* Weekly reset countdown */}
      <div
        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
          finalHours
            ? 'btn-gradient border-transparent'
            : 'border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]'
        }`}
      >
        <span className={finalHours ? 'font-semibold' : ''}>
          {finalHours ? '⏰ Final hours — every vote counts!' : '🗓️ Weekly board resets in'}
        </span>
        <span className={`font-bold tabular-nums ${finalHours ? '' : 'text-[var(--color-accent)]'}`}>
          {formatCountdown(resetMs)}
        </span>
      </div>

      {/* Your fandom — standing + brag/rally share */}
      {mine && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-accent)] bg-[var(--color-accent)]/5 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">
              Your fandom · {mine.artist.fandomName} is{' '}
              <span className="text-[var(--color-accent)]">#{myIndex + 1}</span>
            </div>
            <div className="text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
              {myIndex === 0 ? (
                '👑 On top — defend the crown before the weekly reset.'
              ) : (
                <>
                  <AnimatedNumber key={periodKey} value={myGapToNext} className="tabular-nums" /> votes to
                  overtake #{myIndex}. Rally your fandom.
                </>
              )}
            </div>
          </div>
          <ShareButton
            title={`${mine.artist.fandomName} on PsalmTune`}
            text={
              myIndex === 0
                ? `${mine.artist.fandomName} is #1 on PsalmTune's fandom leaderboard 👑 Help us defend the crown!`
                : `${mine.artist.fandomName} is #${myIndex + 1} on PsalmTune — ${myGapToNext.toLocaleString()} votes from moving up. Vote with us!`
            }
            url={`https://psalmtune.com/fandoms`}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-[var(--color-hairline)] p-0.5 text-sm dark:border-[var(--color-hairline-dark)]">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodKey(p.key)}
              className={`rounded-full px-3 py-1.5 font-medium transition ${
                periodKey === p.key
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Underdog spotlight */}
      {underdog && underdog.votes > 0 && (
        <Link
          to={`/artist/${underdog.artist.id}`}
          className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--color-hairline)] px-4 py-3 text-sm transition hover:shadow-md dark:border-[var(--color-hairline-dark)]"
        >
          <span className="text-lg">🚀</span>
          <span>
            <span className="font-semibold">One to watch:</span> {underdog.artist.fandomName} (
            {underdog.artist.name}) is surging with {underdog.votes.toLocaleString()} votes — help them break the
            top 5.
          </span>
        </Link>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Loading fandoms…
        </p>
      ) : (
        <div ref={listRef} className="space-y-2">
          {ranked.map(({ artist, votes }, i) => (
            <FandomRow
              key={artist.id}
              artist={artist}
              votes={votes}
              periodKey={periodKey}
              rank={i + 1}
              medalClass={medal(i + 1)}
              members={stats[artist.id]?.memberCount ?? 0}
              hearts={stats[artist.id]?.weeklyHearts ?? 0}
              gapToNext={i > 0 ? ranked[i - 1].votes - votes : 0}
              isMine={profile?.biasArtistId === artist.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * A raw counter that tweens to its new value when the live listener delivers a change,
 * with a brief accent flash. Reduced motion gets the new value immediately, no flash.
 * Only ever used for counters that genuinely move per vote — never for rank.
 */
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value)
  // Remount key for the flash: bumping it restarts the CSS animation from scratch.
  const [pulse, setPulse] = useState(0)
  const from = useRef(value)

  useEffect(() => {
    const start = from.current
    if (start === value) return
    from.current = value
    setPulse((p) => p + 1)
    if (!prefersMotion()) {
      setDisplay(value)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 480)
      const eased = 1 - (1 - t) ** 3
      setDisplay(Math.round(start + (value - start) * eased))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])

  // The flash class is withheld until the first change, so a freshly loaded board
  // doesn't light up every row at once.
  return (
    <span key={pulse} className={`${pulse > 0 ? 'count-flash' : ''} ${className ?? ''}`}>
      {display.toLocaleString()}
    </span>
  )
}

function FandomRow({
  artist,
  votes,
  periodKey,
  rank,
  medalClass,
  members,
  hearts,
  gapToNext,
  isMine,
}: {
  artist: Artist
  votes: number
  /** Remounts the tweening numbers on a period switch, so the wholesale value change
   * isn't animated as if votes had been cast. */
  periodKey: string
  rank: number
  medalClass: string
  members: number
  /** Daily hearts this week — a secondary stat only; the ranking stays vote-based. */
  hearts: number
  gapToNext: number
  isMine: boolean
}) {
  return (
    <Link
      to={`/artist/${artist.id}`}
      data-row-id={artist.id}
      // Stable height: both lines are single-line truncated, so every row is exactly the
      // same height no matter what the live counters say — updates and re-sorts never
      // reflow the list, only the FLIP transform moves rows. min-h pins that invariant.
      className={`flex min-h-[66px] items-center gap-4 rounded-2xl border px-4 py-3 transition-shadow duration-200 hover:shadow-md ${
        isMine
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
          : 'border-[var(--color-hairline)] bg-[var(--color-surface)] dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]'
      }`}
    >
      <span className={`w-7 shrink-0 text-center text-lg font-extrabold tabular-nums ${medalClass}`}>{rank}</span>
      {artist.fandomColorHex && (
        <span
          className="h-8 w-8 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: artist.fandomColorHex }}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{artist.fandomName}</span>
          {isMine && (
            <span className="shrink-0 rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
              YOUR FANDOM
            </span>
          )}
        </div>
        <div className="truncate text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          {artist.name}
          {members > 0 && ` · ${members.toLocaleString()} ${members === 1 ? 'member' : 'members'}`}
          {hearts > 0 && ` · 💗 ${hearts.toLocaleString()} this week`}
          {rank > 1 && gapToNext > 0 && (
            <>
              {' · '}
              <AnimatedNumber key={periodKey} value={gapToNext} className="tabular-nums" /> behind #{rank - 1}
            </>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-lg font-bold tabular-nums">
          <AnimatedNumber key={periodKey} value={votes} />
        </div>
        <div className="text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">votes</div>
      </div>
    </Link>
  )
}
