"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createPage } = require("./helpers/page.js");

const KEY = "tymmop:player-state";

test("player and controls work even if the config fetch never settles", async () => {
  const page = await createPage({ configMode: "pending" });
  assert.equal(page.el("trackTitle").textContent, "Sand Drive");

  page.click("playPauseButton");
  await page.tick();
  assert.ok(page.calls.play >= 1, "play must work before config arrives");
  assert.equal(page.el("trackStatus").textContent, "Now Playing");

  page.click("nextButton");
  assert.equal(page.el("trackTitle").textContent, "International Desert Drive");
});

test("a late config does not clobber the track the user chose", async () => {
  const page = await createPage({
    configMode: "manual",
    config: {
      playlist: [
        { src: "https://example.com/new-a.mp3", title: "New A" },
        { src: "https://example.com/new-b.mp3", title: "New B" },
      ],
    },
  });
  // user interacts while the config is still in flight
  page.click("nextButton");
  assert.equal(page.el("trackTitle").textContent, "International Desert Drive");

  await page.resolveConfig();
  assert.equal(
    page.el("trackTitle").textContent,
    "International Desert Drive",
    "late config must not replace the user's current track"
  );
});

test("a late config does swap content for an idle visitor", async () => {
  const page = await createPage({
    configMode: "manual",
    config: {
      playlist: [{ src: "https://example.com/new-a.mp3", title: "New A" }],
    },
  });
  assert.equal(page.el("trackTitle").textContent, "Sand Drive");
  await page.resolveConfig();
  assert.equal(page.el("trackTitle").textContent, "New A");
});

test("resume re-anchors by track src when the playlist order changes", async () => {
  // saved while '99 to Infinity' was at index 2; state says index 0 to
  // simulate a playlist that has since been reordered
  const page = await createPage({
    storage: {
      [KEY]: JSON.stringify({
        trackIndex: 0,
        src: "https://media.tymmop.com/portals/04-infinity.mp3",
        position: 30,
        savedAt: Date.now(),
      }),
    },
  });
  assert.equal(page.el("trackTitle").textContent, "99 to Infinity");
});

test("resume starts fresh when the saved track left the catalog", async () => {
  const page = await createPage({
    storage: {
      [KEY]: JSON.stringify({
        trackIndex: 1,
        src: "https://gone.example.com/removed.mp3",
        position: 30,
        savedAt: Date.now(),
      }),
    },
  });
  assert.equal(page.el("trackTitle").textContent, "Sand Drive");
  page.setAudioState({ duration: 200, currentTime: 0 });
  page.fire(page.audio, "loadedmetadata");
  assert.equal(page.audio.currentTime, 0, "stale position must not be applied");
});

test("natural track end does not overwrite the resume state", async () => {
  const page = await createPage();
  page.setAudioState({ ended: true, currentTime: 180 });
  page.fire(page.audio, "pause"); // browsers fire pause right before ended
  assert.equal(page.window.localStorage.getItem(KEY), null);
});

test("changing track while paused persists the new track", async () => {
  const page = await createPage();
  page.click("nextButton");
  const saved = JSON.parse(page.window.localStorage.getItem(KEY));
  assert.equal(saved.trackIndex, 1);
  assert.equal(saved.src, "https://media.tymmop.com/portals/02-trouble.mp3");
  assert.equal(saved.position, 0);
});

test("resume seek waits out an Infinity duration (streamed response)", async () => {
  const page = await createPage({
    storage: {
      [KEY]: JSON.stringify({
        trackIndex: 2,
        src: "https://media.tymmop.com/portals/04-infinity.mp3",
        position: 30,
        savedAt: Date.now(),
      }),
    },
  });
  page.setAudioState({ duration: Infinity, currentTime: 0 });
  page.fire(page.audio, "loadedmetadata");
  assert.equal(page.audio.currentTime, 0, "no seek while duration is Infinity");

  page.setAudioState({ duration: 200 });
  page.fire(page.audio, "durationchange");
  assert.equal(page.audio.currentTime, 30, "seek once a real duration exists");
});
