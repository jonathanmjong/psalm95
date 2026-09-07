# Feature Research — What to Build Next

**Date:** 2026-08-10
**Method:** Parallel research agents surveyed the most-used K-pop, J-pop, and C-pop fan platforms for engagement/retention mechanics; a separate agent inventoried psalm95's current feature set. Proposed features below were then submitted to **blind verification agents** (independent reviewers who saw only the feature list, not the research rationale) and scored on likely fan/user-interaction impact.

---

## Part 1 — Research findings (condensed)

### K-pop platforms (Weverse, Bubble, Fancafe, IdolChamp, Choeaedol, Whosfan, Mubeat, blip, Stationhead)

Top mechanics, ranked by observed effectiveness:

1. **Streak/anniversary counters that reset on lapse** (Bubble: ~90% of 1.2M subscribers maintained continuous subscription; full-screen celebrations at 100/200/300 days). The most durable retention mechanic is *a number the user is afraid to lose*.
2. **Hard daily caps + nightly/weekly leaderboard resets** (Choeaedol resets rankings at midnight KST; IdolChamp caps 300 votes/day, hearts expire monthly). Missed days are permanently unrecoverable → strongest daily-active driver in the category. Resets keep trailing fandoms from disengaging out of hopelessness.
3. **Ads/effort-for-votes currency** (IdolChamp's 3-currency system, Mubeat's unlimited ad-funded voting). Fans can print voting power with *time* instead of money — removes the class barrier and makes devotion the input.
4. **Votes with real, external, dated consequences** (Show Champion 20% fan vote; MAMA 90% Mnet Plus + 10% X). Points that only buy points die; deadlines supply urgency.
5. **Fan-funded visible support projects** (subway/Times Square ads; Seoul K-pop subway ads grew 76 → 1,576 in four years). The ecosystem's highest-status collective achievement — physical, photographable, dated.
6. **Unscheduled artist livestreams** (Weverse LIVE: 6,558 sessions → >1B views in 2025). Variable-ratio reinforcement.
7. **Ambient activity scoring** (Whosfan Star Chart: reading articles/watching videos moves your artist's public rank). Near-zero activation energy; solves retention *between* comebacks.
8. **Earned-access gating** (Daum Fancafe: trivia quiz + intro post + visit thresholds to unlock 정회원 boards). Effort-justification → higher commitment; creates a legible status hierarchy.
9. **Synchronized collective action with a visible shared counter** (Stationhead streaming parties: 125K → 1M MAU in one month; Choeaedol's 55,555,555-vote milestones). Replaces "my vote doesn't matter" with watching the number move because of you.
10. **Schedule/calendar utility with push reminders** (blip: 10-min-before pushes for comebacks, birthdays, broadcasts). Calendars are checked daily by definition; the reminder push does what gamification can't.

**Cross-cutting:** competition and monetization are the same mechanic in this category — competitive advantage is what fans pay (time or money) for. The unexploited seam is the **reference layer** (kprofiles-style sites carry huge SEO discovery traffic with zero retention mechanics — psalm95's member-bio pages sit exactly on this seam).

### J-pop culture (AKB sōsenkyō, handshake events, cheki, nama-shashin, Oricon)

- **One purchase = one vote/ticket/pull**: the AKB48 general election (peak 3.84M ballots, 2.66M copies of a single sold), handshake tickets (2–10 seconds of contact per CD), and blind-pack random photos all gate access/participation behind a repeatable purchase. The *access token* is the product.
- **The annual "general election" as event television**: a yearly, high-stakes, publicly-ranked showdown with permanent records — fans plan around it for months.
- **Collect-the-set randomness** (nama-shashin blind packs) spawned an entire trading subculture (Mercari trading, dedicated trade-matching tools). Gacha psychology drives repeat engagement even when each unit is cheap.
- **Cheki economy**: ~¥10B/year industry built on 10–30-second interactions — scarce, personal, physical artifacts.
- Japan's loop is physical-native and costly per repetition; K-pop's is digital-native and free-repeatable. A web platform should borrow Japan's *event structure and collecting psychology*, not its pay-per-action economics.

### C-pop platforms (Weibo 超话, survival-show voting, bilibili, NetEase, Owhat/Modian)

See `FEATURE_RESEARCH_CPOP.md` addendum (research agent report). Headlines relevant here:

- **Weibo 超话 daily 签到 (check-in)** is the canonical daily-return mechanic: one tap/day builds personal rank within the fan circle and contributes to the fandom's public super-topic ranking.
- **Regulatory caution**: China's 2021 清朗 campaign banned celebrity ranking lists and pay-to-vote mechanics after the milk-cap voting scandal — evidence that *unbounded* pay-for-rank designs invite backlash and platform risk. Keep voting effort-based, not purchase-based.
- **bilibili's 一键三连** (like+coin+favorite in one long-press) shows the value of bundling multiple cheap actions into one satisfying gesture with visible artist benefit.

---

## Part 2 — Where psalm95 stands

**Existing loops (working):** 3-votes/week scarcity + weekly reset countdown, daily vote streak (🔥 pill), fandom leaderboard with gap-to-overtake, weekly battle, Hall of Fame with win-streak narrative, photo hearts that change the artist hero image, upload competition, 8 client-side achievements, referrals.

**Engagement-critical gaps found in the codebase audit:**

| Gap | Why it matters |
|---|---|
| **Zero notifications** (no push, no email, no in-app center) | Every loop relies on the user remembering to return unprompted. This is the single biggest structural gap vs. every platform studied. |
| **"Live" race isn't live** (`useAllArtists` is a one-shot cached `getDocs`) | A vote produces no visible movement for up to an hour → severs action from reward. |
| **Achievements are client-render-only** | No unlock moment, no persistence, no sharing → nearly zero motivational value. |
| **No public profiles / user identity** | No status to accumulate; fandom membership is invisible to other fans. |
| **Battle has no history/archive** | Weekly wins evaporate; no season narrative. |
| **Upload lockout bug** | 3-upload cap + no delete UI = permanent lockout (dead `deletePicture` callable). |
| **Rules hole**: clients can create picture docs directly, bypassing quota | Integrity risk for any photo-competition feature. |
| Streak only counts artist votes | Hearts/comments/battles don't advance it → streak is fragile and narrow. |

---

## Part 3 — Proposed features (candidates for verification)

Ranked by expected interaction impact ÷ build effort. Each cites the mechanic it borrows and its evidence base.

### F1. Daily check-in + daily free vote ("Daily Heart")
Convert the weekly-only loop into a daily one. Each day a signed-in user can claim 1 Daily Heart (a lightweight vote worth a fraction of a weekly vote, e.g. counted separately or at 0.2× weight) via one tap. Unclaimed hearts don't accumulate — **missing a day is unrecoverable** (IdolChamp/Choeaedol cap mechanic, Weibo 签到). Check-in itself advances the existing streak.
*Build:* new `claimDailyHeart` callable + `dailyHearts` counter on artist + streak integration. Effort: S.

### F2. Notifications: streak risk, overtaken alerts, battle/birthday reminders
FCM web push + an in-app notification bell. Triggers: "🔥 Your N-day streak ends in 3 h", "😱 [Rival fandom] just overtook you — 42 votes behind", "⚔️ New face-off is live", "🎂 [Member]'s birthday today", "⏰ Final hours before weekly reset". blip's utility-push model + the X "voting closes in 3 h" coordination pattern.
*Build:* FCM token registry, notification prefs doc, scheduled trigger functions piggybacking on existing jobs. Effort: M–L. **Force multiplier for every other loop.**

### F3. Make the race actually live
Switch `/fandoms` leaderboard and Home top-N to `onSnapshot`; animate rank/vote changes (count-up ticks, row swap animations). A cast vote should visibly move a number within seconds (Stationhead's watch-the-counter effect; severed action→reward link is the current #1 UX flaw).
*Build:* swap cached `getDocs` for listeners on the top slice; optimistic local increment. Effort: S–M.

### F4. Fandom quiz gate → "Certified fan" status + public profiles
Per-artist trivia quiz (generated from existing seeded member bios — birthdays, positions, zodiac, debut). Passing grants a **Certified [Fandom] Member** badge, flair on comments, and unlocks a small perk (e.g. +1 weekly vote or exclusive flair color). Public profile page shows badges, streak, fandom, vote totals (Daum Fancafe 정회원 effort-justification mechanic).
*Build:* quiz bank from `members[]` seed data, `certifications` map on user doc, public `profiles/{uid}` projection doc (keeps `users/{uid}` private), profile route. Effort: M.

### F5. Fandom milestone projects with a live shared counter
Per-fandom collective goals: "ARMY: 10,000 hearts this month → [artist] takes over the homepage hero for a week + permanent milestone plaque in Hall of Fame." Live progress bar, contributor count (Choeaedol's 55,555,555 milestones; subway-ad projects as the status ceremony — our "billboard" is the site's front page).
*Build:* `fandomProjects/{id}` doc with target/progress, incremented in vote/heart callables; homepage takeover flag. Effort: M.

### F6. Photocard collection (daily pull, complete-the-set)
Daily free "card pull" from the artist's existing picture pool, rendered as collectible photocards (rarity tiers by photo vote-count). Collection album on profile; set-completion badges per artist/member (nama-shashin blind-pack psychology; FanPlus photocard features). Uses only existing CC-licensed/seeded images — no new content needed.
*Build:* deterministic daily pull callable, `users/{uid}/cards` subcollection, album UI. Effort: M.

### F7. Server-side achievements with unlock moments + shareable cards
Move achievement computation into callables/functions, persist unlocks with timestamps, fire a celebration modal at unlock (Bubble's 100-day full-screen celebrations), and generate a shareable OG-image badge card ("I'm a 30-day Unbreakable on psalm95"). Add fandom-level achievements ("first fandom to 1,000 members").
*Build:* achievement check in existing callables, `users/{uid}/achievements` subcollection, share-card route (prerendered OG). Effort: M.

### F8. Battle seasons: archive, brackets, and an annual "General Election"
Persist every weekly battle to `battles/{weekId}`; add a battle-history page; run quarterly 8-team single-elimination brackets seeded by composite score; crown a yearly champion in an **annual site-wide "General Election" event week** with its own countdown and permanent monument page (AKB sōsenkyō event structure; battle-archive gap from the audit).
*Build:* stop overwriting `battles/current`, bracket scheduler function, season pages. Effort: M–L.

### F9. Ambient fan score (activity → rank contribution)
Low-key points for actions users already take — viewing an artist page, hearting, commenting, sharing — feeding (a) a personal "fan score" per fandom shown on profiles/leaderboard, and (b) a small "engagement" component visible on the fandom leaderboard (Whosfan Star Chart: passive consumption moves a public rank; retains between vote windows). Cap per-day earnings to prevent farming.
*Build:* batched activity-event callable with daily caps, `fanScores/{uid}_{artistId}`. Effort: M.

### F10. Streak deepening: any-action streaks + streak insurance
Any engagement action (vote, heart, comment, battle, check-in) sustains the daily streak; add one earnable "streak freeze" per 30 days (borrow Duolingo-via-Bubble loss-aversion); milestone celebrations at 7/30/100/365 days with shareable cards.
*Build:* widen streak logic in callables, freeze token on user doc. Effort: S.

**Fix-first (prerequisites, not features):** upload delete UI (wire the existing `deletePicture` callable — currently a permanent lockout bug), close the picture-doc creation rules hole, harden comments (server timestamp, rate limit), prune the unbounded `weeklyArtistVotes` map.

---

## Part 4 — Blind verification results

Three independent Opus verifiers scored the bare feature list (no access to Parts 1–3 rationale, no access to each other):
**E** = growth/retention expert · **S** = superfan/community moderator · **K** = skeptical product analyst (read the actual codebase; small-user-base lens)

| # | Feature | E | S | K | Reconciled verdict |
|---|---------|---|---|---|--------------------|
| F1 | Daily check-in + daily free vote | 9 | 7 | 8 SHIP | **SHIP FIRST** — unanimous. Conditions below. |
| F2 | Notifications | 9 | 8 | 5 (email-first: 7) | **SHIP, email-first** — verified Google emails already exist; web push needs a PWA surface (none exists) and iOS home-screen install. Per-type toggles, overtaken-alert cooldowns (~2/day cap). |
| F3 | Live race | 8 | 9 | 3 CUT | **SHIP DESCOPED** — honest version only: optimistic +1 animation on the vote button and live vote counters on `/fandoms` (raw `weeklyVotes` *does* respond to votes; the hourly composite rank does not — never animate that as if it did). Full animated rank-race deferred until traffic makes counters move visibly. |
| F4 | Quiz gate + public profiles | 6 (quiz 4) | 4 (quiz is the problem) | 2 CUT | **CUT quiz gate** (unanimous: answer-key leakage, gatekeeping optics, permanent content burden). **DEFER profiles**: real value, but requires chosen handles (Google `displayName` = real names → harassment exposure), privacy defaults, blocking. |
| F5 | Fandom milestone projects | 8 | 8 | 4 SHIP-LATER | **SHIP-LATER** — conditions converge: auto-scale goals from `fandomStats.memberCount`, non-competitive (any fandom hitting its bar gets the reward, queued), reward = artist-page banner + permanent plaque, **never** the homepage (ranking neutrality/SEO), count distinct contributors not raw actions. |
| F6 | Photocard collection | 7 (raw 9, risk-disc.) | 9 | 2 CUT | **DEFER, rights-gated** — highest raw fan appeal (S: most word-of-mouth) but 2 of 3 flag the image pool as the blocker: CC press shots + user uploads aren't collectible-grade, fansite/licensing backlash risk, rarity-per-member drama. Needs a clean image source before any engineering. Free-only forever if built. |
| F7 | Achievements v2 | 5 | 5 | 3 CUT | **CUT standalone** — unanimous weakness. Do the 20-minute fix instead: retune `weekly-warrior`/`unbreakable` so they're attainable. Fold shareable milestone cards into F10 later. No interrupting modals ever. |
| F8 | Battle seasons + General Election | 7 | 8 | archive 5 / rest 2 | **SPLIT: ship the archive NOW as a bug fix** (`createWeeklyBattle` permanently destroys each week's matchup; ~10 lines to copy to `battleArchive/{weekId}`). Brackets + annual event deferred until weekly-battle turnout is decisive and anti-fraud exists — a 4–2 quarterfinal reads as abandonment; a botted General Election permanently discredits the site. Publish seeding rules before any bracket. |
| F9 | Ambient fan score | 3 | 3 | 2 CUT | **CUT** — unanimous. Client-reported activity is unverifiable, farmable, and corrupts leaderboard legibility — the product's core asset. |
| F10 | Streak deepening | 8 | 7 | 6 (freeze yes, "any action" no) | **SHIP freeze + honest milestones with F1** — the freeze targets the single worst churn moment (missed day → never returns). **Drop "any action sustains the streak"** (2 of 3: dilutes the signal; collides with F1's claim ritual — the daily claim IS the streak action). Milestones at 3/7/14/30 only until someone can actually reach higher. Never sell freezes. |

### Codebase defects surfaced by verification (fix regardless of roadmap)

1. **Streak is unwinnable past 6 days** — it only advances inside `castArtistVote` (3 votes/week), so `weekly-warrior` (7-day) and `unbreakable` (30-day) achievements are mathematically unreachable. F1 fixes this structurally.
2. **Weekly battle data is destroyed every Monday** — `battles/current` is overwritten with no archive while `battleVotes` are retained. Archive before overwrite.
3. **Day boundary is UTC** (`functions/src/dates.ts`) — streak "days" roll over at 09:00 KST/JST, mid-morning for the core audience. Decide the boundary before F1 ships.
4. **Upload lockout** — 3-active-upload cap with no delete UI (`deletePicture` callable exists, nothing calls it).
5. **Rules hole** — clients can create picture docs directly, bypassing the upload quota.

### Cross-cutting conditions (from ≥2 verifiers)

- **Account integrity is a prerequisite, not a hardening pass** — multi-accounting/bots are the default in fandom voting; one credible "the rankings are fake" narrative outweighs every feature here. Rate limits + a published, legible scoring rule minimum.
- **Daily votes must be a separate, lighter currency** than the 3 weekly votes, decided *before* launch — otherwise daily volume (~70% of all votes) silently converts the leaderboard from intensity to headcount, and rebalancing after fandoms anchor on results causes a trust crisis.
- **Judge every ship against two metrics only**: D7 return rate and weekly users casting ≥1 vote. "Actions per session"/"achievements unlocked" will rise for anything and mean nothing.
- The C-pop regulatory findings (`FEATURE_RESEARCH_CPOP.md`) independently endorse the same shape: free-action inputs, community-not-person competition framing, no purchasable ranking power, breadth (distinct participants) weighted over depth.

---

## Recommended build order (final, post-verification)

1. **Fix-first bundle** — battle archive (stops ongoing data loss), upload delete UI, picture-rules hole, retune the two unreachable achievements.
2. **F1 + F10 in one release** — daily check-in vote (separate lighter currency, timezone-decided boundary) + streak freeze + milestones 3/7/14/30. This converts the product from weekly to daily; everything else multiplies the return rate this creates.
3. **F2, email-first** — "streak breaks tonight" + "final hours before reset" scheduled emails (verified addresses already on file; ~a day of work). Measure open→visit before investing in web push/PWA.
4. **F3 descoped** — optimistic vote feedback + live raw-vote counters on `/fandoms`.
5. **F5** — auto-scaled fandom milestone projects, once fandom sizes make bars move visibly.
6. **Gated/later**: F8 brackets + annual General Election (after turnout + integrity), F6 photocards (after rights review), public profiles (after handle system).
7. **Cut**: F9 ambient score, F4 quiz gate, F7 standalone achievements system.
