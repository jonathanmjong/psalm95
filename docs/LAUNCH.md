# Launch plan

Researched 2026-08-15. Rules marked **VERIFIED** come from Wayback snapshots of each
subreddit's `/wiki/rules` (the only route that renders server-side); everything else is
marked unverified and should be confirmed in a logged-in browser before posting.

---

## Blockers to settle before posting anywhere

| # | Blocker | Status |
|---|---|---|
| 1 | **No `/about` page** — a suspicious fan's first move is to look for who built this and how ranking works; finding nothing confirms the suspicion | ✅ shipped |
| 2 | **No photo-credit field on uploads** — an uncredited fansite photo is a classic pile-on trigger | ✅ shipped |
| 3 | **Stripe donate flow is wired but hidden** (`functions/src/stripe/checkout.ts`, gated by `VITE_SUPPORT_ENABLED`) — if you post "no monetization" and a Support button appears later, that screenshot is the whole callout | ⬜ **your decision** — say either "there's no way to give me money" or "a donate button is coming; it buys nothing" |
| 4 | **Google-only sign-in** — many K-pop fans run pseudonymous stan accounts and won't attach a real-name Google identity. Biggest conversion leak | ⬜ mitigate: say plainly you only see their email; keep signed-out browsing complete |

**Honesty requirement for all copy:** the ranking is not purely votes — it's ⅓ online
popularity, ⅓ weekly votes, ⅓ monthly votes (`functions/src/ranking/recompute.ts`). Say so
up front. Discovered later it reads as deception; stated early it's the best answer to
"won't the biggest fandom just win?"

### The context that shapes everything

Fandoms are currently running organised campaigns against this exact product category. The
"Shining Awards" surfaced in Jan 2026 with an "ICON of KPOP 2026" vote; fanbases concluded
it monetises fandom traffic with no real award behind it, and now have a reflex, a template
and an audience for the callout. **Disarm suspicion first, invite votes second.**

---

## Channels, ranked

### Tier 1 — start here

**1. r/kpoppers (~84K) — VERIFIED PERMITTED. Your #1 K-pop channel.**
Rule 3 verbatim (snapshot 2024-11-20): *"Self-Promotion Once per Week — Submitting content
from your own channel or blog is permitted, but should be limited to once per week."*
This is the sub r/kpop's own rules name as the home for fan-made work. Flairs include
Research, Misc, Connect, Discussion. Two orders of magnitude smaller than r/kpop, but the
only large K-pop sub where the post is *sanctioned* rather than tolerated.

**2. r/SideProject (~180–790K) — VERIFIED PERMITTED.** Rules: *"Radical Transparency: Don't
hide the ugly parts of your build."* / *"No Landing Page Gates."* / *"Engage, Don't
Broadcast."* Banned: waitlists, marketing copy, vote manipulation, brand-new account
farming, same-day crossposting. Dev audience — a bug-shakeout run with zero fandom risk.

**3. Multi-fandom Discord servers — mod DM first.** Verified sizes: K-Community 25K, KPop
Universe 18K, KPop Empire 16K, KPop Limunary 5K. Confirmed norm across K-pop servers:
self-promotion requires staff approval via private mod DM. Highest yield per unit effort —
one mod's yes converts ban risk into endorsement. Start mid-size, not the 197K rooms.

### Tier 2 — conditional

**4. r/kpopthoughts (282K) — VERIFIED GATE:** *"The karma requirement is 30 (post + comment)
and your account age must be at least 7 days old."* Miss either and the post is silently
auto-removed.

**5. r/kpophelp (242K) — VERIFIED: no launch post possible.** Rule 6: *"Posts Must Ask For
Help."* Rule 4: *"Do not use URL shorteners."* Organic path only — answer real questions the
member profiles genuinely answer, in the comment, citing the profile.

