// Fills the database with a lively demo club, so every screen has content:
// members of different strengths, four months of rounds, live flights, events,
// club news and notifications.
//
//   DATABASE_URL=postgres://… node db/seed-demo.mjs [--force] [--allow-production]
//
// The script is for development and demos. It refuses to run in production
// unless told to, and refuses to touch a club that already has rounds unless
// `--force` is given; with `--force` the club's rounds, events, news,
// notifications, achievements and demo players are removed and rebuilt.
// Everything except "now" comes from a seeded random generator, so two runs
// produce the same club.
import { randomBytes, randomUUID } from "node:crypto";
import { createScriptPool, initialsOf } from "./lib/connection.mjs";
import { hashSecret } from "./lib/secret-hash.mjs";

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");

if (process.env.NODE_ENV === "production" && !args.has("--allow-production")) {
  console.error("seed: refusing to seed demo data in production. Pass --allow-production if you really mean it.");
  process.exit(1);
}

const CLUB_SLUG = "shortgolf-twente";
const CLUB_NAME = "Shortgolf Twente";
const DEMO_PIN = "1234";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const HISTORY_DAYS = 120;

// ------------------------------------------------------------- randomness --

/** mulberry32: small, fast and good enough for demo data. */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20_260_101);
const between = (min, max) => min + random() * (max - min);
const integer = (min, max) => Math.floor(between(min, max + 1));
const chance = (probability) => random() < probability;
const pick = (items) => items[Math.floor(random() * items.length)];

