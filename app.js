(() => {
  const root = document.documentElement;
  const rootStyle = root.style;
  const overlayImage = document.getElementById("overlayImage");
  const overlayWrapper = document.getElementById("overlayWrapper");
  const overlayStage = document.querySelector(".overlay-stage");
  const backgroundVideos = [
    document.getElementById("backgroundVideoPrimary"),
    document.getElementById("backgroundVideoSecondary"),
  ].filter(Boolean);
  const fallbackImage = document.getElementById("backgroundFallback");
  const audioEl = document.getElementById("audioElement");

  const DEFAULT_GEOMETRY = {
    playerLeftPct: 47.5,
    playerTopPct: 50.4,
    playerWidthPct: 13.3,
    playerHeightPct: 9.1,
    overlayScale: 1,
    overlayTranslateXPct: 0,
    overlayTranslateYPct: 0,
  };

  // fallbacks if config/player.json is missing or invalid; the config file
  // is the source of truth for the playlist, video sequence, and links
  const DEFAULT_VIDEO_SEQUENCE = [
    "assets/road.mp4",
    "assets/road3.mp4",
    "assets/road1.mp4",
    "assets/road2.mp4",
  ];

  const DEFAULT_PLAYLIST = [
    { src: "https://media.tymmop.com/portals/01-ntro.mp3", title: "Sand Drive", artist: "tymmo p" },
    {
      src: "https://media.tymmop.com/portals/02-trouble.mp3",
      title: "International Desert Drive",
      artist: "tymmo p",
    },
    { src: "https://media.tymmop.com/portals/04-infinity.mp3", title: "99 to Infinity", artist: "tymmo p" },
    { src: "https://media.tymmop.com/portals/05-rooftop.mp3", title: "Rooftop Fireworks", artist: "tymmo p" },
    { src: "https://media.tymmop.com/portals/06-justr.mp3", title: "Things Just R", artist: "tymmo p" },
  ];

  let videoSources = DEFAULT_VIDEO_SEQUENCE.slice();
  let playlist = DEFAULT_PLAYLIST.slice();

  const elements = {
    title: document.getElementById("trackTitle"),
    titleContainer: document.getElementById("trackTitleContainer"),
    titleInner: document.getElementById("trackTitleInner"),
    titleClone: document.getElementById("trackTitleClone"),
    artist: document.getElementById("trackArtist"),
    status: document.getElementById("trackStatus"),
    currentTime: document.getElementById("currentTime"),
    duration: document.getElementById("duration"),
    playPauseButton: document.getElementById("playPauseButton"),
    playPauseIcon: document.getElementById("playPauseIcon"),
    prevButton: document.getElementById("prevButton"),
    nextButton: document.getElementById("nextButton"),
    progressBar: document.getElementById("progressBar"),
    progressFill: document.getElementById("progressFill"),
  };

  let geometryState = { ...DEFAULT_GEOMETRY };
  let configData = null;
  let overlayNatural = { width: 0, height: 0 };
  let currentTrackIndex = 0;
  let isPlaying = false;
  let hasTrackedPlay = false;

  const DEFAULT_VOLUME = 1.0;
  const SEEK_SCRUB_STEP = 5;
  const BACKGROUND_PLAYBACK_RATE = 0.68;
  const CROSSFADE_DURATION_MS = 3500;
  const CROSSFADE_LEAD_TIME = 2.5;
  const MOBILE_QUERY = "(max-width: 700px)";
  const BASE_TITLE = document.title;
  const STORAGE_KEY = "tymmop:player-state";
  const RESUME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const RESUME_SAVE_INTERVAL_MS = 3000;

  let pendingResumePosition = null;
  let lastResumeSaveAt = 0;

  audioEl.preload = "metadata";

  function setVar(name, value) {
    rootStyle.setProperty(name, String(value));
  }

  function applyGeometry(geometry = {}) {
    geometryState = { ...geometryState, ...geometry };
    setVar("--player-left-pct", geometryState.playerLeftPct);
    setVar("--player-top-pct", geometryState.playerTopPct);
    setVar("--player-width-pct", geometryState.playerWidthPct);
    setVar("--player-height-pct", geometryState.playerHeightPct);
    setVar("--overlay-translate-x-pct", geometryState.overlayTranslateXPct);
    setVar("--overlay-translate-y-pct", geometryState.overlayTranslateYPct);
    updateOverlayTransform();
    updateTrackTitleMarquee();
  }

  function updateOverlayTransform() {
    if (!overlayNatural.width || !overlayNatural.height) return;
    if (!overlayStage) return;

    const stageWidth = overlayStage.clientWidth;
    const stageHeight = overlayStage.clientHeight;
    if (!stageWidth || !stageHeight) return;

    const scaleWidth = stageWidth / overlayNatural.width;
    const scaleHeight = stageHeight / overlayNatural.height;
    const coverScale = Math.max(scaleWidth, scaleHeight);
    const targetScale = coverScale * (Number(geometryState.overlayScale) || 1);

    setVar("--overlay-scale", targetScale);
  }

  function cacheOverlayDimensions() {
    if (!overlayImage.naturalWidth || !overlayImage.naturalHeight) return;
    overlayNatural = {
      width: overlayImage.naturalWidth,
      height: overlayImage.naturalHeight,
    };
    setVar("--overlay-base-width", `${overlayNatural.width}px`);
    setVar("--overlay-base-height", `${overlayNatural.height}px`);
    updateOverlayTransform();
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const whole = Math.floor(seconds);
    const mins = Math.floor(whole / 60);
    const secs = whole % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function updateTimeDisplay(current, duration) {
    elements.currentTime.textContent = formatTime(current);
    elements.duration.textContent = formatTime(duration);
  }

  function updateProgressFill(current, duration) {
    if (!elements.progressFill) return;
    const ratio =
      Number.isFinite(duration) && duration > 0
        ? Math.min(Math.max(current / duration, 0), 1)
        : 0;
    elements.progressFill.style.width = `${ratio * 100}%`;
  }

  function updateMediaSessionMetadata(track) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist != null ? track.artist : "tymmo p",
      album: "between the spaces",
      artwork: [
        { src: "assets/og-card.jpg", sizes: "1200x630", type: "image/jpeg" },
      ],
    });
  }

  function updatePlayStateVisual(isNowPlaying) {
    const icon = isNowPlaying
      ? '<svg viewBox="0 0 24 24"><path d="M8 5h3v14H8zm5 0h3v14h-3z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    elements.playPauseIcon.innerHTML = icon;
    elements.playPauseButton.setAttribute("aria-label", isNowPlaying ? "Pause" : "Play");
    elements.playPauseButton.setAttribute("title", isNowPlaying ? "Pause" : "Play");
    elements.status.textContent = isNowPlaying ? "Now Playing" : "Paused";
    document.title = isNowPlaying
      ? `▶ ${elements.title.textContent} — tymmo p`
      : BASE_TITLE;
  }

  function readResumeState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (
        !Number.isInteger(state.trackIndex) ||
        state.trackIndex < 0 ||
        state.trackIndex >= playlist.length
      ) {
        return null;
      }
      if (!Number.isFinite(state.position) || state.position < 0) return null;
      if (
        !Number.isFinite(state.savedAt) ||
        Date.now() - state.savedAt > RESUME_MAX_AGE_MS
      ) {
        return null;
      }
      return state;
    } catch (error) {
      return null;
    }
  }

  function saveResumeState() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          trackIndex: currentTrackIndex,
          position: audioEl.currentTime || 0,
          savedAt: Date.now(),
        })
      );
    } catch (error) {
      /* storage unavailable (private mode etc.) — resume is best-effort */
    }
  }

  function updateTrackTitleMarquee() {
    const { titleContainer, titleInner, title, titleClone } = elements;
    if (!titleContainer || !titleInner || !title || !titleClone) return;

    titleClone.textContent = "";
    titleContainer.classList.remove("track-title--scroll");
    titleContainer.style.removeProperty("--track-scroll-distance");
    titleContainer.style.removeProperty("--track-scroll-duration");
    titleInner.style.removeProperty("--track-scroll-gap");

    requestAnimationFrame(() => {
      const containerWidth = titleContainer.clientWidth;
      const textWidth = title.scrollWidth;

      if (!containerWidth || textWidth <= containerWidth) {
        return;
      }

      if (containerWidth < 96) {
        return;
      }

      const dynamicGap = Math.min(
        Math.max(containerWidth * 0.45, 18),
        Math.max(textWidth * 0.35, 36)
      );
      titleInner.style.setProperty("--track-scroll-gap", `${dynamicGap}px`);

      const travelDistance = textWidth + dynamicGap;
      const pixelsPerSecond = 40;
      const durationSeconds = Math.max(travelDistance / pixelsPerSecond, 7);

      titleClone.textContent = title.textContent;
      titleContainer.style.setProperty("--track-scroll-distance", `${travelDistance}px`);
      titleContainer.style.setProperty("--track-scroll-duration", `${durationSeconds}s`);
      titleContainer.classList.add("track-title--scroll");
    });
  }

  function loadTrack(index) {
    if (!playlist.length) return;
    pendingResumePosition = null;
    currentTrackIndex = (index + playlist.length) % playlist.length;
    const track = playlist[currentTrackIndex];
    elements.title.textContent = track.title;
    elements.title.setAttribute("title", track.title);
    elements.artist.textContent = track.artist != null ? track.artist : "tymmo p";
    elements.status.textContent = isPlaying ? "Now Playing" : "Paused";
    elements.currentTime.textContent = "0:00";
    elements.duration.textContent = "0:00";
    hasTrackedPlay = false;
    updateProgressFill(0, 0);
    updateMediaSessionMetadata(track);
    updateTrackTitleMarquee();

    audioEl.src = track.src;
    audioEl.load();
    if (isPlaying) {
      audioEl
        .play()
        .then(() => updatePlayStateVisual(true))
        .catch(() => {
          isPlaying = false;
          updatePlayStateVisual(false);
        });
    }
  }

  function play() {
    if (!playlist.length) return;
    isPlaying = true;
    audioEl
      .play()
      .then(() => {
        updatePlayStateVisual(true);
      })
      .catch(() => {
        isPlaying = false;
        updatePlayStateVisual(false);
      });
  }

  function pause() {
    isPlaying = false;
    audioEl.pause();
    updatePlayStateVisual(false);
  }

  function togglePlay() {
    if (audioEl.paused) {
      play();
    } else {
      pause();
    }
  }

  function stepTrack(direction) {
    loadTrack(currentTrackIndex + direction);
    if (isPlaying) play();
  }

  function handleKeyControls(event) {
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "BUTTON" || tag === "TEXTAREA") return;

    switch (event.key) {
      case " ":
      case "Spacebar":
        event.preventDefault();
        togglePlay();
        elements.playPauseButton.focus();
        break;
      case "ArrowRight":
        event.preventDefault();
        audioEl.currentTime = Math.min(
          audioEl.currentTime + SEEK_SCRUB_STEP,
          audioEl.duration || audioEl.currentTime
        );
        break;
      case "ArrowLeft":
        event.preventDefault();
        audioEl.currentTime = Math.max(audioEl.currentTime - SEEK_SCRUB_STEP, 0);
        break;
      case "n":
      case "N":
        stepTrack(1);
        break;
      case "p":
      case "P":
        stepTrack(-1);
        break;
      default:
        break;
    }
  }

  function loadConfig() {
    return fetch("config/player.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Config request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then((config) => {
        configData = config;
        const desktopConfig = config && config.desktop ? config.desktop : DEFAULT_GEOMETRY;
        applyGeometry(desktopConfig);
        return config;
      })
      .catch((error) => {
        console.warn("Failed to load config/player.json; using defaults.", error);
        configData = { desktop: { ...DEFAULT_GEOMETRY } };
        applyGeometry(DEFAULT_GEOMETRY);
        return null;
      });
  }

  function applyConfigContent(config) {
    if (config && Array.isArray(config.playlist)) {
      const tracks = config.playlist.filter(
        (track) =>
          track &&
          typeof track.src === "string" &&
          typeof track.title === "string"
      );
      if (tracks.length) playlist = tracks;
    }
    if (config && Array.isArray(config.videoSequence)) {
      const sources = config.videoSequence.filter(
        (src) => typeof src === "string" && src.trim().length
      );
      if (sources.length) videoSources = sources;
    }
    renderSiteLinks(config && Array.isArray(config.links) ? config.links : []);
  }

  function renderSiteLinks(links) {
    const nav = document.getElementById("siteLinks");
    if (!nav) return;
    const valid = links.filter(
      (link) =>
        link &&
        typeof link.label === "string" &&
        typeof link.url === "string" &&
        /^https?:\/\//.test(link.url)
    );
    nav.innerHTML = "";
    if (!valid.length) {
      nav.hidden = true;
      return;
    }
    valid.forEach(({ label, url }) => {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.textContent = label;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.addEventListener("click", () => {
        if (window.umami && typeof window.umami.track === "function") {
          window.umami.track("link-click", { label });
        }
      });
      nav.appendChild(anchor);
    });
    nav.hidden = false;
  }

  function setupPlayerGeometryTools() {
    window.playerGeometryTools = {
      getConfig() {
        return configData ? JSON.parse(JSON.stringify(configData)) : undefined;
      },
      get() {
        return { ...geometryState };
      },
      set(partial = {}) {
        const next = { ...geometryState };
        Object.entries(partial).forEach(([key, value]) => {
          if (typeof next[key] === "undefined") return;
          if (typeof value !== "number" || Number.isNaN(value)) return;
          next[key] = value;
        });
        applyGeometry(next);
        return { ...geometryState };
      },
      reset() {
        if (!configData || !configData.desktop) {
          console.warn("No desktop geometry in config to reset to.");
          applyGeometry(DEFAULT_GEOMETRY);
          return { ...geometryState };
        }
        applyGeometry(configData.desktop);
        return { ...geometryState };
      },
      log() {
        console.table({ desktop: geometryState });
        return { ...geometryState };
      },
    };
  }

  function setupResponsiveDock() {
    const playerShell = document.getElementById("playerShell");
    if (!playerShell || !overlayWrapper) return;
    if (typeof window.matchMedia !== "function") return;

    // position: fixed cannot escape the overlay wrapper's transform, so
    // docking on small screens requires physically moving the node to body
    const homeParent = playerShell.parentElement;
    const homeAnchor = playerShell.nextElementSibling;
    const query = window.matchMedia(MOBILE_QUERY);

    const applyDockMode = (isMobile) => {
      if (isMobile) {
        playerShell.classList.add("player-shell--docked");
        document.body.appendChild(playerShell);
      } else {
        playerShell.classList.remove("player-shell--docked");
        homeParent.insertBefore(playerShell, homeAnchor);
      }
      updateTrackTitleMarquee();
    };

    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", (event) => applyDockMode(event.matches));
    } else if (typeof query.addListener === "function") {
      query.addListener((event) => applyDockMode(event.matches));
    }
    applyDockMode(query.matches);
  }

  function setupBackgroundVideo() {
    if (!backgroundVideos.length) {
      console.warn("No background video elements found.");
      if (fallbackImage) {
        fallbackImage.classList.add("is-visible");
      }
      return;
    }

    const sources = videoSources.filter((src) => typeof src === "string" && src.trim().length);
    if (!sources.length) {
      console.warn("No background video sources configured.");
      if (fallbackImage) {
        fallbackImage.classList.add("is-visible");
      }
      return;
    }

    let hasUserInteracted = false;
    let activeSlot = 0;
    let activeSourceIndex = 0;
    let isCrossfadeRunning = false;

    function ensurePlayback(video) {
      if (!video) return;
      video.playbackRate = BACKGROUND_PLAYBACK_RATE;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((error) => {
          console.warn("Background video playback failed", error);
        });
      }
    }

    const normalizeIndex = (index) => {
      const count = sources.length;
      return ((index % count) + count) % count;
    };

    if (backgroundVideos.length < 2) {
      console.warn("Expected two background video elements for crossfade; using single video fallback.");
      const singleVideo = backgroundVideos[0];

      if (!singleVideo) {
        if (fallbackImage) {
          fallbackImage.classList.add("is-visible");
        }
        return;
      }

      singleVideo.pause();
      singleVideo.currentTime = 0;
      singleVideo.classList.remove("is-active");

      if (fallbackImage) {
        fallbackImage.classList.add("is-visible");
      }

      singleVideo.addEventListener(
        "canplay",
        () => {
          if (fallbackImage) {
            fallbackImage.classList.remove("is-visible");
          }
          if (hasUserInteracted) {
            ensurePlayback(singleVideo);
          }
        },
        { once: true }
      );

      singleVideo.addEventListener("error", (event) => {
        console.warn("Background video error", event);
        if (fallbackImage) {
          fallbackImage.classList.add("is-visible");
        }
      });

      singleVideo.src = sources[0];
      singleVideo.load();

      const startPlaybackSingle = () => {
        hasUserInteracted = true;
        ensurePlayback(singleVideo);
      };

      document.addEventListener("pointerdown", startPlaybackSingle, { once: true });
      document.addEventListener("keydown", startPlaybackSingle, { once: true });
      audioEl.addEventListener("play", startPlaybackSingle, { once: true });

      return;
    }

    backgroundVideos.forEach((video) => {
      video.pause();
      video.currentTime = 0;
      video.classList.remove("is-active");
      video.removeAttribute("loop");
      video.removeAttribute("autoplay");
    });

    if (fallbackImage) {
      fallbackImage.classList.add("is-visible");
    }

    const loadSlot = (slot, sourceIndex) => {
      const video = backgroundVideos[slot];
      if (!video) {
        return Promise.reject(new Error(`Missing background video slot ${slot}`));
      }

      const source = sources[normalizeIndex(sourceIndex)];

      return new Promise((resolve, reject) => {
        const handleCanPlay = () => {
          cleanup();
          video.dataset.sourceIndex = String(normalizeIndex(sourceIndex));
          resolve(video);
        };
        const handleError = (event) => {
          cleanup();
          reject(event);
        };
        const cleanup = () => {
          video.removeEventListener("canplay", handleCanPlay);
          video.removeEventListener("error", handleError);
        };

        video.pause();
        video.currentTime = 0;
        video.addEventListener("canplay", handleCanPlay, { once: true });
        video.addEventListener("error", handleError, { once: true });
        video.src = source;
        video.load();
      });
    };

    const startCrossfade = (forceImmediate = false) => {
      if (isCrossfadeRunning) return;

      const outgoingSlot = activeSlot;
      const incomingSlot = 1 - activeSlot;
      const nextSourceIndex = normalizeIndex(activeSourceIndex + 1);

      isCrossfadeRunning = true;

      loadSlot(incomingSlot, nextSourceIndex)
        .then((incomingVideo) => {
          if (hasUserInteracted) {
            ensurePlayback(incomingVideo);
          }

          if (fallbackImage) {
            fallbackImage.classList.remove("is-visible");
          }

          requestAnimationFrame(() => {
            incomingVideo.classList.add("is-active");
            const outgoingActiveVideo = backgroundVideos[outgoingSlot];
            if (outgoingActiveVideo) {
              outgoingActiveVideo.classList.remove("is-active");
            }
          });

          const outgoingVideo = backgroundVideos[outgoingSlot];
          if (outgoingVideo) {
            const delay = forceImmediate ? 0 : CROSSFADE_DURATION_MS;
            window.setTimeout(() => {
              outgoingVideo.pause();
              outgoingVideo.currentTime = 0;
            }, delay);
          }

          activeSlot = incomingSlot;
          activeSourceIndex = nextSourceIndex;
        })
        .catch((error) => {
          console.warn("Failed to prepare background video", error);
        })
        .finally(() => {
          isCrossfadeRunning = false;
        });
    };

    backgroundVideos.forEach((video, slot) => {
      video.addEventListener("timeupdate", () => {
        if (slot !== activeSlot) return;
        if (isCrossfadeRunning) return;
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;
        if (!Number.isFinite(video.currentTime)) return;

        const remaining = video.duration - video.currentTime;
        if (remaining <= CROSSFADE_LEAD_TIME) {
          startCrossfade();
        }
      });

      video.addEventListener("ended", () => {
        if (slot === activeSlot) {
          startCrossfade(true);
        }
      });

      video.addEventListener("error", (event) => {
        if (slot === activeSlot) {
          console.warn("Background video error", event);
          startCrossfade(true);
        }
      });
    });

    loadSlot(activeSlot, activeSourceIndex)
      .then((video) => {
        video.classList.add("is-active");
        if (fallbackImage) {
          fallbackImage.classList.remove("is-visible");
        }
        if (hasUserInteracted) {
          ensurePlayback(video);
        }
      })
      .catch((error) => {
        console.warn("Failed to load initial background video", error);
      });

    const startPlayback = () => {
      hasUserInteracted = true;
      ensurePlayback(backgroundVideos[activeSlot]);
    };

    document.addEventListener("pointerdown", startPlayback, { once: true });
    document.addEventListener("keydown", startPlayback, { once: true });
    audioEl.addEventListener(
      "play",
      () => {
        hasUserInteracted = true;
        ensurePlayback(backgroundVideos[activeSlot]);
      },
      { once: true }
    );
  }

  function wirePlayerEvents() {
    elements.playPauseButton.addEventListener("click", togglePlay);
    elements.prevButton.addEventListener("click", () => stepTrack(-1));
    elements.nextButton.addEventListener("click", () => stepTrack(1));

    audioEl.addEventListener("loadedmetadata", () => {
      if (
        pendingResumePosition !== null &&
        Number.isFinite(audioEl.duration) &&
        pendingResumePosition < audioEl.duration
      ) {
        audioEl.currentTime = pendingResumePosition;
      }
      pendingResumePosition = null;
      updateTimeDisplay(audioEl.currentTime || 0, audioEl.duration || 0);
      updateProgressFill(audioEl.currentTime || 0, audioEl.duration || 0);
    });

    audioEl.addEventListener("timeupdate", () => {
      updateTimeDisplay(audioEl.currentTime || 0, audioEl.duration || 0);
      updateProgressFill(audioEl.currentTime || 0, audioEl.duration || 0);
      if (Date.now() - lastResumeSaveAt >= RESUME_SAVE_INTERVAL_MS) {
        lastResumeSaveAt = Date.now();
        saveResumeState();
      }
    });

    audioEl.addEventListener("play", () => {
      isPlaying = true;
      updatePlayStateVisual(true);
      if (
        !hasTrackedPlay &&
        window.umami &&
        typeof window.umami.track === "function"
      ) {
        window.umami.track("track-play", {
          title: playlist[currentTrackIndex].title,
        });
        hasTrackedPlay = true;
      }
    });

    audioEl.addEventListener("pause", () => {
      if (!audioEl.ended) {
        isPlaying = false;
        updatePlayStateVisual(false);
      }
      saveResumeState();
    });

    audioEl.addEventListener("ended", () => {
      stepTrack(1);
      play();
    });

    if (elements.progressBar) {
      let isScrubbing = false;

      const seekFromPointer = (event) => {
        const rect = elements.progressBar.getBoundingClientRect();
        if (!rect.width) return;
        if (!Number.isFinite(audioEl.duration) || audioEl.duration <= 0) return;
        const ratio = Math.min(
          Math.max((event.clientX - rect.left) / rect.width, 0),
          1
        );
        audioEl.currentTime = ratio * audioEl.duration;
        updateProgressFill(audioEl.currentTime, audioEl.duration);
      };

      elements.progressBar.addEventListener("pointerdown", (event) => {
        isScrubbing = true;
        if (elements.progressBar.setPointerCapture) {
          elements.progressBar.setPointerCapture(event.pointerId);
        }
        seekFromPointer(event);
      });
      elements.progressBar.addEventListener("pointermove", (event) => {
        if (isScrubbing) seekFromPointer(event);
      });
      const endScrub = () => {
        isScrubbing = false;
      };
      elements.progressBar.addEventListener("pointerup", endScrub);
      elements.progressBar.addEventListener("pointercancel", endScrub);
    }

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", play);
      navigator.mediaSession.setActionHandler("pause", pause);
      navigator.mediaSession.setActionHandler("previoustrack", () =>
        stepTrack(-1)
      );
      navigator.mediaSession.setActionHandler("nexttrack", () => stepTrack(1));
    }

    document.addEventListener("keydown", handleKeyControls);
    window.addEventListener("resize", () => {
      updateOverlayTransform();
      updateTrackTitleMarquee();
    });
  }

  function initializePlayer() {
    audioEl.volume = DEFAULT_VOLUME;
    const resume = readResumeState();
    loadTrack(resume ? resume.trackIndex : currentTrackIndex);
    if (resume) {
      pendingResumePosition = resume.position;
    }
    updatePlayStateVisual(false);
  }

  if (overlayImage.complete) {
    cacheOverlayDimensions();
  } else {
    overlayImage.addEventListener("load", () => {
      cacheOverlayDimensions();
      updateOverlayTransform();
    });
  }

  setupResponsiveDock();
  wirePlayerEvents();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready
      .then(() => {
        updateTrackTitleMarquee();
      })
      .catch(() => {});
  } else {
    window.addEventListener(
      "load",
      () => {
        updateTrackTitleMarquee();
      },
      { once: true }
    );
  }

  loadConfig().then((config) => {
    applyConfigContent(config);
    setupPlayerGeometryTools();
    setupBackgroundVideo();
    initializePlayer();
    updateOverlayTransform();
  });
})();
