// Probity — sanctions list screening.
// Fetches the official EU Consolidated Financial Sanctions List and the UN
// Security Council Consolidated List, then returns raw context snippets around
// any candidate name-token hits. It deliberately casts a WIDE net (high recall):
// the AI judgment layer (groq) decides which snippets are true matches.
//
// No API key required — both feeds are official and public.
// Accepts: { name }
// Returns: { matches: [{ source, snippet, score }], sourcesUsed, errors }

const SOURCES = {
  eu: {
    // Primary: official European Commission XML feed.
    // Fallback: OpenSanctions mirror (daily-synced from the same EU source).
    urls: [
      "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content",
      "https://data.opensanctions.org/datasets/latest/eu_fsf/targets.simple.csv",
    ],
    label: "EU Consolidated Financial Sanctions List",
    portal: "https://www.sanctionsmap.eu/",
  },
  un: {
    urls: ["https://scsanctions.un.org/resources/xml/en/consolidated.xml"],
    label: "UN Security Council Consolidated List",
    portal: "https://www.un.org/securitycouncil/content/un-sc-consolidated-list",
  },
};

const TTL = 6 * 60 * 60 * 1000; // refresh cached lists every 6 hours
const CACHE = { eu: { text: "", ts: 0 }, un: { text: "", ts: 0 } };

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getList(key) {
  const now = Date.now();
  if (CACHE[key].text && now - CACHE[key].ts < TTL) return CACHE[key].text;

  let lastErr = null;
  for (const url of SOURCES[key].urls) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9500);
    try {
      // Some EU endpoints reject default Node fetch headers — set a recognisable UA.
      const r = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Probity-Compliance/1.0; +https://probity.app)",
          Accept: "application/xml, text/xml, text/csv, */*",
          "Accept-Language": "en",
        },
      });
      if (!r.ok) {
        lastErr = new Error(`${SOURCES[key].label} returned ${r.status}`);
        continue;
      }
      const text = await r.text();
      CACHE[key] = { text, ts: now };
      return text;
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr || new Error(`${SOURCES[key].label} unavailable`);
}

function findMatches(text, tokens, label) {
  const lower = text.toLowerCase();
  // Anchor on the longest (most distinctive) token to bound the scan.
  const anchor = tokens.slice().sort((a, b) => b.length - a.length)[0];
  const out = [];
  const seen = new Set();
  let idx = 0;
  let scanned = 0;

  while ((idx = lower.indexOf(anchor, idx)) !== -1 && scanned < 600) {
    scanned++;
    const start = Math.max(0, idx - 450);
    const end = Math.min(text.length, idx + 450);
    const windowLower = lower.slice(start, end);
    const score = tokens.filter((tok) => windowLower.includes(tok)).length;
    const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
    const sig = snippet.slice(0, 140);
    if (!seen.has(sig)) {
      seen.add(sig);
      out.push({ source: label, score, snippet });
    }
    idx = idx + anchor.length;
  }

  out.sort((a, b) => b.score - a.score);
  const multi = tokens.length >= 2;
  // For multi-word names require at least two matching tokens in the window.
  let kept = multi ? out.filter((o) => o.score >= 2) : out;
  if (kept.length === 0) kept = out.slice(0, 4); // fall back to anchor-only hits
  return kept.slice(0, 6);
}

exports.handler = async (event) => {
  try {
    const { name } = JSON.parse(event.body || "{}");
    if (!name) return { statusCode: 400, body: JSON.stringify({ error: "name is required" }) };

    const norm = normalize(name);
    const tokens = norm.split(" ").filter((w) => w.length >= 4);
    if (!tokens.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({ matches: [], sourcesUsed: [], errors: ["Name has no token long enough to screen reliably"] }),
      };
    }

    const matches = [];
    const sourcesUsed = [];
    const errors = [];

    for (const key of Object.keys(SOURCES)) {
      try {
        const text = await getList(key);
        sourcesUsed.push({ label: SOURCES[key].label, portal: SOURCES[key].portal });
        const found = findMatches(text, tokens, SOURCES[key].label);
        for (const f of found) matches.push(f);
      } catch (e) {
        errors.push(`${SOURCES[key].label}: ${String(e && e.message ? e.message : e)}`);
      }
    }

    matches.sort((a, b) => b.score - a.score);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matches: matches.slice(0, 12), sourcesUsed, errors, tokens }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e && e.message ? e.message : e) }) };
  }
};
