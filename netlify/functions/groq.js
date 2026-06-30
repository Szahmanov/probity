// Probity — Groq reasoning proxy.
// Keeps GROQ_API_KEY server-side. The frontend never sees the key.
// Accepts: { messages, temperature?, json?, max_tokens? }
// Returns: { content }

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!process.env.GROQ_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "GROQ_API_KEY is not set in Netlify environment variables" }) };
  }

  try {
    const { messages, temperature = 0.15, json = false, max_tokens = 2200 } = JSON.parse(event.body || "{}");

    if (!Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "messages array is required" }) };
    }

    const body = {
      model: "llama-3.3-70b-versatile",
      messages,
      temperature,
      max_tokens,
    };
    if (json) body.response_format = { type: "json_object" };

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    if (!r.ok) {
      return { statusCode: r.status, body: JSON.stringify({ error: data?.error?.message || "Groq request failed" }) };
    }

    const content = data?.choices?.[0]?.message?.content || "";
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e && e.message ? e.message : e) }) };
  }
};
