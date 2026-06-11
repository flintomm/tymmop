"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createPage } = require("./helpers/page.js");

test("initial render shows the first track, paused", async () => {
  const page = await createPage();
  assert.equal(page.el("trackTitle").textContent, "Sand Drive");
  assert.equal(page.el("trackArtist").textContent, "tymmo p");
  assert.equal(page.el("trackStatus").textContent, "Paused");
  assert.equal(page.el("currentTime").textContent, "0:00");
});

test("next goes forward, prev goes back, playlist wraps", async () => {
  const page = await createPage();
  page.click("nextButton");
  assert.equal(
    page.el("trackTitle").textContent,
    "International Desert Drive",
    "next button must advance to track 2"
  );
  page.click("prevButton");
  assert.equal(page.el("trackTitle").textContent, "Sand Drive");
  page.click("prevButton");
  assert.equal(
    page.el("trackTitle").textContent,
    "Things Just R",
    "prev from the first track must wrap to the last"
  );
});

test("keyboard shortcuts n/p step tracks", async () => {
  const page = await createPage();
  page.key("n");
  assert.equal(page.el("trackTitle").textContent, "International Desert Drive");
  page.key("p");
  assert.equal(page.el("trackTitle").textContent, "Sand Drive");
});

test("play/pause updates status, icon, and aria labels", async () => {
  const page = await createPage();
  page.click("playPauseButton");
  await page.tick();
  assert.ok(page.calls.play >= 1, "audio.play() must be called");
  assert.equal(page.el("trackStatus").textContent, "Now Playing");
  assert.equal(page.el("playPauseButton").getAttribute("aria-label"), "Pause");

  // the element is not really playing in jsdom; simulate the paused=false
  page.setAudioState({ paused: false });
  page.click("playPauseButton");
  assert.ok(page.calls.pause >= 1, "audio.pause() must be called");
  assert.equal(page.el("trackStatus").textContent, "Paused");
  assert.equal(page.el("playPauseButton").getAttribute("aria-label"), "Play");
});

test("browser tab title follows playback", async () => {
  const page = await createPage();
  const baseTitle = page.document.title;
  page.click("playPauseButton");
  await page.tick();
  assert.equal(page.document.title, "▶ Sand Drive — tymmo p");

  page.setAudioState({ paused: false });
  page.click("playPauseButton");
  assert.equal(page.document.title, baseTitle);
});

test("timeupdate renders clock and fills the seek bar", async () => {
  const page = await createPage();
  page.setAudioState({ duration: 100, currentTime: 25 });
  page.fire(page.audio, "timeupdate");
  assert.equal(page.el("currentTime").textContent, "0:25");
  assert.equal(page.el("duration").textContent, "1:40");
  assert.equal(page.el("progressFill").style.width, "25%");
});

test("clock survives missing duration", async () => {
  const page = await createPage();
  page.setAudioState({ duration: NaN, currentTime: 5 });
  page.fire(page.audio, "timeupdate");
  assert.equal(page.el("duration").textContent, "0:00");
  assert.equal(page.el("progressFill").style.width, "0%");
});

test("umami records one play per track, not per resume", async () => {
  const page = await createPage();
  const plays = () =>
    page.calls.umami.filter((entry) => entry.event === "track-play");
  page.fire(page.audio, "play");
  page.fire(page.audio, "play"); // resume after pause: no second event
  assert.equal(plays().length, 1);
  assert.equal(plays()[0].data.title, "Sand Drive");

  page.click("nextButton");
  page.fire(page.audio, "play");
  assert.equal(plays().length, 2);
  assert.equal(plays()[1].data.title, "International Desert Drive");
});

test("media session gets metadata and working transport handlers", async () => {
  const page = await createPage();
  assert.equal(page.mediaSession.metadata.title, "Sand Drive");
  assert.equal(page.mediaSession.metadata.artist, "tymmo p");

  for (const type of ["play", "pause", "previoustrack", "nexttrack"]) {
    assert.equal(
      typeof page.calls.mediaSessionHandlers[type],
      "function",
      `media session "${type}" handler missing`
    );
  }
  page.calls.mediaSessionHandlers.nexttrack();
  assert.equal(page.el("trackTitle").textContent, "International Desert Drive");
  assert.equal(
    page.mediaSession.metadata.title,
    "International Desert Drive",
    "lock screen metadata must follow track changes"
  );
});

test("track ends: playlist advances and keeps playing", async () => {
  const page = await createPage();
  page.fire(page.audio, "ended");
  await page.tick();
  assert.equal(page.el("trackTitle").textContent, "International Desert Drive");
  assert.ok(page.calls.play >= 1, "should call play() for the next track");
});

test("config geometry lands in css custom properties", async () => {
  const page = await createPage({
    config: {
      desktop: {
        playerLeftPct: 11.5,
        playerTopPct: 22.5,
        videoOffsetYPct: -9,
        videoScale: 1.2,
      },
    },
  });
  const rootStyle = page.document.documentElement.style;
  assert.equal(rootStyle.getPropertyValue("--player-left-pct"), "11.5");
  assert.equal(rootStyle.getPropertyValue("--player-top-pct"), "22.5");
  assert.equal(rootStyle.getPropertyValue("--video-offset-y-pct"), "-9");
  assert.equal(rootStyle.getPropertyValue("--video-scale"), "1.2");
});

test("playerGeometryTools.set applies numbers and ignores junk", async () => {
  const page = await createPage();
  const tools = page.window.playerGeometryTools;
  const updated = tools.set({ playerLeftPct: 33, bogusKey: 1, playerTopPct: "x" });
  assert.equal(updated.playerLeftPct, 33);
  assert.equal(updated.bogusKey, undefined);
  assert.notEqual(updated.playerTopPct, "x");
  const rootStyle = page.document.documentElement.style;
  assert.equal(rootStyle.getPropertyValue("--player-left-pct"), "33");
});

test("config fetch failure falls back to defaults without crashing", async () => {
  const page = await createPage({ config: null });
  // null config -> config.desktop missing -> defaults applied
  const rootStyle = page.document.documentElement.style;
  assert.equal(rootStyle.getPropertyValue("--player-left-pct"), "47.5");
});
