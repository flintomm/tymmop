"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createPage, read } = require("./helpers/page.js");

test("desktop: player lives inside the dashboard overlay", async () => {
  const page = await createPage();
  const shell = page.el("playerShell");
  assert.equal(shell.parentElement.id, "overlayWrapper");
  assert.ok(!shell.classList.contains("player-shell--docked"));
});

test("mobile: player docks to body as a bottom bar", async () => {
  const page = await createPage({ mobile: true });
  const shell = page.el("playerShell");
  assert.equal(shell.parentElement, page.document.body);
  assert.ok(shell.classList.contains("player-shell--docked"));
});

test("rotating/resizing across the breakpoint moves the player both ways", async () => {
  const page = await createPage();
  const shell = page.el("playerShell");

  page.setMobile(true);
  assert.equal(shell.parentElement, page.document.body);
  assert.ok(shell.classList.contains("player-shell--docked"));

  page.setMobile(false);
  assert.equal(shell.parentElement.id, "overlayWrapper");
  assert.ok(!shell.classList.contains("player-shell--docked"));
});

test("controls keep working while docked", async () => {
  const page = await createPage({ mobile: true });
  page.click("nextButton");
  assert.equal(page.el("trackTitle").textContent, "International Desert Drive");
  page.click("playPauseButton");
  await page.tick();
  assert.equal(page.el("trackStatus").textContent, "Now Playing");
});

test("docked stylesheet contract: fixed bar with finger-sized controls", () => {
  const css = read("styles.css");
  const docked = css.slice(css.indexOf(".player-shell--docked"));
  assert.ok(docked.length > 0, "docked styles missing");
  assert.match(docked, /position:\s*fixed/);
  assert.match(docked, /safe-area-inset-bottom/);
  // 2.75rem = 44px touch targets at default font size
  assert.match(docked, /\.player-shell--docked button\s*{[^}]*width:\s*2\.75rem/);
  assert.match(docked, /#playPauseButton\s*{[^}]*width:\s*3\.25rem/);
});

test("app.js uses a media query to drive dock mode", () => {
  const js = read("app.js");
  assert.match(js, /matchMedia/);
  assert.match(js, /max-width:\s*700px/);
});