**6. Single-fandom subreddits — ALL RULES UNVERIFIED.** r/blackpink 960K, r/twice 759K,
r/bangtan 750K, r/straykids 245K, r/seventeen 96K. Biggest reach, most scam-sensitised.
Assume restrictive; modmail first, every time. At most one, late.

**7. Twitter/X** — not a community to post into; the discovery layer, and where callouts
happen. The thread's job is to be *screenshot-proof when a skeptic quote-tweets it.*

**8. Kpopalypse (kpopalypse.com)** — runs an interview series and explicitly invites
subjects; profiled Kpopping's owner in April 2025. Third-party coverage does credibility
work you can't do for yourself.

### Unusable

- **r/kpop (3.9M) — VERIFIED BANNED.** Rule 9: *"No Fan-Made Content/Self-Promo… Do not link
  to your own blogs, articles, or work in r/kpop."* The rule itself points to r/kpoppers.
- **Weibo / Bilibili / Xiaohongshu — structurally closed.** Weibo's link whitelist excludes
  personal sites and needs a business + ICP licence.
- **C-pop / J-pop Reddit** — too small or unverified. Despite the tri-regional roster, **this
  is a K-pop launch.**

---

## What NOT to do

**Category-fatal**

1. **Never call it an award; never imply anyone wins anything.** "Ranking board", "weekly race".
2. **No alt accounts, ever** — not to upvote, not to seed the board, not to ask "has anyone tried this?". Reddit bans vote manipulation sitewide; in fandom terms, getting caught confirms the scam hypothesis.
3. **Don't seed fake votes or members.** An empty board you're honest about is recoverable; an inflated one that gets reverse-engineered is not.
4. **Don't ask any fandom to "beat" another.** The 1v1 battle is a race you *watch*, not a war you *win*. Frame it as mobilisation and every K-pop mod treats you as a threat.

**Blacklist-grade**

5. Don't post the same link to several subreddits in a day — the documented trigger for a near-unappealable shadow ban.
6. Don't post from a fresh account. *"It's fine to be a redditor with a website, it's not fine to be a website with a Reddit account"* — ~90% non-promotional activity.
7. **Never use a URL shortener.**
8. Don't post during a comeback, award show or scandal.
9. Don't hit multiple fandoms simultaneously — they watch each other, and it becomes a screenshot collage.
10. Don't exceed r/kpoppers' once-per-week cap.
11. **Don't argue with the first skeptic.** You *will* get "this is a scam". Answer calmly and specifically — link `/about`, explain the ⅓ split, say what data you store. Getting testy is the tell.
12. Don't ignore photo credit.
13. Don't DM the link unsolicited or reply to unrelated fandom tweets with it — that's the scam-bot signature.
14. Don't say "no monetization" unless it's true forever.

---

## Sequencing

**One channel per 3–5 days, never two the same day, never the same wording twice.** Reddit's
spam signal is velocity across communities, so slowness *is* the strategy.

| When | What |
|---|---|
| Weeks −4 to 0 | Settle blocker 3, mitigate 4. Verify rule text yourself. Then *be a member* — comment genuinely in r/kpoppers, r/kpopthoughts, r/kpophelp and 2–3 Discords with no link. This also clears the 30-karma / 7-day gate. |
| Day 0 | **r/SideProject** — the dress rehearsal. Reply to every comment; fix what breaks. |
| Day 3–5 | **Discord mod DMs** — 3–4 mid-size multi-fandom servers. Ask; don't post. Expect ~half no reply. Stay in the server afterwards. |
| Day 7–10 | **Twitter/X thread**, once there's *some* real activity. No paid reach, no mass-tagging. |
| Day 10–14 | **r/kpoppers** — one post, flaired [Misc] or [Research]. Then respect the weekly cap. |
| Week 3+ | **r/kpopthoughts** (gate cleared) + organic answering in r/kpophelp. Low-news day only. |
| Week 3–4 | Email **Kpopalypse**. |
| Week 4+ | At most **one** single-fandom subreddit, modmail first, chosen because that fandom already shows up on the site. |

