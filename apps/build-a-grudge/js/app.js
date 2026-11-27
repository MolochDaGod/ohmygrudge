import { STARTERS } from "../engine/starters.js";
import { createPlayer } from "./player.js";
import { askAle, pickGame } from "./ale.js";
import { ingest, session, startLogin, signOut } from "./auth.js";

const PENDING = "bag.pending";
const view = document.querySelector("main");
const nav = document.querySelector("nav");
let player = null;

ingest();

function gameById(id) {
  return STARTERS.find((g) => g.id === id) || null;
}

function destroyPlayer() {
  if (player) {
    player.destroy();
    player = null;
  }
}

function shell() {
  const s = session();
  nav.innerHTML = `
    <a href="#/">Make</a>
    <a href="#/talk">ALE</a>
    <a href="#/learn">How it plays</a>
    ${s.signedIn
      ? `<button type="button" id="out">Sign out</button>`
      : `<button type="button" id="in">Sign in</button>`}
  `;
  document.getElementById("in")?.addEventListener("click", startLogin);
  document.getElementById("out")?.addEventListener("click", () => { signOut(); route(); });
  const here = location.hash.split("?")[0] || "#/";
  for (const a of nav.querySelectorAll("a")) {
    if (a.getAttribute("href") === here) a.setAttribute("aria-current", "page");
  }
}

function rail() {
  return `<p class="rail">${STARTERS.map((g) => `<a href="#/play/${g.id}">${g.title}</a>`).join("<span aria-hidden='true'>·</span>")}</p>`;
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
  destroyPlayer();
  document.body.classList.remove("playing");
  const signed = session().signedIn;
  view.innerHTML = `
    <section class="hero">
      <p class="kicker">Grudge Studio</p>
      <h1>Say the game. It starts here.</h1>
      <form class="ask" id="make">
        <label class="sr" for="idea">The game</label>
        <input id="idea" name="idea" maxlength="240" placeholder="A jump across a dark forge" required autocomplete="off">
        <button type="submit">Make it</button>
      </form>
      ${rail()}
      <p class="quiet">${signed
        ? "You are signed in. ALE answers in everyday English, then the game opens in this room."
        : "Sign in with Grudge ID. That is the only step before ALE builds."}</p>
    </section>`;
  view.querySelector("#make").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get("idea");
    void make(String(text || ""));
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function play(id) {
  const game = gameById(id);
  document.body.classList.remove("playing");
  if (!game) {
    destroyPlayer();
    view.innerHTML = `<section class="hero"><h1>That game is not here.</h1><p><a class="go" href="#/">Back</a></p></section>`;
    return;
  }
  const speech = sessionStorage.getItem("bag.speech") || "";
  sessionStorage.removeItem("bag.speech");
  destroyPlayer();
  document.body.classList.add("playing");
  view.innerHTML = `
    <div class="stage" id="stage"></div>
    <footer class="dock">
      <div>
        <a class="leave" href="#/">Leave</a>
        <strong>${game.title}</strong>
        <span>${speech ? escapeHtml(speech) : escapeHtml(game.description)}</span>
      </div>
      <a class="walk" href="https://builder.grudge-studio.com/">Walk this in 3D</a>
    </footer>`;
  const stage = document.getElementById("stage");
  player = await createPlayer(stage, game.code, {});
  player.focus();
}

function talk() {
  destroyPlayer();
  document.body.classList.remove("playing");
  const signed = session().signedIn;
  view.innerHTML = `
    <section class="hero">
      <p class="kicker">ALE</p>
      <h1>Tell me the game.</h1>
      <p class="quiet">${signed
        ? "I answer in everyday English. The game opens in this room."
        : "Sign in with Grudge ID. That is the only step."}</p>
      <form id="talk">
        <label class="sr" for="line">Message</label>
        <textarea id="line" name="line" maxlength="500" placeholder="Make a small dodge game" required></textarea>
        <div class="rail"><button class="go" type="submit">Send</button></div>
      </form>
      <div id="reply"></div>
    </section>`;
  view.querySelector("#talk").addEventListener("submit", async (e) => {
    e.preventDefault();
    const line = String(new FormData(e.target).get("line") || "");
    if (!session().signedIn) {
      sessionStorage.setItem(PENDING, line);
      startLogin();
      return;
    }
    const box = document.getElementById("reply");
    box.innerHTML = `<p class="speech">Working on it.</p>`;
    const speech = await askAle(line);
    const id = pickGame(line);
    box.innerHTML = `<p class="speech">${escapeHtml(speech)}</p><p class="rail"><a href="#/play/${id}">Play it</a></p>`;
  });
}

function learn() {
  destroyPlayer();
  document.body.classList.remove("playing");
  view.innerHTML = `
    <section class="hero">
      <p class="kicker">How it plays</p>
      <h1>Play starts in the first moment.</h1>
      <p>ALE is the companion. You are the player. Heroes and bags stay on your Grudge account.</p>
      <p class="quiet">When the game in this room is the one you meant, open the builder and walk it.</p>
      <p class="rail"><a href="https://builder.grudge-studio.com/">Open the builder</a></p>
    </section>`;
}

function route() {
  shell();
  const hash = location.hash || "#/";
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const page = parts[0] || "";
  if (page === "play") void play(parts[1]);
  else if (page === "talk") talk();
  else if (page === "learn") learn();
  else home();
  const pending = sessionStorage.getItem(PENDING);
  if (pending && session().signedIn && page !== "play") {
    sessionStorage.removeItem(PENDING);
    void make(pending);
  }
}

window.addEventListener("hashchange", route);
route();
