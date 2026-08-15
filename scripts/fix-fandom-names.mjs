#!/usr/bin/env node
/**
 * Backfills and corrects artist `fandomName` values in the live Firestore project.
 *
 * Background: the bio seeder left 12 artists with no `fandomName` at all, which used to take
 * the whole join-fandom CTA off their artist page, and left them out of /fandoms entirely
 * (the board filters on `fandomName`). It also wrote the garbage value "Yoa's" for YOASOBI,
 * and gave NCT 127 and NCT Dream the same name ("NCTzen"), so the leaderboard shows two
 * identical rows.
 *
 * Every name below is a researched, sourced fandom name — see the `source` field on each
 * entry. Where an artist has no official fandom name, the entry is marked `skip` with the
 * reason rather than inventing one; the UI now falls back to "Join <artist>'s fandom".
 *
 * Rules:
 *   - Only `fandomName` (and `fandomColorName`/`fandomColorHex` where explicitly given) is
 *     written. Nothing else on the artist doc is touched.
 *   - An artist whose stored value already matches the researched name is left alone.
 *   - An artist whose stored value differs from BOTH the current expectation and the new name
 *     is reported as a conflict and skipped, so a later manual edit is never clobbered.
 *   - `skip` entries are never written.
 *
 * Usage:
 *   node scripts/fix-fandom-names.mjs            # dry run (default)
 *   node scripts/fix-fandom-names.mjs --apply    # write changes
 *
 * Auth: application default credentials against project jj-psalm95, the same pattern used by
 * scripts/repair-artist-photos.mjs. Run `gcloud auth application-default login` first if you
 * have not already.
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const PROJECT_ID = 'jj-psalm95'

// firebase-admin lives under functions/.
const functionsRequire = createRequire(resolve(here, '../functions/package.json'))
const { initializeApp, applicationDefault } = functionsRequire('firebase-admin/app')
const { getFirestore } = functionsRequire('firebase-admin/firestore')

// --- args ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const unknown = args.filter((a) => !['--apply', '--dry-run'].includes(a))
if (unknown.length > 0) {
  console.error(`Unknown argument(s): ${unknown.join(', ')}`)
  console.error('Usage: node scripts/fix-fandom-names.mjs [--dry-run|--apply]')
  process.exit(1)
}

// --- the researched table -------------------------------------------------------------

/**
 * One entry per artist this script is responsible for.
 *
 *   fandomName  the researched name to write, or null together with `skip`
 *   expect      the value currently stored, as verified against production. `null` means the
 *               field is expected to be absent. A mismatch is reported and skipped.
 *   skip        reason this artist is deliberately left unset (no official fandom name)
 *   source      where the name was verified
 */
const JA_WIKI = 'https://ja.wikipedia.org/wiki/'
const EN_WIKI = 'https://en.wikipedia.org/wiki/'

