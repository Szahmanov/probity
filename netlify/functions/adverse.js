// Probity — adverse media search via Serper (Google).
// Keeps SERPER_API_KEY server-side. Returns cited organic results that the
// AI layer then judges for genuine relevance.
// Accepts: { name, country? }
// Returns: { organic: [{ title, snippet, link, date }], query }

exports.handler = async (event) => {
  if (!process.env.SERPER_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "SERPER_API_KEY is not set in Netlify environment variables" }) };
  }

  try {
    const { name, country } = JSON.parse(event.body || "{}");
    if (!name) return { statusCode: 400, body: JSON.stringify({ error: "name is required" }) };

    const q =
      `"${name}" ${country ? country + " " : ""}` +
      `(sanctions OR fraud OR "money laundering" OR investigation OR bribery OR ` +
      `lawsuit OR convicted OR embezzlement OR "tax evasion" OR scandal)`;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);

    let data = {};
    try {
      const r = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q, num: 10 }),
        signal: ctrl.signal,
      });
      data = await r.json();
    } finally {
      clearTimeout(t);
    }

    const organic = (data.organic || []).slice(0, 8).map((o) => ({
      title: o.title || "",
      snippet: o.snippet || "",
      link: o.link || "",
      date: o.date || null,
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organic, query: q }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      body: JSON.stringify({ organic: [], unavailable: true, error: String(e && e.message ? e.message : e) }),
    };
  }
};
