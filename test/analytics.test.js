"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createPage } = require("./helpers/page.js");

const events = (page, name) =>
  page.calls.umami.filter((entry) => entry.event === name);

async function startPlaying(page) {
  page.click("playPauseButton");
  await page.tick();
  page.fire(page.audio, "play");
}

test("a song that plays to the end records track-complete, not a skip", async () => {
  const page = await createPage();
  await startPlaying(page);
  page.setAudioState({ ended: true, currentTime: 180 });
  page.fire(page.audio, "ended");

  const completes = events(page, "track-complete");
  assert.equal(completes.length, 1);
  assert.equal(completes[0].data.title, "Sand Drive");
  assert.equal(events(page, "track-skip").length, 0);
});

test("jumping away mid-song records track-skip with the position", async () => {
  const page = await createPage();
  await startPlaying(page);
  page.setAudioState({ currentTime: 42, ended: false });
  page.click("nextButton");

  const skips = events(page, "track-skip");
  assert.equal(skips.length, 1);
  assert.equal(skips[0].data.title, "Sand Drive");
  assert.equal(skips[0].data.at, 42);
});

test("browsing tracks while paused is not a skip", async () => {
  const page = await createPage();
  page.click("nextButton");
  page.click("nextButton");
  assert.equal(events(page, "track-skip").length, 0);
});

test("share link cues the right track and records track-link-open", async () => {
  const page = await createPage({
    url: "https://tymmop.com/?track=99-to-infinity",
  });
  assert.equal(page.el("trackTitle").textContent, "99 to Infinity");
  const opens = events(page, "track-link-open");
  assert.equal(opens.length, 1);
  assert.equal(opens[0].data.title, "99 to Infinity");
});

test("share link beats resume state", async () => {
  const page = await createPage({
    url: "https://tymmop.com/?track=rooftop-fireworks",
    storage: {
      "tymmop:player-state": JSON.stringify({
        trackIndex: 1,
        src: "https://media.tymmop.com/portals/02-trouble.mp3",
        position: 60,
        savedAt: Date.now(),
      }),
    },
  });
  assert.equal(page.el("trackTitle").textContent, "Rooftop Fireworks");
});

test("an unknown track slug falls back to the first song, no event", async () => {
  const page = await createPage({
    url: "https://tymmop.com/?track=not-a-real-song",
  });
  assert.equal(page.el("trackTitle").textContent, "Sand Drive");
  assert.equal(events(page, "track-link-open").length, 0);
});
