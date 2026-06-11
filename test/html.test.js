"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { read } = require("./helpers/page.js");

const dom = new JSDOM(read("index.html"));
const doc = dom.window.document;

const q = (sel) => doc.querySelector(sel);

test("page has title, description, and canonical url", () => {
  assert.match(doc.title, /tymmo p/);
  assert.ok(q('meta[name="description"]')?.content.length > 20);
  assert.equal(q('link[rel="canonical"]')?.href, "https://tymmop.com/");
});

test("social cards are complete", () => {
  assert.ok(q('meta[property="og:title"]')?.content);
  assert.ok(q('meta[property="og:description"]')?.content);
  assert.match(q('meta[property="og:image"]')?.content, /^https:\/\//);
  assert.equal(q('meta[name="twitter:card"]')?.content, "summary_large_image");
});

test("icons are wired to the gunmetal set: ico, svg, png, apple touch", () => {
  assert.ok(q('link[rel="icon"][href^="assets/favicon-gunmetal/favicon.ico"]'));
  assert.ok(
    q(
      'link[rel="icon"][type="image/svg+xml"][href^="assets/favicon-gunmetal/favicon.svg"]'
    )
  );
  assert.ok(
    q(
      'link[rel="icon"][type="image/png"][href^="assets/favicon-gunmetal/favicon-32.png"]'
    )
  );
  assert.ok(
    q(
      'link[rel="apple-touch-icon"][href^="assets/favicon-gunmetal/apple-touch-icon-180.png"]'
    )
  );
});

test("umami analytics is present with a real website id", () => {
  const script = q("script[data-website-id]");
  assert.ok(script, "umami script tag missing");
  assert.match(script.src, /umami/);
  assert.match(
    script.getAttribute("data-website-id"),
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    "data-website-id must be a real uuid, not a placeholder"
  );
  assert.ok(script.hasAttribute("defer"), "umami script should be deferred");
});

test("transport buttons say what they do", () => {
  const prev = q("#prevButton");
  const next = q("#nextButton");
  assert.ok(prev && next, "prev/next buttons must exist");
  assert.match(prev.getAttribute("aria-label"), /previous/i);
  assert.match(prev.getAttribute("title"), /previous/i);
  assert.match(next.getAttribute("aria-label"), /next/i);
  assert.match(next.getAttribute("title"), /next/i);
  // visual order: previous on the left of next, play/pause between them
  const buttons = [...doc.querySelectorAll(".transport button")].map(
    (b) => b.id
  );
  assert.deepEqual(buttons, ["prevButton", "playPauseButton", "nextButton"]);
});

test("player chrome elements the script depends on all exist", () => {
  for (const id of [
    "trackTitle",
    "trackTitleContainer",
    "trackTitleInner",
    "trackTitleClone",
    "trackArtist",
    "trackStatus",
    "currentTime",
    "duration",
    "playPauseButton",
    "playPauseIcon",
    "prevButton",
    "nextButton",
    "progressBar",
    "progressFill",
    "shareButton",
    "audioElement",
    "overlayImage",
    "overlayWrapper",
    "backgroundVideoPrimary",
    "backgroundVideoSecondary",
    "backgroundFallback",
  ]) {
    assert.ok(doc.getElementById(id), `#${id} missing from index.html`);
  }
});

test("page has exactly one h1 for search engines, visually hidden", () => {
  const headings = doc.querySelectorAll("h1");
  assert.equal(headings.length, 1);
  assert.match(headings[0].textContent, /tymmo p/);
  assert.ok(headings[0].classList.contains("visually-hidden"));
  assert.match(read("styles.css"), /\.visually-hidden\s*{[^}]*clip/);
});

test("background videos are muted, inline, and decorative", () => {
  for (const video of doc.querySelectorAll("video")) {
    assert.ok(video.hasAttribute("muted"), "background video must be muted");
    assert.ok(video.hasAttribute("playsinline"), "needs playsinline for iOS");
    assert.equal(video.getAttribute("aria-hidden"), "true");
  }
});