/** Standard normal via Box–Muller. */
function normal() {
  const u = Math.max(random(), 1e-9);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** @template T @param {T[]} items @param {number} count @returns {T[]} */
function sample(items, count) {
  const pool = [...items];
  const chosen = [];
  while (chosen.length < count && pool.length > 0) {
    chosen.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return chosen;
}

function weighted(options) {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = random() * total;
  for (const [value, weight] of options) {
    cursor -= weight;
    if (cursor <= 0) return value;
  }
  return options[options.length - 1][0];
}

// ------------------------------------------------------------------ data --

const text = (nl, en) => JSON.stringify({ nl, en });

/**
 * `skill` is the average number of strokes over par per par-3 hole; `trend`
 * is how much worse the player was at the start of the history (so positive
 * means they have been improving).
 */
const MEMBERS = [
  { code: "FW-DEMO01", name: "Sanne de Vries", username: "sanne.devries", skill: 0.48, trend: 0.3, activity: 3.0 },
  { code: "FW-DEMO02", name: "Daan Jansen", username: "daan.jansen", skill: 0.1, trend: 0.05, activity: 2.6 },
  { code: "FW-DEMO03", name: "Mila Bakker", username: "mila.bakker", skill: 0.36, trend: 0.1, activity: 2.2 },
  { code: "FW-DEMO04", name: "Sem de Boer", username: "sem.deboer", skill: 0.45, trend: 0, activity: 1.6 },
  { code: "FW-DEMO05", name: "Noah Smit", username: "noah.smit", skill: 0.6, trend: 0.15, activity: 1.8 },
  { code: "FW-DEMO06", name: "Emma Visser", username: "emma.visser", skill: 0.5, trend: -0.1, activity: 1.5 },
  { code: "FW-DEMO07", name: "Lucas Meijer", username: "lucas.meijer", skill: 0.8, trend: 0.2, activity: 1.2 },
  { code: "FW-DEMO08", name: "Julia Mulder", username: "julia.mulder", skill: 0.7, trend: 0, activity: 1.3 },
  { code: "FW-DEMO09", name: "Finn de Groot", username: "finn.degroot", skill: 0.9, trend: 0.25, activity: 1.0 },
  { code: "FW-DEMO10", name: "Tess Bos", username: "tess.bos", skill: 1.0, trend: 0.1, activity: 0.9 },
  { code: "FW-DEMO11", name: "Levi Vos", username: "levi.vos", skill: 0.55, trend: 0, activity: 1.4 },
  { code: "FW-DEMO12", name: "Sara Peters", username: "sara.peters", skill: 1.1, trend: 0.3, activity: 0.8 },
  { code: "FW-DEMO13", name: "Bram Hendriks", username: "bram.hendriks", skill: 0.65, trend: -0.05, activity: 1.3 },
  { code: "FW-DEMO14", name: "Lotte van Dijk", username: "lotte.vandijk", skill: 0.34, trend: 0.15, activity: 2.0 },
  { code: "FW-DEMO15", name: "Thijs Dekker", username: "thijs.dekker", skill: 1.2, trend: 0.2, activity: 0.7 },
  { code: "FW-DEMO16", name: "Eva Brouwer", username: "eva.brouwer", skill: 0.75, trend: 0.1, activity: 1.1 },
  { code: "FW-DEMO17", name: "Ruben Koster", username: "ruben.koster", skill: 0.4, trend: 0.05, activity: 1.7 },
];

const INACTIVE_MEMBER = { code: "FW-DEMO18", name: "Henk Wolters", username: "henk.wolters" };
const PENDING_MEMBERS = [
  { code: "FW-DEMO19", name: "Jesse Kok", username: "jesse.kok", email: "jesse.kok@example.com" },
  { code: "FW-DEMO20", name: "Fleur Willems", username: "fleur.willems", email: "fleur.willems@example.com" },
];

const GUESTS = ["Oom Gerard", "Collega Mark", "Buurvrouw Anja", "Neef Tim", "Schoonzus Ilse", "Vriend Joost"];

const COURSES = [
  {
    key: "short",
    name: ["Shortgolf Twente", "Shortgolf Twente"],
    description: [
      "Negen karaktervolle par-3 holes tussen de Twentse houtwallen. Kort genoeg voor beginners, lastig genoeg voor wie denkt dat het makkelijk is.",
      "Nine characterful par-3 holes between the hedgerows of Twente. Short enough for beginners, tricky enough for anyone who thinks it is easy.",
    ],
    accent: "#c9f04b",
    tee: ["Club", "Club"],
    holes: [
      [3, 37, "De Opwarmer", "The Warm-up", "Speel naar het midden van de green; links loopt hij weg.", "Aim for the middle of the green; it runs off to the left."],
      [3, 45, "Berkenlaan", "Birch Lane", "De berken rechts vangen elke slice. Blijf links van de vlag.", "The birches on the right catch every slice. Stay left of the flag."],
      [3, 46, "Het Plateau", "The Plateau", "De green ligt hoog: neem een club meer dan je denkt.", "The green sits high: take one more club than you think."],
      [3, 31, "Kort & Venijnig", "Short & Nasty", "De kortste hole, maar de bunker voor de green is hongerig.", "The shortest hole, but the bunker in front of the green is hungry."],
      [3, 45, "De Vijver", "The Pond", "Water links. Rechts van de vlag is altijd veilig.", "Water on the left. Right of the flag is always safe."],
      [3, 48, "Twentse Bult", "Twente Hump", "Laat de bal op de helling landen en naar de vlag rollen.", "Land the ball on the slope and let it feed down to the flag."],
      [3, 60, "De Lange", "The Long One", "De langste hole van de baan. Een volle slag, niets minder.", "The longest hole on the course. A full swing, nothing less."],
      [3, 32, "Dennenpoort", "Pine Gate", "Smalle doorgang tussen de dennen: speel hem laag.", "A narrow gap between the pines: keep it low."],
      [3, 50, "Thuishaven", "Home Port", "Je eindigt voor het terras. Er wordt meegekeken.", "You finish in front of the terrace. People are watching."],
    ],
  },
  {
    key: "heide",
    name: ["De Heidebaan", "The Heath Course"],
    description: [
      "Technisch golf over glooiende heide: vier par-4 holes en vijf par-3 holes met snelle greens.",
      "Technical golf across rolling heath: four par-4 holes and five par-3 holes with quick greens.",
    ],
    accent: "#f3a953",
    tee: ["Geel", "Yellow"],
    holes: [
      [3, 112, "Heidezicht", "Heath View", "Wind van rechts: richt op de rechterrand van de green.", "Wind from the right: aim at the right edge of the green."],
      [4, 238, "De Schaapskooi", "The Sheepfold", "Kort van de bunker blijven geeft de beste hoek.", "Laying up short of the bunker leaves the best angle."],
      [3, 96, "Jeneverbes", "Juniper", "Kleine green, liever te kort dan te lang.", "A small green; rather short than long."],
      [4, 251, "Zandverstuiving", "The Dunes", "Het zand links is diep. De fairway is breder dan hij lijkt.", "The sand on the left is deep. The fairway is wider than it looks."],
      [3, 134, "Het Ven", "The Mere", "Volledig over water. Neem genoeg club.", "All carry over water. Take enough club."],
      [4, 224, "Grafheuvel", "Barrow", "Blind tweede schot: speel op de witte paal.", "Blind second shot: play towards the white post."],
      [3, 105, "Korhoen", "Black Grouse", "De green helt van achter naar voor.", "The green slopes from back to front."],
      [4, 260, "De Lange Adem", "The Long Haul", "Twee stevige slagen. Rechts is de ruimte.", "Two solid shots. The room is on the right."],
      [3, 141, "Uitkijk", "Lookout", "Hoog afslagpunt: de bal vliegt verder dan je denkt.", "Elevated tee: the ball flies further than you think."],
    ],
  },
  {
    key: "landgoed",
    name: ["Landgoedbaan", "Estate Course"],
    description: [
      "Een volwaardige parkbaan van achttien holes langs bosranden, vijvers en oude eiken.",
      "A full eighteen-hole parkland course along woodland edges, ponds and old oaks.",
    ],
    accent: "#80b8ff",
    tee: ["Geel", "Yellow"],
    holes: [
      [4, 312], [4, 344], [3, 148], [5, 462], [4, 326], [3, 171], [4, 358], [5, 478], [4, 301],
      [4, 337], [3, 152], [5, 488], [4, 319], [4, 365], [3, 164], [5, 471], [4, 329], [4, 350],
    ].map(([par, distance]) => [par, distance, null, null, null, null]),
  },
];

const REJECTION_REASONS = [
  "De scores van hole 7 en 8 lijken omgewisseld. Dien de ronde opnieuw in.",
  "Deze ronde is op de oefenholes gespeeld en telt niet mee voor het klassement.",
];

// --------------------------------------------------------------- scoring --

/** One hole for one player on one day. Never a hole-in-one: those are placed by hand. */
function playHole(par, skillPerHole) {
  const difficulty = par === 3 ? 1 : par === 4 ? 1.45 : 1.7;
  const delta = Math.round(skillPerHole * difficulty + normal() * (par === 3 ? 0.6 : 0.8));
  const strokes = par + Math.max(-1, Math.min(5, delta));
  return Math.max(2, Math.min(12, strokes));
}

function puttsFor(strokes, par) {
  const approach = par - 2; // shots a scratch player needs to reach the green
  let putts = strokes - approach;
  if (strokes > par && chance(0.5)) putts -= 1; // the extra stroke was not a putt
  if (strokes <= par && chance(0.2)) putts -= 1;
  return Math.max(0, Math.min(4, Math.min(strokes - 1, putts)));
}

function layoutFor(course, holeCount) {
  return Array.from({ length: holeCount }, (_, index) => {
    const hole = course.holes[index % course.holes.length];
    return { number: index + 1, par: hole.par, distance: hole.distance };
  });
}

// ------------------------------------------------- club index (port) --
// Source of truth: src/lib/golf/club-index.ts. Keep in step with it.

function differentialsUsed(roundCount) {
  if (roundCount < 3) return 0;
  if (roundCount <= 5) return 1;
  if (roundCount <= 8) return 2;
  if (roundCount <= 11) return 3;
  if (roundCount <= 14) return 4;
  if (roundCount <= 16) return 5;
  if (roundCount <= 18) return 6;
  if (roundCount === 19) return 7;
  return 8;
}

/** @param {{ strokes: number, par: number, holeCount: number }[]} recentFirst */
function computeClubIndex(recentFirst) {
  const window = recentFirst.slice(0, 20);
  const used = differentialsUsed(window.length);
  if (used === 0) return null;
  const best = window
    .map((round) => ((round.strokes - round.par) * 9) / round.holeCount)
    .sort((left, right) => left - right)
    .slice(0, used);
  return Math.round((best.reduce((total, value) => total + value, 0) / best.length) * 10) / 10;
}

// ------------------------------------------------ achievements (port) --
// Source of truth: src/lib/golf/achievements.ts (`evaluateAchievements`).
// This is a faithful copy so the seed can run on plain Node without a build.

const MS_PER_WEEK = 7 * DAY;

function weekNumber(date) {
  return Math.floor((date.getTime() + 3 * DAY) / MS_PER_WEEK);
}

function longestWeekStreak(rounds) {
  const weeks = [...new Set(rounds.map((round) => weekNumber(round.completedAt)))].sort((a, b) => a - b);
  let best = 0;
  let current = 0;
  weeks.forEach((week, index) => {
    current = index > 0 && week === weeks[index - 1] + 1 ? current + 1 : 1;
    best = Math.max(best, current);
  });
  return best;
}

function longestBirdieStreak(scores, pars) {
  let best = 0;
  let current = 0;
  scores.forEach((strokes, index) => {
    if (strokes !== null && strokes < (pars[index] ?? 3)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });
  return best;
}

/**
 * @param {{ roundId: string, completedAt: Date, holeCount: number, scores: (number|null)[], pars: number[], partnerIds: string[], wonFlight: boolean }[]} history
 * @returns {Map<string, { roundId: string | null, at: Date }>}
 */
function evaluateAchievements(history) {
  const earned = new Map();
  const rounds = [...history].sort((left, right) => left.completedAt.getTime() - right.completedAt.getTime());
  const award = (key, round) => {
    if (!earned.has(key)) {
      earned.set(key, { roundId: round?.roundId ?? null, at: round?.completedAt ?? rounds[rounds.length - 1].completedAt });
    }
  };

  for (const [threshold, key] of [[1, "first_round"], [10, "rounds_10"], [25, "rounds_25"], [50, "rounds_50"], [100, "rounds_100"]]) {
    if (rounds.length >= threshold) award(key, rounds[threshold - 1]);
  }

  const partners = new Set();
  let wins = 0;

  for (const round of rounds) {
    const complete = round.scores.length === round.holeCount && round.scores.every((strokes) => strokes !== null);
    let strokes = 0;
    let par = 0;
    let overPar = false;

    round.scores.forEach((value, index) => {
      if (value === null) return;
      const holePar = round.pars[index] ?? 3;
      strokes += value;
      par += holePar;
      if (value === 1) award("ace", round);
      if (value === 1 || value < holePar) award("first_birdie", round);
      if (value > holePar) overPar = true;
    });

    if (complete) {
      if (strokes <= par) award("level_par", round);
      if (strokes < par) award("under_par", round);
      if (!overPar) award("bogey_free", round);
      if (round.holeCount === 18) award("full_eighteen", round);
    }
    if (longestBirdieStreak(round.scores, round.pars) >= 3) award("birdie_streak", round);

    if (round.wonFlight) {
      wins += 1;
      if (wins >= 5) award("flight_winner", round);
    }
    for (const partnerId of round.partnerIds) partners.add(partnerId);
    if (partners.size >= 5) award("social", round);
  }

  if (longestWeekStreak(rounds) >= 4) award("regular", null);
  return earned;
}

// ================================================================== run ====

const pool = createScriptPool();
const client = await pool.connect();
const query = (sql, values) => client.query(sql, values);
const one = async (sql, values) => (await query(sql, values)).rows[0];

try {
  await query("BEGIN");

  // ----------------------------------------------------------------- club --
  let club = await one("SELECT id FROM clubs WHERE slug = $1", [CLUB_SLUG]);
  if (!club) {
    club = await one(
      "INSERT INTO clubs (slug, name, join_code, board_token) VALUES ($1, $2, $3, $4) RETURNING id",
      [CLUB_SLUG, CLUB_NAME, randomBytes(4).toString("hex").toUpperCase(), randomBytes(24).toString("hex")],
    );
  }
  const clubId = club.id;

  const existing = await one("SELECT count(*)::int AS rounds FROM rounds WHERE club_id = $1", [clubId]);
  if (existing.rounds > 5 && !FORCE) {
    throw new Error(`The club already has ${existing.rounds} rounds. Run again with --force to replace its demo data.`);
  }
  if (FORCE) {
    await query("DELETE FROM rounds WHERE club_id = $1", [clubId]);
    await query("DELETE FROM events WHERE club_id = $1", [clubId]);
    await query("DELETE FROM content_items WHERE club_id = $1", [clubId]);
    await query("DELETE FROM notifications WHERE club_id = $1", [clubId]);
    await query("DELETE FROM player_achievements WHERE club_id = $1", [clubId]);
    await query("DELETE FROM players WHERE club_id = $1 AND code::text LIKE 'FW-DEMO%' AND code <> 'FW-DEMO01'", [clubId]);
  }

  await query(
    `UPDATE clubs
        SET tagline = $2, contact_email = $3, phone = $4, address = $5, website = $6, opening_hours_text = $7,
            self_registration = 'approval', auto_approve_rounds = false, status = 'active', updated_at = now()
      WHERE id = $1`,
    [
      clubId,
      "Negen holes plezier in het Twentse groen",
      "info@shortgolftwente.example",
      "053 555 01 42",
      "Fairwayweg 12, 7522 AB Enschede",
      "https://www.shortgolftwente.example",
      "Maandag t/m vrijdag 09:00 – 20:00\nZaterdag en zondag 08:30 – 19:00\nLaatste starttijd: anderhalf uur voor sluiting",
    ],
  );

  const clock = await one(
    `SELECT now() AS now,
            date_trunc('day', now() AT TIME ZONE timezone) AT TIME ZONE timezone AS day_start,
            date_trunc('week', now() AT TIME ZONE timezone) AT TIME ZONE timezone AS week_start
       FROM clubs WHERE id = $1`,
    [clubId],
  );
  const now = new Date(clock.now);
  const dayStart = new Date(clock.day_start);
  const weekStart = new Date(clock.week_start);
  const ago = (ms) => new Date(now.getTime() - ms);

  const owner = await one(
    "SELECT id FROM admin_accounts WHERE club_id = $1 AND role = 'club_owner' AND active ORDER BY created_at LIMIT 1",
    [clubId],
  );
  const reviewerId = owner?.id ?? null;

  // -------------------------------------------------------------- courses --
  /** @type {Map<string, { id: string, teeId: string, holeCount: number, name: string, holes: { par: number, distance: number }[] }>} */
  const courses = new Map();
  for (const spec of COURSES) {
    let course = await one("SELECT id FROM courses WHERE club_id = $1 AND name->>'nl' = $2 ORDER BY created_at LIMIT 1", [
      clubId,
      spec.name[0],
    ]);
    if (course) {
      await query(
        "UPDATE courses SET name = $2, description = $3, accent_color = $4, hole_count = $5, active = true, updated_at = now() WHERE id = $1",
        [course.id, text(...spec.name), text(...spec.description), spec.accent, spec.holes.length],
      );
    } else {
      course = await one(
        `INSERT INTO courses (club_id, name, description, hole_count, accent_color)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [clubId, text(...spec.name), text(...spec.description), spec.holes.length, spec.accent],
      );
    }
    let tee = await one("SELECT id FROM tee_sets WHERE course_id = $1 AND is_default", [course.id]);
    if (tee) {
      await query("UPDATE tee_sets SET name = $2 WHERE id = $1", [tee.id, text(...spec.tee)]);
    } else {
      tee = await one(
        "INSERT INTO tee_sets (club_id, course_id, name, color, is_default) VALUES ($1, $2, $3, 'green', true) RETURNING id",
        [clubId, course.id, text(...spec.tee)],
      );
    }
    for (const [index, [par, distance, nameNl, nameEn, tipNl, tipEn]] of spec.holes.entries()) {
      await query(
        `INSERT INTO holes (club_id, course_id, tee_set_id, number, par, distance_m, name, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (tee_set_id, number) DO UPDATE
           SET par = EXCLUDED.par, distance_m = EXCLUDED.distance_m, name = EXCLUDED.name, description = EXCLUDED.description`,
        [clubId, course.id, tee.id, index + 1, par, distance, nameNl ? text(nameNl, nameEn) : "{}", tipNl ? text(tipNl, tipEn) : "{}"],
      );
    }
    await query("DELETE FROM holes WHERE tee_set_id = $1 AND number > $2", [tee.id, spec.holes.length]);
    courses.set(spec.key, {
      id: course.id,
      teeId: tee.id,
      holeCount: spec.holes.length,
      name: spec.name[0],
      holes: spec.holes.map(([par, distance]) => ({ par, distance })),
    });
  }

  // -------------------------------------------------------------- players --
  const pinHash = await hashSecret(DEMO_PIN);
  /** @type {Map<string, { id: string, name: string, skill: number, trend: number, activity: number }>} */
  const players = new Map();

  for (const [index, member] of MEMBERS.entries()) {
    const joined = ago(integer(150, 620) * DAY);
    const lastLogin = ago(integer(1, index < 6 ? 4 : 30) * HOUR * 6);
    const row = await one(
      `INSERT INTO players (club_id, display_name, initials, username, code, pin_hash, must_change_pin,
                            registration_status, active, created_at, last_login_at, email)
       VALUES ($1, $2, $3, $4, $5, $6, false, 'approved', true, $7, $8, $9)
       ON CONFLICT (code) DO UPDATE
         SET must_change_pin = false, registration_status = 'approved', active = true,
             failed_attempts = 0, locked_until = NULL, username = EXCLUDED.username,
             email = COALESCE(players.email, EXCLUDED.email),
             created_at = EXCLUDED.created_at, updated_at = now()
       RETURNING id, club_id`,
      [clubId, member.name, initialsOf(member.name), member.username, member.code, pinHash, joined, lastLogin, `${member.username}@example.com`],
    );
    if (row.club_id !== clubId) {
      throw new Error(`Player code ${member.code} already belongs to another club.`);
    }
    players.set(member.code, { id: row.id, name: member.name, skill: member.skill, trend: member.trend, activity: member.activity });
  }

  await query(
    `INSERT INTO players (club_id, display_name, initials, username, code, pin_hash, must_change_pin,
                          registration_status, active, created_at, last_login_at)
     VALUES ($1, $2, $3, $4, $5, $6, false, 'approved', false, $7, $8)
     ON CONFLICT (code) DO NOTHING`,
    [clubId, INACTIVE_MEMBER.name, initialsOf(INACTIVE_MEMBER.name), INACTIVE_MEMBER.username, INACTIVE_MEMBER.code, pinHash, ago(700 * DAY), ago(210 * DAY)],
  );
  for (const [index, pending] of PENDING_MEMBERS.entries()) {
    await query(
      `INSERT INTO players (club_id, display_name, initials, username, code, pin_hash, must_change_pin,
                            registration_status, active, created_at, email)
       VALUES ($1, $2, $3, $4, $5, $6, false, 'pending', true, $7, $8)
       ON CONFLICT (code) DO NOTHING`,
      [clubId, pending.name, initialsOf(pending.name), pending.username, pending.code, pinHash, ago((index + 1) * 9 * HOUR), pending.email],
    );
  }

  const member = (code) => players.get(code);
  const sanne = member("FW-DEMO01");
  const everyone = [...players.values()];

  // ---------------------------------------------------------------- rounds --
  let roundsInserted = 0;
  const statusCounts = { approved: 0, pending: 0, rejected: 0 };

  /**
   * Inserts one round with its participants and hole scores.
   * @param {object} spec
   * @param {string} spec.course                    key in `courses`
   * @param {9|18} spec.holeCount
   * @param {'inviting'|'active'|'pending'|'approved'|'rejected'} spec.status
   * @param {'stroke'|'stableford'|'match'} [spec.format]
   * @param {boolean} [spec.trackPutts]
   * @param {Date} spec.completedAt                 for unfinished rounds: "last activity"
   * @param {({ player: object } | { guest: string })[]} spec.flight   first entry is the starter
   * @param {number} [spec.holesScored]             for active rounds
   * @param {string|null} [spec.eventId]
   * @param {string|null} [spec.rejectionReason]
   * @param {Record<number, number>} [spec.aces]    flight position → hole number (1-based)
   * @param {string[]} [spec.pendingIds]            player ids whose invitation is still open
   */
  async function insertRound(spec) {
    const course = courses.get(spec.course);
    const layout = layoutFor(course, spec.holeCount);
    const totalPar = layout.reduce((total, hole) => total + hole.par, 0);
    const finished = spec.status === "pending" || spec.status === "approved" || spec.status === "rejected";
    const holesScored = finished ? spec.holeCount : spec.status === "active" ? (spec.holesScored ?? 0) : 0;
    const pace = (course.holeCount === 18 ? between(11, 14) : between(6.5, 9.5)) * (0.8 + spec.flight.length * 0.12);
    const minutes = Math.max(4, holesScored * pace);
    const completedAt = spec.completedAt;
    const createdAt = new Date(completedAt.getTime() - minutes * MINUTE);
    const startedAt = spec.status === "inviting" ? null : new Date(createdAt.getTime() + integer(0, 3) * MINUTE);
    const reviewed = spec.status === "approved" || spec.status === "rejected";
    const reviewedAt = reviewed ? new Date(Math.min(now.getTime() - MINUTE, completedAt.getTime() + between(0.3, 20) * HOUR)) : null;
    const daysAgo = (now.getTime() - completedAt.getTime()) / DAY;
    const trackPutts = spec.trackPutts ?? false;
    const starter = spec.flight[0].player;

    const cards = spec.flight.map((entry, position) => {
      const base = entry.player ? entry.player.skill + entry.player.trend * Math.min(1, daysAgo / HISTORY_DAYS) : 1.25;
      const form = base + normal() * 0.16;
      const scores = layout.slice(0, holesScored).map((hole) => playHole(hole.par, Math.max(0.02, form)));
      const aceHole = spec.aces?.[position];
      if (aceHole) scores[aceHole - 1] = 1;
      return { entry, scores };
    });

    const round = await one(
      `INSERT INTO rounds (client_id, club_id, course_id, tee_set_id, starter_player_id, hole_count, status, format,
                           track_putts, event_id, created_at, started_at, completed_at, reviewed_at, reviewed_by,
                           rejection_reason, revision, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::round_status, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id`,
      [
        randomUUID(), clubId, course.id, course.teeId, starter.id, spec.holeCount, spec.status, spec.format ?? "stroke",
        trackPutts, spec.eventId ?? null, createdAt, startedAt, finished ? completedAt : null,
        reviewedAt, reviewed ? reviewerId : null, spec.rejectionReason ?? null,
        cards.reduce((total, card) => total + card.scores.length, 0) + spec.flight.length,
        finished ? (reviewedAt ?? completedAt) : completedAt,
      ],
    );

    for (const [position, card] of cards.entries()) {
      const { entry, scores } = card;
      const invitation = entry.player && spec.pendingIds?.includes(entry.player.id) ? "pending" : "accepted";
      const participant = await one(
        `INSERT INTO round_participants (round_id, club_id, player_id, display_name, is_guest, position, total_strokes,
                                         total_par, invitation_status, invited_at, responded_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text, $10, CASE WHEN $9::text = 'accepted' THEN $10::timestamptz END, $11)
         RETURNING id`,
        [
          round.id, clubId, entry.player?.id ?? null, entry.player?.name ?? entry.guest, !entry.player, position + 1,
          scores.reduce((total, strokes) => total + strokes, 0), totalPar, invitation, createdAt, completedAt,
        ],
      );
      card.participantId = participant.id;
      if (scores.length === 0) continue;
      const holes = layout.slice(0, scores.length);
      await query(
        `INSERT INTO hole_scores (round_participant_id, club_id, hole_number, strokes, par_snapshot, distance_snapshot,
                                  putts, updated_by_player_id, updated_at)
         SELECT $1, $2, hole.number, hole.strokes, hole.par, hole.distance, hole.putts, $3, $4
           FROM unnest($5::int[], $6::int[], $7::int[], $8::int[], $9::int[]) AS hole(number, strokes, par, distance, putts)`,
        [
          participant.id, clubId, starter.id, completedAt,
          holes.map((hole) => hole.number),
          scores,
          holes.map((hole) => hole.par),
          holes.map((hole) => hole.distance),
          scores.map((strokes, index) => (trackPutts ? puttsFor(strokes, holes[index].par) : null)),
        ],
      );
    }

    if (reviewed && reviewerId) {
      await query(
        `INSERT INTO round_reviews (round_id, club_id, reviewer_id, decision, reason, created_at)
         VALUES ($1, $2, $3, $4::round_status, $5, $6)`,
        [round.id, clubId, reviewerId, spec.status, spec.rejectionReason ?? null, reviewedAt],
      );
    }

    roundsInserted += 1;
    if (finished) statusCounts[spec.status] += 1;
    return { id: round.id, cards };
  }

  /** A random flight: members picked by how often they play, sometimes with a guest. */
  function randomFlight(size, { allowGuest = true, include = [] } = {}) {
    const chosen = [...include];
    while (chosen.length < size) {
      const candidate = weighted(everyone.map((player) => [player, player.activity]));
      if (!chosen.includes(candidate)) chosen.push(candidate);
    }
    const flight = chosen.map((player) => ({ player }));
    if (allowGuest && size > 1 && chance(0.14)) flight[flight.length - 1] = { guest: pick(GUESTS) };
    return flight;
  }

  /** What a typical round looks like at this club. */
  function randomRoundShape() {
    const course = weighted([["short", 72], ["heide", 18], ["landgoed", 10]]);
    const holeCount = course === "landgoed" ? (chance(0.75) ? 18 : 9) : course === "short" && chance(0.09) ? 18 : 9;
    const size = weighted([[1, 35], [2, 35], [3, 18], [4, 12]]);
    // Match play needs exactly two players, so only pairs ever choose it.
    const format = size === 2 && chance(0.16) ? "match" : weighted([["stroke", 82], ["stableford", 18]]);
    return { course, holeCount, size, format, trackPutts: chance(0.25) };
  }

  /** A moment during opening hours, `days` days back in the club's time zone. */
  const duringDay = (days) => new Date(dayStart.getTime() - days * DAY + between(10, 18.5) * HOUR);

  // Four months of history, denser towards today.
  const historyDays = Array.from({ length: 118 }, () => 1 + Math.floor((HISTORY_DAYS - 1) * random() ** 1.7));
  for (const days of historyDays) {
    const shape = randomRoundShape();
    await insertRound({
      course: shape.course,
      holeCount: shape.holeCount,
      format: shape.format,
      trackPutts: shape.trackPutts,
      status: "approved",
      completedAt: duringDay(days),
      flight: randomFlight(shape.size, { allowGuest: shape.format !== "match" }),
    });
  }

  // The two hole-in-ones of the season.
  await insertRound({
    course: "short", holeCount: 9, status: "approved", completedAt: duringDay(41),
    flight: [{ player: member("FW-DEMO02") }, { player: member("FW-DEMO03") }, { player: member("FW-DEMO04") }],
    aces: { 0: 4 },
  });
  await insertRound({
    course: "short", holeCount: 9, status: "approved", completedAt: duringDay(12),
    flight: [{ player: member("FW-DEMO14") }, { player: sanne }],
    aces: { 0: 8 },
  });

  // Two rounds the club turned down.
  for (const [index, reason] of REJECTION_REASONS.entries()) {
    await insertRound({
      course: "short", holeCount: 9, status: "rejected", rejectionReason: reason,
      completedAt: duringDay(6 + index * 9),
      flight: randomFlight(index + 1, { allowGuest: false, include: index === 0 ? [sanne] : [] }),
    });
  }

  // This week, so the weekly ranking is alive whatever day it is.
  const sinceWeekStart = now.getTime() - weekStart.getTime();
  for (let index = 0; index < 8; index += 1) {
    const shape = randomRoundShape();
    await insertRound({
      course: "short", holeCount: 9, format: shape.format, trackPutts: shape.trackPutts, status: "approved",
      completedAt: new Date(weekStart.getTime() + between(0.15, 0.9) * sinceWeekStart),
      flight: randomFlight(shape.size, { allowGuest: shape.format !== "match" }),
    });
  }

  // ---------------------------------------------------------------- events --
  async function insertEvent(event) {
    const row = await one(
      `INSERT INTO events (club_id, course_id, title, description, kind, starts_at, ends_at, registration_closes_at,
                           location, capacity, leaderboard_enabled, published, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        clubId, event.course ? courses.get(event.course).id : null, text(...event.title), text(...event.description),
        event.kind, event.startsAt, event.endsAt ?? null, event.closesAt ?? null, event.location ?? "Clubhuis",
        event.capacity ?? null, event.leaderboard ?? false, event.published ?? true,
        new Date(Math.min(now.getTime(), event.startsAt.getTime()) - 20 * DAY),
      ],
    );
    const registrations = [
      ...(event.registered ?? []).map((player) => [player, "registered"]),
      ...(event.waitlisted ?? []).map((player) => [player, "waitlisted"]),
    ];
    for (const [index, [player, status]] of registrations.entries()) {
      await query(
        `INSERT INTO event_registrations (event_id, club_id, player_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [row.id, clubId, player.id, status, new Date(Math.min(now.getTime(), event.startsAt.getTime()) - 12 * DAY + index * 5 * HOUR)],
      );
    }
    return row.id;
  }

  const others = everyone.filter((player) => player !== sanne);
  const eventAt = (days, hour) => new Date(dayStart.getTime() + days * DAY + hour * HOUR);

  // Past: a monthly cup with its own leaderboard, and a social tournament.
  const monthlyCupDay = 21;
  const monthlyCupPlayers = [sanne, ...sample(others, 9)];
  const monthlyCup = await insertEvent({
    title: ["Maandbeker", "Monthly Cup"],
    description: [
      "Onze maandelijkse strokeplay-wedstrijd over negen holes. De winnaar krijgt de wisselbeker en eeuwige roem tot de volgende editie.",
      "Our monthly nine-hole stroke play competition. The winner takes the challenge cup and eternal glory until the next edition.",
    ],
    kind: "tournament", course: "short", leaderboard: true,
    startsAt: eventAt(-monthlyCupDay, 10), endsAt: eventAt(-monthlyCupDay, 17), capacity: 36,
    registered: monthlyCupPlayers,
  });
  for (let index = 0; index < monthlyCupPlayers.length; index += 2) {
    const flight = monthlyCupPlayers.slice(index, index + 2).map((player) => ({ player }));
    await insertRound({
      course: "short", holeCount: 9, status: "approved", eventId: monthlyCup,
      completedAt: new Date(eventAt(-monthlyCupDay, 11).getTime() + index * 25 * MINUTE),
      flight,
    });
  }
  await insertEvent({
    title: ["Mixed-toernooi met barbecue", "Mixed tournament with barbecue"],
    description: [
      "Koppels worden geloot. Na afloop steken we de barbecue aan op het terras.",
      "Pairs are drawn at random. Afterwards we light the barbecue on the terrace.",
    ],
    kind: "social", course: "short", startsAt: eventAt(-56, 14), endsAt: eventAt(-56, 20), capacity: 40,
    registered: sample(everyone, 14),
  });

  // Today: the club day competition, playable right now.
  const clubDay = await insertEvent({
    title: ["Clubdag-competitie", "Club Day Competition"],
    description: [
      "Speel vandaag op elk moment je negen holes en lever je kaart in. De beste ronde van de dag wint een lesbon.",
      "Play your nine holes at any time today and hand in your card. The best round of the day wins a lesson voucher.",
    ],
    kind: "tournament", course: "short", leaderboard: true,
    startsAt: eventAt(0, 8.5), endsAt: eventAt(0, 23.9),
    registered: [sanne, ...sample(others, 11)],
  });

  // Today: finished rounds (some for the club day), spread between midnight and now.
  const sinceDayStart = now.getTime() - dayStart.getTime();
  const todayAt = (fraction) => new Date(dayStart.getTime() + fraction * sinceDayStart);
  const todayFlights = [
    { flight: [member("FW-DEMO02"), member("FW-DEMO17")], event: true },
    { flight: [member("FW-DEMO03")], event: true },
    { flight: [member("FW-DEMO05"), member("FW-DEMO11"), member("FW-DEMO13")], event: false },
    { flight: [member("FW-DEMO06"), member("FW-DEMO08")], event: true },
    { flight: [member("FW-DEMO04")], event: false },
    { flight: [member("FW-DEMO16"), member("FW-DEMO07")], event: false },
  ];
  for (const [index, entry] of todayFlights.entries()) {
    await insertRound({
      course: "short", holeCount: 9, status: "approved", eventId: entry.event ? clubDay : null,
      trackPutts: index % 2 === 0,
      completedAt: todayAt(0.2 + index * 0.1),
      flight: entry.flight.map((player) => ({ player })),
    });
  }

  // Waiting for the club: six fresh cards, three from today and three from yesterday.
  const pendingFlights = [
    { flight: [sanne, member("FW-DEMO03")], at: todayAt(0.86), event: clubDay },
    { flight: [member("FW-DEMO09"), member("FW-DEMO10")], at: todayAt(0.9), event: null },
    { flight: [member("FW-DEMO14")], at: todayAt(0.94), event: clubDay },
    { flight: [member("FW-DEMO12"), member("FW-DEMO15")], at: duringDay(1), event: null },
    { flight: [member("FW-DEMO05")], at: duringDay(1), event: null },
    { flight: [member("FW-DEMO11"), member("FW-DEMO16"), member("FW-DEMO08")], at: duringDay(1), event: null },
  ];
  for (const entry of pendingFlights) {
    await insertRound({
      course: "short", holeCount: 9, status: "pending", eventId: entry.event, completedAt: entry.at,
      flight: entry.flight.map((player) => ({ player })),
    });
  }

  // On the course right now.
  const sanneLive = await insertRound({
    course: "short", holeCount: 9, status: "active", holesScored: 5, completedAt: ago(3 * MINUTE),
    flight: [{ player: sanne }, { player: member("FW-DEMO03") }, { guest: "Oom Gerard" }],
  });
  await insertRound({
    course: "short", holeCount: 9, status: "active", format: "match", holesScored: 7, completedAt: ago(1 * MINUTE),
    flight: [{ player: member("FW-DEMO14") }, { player: member("FW-DEMO17") }],
  });
  await insertRound({
    course: "heide", holeCount: 9, status: "active", holesScored: 3, completedAt: ago(6 * MINUTE),
    flight: [{ player: member("FW-DEMO06") }, { player: member("FW-DEMO11") }, { player: member("FW-DEMO08") }],
  });

  // An invitation Sanne has not answered yet.
  const invitation = await insertRound({
    course: "short", holeCount: 9, status: "inviting", completedAt: ago(4 * MINUTE),
    flight: [{ player: member("FW-DEMO02") }, { player: sanne }, { player: member("FW-DEMO05") }],
    pendingIds: [sanne.id],
  });
  await query("UPDATE rounds SET created_at = $2 WHERE id = $1", [invitation.id, ago(6 * MINUTE)]);

  // Upcoming events of different kinds, plus an unpublished draft.
  const clinicPlayers = sample(others, 11);
  const championship = await insertEvent({
    title: ["Clubkampioenschap Shortgolf", "Short Golf Club Championship"],
    description: [
      "Achttien holes strokeplay om de titel clubkampioen. Starttijden worden twee dagen vooraf gedeeld. Na afloop prijsuitreiking in het clubhuis.",
      "Eighteen holes of stroke play for the title of club champion. Tee times are shared two days in advance. Prize giving in the clubhouse afterwards.",
    ],
    kind: "tournament", course: "short", leaderboard: true, capacity: 48,
    startsAt: eventAt(12, 9.5), endsAt: eventAt(12, 17), closesAt: eventAt(10, 18),
    registered: [sanne, ...sample(others, 13)],
  });
  await insertEvent({
    title: ["Clinic korte spel", "Short Game Clinic"],
    description: [
      "Onze pro neemt je in een kleine groep mee langs chippen, pitchen en putten. Voor elk niveau.",
      "Our pro takes a small group through chipping, pitching and putting. For every level.",
    ],
    kind: "clinic", course: "short", capacity: 8, location: "Oefengreen",
    startsAt: eventAt(5, 19), endsAt: eventAt(5, 20.5),
    registered: clinicPlayers.slice(0, 8), waitlisted: clinicPlayers.slice(8),
  });
  await insertEvent({
    title: ["Vrijdagmiddagborrel & 9 holes", "Friday Drinks & 9 Holes"],
    description: [
      "Loop om vier uur binnen, speel negen holes met wie er is en sluit af met een drankje op het terras.",
      "Drop in at four, play nine holes with whoever is there and finish with a drink on the terrace.",
    ],
    kind: "social", course: "short", startsAt: eventAt(3, 16), endsAt: eventAt(3, 19.5),
    registered: sample(others, 9),
  });
  await insertEvent({
    title: ["Kennismakingsochtend De Heidebaan", "Introduction Morning at The Heath Course"],
    description: [
      "Nog nooit op De Heidebaan gespeeld? Een ervaren clubgenoot loopt de eerste negen holes met je mee.",
      "Never played The Heath Course? An experienced club mate walks the first nine holes with you.",
    ],
    kind: "clinic", course: "heide", capacity: 12, startsAt: eventAt(18, 10), endsAt: eventAt(18, 12.5),
    registered: sample(others, 5),
  });
  await insertEvent({
    title: ["Nachtgolf met lichtgevende ballen", "Night Golf with Glow Balls"],
    description: ["Concept: datum en opzet nog afstemmen met de greenkeeper.", "Draft: date and format still to be agreed with the greenkeeper."],
    kind: "social", course: "short", capacity: 24, published: false, startsAt: eventAt(33, 20.5),
  });

  // ------------------------------------------------------------------ news --
  async function insertContent(item) {
    const row = await one(
      `INSERT INTO content_items (club_id, kind, title, body, pinned, published_at, author_id, created_at)
       VALUES ($1, $2::content_kind, $3, $4, $5, $6, $7, $6) RETURNING id`,
      [clubId, item.kind, text(...item.title), text(...item.body), item.pinned ?? false, item.at, reviewerId],
    );
    return row.id;
  }

  await insertContent({
    kind: "announcement", pinned: true, at: ago(20 * HOUR),
    title: ["Hole 5 tijdelijk met wintergreen", "Hole 5 temporarily on a winter green"],
    body: [
      "De green van hole 5 wordt deze week gedresst en doorgezaaid. Tot en met zondag spelen we op de wintergreen links van de vijver. De afstand blijft gelijk; scores tellen gewoon mee.",
      "The green of hole 5 is being top-dressed and overseeded this week. Until Sunday we play to the winter green left of the pond. The distance is the same and scores count as usual.",
    ],
  });
  const latestNews = await insertContent({
    kind: "news", at: ago(2 * DAY),
    title: ["Inschrijving clubkampioenschap geopend", "Club championship registration is open"],
    body: [
      "Over twee weken strijden we weer om de titel. Schrijf je in via de app; er is plek voor 48 spelers.\n\nNieuw dit jaar: je ronde wordt live gevolgd op het scherm in het clubhuis.",
      "In two weeks we play for the title again. Register in the app; there is room for 48 players.\n\nNew this year: your round is followed live on the screen in the clubhouse.",
    ],
  });
  await insertContent({
    kind: "news", at: ago(9 * DAY),
    title: ["Twee hole-in-ones in één maand", "Two holes-in-one in a single month"],
    body: [
      "Daan Jansen sloeg hem er op hole 4 in één keer in, en Lotte van Dijk deed het op hole 8 dunnetjes over. Het rondje voor het clubhuis laat volgens de traditie niet lang op zich wachten.",
      "Daan Jansen holed out from the tee on hole 4, and Lotte van Dijk repeated the feat on hole 8. Tradition says the round of drinks at the clubhouse will follow shortly.",
    ],
  });
  await insertContent({
    kind: "news", at: ago(24 * DAY),
    title: ["Nieuwe afslagmatten op de oefenbaan", "New tee mats on the practice range"],
    body: [
      "De oefenbaan heeft twaalf nieuwe afslagmatten gekregen. Ballen haal je met je spelerscode bij de automaat naast de ingang.",
      "The practice range has twelve new tee mats. Collect balls with your player code at the machine next to the entrance.",
    ],
  });
  await insertContent({
    kind: "news", at: ago(47 * DAY),
    title: ["Welkom in de nieuwe clubapp", "Welcome to the new club app"],
    body: [
      "Vanaf nu houd je je scorekaart bij in de app, samen met je hele flight. Na goedkeuring door de club telt je ronde mee voor het klassement en je clubindex.\n\nVragen? Loop even langs de balie.",
      "From now on you keep your scorecard in the app, together with your whole flight. Once the club approves it, your round counts for the rankings and your club index.\n\nQuestions? Drop by the front desk.",
    ],
  });
  await insertContent({
    kind: "rules", at: ago(120 * DAY),
    title: ["Baanregels en etiquette", "Course rules and etiquette"],
    body: [
      "1. Meld je voor de ronde bij de balie en start op je afgesproken tijd.\n2. Maximaal vier spelers per flight. Snellere flights laat je door.\n3. Repareer je pitchmarks op de green en leg plaggen terug.\n4. Hark de bunker aan nadat je eruit hebt gespeeld.\n5. Wacht met slaan tot de green vrij is, ook op de korte holes.\n6. Golfschoenen met softspikes of sportschoenen met een vlakke zool.\n7. Honden zijn welkom op het terras, niet in de baan.\n8. Bij onweer klinkt de hoorn: verlaat direct de baan.\n9. Noteer je scores eerlijk; een ronde telt pas mee na goedkeuring door de club.",
      "1. Check in at the front desk before your round and start at your agreed time.\n2. At most four players per flight. Let faster flights play through.\n3. Repair your pitch marks on the green and replace divots.\n4. Rake the bunker after playing out of it.\n5. Do not play until the green is clear, also on the short holes.\n6. Golf shoes with soft spikes or trainers with a flat sole.\n7. Dogs are welcome on the terrace, not on the course.\n8. In case of thunder the horn sounds: leave the course immediately.\n9. Record your scores honestly; a round only counts once the club has approved it.",
    ],
  });

  // ------------------------------------------- club index and achievements --
  const history = await query(
    `SELECT rp.player_id, r.id AS round_id, r.completed_at, r.hole_count, rp.total_strokes, rp.total_par,
            ARRAY(SELECT hs.strokes FROM hole_scores hs WHERE hs.round_participant_id = rp.id ORDER BY hs.hole_number) AS scores,
            ARRAY(SELECT hs.par_snapshot FROM hole_scores hs WHERE hs.round_participant_id = rp.id ORDER BY hs.hole_number) AS pars,
            ARRAY(SELECT o.player_id FROM round_participants o
                   WHERE o.round_id = r.id AND o.id <> rp.id AND o.player_id IS NOT NULL) AS partner_ids,
            (SELECT count(*)::int FROM round_participants o WHERE o.round_id = r.id) AS flight_size,
            NOT EXISTS (
              SELECT 1 FROM round_participants o
               WHERE o.round_id = r.id AND o.id <> rp.id
                 AND (o.total_strokes - o.total_par) <= (rp.total_strokes - rp.total_par)
            ) AS best_in_flight
       FROM rounds r
       JOIN round_participants rp ON rp.round_id = r.id AND rp.player_id IS NOT NULL
      WHERE r.club_id = $1 AND r.status = 'approved'
      ORDER BY r.completed_at`,
    [clubId],
  );
  const byPlayer = new Map();
  for (const row of history.rows) {
    const list = byPlayer.get(row.player_id) ?? [];
    list.push(row);
    byPlayer.set(row.player_id, list);
  }

  let achievementsAwarded = 0;
  const sanneAchievements = [];
  for (const [playerId, rows] of byPlayer) {
    const recentFirst = [...rows].reverse().map((row) => ({ strokes: row.total_strokes, par: row.total_par, holeCount: row.hole_count }));
    await query("UPDATE players SET club_index = $2 WHERE id = $1", [playerId, computeClubIndex(recentFirst)]);

    const earned = evaluateAchievements(
      rows.map((row) => ({
        roundId: row.round_id,
        completedAt: new Date(row.completed_at),
        holeCount: row.hole_count,
        scores: row.scores,
        pars: row.pars,
        partnerIds: row.partner_ids,
        wonFlight: row.flight_size > 1 && row.best_in_flight,
      })),
    );
    for (const [key, award] of earned) {
      await query(
        `INSERT INTO player_achievements (club_id, player_id, key, round_id, achieved_at)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (player_id, key) DO NOTHING`,
        [clubId, playerId, key, award.roundId, award.at],
      );
      achievementsAwarded += 1;
      if (playerId === sanne.id) sanneAchievements.push({ key, at: award.at });
    }
  }

  // --------------------------------------------------------- notifications --
  const notifyAt = async (kind, data, createdAt, read) =>
    query(
      `INSERT INTO notifications (club_id, player_id, kind, data, created_at, read_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [clubId, sanne.id, kind, JSON.stringify(data), createdAt, read ? new Date(createdAt.getTime() + 20 * MINUTE) : null],
    );

  const lastApproved = await one(
    `SELECT r.id, c.name->>'nl' AS course_name
       FROM rounds r
       JOIN round_participants rp ON rp.round_id = r.id AND rp.player_id = $2
       JOIN courses c ON c.id = r.course_id
      WHERE r.club_id = $1 AND r.status = 'approved' ORDER BY r.completed_at DESC LIMIT 1`,
    [clubId, sanne.id],
  );
  const newestAchievement = sanneAchievements.sort((left, right) => right.at.getTime() - left.at.getTime())[0];

  await notifyAt("news_published", { newsId: latestNews, title: "Inschrijving clubkampioenschap geopend" }, ago(2 * DAY), true);
  await notifyAt("event_published", { eventId: championship, title: "Clubkampioenschap Shortgolf" }, ago(2 * DAY - HOUR), true);
  if (lastApproved) {
    await notifyAt("round_approved", { roundId: lastApproved.id, courseName: lastApproved.course_name }, ago(26 * HOUR), true);
  }
  if (newestAchievement) await notifyAt("achievement", { key: newestAchievement.key }, ago(25 * HOUR), false);
  await notifyAt("event_published", { eventId: clubDay, title: "Clubdag-competitie" }, ago(7 * HOUR), false);
  await notifyAt("round_invite", { roundId: invitation.id, starterName: "Daan Jansen", courseName: CLUB_NAME }, ago(6 * MINUTE), false);

  await query("COMMIT");

  console.log(`
seed: demo club "${CLUB_NAME}" is ready.

  ${roundsInserted} rounds (${statusCounts.approved} approved, ${statusCounts.pending} pending, ${statusCounts.rejected} rejected, 3 live, 1 inviting)
  ${MEMBERS.length} active members, ${PENDING_MEMBERS.length} pending registrations, 1 inactive member
  ${COURSES.length} courses, ${achievementsAwarded} achievements

  Players sign in with a code and PIN ${DEMO_PIN}:
    FW-DEMO01  Sanne de Vries   (live round ${sanneLive.id.slice(0, 8)}…, one open invitation)
    FW-DEMO02  Daan Jansen      (has sent Sanne the invitation)
    FW-DEMO03 … FW-DEMO17       other members

  Club management: the owner account created by db/bootstrap.mjs.
`);
} catch (error) {
  await query("ROLLBACK").catch(() => {});
  console.error(`seed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
