import { STARTERS } from "../engine/starters.js";
import { createPlayer } from "./player.js";
import { askAle, pickGame, systemEye } from "./ale.js";
import { ingest, session, startLogin, signOut } from "./auth.js";

const PENDING = "bag.pending";
const view = document.querySelector("main");
const nav = document.querySelector("nav");

ingest();

function gameById(id) {
  return STARTERS.find((g) => g.id === id) || null;
}

function shell() {
  const s = session();
  nav.innerHTML = `
    <a href="#/">Play</a>
    <a href="#/talk">Talk to ALE</a>
    <a href="#/learn">Learn</a>
    <a href="#/systems">Systems</a>
    ${s.signedIn
      ? `<button type="button" id="out">Sign out</button>`
      : `<button type="button" class="primary" id="in">Sign in</button>`}
  `;
  document.getElementById("in")?.addEventListener("click", startLogin);
  document.getElementById("out")?.addEventListener("click", () => { signOut(); route(); });
  const here = location.hash.split("?")[0] || "#/";
  for (const a of nav.querySelectorAll("a")) {
    if (a.getAttribute("href") === here) a.setAttribute("aria-current", "page");
  }
}

function cards() {
  return STARTERS.map((g) => `
    <a class="card" href="#/play/${g.id}">
      <small>${g.genre}</small>
      <h2>${g.title}</h2>
      <p>${g.description}</p>
    </a>`).join("");
}

async function make(text) {
  if (!session().signedIn) {
    sessionStorage.setItem(PENDING, text);
    startLogin();
    return;
  }
  const id = pickGame(text);
  const game = gameById(id);
  let speech = "I started a game you can play now.";
  try { speech = await askAle(text); } catch { /* the game still starts */ }
  sessionStorage.setItem("bag.speech", speech);
  location.hash = "#/play/" + game.id;
}

function home() {
  view.innerHTML = `
    <h1>Build a Grudge</h1>
    <p class="lede">Tell ALE a game in plain English. A playable game starts here. The 3D world, deploy, and publish stay on the builder after you sign in.</p>
    <form class="row" id="make">
      <input type="text" name="idea" maxlength="240" placeholder="A jump game across a forge" required>
      <button class="primary" type="submit">Make it</button>
    </form>
    <div class="grid">${cards()}</div>`;
  view.querySelector("#make").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get("idea");
    void make(String(text || ""));
  });
}

async function play(id) {
  const game = gameById(id);
  if (!game) { view.innerHTML = `<h1>That game is not here.</h1><p><a href="#/">Back</a></p>`; return; }
  const speech = sessionStorage.getItem("bag.speech") || "";
  sessionStorage.removeItem("bag.speech");
  view.innerHTML = `
    <p><a href="#/">Games</a></p>
    <h1>${game.title}</h1>
    ${speech ? `<p class="speech">${escapeHtml(speech)}</p>` : `<p class="lede">${game.description}</p>`}
    <div class="stage" id="stage"></div>
    <p class="lede"><a href="https://builder.grudge-studio.com/">Open the 3D builder</a> when you want ALE to shape a world you can walk.</p>`;
  const stage = document.getElementById("stage");
  const player = await createPlayer(stage, game.code, {});
  player.focus();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function talk() {
  const s = session();
  view.innerHTML = `
    <h1>ALE</h1>
    <p class="lede">ALE talks to you. The crew and the model workers stay off this screen.</p>
    ${s.signedIn ? "" : `<p class="speech">Sign in with Grudge ID. That is the only step.</p>`}
    <form id="talk">
      <textarea name="line" maxlength="500" placeholder="Make a small dodge game" required></textarea>
      <div class="row"><button class="primary" type="submit">Send</button></div>
    </form>
    <div id="reply"></div>`;
  view.querySelector("#talk").addEventListener("submit", async (e) => {
    e.preventDefault();
    const line = String(new FormData(e.target).get("line") || "");
    if (!session().signedIn) { sessionStorage.setItem(PENDING, line); startLogin(); return; }
    const box = document.getElementById("reply");
    box.innerHTML = `<p class="speech">Working on it.</p>`;
    const speech = await askAle(line);
    const id = pickGame(line);
    box.innerHTML = `<p class="speech">${escapeHtml(speech)}</p><p><a class="primary" href="#/play/${id}" style="display:inline-block;margin-top:12px">Play it</a></p>`;
  });
}

function learn() {
  view.innerHTML = `
    <h1>How a game should be made</h1>
    <ul>
      <li>The first ten seconds show the goal. Play starts immediately.</li>
      <li>One unit is one meter. A person is about 1.8 meters.</li>
      <li>Play heroes are the Toon kits. ALE is the companion, not the player.</li>
      <li>One animation mixer. One physics world.</li>
      <li>Art that ships lives on assets.grudge-studio.com. Credit CC-BY.</li>
      <li>Players and bags stay on the Grudge account, not in this page.</li>
      <li>Say what you want in a sentence. ALE builds. You walk it.</li>
    </ul>
    <p><a href="https://github.com/MolochDaGod/ohmygrudge/blob/main/packages/plugin-examples/grudge-client-law/skills/grudge-client-law/SKILL.md">The full client law</a></p>`;
}

async function systems() {
  view.innerHTML = `<h1>What ALE is watching</h1><p class="lede">This is the crew's board. It is separate from the chat.</p><div class="checks" id="checks">Looking…</div>`;
  const rows = await systemEye();
  document.getElementById("checks").innerHTML = rows.map((r) =>
    `<div class="check"><span>${r.name}</span><span class="${r.ok ? "ok" : "bad"}">${r.ok ? "Up" : "Down"}</span></div>`
  ).join("") + `<details><summary>What this does not show</summary><p>Keys, tokens, and the hidden worker environment stay on Cloudflare. This page cannot spend them. ALE is the admin of that environment. Planner, builder, and fixer are the crew behind the chat.</p></details>`;
}

function route() {
  shell();
  const hash = location.hash || "#/";
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const page = parts[0] || "";
  if (page === "play") void play(parts[1]);
  else if (page === "talk") talk();
  else if (page === "learn") learn();
  else if (page === "systems") void systems();
  else home();
  const pending = sessionStorage.getItem(PENDING);
  if (pending && session().signedIn && page !== "play") {
    sessionStorage.removeItem(PENDING);
    void make(pending);
  }
}

window.addEventListener("hashchange", route);
route();
