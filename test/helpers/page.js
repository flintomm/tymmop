"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/**
 * Boot the real index.html + app.js in jsdom with the browser APIs the
 * app touches (media element, media session, umami, fetch for config)
 * replaced by inspectable test doubles.
 */
async function createPage({ config } = {}) {
  const html = read("index.html");
  const appJs = read("app.js");
  const configJson =
    config !== undefined ? config : JSON.parse(read("config/player.json"));

  const dom = new JSDOM(html, {
    url: "https://tymmop.com/",
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

  window.fetch = (url) => {
    if (String(url).includes("config/player.json")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(configJson),
      });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  };

  window.eval(appJs);

  // let loadConfig() and other startup promises settle
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  const document = window.document;
  const audio = document.getElementById("audioElement");

  return {
    window,
    document,
    audio,
    calls,
    mediaSession,
    el: (id) => document.getElementById(id),
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
    setAudioState({ duration, currentTime }) {
      if (duration !== undefined) {
        Object.defineProperty(audio, "duration", {
          value: duration,
          configurable: true,
        });
      }
      if (currentTime !== undefined) {
        Object.defineProperty(audio, "currentTime", {
          value: currentTime,
          configurable: true,
          writable: true,
        });
      }
    },
  };
}

module.exports = { createPage, read, ROOT };
