"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createPage, read } = require("./helpers/page.js");

test("the player lives in the dashboard overlay on desktop", async () => {
  const page = await createPage();
  assert.equal(page.el("playerShell").parentElement.id, "overlayWrapper");
});

test("the player stays on the radio bezel on small screens too", async () => {
  // regression for the docked-bar experiment: the player must never leave
  // the overlay, because the whole design is "the player is the car radio"
  const page = await createPage({ mobile: true });
  const shell = page.el("playerShell");
  assert.equal(shell.parentElement.id, "overlayWrapper");

  page.setMobile(true);
  page.setMobile(false);
  assert.equal(shell.parentElement.id, "overlayWrapper");
});

test("controls work at mobile sizes", async () => {
  const page = await createPage({ mobile: true });
  page.click("nextButton");
  assert.equal(page.el("trackTitle").textContent, "International Desert Drive");
  page.click("playPauseButton");
  await page.tick();
  assert.equal(page.el("trackStatus").textContent, "Now Playing");
});

test("no docked-mode styles or reparenting remain", () => {
  assert.ok(!read("styles.css").includes("player-shell--docked"));
  assert.ok(!read("app.js").includes("player-shell--docked"));
});

test("buttons extend their tap targets beyond the visible circle", () => {
  const css = read("styles.css");
  assert.match(css, /button::after\s*{[^}]*inset:\s*-\d+px/);
});

test("background media transform is driven by the geometry vars", () => {
  const css = read("styles.css");
  const block = css.slice(
    css.indexOf(".background-media"),
    css.indexOf(".background-video")
  );
  assert.match(block, /translateY\(calc\(var\(--video-offset-y-pct\)/);
  assert.match(block, /scale\(var\(--video-scale\)\)/);
});