**Abort conditions.** If a post is removed, don't repost — message the mods and accept the
answer. If a scam accusation gains traction, stop all outreach, reply once calmly in that
thread, let it settle.

---

## First 50 users

Kpopping's owner reports **social media drives under 1% of his traffic — organic search
dominates**, and warns that trying to be "a general K-pop platform" is what killed
competitors. Your search machine is already built (prerendered artist pages, 111-URL
sitemap) but works in months, not weeks. So the first 50 are hand-built, one at a time.

1. **Make the empty board a feature.** Put the real vote count on the homepage. Early
   adopters like being early; what they hate is discovering "busy" was a lie. A visible
   small number is your strongest anti-scam signal — scams inflate, they don't disclose.
2. **Give the first users authorship.** Ask what's wrong with the data, fix it that day,
   tell them you did. That's exactly how Kpopping was built.
3. **Fix the login leak before scaling outreach.** Expect low single-digit visitor→voter
   conversion until then, and don't misread it as "the post failed".
4. **Recruit one fandom at a time.** Pick a mid-size, active, not-mid-comeback fandom and
   get 15–20 of them on. One fandom with a real streak and a filled gallery makes the whole
   site look alive — and gives you an actual weekly matchup instead of a one-runner race.
5. **Use the streak mechanic on the people you have.** Fifteen users with 30-day streaks is
   a living site; 500 one-time visitors is not.
6. **Answer questions the site genuinely answers** in r/kpophelp and Discord help channels —
   in the comment, never link-only.
7. **Email Kpopalypse.** "Solo dev built a ranking site, here's what I learned about ranking
   formulas and fandom fairness" is a real story.
8. **Don't chase a big fandom first.** A hundred ARMY arriving at an empty board behind a
   Google-only login produces a hundred bounces and one sceptical quote-tweet.

**Realistic expectation:** Tier 1 done well yields perhaps 20–60 visitors and single-digit
to low-double-digit signups. That's the normal shape, not failure.

---

## Drafts

Check every number against the live site at the moment you post. Fill the bracketed
monetisation choice in each.

### (a) r/kpoppers self-post