const ENTRIES = [
  // --- names that genuinely exist and are missing ------------------------------------
  {
    id: 'kingandprince',
    expect: null,
    fandomName: 'Tiara',
    // 「ファンネームは「ティアラ」」 — chosen at the group's debut event on 2018-05-26 and
    // named by member Genki Iwahashi. (Male fans are 「オスティアラ」/Ostiara.)
    source: `${JA_WIKI}King_%26_Prince — ファンネームは「ティアラ」`,
    confidence: 'high',
  },
  {
    id: 'lisa',
    expect: null,
    fandomName: 'LiSAkko',
    // 「また、自身のファンのことは「LiSAッ子」と呼んでいる。」 — LiSA's own name for her fans,
    // corroborated by her official fan-club event series 「リアルLiSAッ子祭」. Romanized here to
    // match the roster's existing convention (e.g. Momoiro Clover Z -> "Mononofu"). Her fan
    // club is separately named 「リサラボっ。」(LiSA Lab).
    source: `${JA_WIKI}LiSA — 自身のファンのことは「LiSAッ子」と呼んでいる`,
    confidence: 'high',
  },
  {
    id: 'zhou-shen',
    expect: null,
    // Held back deliberately: this is the one entry sourced from community discussion rather
    // than an announcement, and a wrong fandom name is exactly the detail that costs a new
    // fan site its credibility. JoinFandomButton's fallback covers it until it's confirmed.
    fandomName: null,
    // 生米 (shēngmǐ, "raw rice") — 深/生 are near-homophones and Zhou Shen likes rice. Adopted
    // after his debut, replacing the earlier 布丁 (which collided with Aaron Yan's fandom).
    // C-pop fandom names are community-adopted and used back by the artist rather than
    // decreed by an agency; this is the lowest-confidence entry in the table.
    source: 'https://zhuanlan.zhihu.com/p/370275711 (米缸相关小历史); https://www.zhihu.com/question/368227712',
    confidence: 'medium',
  },

  // --- corrections to values already stored ---------------------------------------------
  {
    id: 'nct127',
    expect: 'NCTzen',
    fandomName: 'NCTzen 127',
    // The umbrella fandom is NCTzen (엔시티젠, revealed by Taeyong on V LIVE 2017-06-12), which
    // is why both units were seeded with the same string. SM's own per-unit designations come
    // from the fanclub memberships opened 2023-09-12: NCTzen 127, NCTzen DREAM, NCTzen WISH
    // (WayV's is WayZenNi). Fan shorthands like "127zen"/"Dreamzen" are NOT official, and
    // "Dreamies" names the MEMBERS, not the fans.
    source: 'https://en.namu.wiki/w/NCTzen; corroborated by ' + `${JA_WIKI}NCT_DREAM (日本ファンクラブ「NCTzen …」)`,
    confidence: 'high',
  },
  {
    id: 'nct-dream',
    expect: 'NCTzen',
    fandomName: 'NCTzen DREAM',
    source: 'https://en.namu.wiki/w/NCTzen; corroborated by ' + `${JA_WIKI}NCT_DREAM (日本ファンクラブ「NCTzen …」)`,
    confidence: 'high',
  },

  // --- deliberately left unset: no official fandom name exists -------------------------
  // J-pop and C-pop acts largely do not use K-pop-style fandom names. Several of these run
  // an official *fan club*, which is a paid membership scheme, not a name for the fans —
  // inventing one would be exactly the fabrication this whole pass is meant to remove. The
  // UI now falls back to "Join <artist>'s fandom" for these.
  {
    id: 'akb48',
    expect: null,
    skip: 'no fan name; the official fan club is 「柱の会」(Hashira no Kai), a membership scheme rather than a name for the fans',
    source: `${JA_WIKI}AKB48 — 公式ファンクラブ『柱の会』`,
  },
  {
    id: 'arashi',
    expect: null,
    skip: 'no fan name; アラシック/ARASHIC is the title of their 2006 album, not a fan designation, and members pushed back on its use as one',
    source: `${JA_WIKI}ARASHIC; https://dic.pixiv.net/a/アラシック`,
  },
  {
    id: 'nogizaka46',
    expect: null,
    skip: 'no group fan name (乃木オタ is self-coined slang). Individual members have their own, and sister groups do too (Sakurazaka46 = Buddies, Hinatazaka46 = おひさま) — which is where the confusion comes from',
    source: 'https://sakamichidatabase.penguinelegy.com (乃木坂46 ファンネーム一覧)',
  },
  {
    id: 'snowman',
    expect: null,
    skip: 'no fan name; スノ担 (Suno-tan) is the de-facto term and candidates like スノーメン were never adopted',
    source: 'https://idea-noto.com/snowman-fanname/; https://cutie-media.com/archives/400',
  },
  {
    id: 'sixtones',
    expect: null,
    skip: 'no fan name BY DELIBERATE CHOICE — the group said on radio they will not set one because fans are already part of SixTONES. スト担/ストヲタ are fan-coined',
    source: 'https://dews365.com/archives/230797.html; https://realsound.jp/2019/07/post-389985_2.html',
  },
  {
    id: 'ado',
    expect: null,
    skip: 'no fan name — Ado publicly declined to make one: 「ファンネームを作らない理由は、ファンの形を限定したくないからです」. Ado民 is fan-coined',
    source: 'https://x.com/ado1024imokenp/status/1892943254607605836',
  },
  {
    id: 'kenshi-yonezu',
    expect: null,
    skip: 'no official fan name; 米民 (Yonemin) is widespread but explicitly never announced — 「公式からアナウンスされてはおらず、自然発生」 — and some fans reject it',
    source: 'https://realsound.jp (バンド・アーティストのファンネーム考察); ' + `${JA_WIKI}米津玄師 (no mention)`,
  },
  {
    id: 'fahrenheit',
    expect: null,
    skip: 'no group fan name found in zh/en Wikipedia or Taiwanese coverage; only fan-run clubs (飛輪海國際歌迷會). Individual members have their own (Aaron Yan = 布丁)',
    source: 'https://zh.wikipedia.org/wiki/飛輪海; ' + `${EN_WIKI}Fahrenheit_(Taiwanese_band)`,
  },
  {
    id: 'wang-leehom',
    expect: null,
    skip: 'no declared fan name. His official club is OurHome / OurHome China (王力宏大陆区国际歌迷会, est. 2002) — a club, not a fandom name; fans colloquially say 宏迷',
    source: 'https://baike.baidu.com/item/王力宏大陆区国际歌迷会; https://www.instagram.com/wangleehomfanclub',
  },

  // --- values already in Firestore that turned out to be correct -----------------------
  {
    id: 'yoasobi',
    expect: "Yoa's",
    skip:
      'NOT a data error, despite looking like one. "Yoa\'s" (pronounced "yours") is YOASOBI\'s real ' +
      'fan name AND fan-club name, announced by the official staff account at the 6th anniversary ' +
      'live on 2025-09-30 (「新FCネーム&ファンネームは、【YOA\'S】」), replacing CLUB夜遊. Left exactly ' +
      'as stored — the official styling is all-caps YOA\'S, but Wikipedia and general prose use ' +
      '"Yoa\'s", so the stored casing is not worth a write.',
    source:
      'https://x.com/YOASOBI_staff/status/1973367052401619417; https://yoasobi-fc.com/; ' +
      `${EN_WIKI}Yoasobi`,
  },
]

