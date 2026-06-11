"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createPage } = require("./helpers/page.js");

const KEY = "tymmop:player-state";

function state(overrides = {}) {
  return JSON.stringify({
    trackIndex: 2,
    position: 30,
    savedAt: Date.now(),
    ...overrides,
  });
}

test("listening progress is saved on timeupdate", async () => {
  const page = await createPage();
  page.setAudioState({ duration: 100, currentTime: 42 });
  page.fire(page.audio, "timeupdate");
  const saved = JSON.parse(page.window.localStorage.getItem(KEY));
  assert.equal(saved.trackIndex, 0);
  assert.equal(saved.position, 42);
  assert.ok(Number.isFinite(saved.savedAt));
});

test("progress is saved on pause", async () => {
  const page = await createPage();
  page.click("nextButton");
  page.setAudioState({ currentTime: 7 });
  page.fire(page.audio, "pause");
  const saved = JSON.parse(page.window.localStorage.getItem(KEY));
  assert.equal(saved.trackIndex, 1);
  assert.equal(saved.position, 7);
});

test("a returning visitor resumes track and position", async () => {
  const page = await createPage({ storage: { [KEY]: state() } });
  assert.equal(
    page.el("trackTitle").textContent,
    "99 to Infinity",
    "should restore the saved track"
  );
  page.setAudioState({ duration: 200 });
  page.fire(page.audio, "loadedmetadata");
  assert.equal(page.audio.currentTime, 30, "should seek to saved position");
});

test("stale saved state is ignored", async () => {
  const old = Date.now() - 40 * 24 * 60 * 60 * 1000;
  const page = await createPage({ storage: { [KEY]: state({ savedAt: old }) } });
  assert.equal(page.el("trackTitle").textContent, "Sand Drive");
});

test("corrupt or out-of-range saved state is ignored", async () => {
  for (const bad of [
    "not json{",
    state({ trackIndex: 99 }),
    state({ trackIndex: -1 }),
    state({ position: -5 }),
    state({ position: "x" }),
  ]) {
    const page = await createPage({ storage: { [KEY]: bad } });
    assert.equal(page.el("trackTitle").textContent, "Sand Drive");
  }
});

test("changing track manually cancels a pending resume seek", async () => {
  const page = await createPage({ storage: { [KEY]: state() } });
  page.click("nextButton"); // user immediately skips: forget the old position
  page.setAudioState({ duration: 200 });
  page.fire(page.audio, "loadedmetadata");
  assert.notEqual(page.audio.currentTime, 30);
});

test("resume never seeks past the end of a shortened file", async () => {
  const page = await createPage({
    storage: { [KEY]: state({ position: 500 }) },
  });
  page.setAudioState({ duration: 200, currentTime: 0 });
  page.fire(page.audio, "loadedmetadata");
  assert.equal(page.audio.currentTime, 0);
});