> **Title:** [Misc] I made a free fan ranking site for K-pop, C-pop and J-pop — it's new, it's quiet, and I'd like it torn apart
>
> Disclosure first: this is my own project. I built it, I'm the only person working on it, and I'm posting it here because r/kpop's rules point fan-made stuff to r/kpoppers. Mods, if I've got the flair or the format wrong, tell me and I'll fix it.
>
> It's called PsalmTune (psalmtune.com). It's a ranking board covering K-pop, C-pop and J-pop — 107 artists right now. You get 3 votes a week, plus one free "heart" each day for whichever fandom you've joined. There's a weekly 1v1 fandom matchup and a hall of fame for past winners. Artists have member profiles with birthdays, positions and so on, and photo galleries.
>
> Because a brand-new voting site is exactly what a scam looks like at the moment, let me get ahead of the obvious questions:
>
> - **It is not an award.** Nothing is won. No trophy, no certificate, no ad in Seoul, nothing submitted to anybody. It's a scoreboard on a website.
> - **No ads, nothing for sale.** [Pick one: *There's currently no way to give me money.* / *I'd like to add a small donate button eventually — it would buy nothing: no perks, no extra votes, no ranking effect. Flagging it now so nobody's surprised later.*]
> - **The ranking isn't purely votes,** and I think that's worth saying out loud. It's three equally weighted parts — online popularity, weekly fan votes, monthly fan votes, a third each. So a small fandom voting hard genuinely moves an artist up, but can't conjure a #1 out of nowhere. If you think that balance is wrong, I'd like to hear why.
> - **Sign-in is Google only,** which I know is a dealbreaker for some people, and I understand why. I see your email address and nothing else. Every ranking and profile is browsable without an account.
> - **Photos** are CC-licensed from Wikimedia Commons with the photographer and licence shown on each image. Fan uploads are opt-in and I'll remove anything on request.
>
> Honest state of it: it's brand new and pretty empty. The board right now is mostly the popularity component, because there aren't many votes in it yet. I'm not going to pretend otherwise and I'm not going to fake votes to make it look busier than it is.
>
> What I'd actually find useful: is the ranking formula sensible or annoying? Is the roster missing artists it obviously shouldn't be? Does the weekly fandom race read as fun, or as something that would just start fights? I'd rather hear it now than after more people are using it.

### (b) Single-fandom community version

> **Title:** Made a free ranking site as a side project — [GROUP] is on it, and I'd like to know if it's any good
>
> My own project, I'm the only one working on it, and I read the rules before posting — mods, remove it if I got that wrong.
>
> psalmtune.com is a fan ranking board covering K-pop, C-pop and J-pop, 107 artists so far. 3 votes a week, one daily heart for the fandom you join, and a weekly 1v1 matchup between fandoms. [GROUP] has a profile with member pages and a gallery.
>
> To save you asking: it's not an award and nothing is won, there are no ads and nothing for sale, and the ranking is a third online popularity / a third weekly votes / a third monthly votes — so voting matters, but it isn't the whole score. Sign-in is Google only and I only see your email. You can look around without signing in at all.
>
> It's new and quiet, so the board is thin right now — I'd rather say that than dress it up. Mainly I want to know whether [GROUP]'s profile and member info are actually correct. I put it together from public sources and I'd rather have it fixed by people who'd notice.

### (c) Twitter/X thread

> **1/** I built a thing: psalmtune.com — a free ranking board for K-pop, C-pop and J-pop artists. 107 artists, 3 votes a week, a weekly fandom race.
> It's my own side project. I'm one person. It's new and it's quiet.
> Because "new voting site" is a scam red flag right now, here's everything up front 🧵

> **2/** What it is NOT: it's not an award. Nothing is won — no trophy, no ad in Seoul, nothing submitted anywhere. It's a scoreboard.
> No ads. Nothing for sale. [*/ One day there may be a donate button that buys nothing — no perks, no extra votes. Flagging it now so it's not a surprise later.*]

> **3/** How the ranking actually works, because you should be suspicious of any site that won't tell you:
> ⅓ online popularity
> ⅓ weekly fan votes
> ⅓ monthly fan votes
> Voting genuinely moves things. It just can't fabricate a #1 out of nothing.

> **4/** Sign-in is Google only right now — I know that puts some of you off. I see your email and nothing else, and everything is browsable signed out.
> Photos are CC-licensed from Wikimedia with the photographer credited.
> Roster wrong? Formula bad? Tell me — I'd rather fix it early. psalmtune.com

### (d) Discord — only after a mod says yes

> Hey — thanks to the mods for letting me post this. I'm a solo developer and this is my own project, so take it with that in mind. I made psalmtune.com, a free ranking board for K-pop, C-pop and J-pop artists — 107 so far, 3 votes a week, a daily heart for whichever fandom you join, and a weekly 1v1 fandom race with a hall of fame. Being upfront since new voting sites are rightly getting side-eye lately: it isn't an award, nothing is won, there are no ads and nothing for sale, and the ranking is a third online popularity plus a third weekly votes plus a third monthly votes — so votes count, but they aren't the whole score. Sign-in is Google only and I only see your email; you can browse it all without an account. It's genuinely new and the board is still thin, so I'm not going to pretend it's busy. Mostly I'd like to know if the artist and member info is accurate, and whether the weekly race seems fun or seems like it'd cause fights. Happy to answer anything, including sceptical questions.

---

## Unverified — do not treat as researched

All 19 single-fandom subs (including whether r/bangtan or r/BTS is live), individual Discord
rulebooks, and the meta subs. Also: **zero** credible sourcing was found for mods
specifically banning fan-vote sites — the warnings above rest on the well-documented Shining
Awards backlash, not on any published moderator policy.
