/**
 * End-to-end smoke test of the journeys that must never break:
 *
 *   staff create a member → the member signs in with the one-time PIN, picks
 *   their own and an e-mail address → signs in again with that address →
 *   plays and submits a round → staff approve it → the round counts for the
 *   ranking.
 *
 * Needs a running app with the demo seed (`npm run db:seed`):
 *   BASE_URL=http://localhost:3000 npm run e2e
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OWNER = { email: process.env.E2E_OWNER_EMAIL || "owner@fairway.test", password: process.env.E2E_OWNER_PASSWORD || "fairway-owner-123" };
const NAME = `Testspeler ${Date.now().toString(36).slice(-5)}`;
const NEW_PIN = "482915";
const EMAIL = `${NAME.toLowerCase().replace(/\s+/g, ".")}@e2e.example`;

function step(message) {
  console.log(`  ✓ ${message}`);
}

async function main() {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page, who) => page.on("pageerror", (error) => errors.push(`${who}: ${error.message}`));

  // ---- staff create a member -------------------------------------------------
  const staffContext = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const staff = await staffContext.newPage();
  watch(staff, "staff");
  await staff.goto(`${BASE}/admin/login`);
  await staff.getByLabel(/E-mail/).fill(OWNER.email);
  await staff.getByLabel(/Wachtwoord/).fill(OWNER.password);
  await staff.getByRole("button", { name: "Inloggen" }).click();
  await staff.waitForURL(/\/admin$/);
  step("staff signed in");

  // The API is the stable way to read back the one-time credentials.
  const credentials = await staff.evaluate(async (displayName) => {
    const csrf = document.cookie.split("; ").find((part) => part.startsWith("fairway_csrf=")).split("=")[1];
    const response = await fetch("/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": decodeURIComponent(csrf) },
      body: JSON.stringify({ displayName }),
    });
    if (!response.ok) throw new Error(`creating a player failed: ${response.status}`);
    return (await response.json()).credentials;
  }, NAME);
  step(`member created (${credentials.code})`);

  // ---- the member signs in and chooses a PIN ---------------------------------
  const playerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const player = await playerContext.newPage();
  watch(player, "player");
  await player.goto(BASE);
  await player.getByLabel(/E-mailadres of spelerscode/).fill(credentials.code);
  await player.getByLabel(/Pincode/).fill(credentials.pin);
  await player.getByRole("button", { name: "Inloggen" }).click();
  await player.waitForURL(/\/app\/welcome/);
  await player.getByLabel("E-mailadres").fill(EMAIL);
  await player.getByLabel("Eenmalige pincode").fill(credentials.pin);
  await player.getByLabel("Nieuwe pincode", { exact: true }).fill(NEW_PIN);
  await player.getByLabel("Herhaal nieuwe pincode").fill(NEW_PIN);
  await player.getByRole("button", { name: "Opslaan en verder" }).click();
  await player.waitForURL(/\/app$/);
  step("member chose a PIN and an e-mail address, and reached the home screen");

  // From now on the e-mail address is enough to sign in.
  await player.context().clearCookies();
  await player.goto(BASE);
  await player.getByLabel(/E-mailadres of spelerscode/).fill(EMAIL.toUpperCase());
  await player.getByLabel(/Pincode/).fill(NEW_PIN);
  await player.getByRole("button", { name: "Inloggen" }).click();
  await player.waitForURL(/\/app$/);
  step("member signed in again with their e-mail address");

  // ---- a solo round, nine holes ----------------------------------------------
  await player.goto(`${BASE}/app/play`);
  await player.getByRole("button", { name: "Start ronde" }).click();
  await player.waitForURL(/\/app\/play\/[0-9a-f-]{36}/);
  const roundId = player.url().split("/").pop();
  const strokes = player.getByRole("group", { name: /^Slagen van/ });
  const card = [3, 2, 4, 3, 3, 5, 3, 2, 3];
  for (const [index, value] of card.entries()) {
    await strokes.getByRole("button", { name: String(value), exact: true }).click();
    if (index < card.length - 1) await player.getByRole("button", { name: "Volgende" }).click();
  }
  await player.getByRole("button", { name: "Ronde afronden" }).click();
  await player.getByRole("button", { name: "Scorekaart indienen" }).click();
  await player.waitForURL(new RegExp(`/app/results/${roundId}`));
  await player.getByText("In beoordeling").first().waitFor();
  step("round played and submitted (28 strokes, waiting for review)");

  // ---- staff approve it ------------------------------------------------------
  await staff.goto(`${BASE}/admin/rounds/${roundId}`);
  await staff.getByRole("button", { name: "Goedkeuren" }).first().click();
  await staff.getByText("Goedgekeurd").first().waitFor();
  step("staff approved the round");

  // ---- it counts -------------------------------------------------------------
  await player.goto(`${BASE}/app/leaderboards`);
  await player.getByRole("radio", { name: "Vandaag" }).click();
  await player.getByRole("link", { name: new RegExp(NAME) }).waitFor();
  await player.goto(`${BASE}/app/stats`);
  await player.getByText("Eerste ronde").first().waitFor();
  step("the round is in today's ranking and earned the first achievement");

  // ---- clean up: the test member is deactivated ------------------------------
  await staff.evaluate(async (id) => {
    const csrf = document.cookie.split("; ").find((part) => part.startsWith("fairway_csrf=")).split("=")[1];
    await fetch(`/api/admin/players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": decodeURIComponent(csrf) },
      body: JSON.stringify({ action: "deactivate" }),
    });
  }, credentials.id);

  await browser.close();
  if (errors.length > 0) throw new Error(`page errors:\n${errors.join("\n")}`);
}

console.log(`Fairway smoke test against ${BASE}`);
main().then(
  () => console.log("All journeys passed."),
  (error) => {
    console.error(`\nFAILED: ${error.message}`);
    process.exit(1);
  },
);
