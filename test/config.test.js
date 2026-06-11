"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createPage, read, ROOT } = require("./helpers/page.js");

const config = JSON.parse(read("config/player.json"));

test("config playlist entries are complete", () => {
  assert.ok(Array.isArray(config.playlist) && config.playlist.length >= 1);
  for (const track of config.playlist) {
    assert.equal(typeof track.src, "string", "track src required");
    assert.match(track.src, /^https?:\/\/|^assets\//);
    assert.equal(typeof track.title, "string", "track title required");
    assert.ok(track.title.length > 0);
  }
});

test("config video sequence references real files", () => {
  assert.ok(Array.isArray(config.videoSequence) && config.videoSequence.length >= 1);
  for (const src of config.videoSequence) {
    if (!/^https?:\/\//.test(src)) {
      assert.ok(
        fs.existsSync(path.join(ROOT, src)),
        `videoSequence references missing file ${src}`
      );
    }
  }
});

test("config links entries, when present, have label and absolute url", () => {
  assert.ok(Array.isArray(config.links), "links must be an array");
  for (const link of config.links) {
    assert.equal(typeof link.label, "string");
    assert.match(link.url, /^https?:\/\//);
  }
});

test("the playlist used by the player comes from config", async () => {
  const page = await createPage({
    config: {
      desktop: { playerLeftPct: 50 },
      playlist: [
        { src: "https://example.com/a.mp3", title: "Config Track A" },
        { src: "https://example.com/b.mp3", title: "Config Track B" },
      ],
    },
  });
  assert.equal(page.el("trackTitle").textContent, "Config Track A");
  page.click("nextButton");
  assert.equal(page.el("trackTitle").textContent, "Config Track B");
  page.click("nextButton");
  assert.equal(
    page.el("trackTitle").textContent,
    "Config Track A",
    "two-track playlist must wrap"
  );
});

test("an invalid config playlist falls back to the built-in one", async () => {
  const page = await createPage({
    config: { playlist: [{ nope: true }, "garbage"] },
  });
  assert.equal(page.el("trackTitle").textContent, "Sand Drive");
});

test("background video sequence comes from config", async () => {
  const page = await createPage({
    config: { videoSequence: ["assets/road2.mp4"] },
  });
  const video = page.el("backgroundVideoPrimary");
  assert.match(video.src, /assets\/road2\.mp4$/);
});

test("links render as new-tab anchors and stay hidden when empty", async () => {
  const withLinks = await createPage({
    config: {
      links: [
        { label: "instagram", url: "https://instagram.com/tymmop" },
        { label: "bad entry" },
        { label: "spotify", url: "https://open.spotify.com/artist/x" },
      ],
    },
  });
  const nav = withLinks.el("siteLinks");
  assert.equal(nav.hidden, false);
  const anchors = [...nav.querySelectorAll("a")];
  assert.equal(anchors.length, 2, "invalid entries must be skipped");
  for (const anchor of anchors) {
    assert.equal(anchor.target, "_blank");
    assert.match(anchor.rel, /noopener/);
  }
  assert.equal(anchors[0].textContent, "instagram");

  const noLinks = await createPage({ config: { links: [] } });
  assert.equal(noLinks.el("siteLinks").hidden, true);

  const missing = await createPage({ config: {} });
  assert.equal(missing.el("siteLinks").hidden, true);
});

test("clicking a link records a umami event", async () => {
  const page = await createPage({
    config: { links: [{ label: "bandcamp", url: "https://tymmop.bandcamp.com" }] },
  });
  const anchor = page.el("siteLinks").querySelector("a");
  anchor.dispatchEvent(
    new page.window.MouseEvent("click", { bubbles: true, cancelable: true })
  );
  const events = page.calls.umami.filter((e) => e.event === "link-click");
  assert.equal(events.length, 1);
  assert.equal(events[0].data.label, "bandcamp");
});
