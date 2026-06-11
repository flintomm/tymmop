"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..", "..");

const fileCache = new Map();
function read(rel) {
  if (!fileCache.has(rel)) {
    fileCache.set(rel, fs.readFileSync(path.join(ROOT, rel), "utf8"));
  }
  return fileCache.get(rel);
}

function readConfig() {
  return JSON.parse(read("config/player.json"));
}

function assertFileExists(assert, rel, source) {
  assert.ok(
    fs.existsSync(path.join(ROOT, rel)),
    `${source} references "${rel}" but the file does not exist`
  );
}

async function tick(times = 1) {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Boot the real index.html + app.js in jsdom with the browser APIs the
 * app touches (media element, media session, umami, fetch for config)
 * replaced by inspectable test doubles.
 */
async function createPage({
  config,
  mobile = false,
  storage = {},
  configMode = "immediate", // "immediate" | "pending" | "manual"
  url = "https://tymmop.com/",
} = {}) {
  const html = read("index.html");
  const appJs = read("app.js");
  const configJson = config !== undefined ? config : readConfig();

  const dom = new JSDOM(html, {
    url,
    pretendToBeVisual: true,
    runScripts: "outside-only",
  });
  const { window } = dom;

  const calls = {
    play: 0,
    pause: 0,
    load: 0,
    umami: [],
    mediaSessionHandlers: {},
  };

  window.HTMLMediaElement.prototype.play = function () {
    calls.play += 1;
    return Promise.resolve();
  };
  window.HTMLMediaElement.prototype.pause = function () {
    calls.pause += 1;
  };
  window.HTMLMediaElement.prototype.load = function () {
    calls.load += 1;
  };

  window.MediaMetadata = class MediaMetadata {
    constructor(init) {
      Object.assign(this, init);
    }
  };
  const mediaSession = {
    metadata: null,
    setActionHandler(type, handler) {
      calls.mediaSessionHandlers[type] = handler;
    },
  };
  Object.defineProperty(window.navigator, "mediaSession", {
    value: mediaSession,
    configurable: true,
  });

  window.umami = {
    track(event, data) {
      calls.umami.push({ event, data });
    },
  };

  const mediaQueries = [];
  window.matchMedia = (media) => {
    const listeners = new Set();
    const mql = {
      media,
      matches: mobile,
      addEventListener: (_type, fn) => listeners.add(fn),
      removeEventListener: (_type, fn) => listeners.delete(fn),
      dispatch(matches) {
        mql.matches = matches;
        listeners.forEach((fn) => fn({ matches, media }));
      },
    };
    mediaQueries.push(mql);
    return mql;
  };

  let releaseConfigFetch = null;
  window.fetch = (url) => {
    if (String(url).includes("config/player.json")) {
      const response = { ok: true, json: () => Promise.resolve(configJson) };
      if (configMode === "pending") {
        return new Promise(() => {}); // a fetch that never settles
      }
      if (configMode === "manual") {
        return new Promise((resolve) => {
          releaseConfigFetch = () => resolve(response);
        });
      }
      return Promise.resolve(response);
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  };

  for (const [key, value] of Object.entries(storage)) {
    window.localStorage.setItem(key, value);
  }

  window.eval(appJs);

  // let loadConfig() and other startup promises settle
  await tick(2);

  const document = window.document;
  const audio = document.getElementById("audioElement");

  return {
    window,
    document,
    audio,
    calls,
    mediaSession,
    el: (id) => document.getElementById(id),
    tick,
    async resolveConfig() {
      if (releaseConfigFetch) releaseConfigFetch();
      await tick(2);
    },
    setMobile(matches) {
      mediaQueries
        .filter((mql) => mql.media.includes("max-width"))
        .forEach((mql) => mql.dispatch(matches));
    },
    click(id) {
      document
        .getElementById(id)
        .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    },
    key(key) {
      document.dispatchEvent(new window.KeyboardEvent("keydown", { key }));
    },
    fire(target, type) {
      target.dispatchEvent(new window.Event(type));
    },
    setAudioState({ duration, currentTime, paused, ended }) {
      const define = (prop, value, writable = false) =>
        Object.defineProperty(audio, prop, {
          value,
          configurable: true,
          ...(writable ? { writable: true } : {}),
        });
      if (duration !== undefined) define("duration", duration);
      if (currentTime !== undefined) define("currentTime", currentTime, true);
      if (paused !== undefined) define("paused", paused);
      if (ended !== undefined) define("ended", ended);
    },
  };
}

module.exports = { createPage, read, readConfig, assertFileExists, tick, ROOT };
