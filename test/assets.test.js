"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { read, ROOT } = require("./helpers/page.js");

function assertFileExists(rel, source) {
  assert.ok(
    fs.existsSync(path.join(ROOT, rel)),
    `${source} references "${rel}" but the file does not exist`
  );
}

test("every relative src/href/poster/srcset in index.html points at a real file", () => {
  const html = read("index.html");
  const refs = [...html.matchAll(/(?:srcset|src|href|poster)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((url) => !/^(https?:)?\/\//.test(url) && !url.startsWith("#"));
  assert.ok(refs.length > 5, "expected to find local references");
  for (const ref of refs) assertFileExists(ref, "index.html");
});

test("the overlay ships a webp with png fallback", () => {
  const html = read("index.html");
  assert.match(html, /<source srcset="assets\/overlay-car\.webp" type="image\/webp" \/>/);
  assert.match(html, /src="assets\/overlay-car\.png"/);
  assertFileExists("assets/overlay-car.webp", "overlay picture");
});

test("og/twitter card images exist locally at their advertised paths", () => {
  const html = read("index.html");
  const images = [
    ...html.matchAll(
      /(?:property="og:image"|name="twitter:image")\s+content="https:\/\/tymmop\.com\/([^"]+)"/g
    ),
  ].map((m) => m[1]);
  assert.ok(images.length >= 1, "expected og:image/twitter:image tags");
  for (const ref of images) assertFileExists(ref, "social card meta");
});

test("every asset path mentioned in app.js exists", () => {
  const js = read("app.js");
  const refs = [...js.matchAll(/"(assets\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 0, "expected asset references in app.js");
  for (const ref of refs) assertFileExists(ref, "app.js");
});

test("every url() in styles.css exists", () => {
  const css = read("styles.css");
  const refs = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
    .map((m) => m[1])
    .filter((url) => !/^(https?:|data:)/.test(url));
  for (const ref of refs) assertFileExists(ref, "styles.css");
});

test("config/player.json parses and has sane desktop geometry", () => {
  const config = JSON.parse(read("config/player.json"));
  assert.ok(config.desktop, "config needs a desktop block");
  for (const key of [
    "playerLeftPct",
    "playerTopPct",
    "playerWidthPct",
    "playerHeightPct",
    "overlayScale",
  ]) {
    assert.equal(
      typeof config.desktop[key],
      "number",
      `desktop.${key} must be a number`
    );
    assert.ok(Number.isFinite(config.desktop[key]), `desktop.${key} finite`);
  }
});

test("no merge conflict markers in tracked text files", () => {
  for (const rel of ["index.html", "app.js", "styles.css", "README.md"]) {
    const content = read(rel);
    assert.ok(
      !/^(<{7}|={7}|>{7})/m.test(content),
      `${rel} contains merge conflict markers`
    );
  }
});
