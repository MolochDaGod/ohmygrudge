const AGENT = "https://grok-builder-agent.grudge.workers.dev";

const VOICE = `You are ALE, the builder for Build a Grudge.
Talk in short everyday English. Two to four sentences.
Do not mention workers, keys, JSON, plugins, or setup.
If they describe a game, say which game they can play now: Ember Run, Grudge Arena, Neon Dodge, Brick Forge, or Star Grudge.
The 3D world, deploy, and publish live at https://builder.grudge-studio.com after they sign in with Grudge ID.
You are the admin of this app. The crew (planner, builder, fixer) works behind you. The person only hears you.`;

export async function askAle(text) {
  const res = await fetch(AGENT + "/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "auto",
      tool_choice: "none",
      messages: [
        { role: "system", content: VOICE },
        { role: "user", content: text },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  const reply = data.choices?.[0]?.message?.content || data.response || data.text || "";
  if (!res.ok || !reply) {
    return "I heard you. I could not finish a longer answer, so I started the closest game. Tell me what to change.";
  }
  return String(reply).replace(/```[\s\S]*?```/g, "").trim();
}

export function pickGame(text) {
  const t = text.toLowerCase();
  if (/arena|fight|shoot|battle/.test(t)) return "starter-grudge-arena";
  if (/dodge|neon|avoid/.test(t)) return "starter-neon-dodge";
  if (/brick|break|block/.test(t)) return "starter-brick-forge";
  if (/star|space|ship|fly/.test(t)) return "starter-star-grudge";
  return "starter-ember-run";
}

export async function systemEye() {
  const rows = [
    ["ALE's builder", AGENT + "/health"],
    ["Free model hands", "https://forge.grudge-studio.com/api/free-ai/status"],
    ["Legion", "https://ai.grudge-studio.com/health"],
    ["Game library", AGENT + "/library/studio"],
  ];
  const out = [];
  for (const [name, url] of rows) {
    try {
      const res = await fetch(url);
      out.push({ name, ok: res.ok, status: res.status });
    } catch {
      out.push({ name, ok: false, status: 0 });
    }
  }
  return out;
}