// --- run --------------------------------------------------------------------------------

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
const db = getFirestore()

const norm = (v) => (v === undefined || v === null || v === '' ? null : String(v))

async function main() {
  console.log(
    `Mode: ${apply ? 'APPLY (writes to Firestore)' : 'DRY RUN (no writes)'} | project ${PROJECT_ID}`,
  )
  console.log(`${ENTRIES.length} artist(s) in the table.\n`)

  const writes = []
  const skipped = []
  const conflicts = []
  const unchanged = []
  const missingDocs = []

  for (const entry of ENTRIES) {
    const snap = await db.doc(`artists/${entry.id}`).get()
    if (!snap.exists) {
      missingDocs.push(entry)
      console.log(`${entry.id.padEnd(16)} MISSING   no artists/${entry.id} doc`)
      continue
    }
    const current = norm(snap.get('fandomName'))
    const name = snap.get('name')

    if (entry.skip) {
      skipped.push({ ...entry, current })
      const stored = current === null ? '(unset)' : `"${current}"`
      const drifted = current !== norm(entry.expect)
      console.log(
        `${entry.id.padEnd(16)} ${drifted ? 'SKIP*   ' : 'SKIP    '}  ${name} — leaving ${stored} as-is`,
      )
      console.log(`${''.padEnd(26)}${entry.skip}`)
      if (drifted) {
        console.log(
          `${''.padEnd(26)}* NOTE: expected ${
            entry.expect === null ? '(unset)' : `"${entry.expect}"`
          } when this table was researched — re-check before trusting the reason above.`,
        )
      }
      continue
    }

    if (current === entry.fandomName) {
      unchanged.push(entry)
      console.log(`${entry.id.padEnd(16)} OK        ${name} — already "${entry.fandomName}"`)
      continue
    }

    if (current !== norm(entry.expect)) {
      conflicts.push({ ...entry, current })
      console.log(
        `${entry.id.padEnd(16)} CONFLICT  ${name} — stored "${current}", expected ` +
          `${entry.expect === null ? '(unset)' : `"${entry.expect}"`}; not touching it`,
      )
      continue
    }

    const update = { fandomName: entry.fandomName }
    if (entry.fandomColorName) update.fandomColorName = entry.fandomColorName
    if (entry.fandomColorHex) update.fandomColorHex = entry.fandomColorHex

    writes.push({ ...entry, current, update })
    console.log(
      `${entry.id.padEnd(16)} WRITE     ${name} — ${current === null ? '(unset)' : `"${current}"`}` +
        ` -> "${entry.fandomName}"`,
    )
    console.log(`${''.padEnd(26)}confidence: ${entry.confidence} · source: ${entry.source}`)

    if (apply) await snap.ref.update(update)
  }

  // Duplicate check across the whole collection, using the post-run values.
  const all = await db.collection('artists').select('name', 'fandomName').get()
  const pending = new Map(writes.map((w) => [w.id, w.fandomName]))
  const byName = new Map()
  for (const doc of all.docs) {
    const fandom = pending.get(doc.id) ?? norm(doc.get('fandomName'))
    if (!fandom) continue
    if (!byName.has(fandom)) byName.set(fandom, [])
    byName.get(fandom).push(`${doc.id} (${doc.get('name')})`)
  }
  const dupes = [...byName.entries()].filter(([, ids]) => ids.length > 1)

  console.log('\n' + '='.repeat(78))
  console.log(`SUMMARY (${apply ? 'APPLIED' : 'DRY RUN'})`)
  console.log('='.repeat(78))
  console.log(`to write        : ${writes.length}`)
  console.log(`already correct : ${unchanged.length}`)
  console.log(`left unset      : ${skipped.length}`)
  console.log(`conflicts       : ${conflicts.length}`)
  console.log(`missing docs    : ${missingDocs.length}`)

  console.log(
    `\nDUPLICATE fandom names after this run: ${dupes.length === 0 ? 'none' : dupes.length}`,
  )
  for (const [fandom, ids] of dupes) console.log(`  - "${fandom}": ${ids.join(', ')}`)

  const stillUnset = all.docs.filter((d) => {
    if (pending.has(d.id)) return false
    return !norm(d.get('fandomName'))
  })
  console.log(`\nArtists still without a fandom name after this run: ${stillUnset.length}`)
  for (const d of stillUnset) {
    const entry = ENTRIES.find((e) => e.id === d.id)
    console.log(`  - ${d.id} (${d.get('name')})${entry?.skip ? ` — ${entry.skip}` : ''}`)
  }

  if (!apply) console.log('\nNothing was written. Re-run with --apply to commit these changes.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
