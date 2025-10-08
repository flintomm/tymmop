(() => {
  const root = document.documentElement;
  const rootStyle = root.style;
  const overlayImage = document.getElementById("overlayImage");
  const overlayWrapper = document.getElementById("overlayWrapper");
  const overlayStage = document.querySelector(".overlay-stage");
  const backgroundVideo = document.getElementById("backgroundVideo");
  const fallbackImage = document.getElementById("backgroundFallback");
  const audioEl = document.getElementById("audioElement");

  const DEFAULT_GEOMETRY = {
    playerLeftPct: 47.6,
    playerTopPct: 50.4,
    playerWidthPct: 14.2,
    playerHeightPct: 8.1,
    overlayScale: 1,
    overlayTranslateXPct: 0,
    overlayTranslateYPct: 0,
  };

  const playlist = [
    { src: "https://media.tymmop.com/portals/01-ntro.mp3", title: "Sand Drive", artist: "tymmo p" },
    {
      src: "https://media.tymmop.com/portals/02-trouble.mp3",
      title: "International Desert Drive",
      artist: "tymmo p",
    },
    {
      src: "https://media.tymmop.com/portals/03-double.mp3",
      title: "Floating Airy Helicopty Ride",
      artist: "tymmo p",
    },
    { src: "https://media.tymmop.com/portals/04-infinity.mp3", title: "99 to Infinity", artist: "tymmo p" },
    { src: "https://media.tymmop.com/portals/05-rooftop.mp3", title: "Rooftop Fireworks", artist: "tymmo p" },
    { src: "https://media.tymmop.com/portals/06-justr.mp3", title: "Things Just R", artist: "tymmo p" },
  ];

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
  };

  let geometryState = { ...DEFAULT_GEOMETRY };
  let configData = null;
  let overlayNatural = { width: 0, height: 0 };
  let currentTrackIndex = 0;
  let isPlaying = false;

  const DEFAULT_VOLUME = 0.8;
  const SEEK_SCRUB_STEP = 5;

  audioEl.preload = "metadata";
  audioEl.crossOrigin = "anonymous";

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

  function updatePlayStateVisual(isNowPlaying) {
    const icon = isNowPlaying
      ? '<svg viewBox="0 0 24 24"><path d="M8 5h3v14H8zm5 0h3v14h-3z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    elements.playPauseIcon.innerHTML = icon;
    elements.playPauseButton.setAttribute("aria-label", isNowPlaying ? "Pause" : "Play");
    elements.playPauseButton.setAttribute("title", isNowPlaying ? "Pause" : "Play");
    elements.status.textContent = isNowPlaying ? "Now Playing" : "Paused";
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
    currentTrackIndex = (index + playlist.length) % playlist.length;
    const track = playlist[currentTrackIndex];
    elements.title.textContent = track.title;
    elements.title.setAttribute("title", track.title);
    elements.artist.textContent = track.artist ?? "tymmo p";
    elements.status.textContent = isPlaying ? "Now Playing" : "Paused";
    elements.currentTime.textContent = "0:00";
    elements.duration.textContent = "0:00";
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
        applyGeometry(config.desktop ?? DEFAULT_GEOMETRY);
      })
      .catch((error) => {
        console.warn("Failed to load config/player.json; using defaults.", error);
        configData = { desktop: { ...DEFAULT_GEOMETRY } };
        applyGeometry(DEFAULT_GEOMETRY);
      });
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
        if (!configData?.desktop) {
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

  function setupBackgroundVideo() {
    fallbackImage.classList.add("is-visible");

    backgroundVideo.addEventListener("canplay", () => {
      backgroundVideo.classList.add("is-ready");
      fallbackImage.classList.remove("is-visible");
      backgroundVideo.play().catch(() => {});
    });

    backgroundVideo.addEventListener("error", () => {
      backgroundVideo.classList.remove("is-ready");
      fallbackImage.classList.add("is-visible");
    });

    const resume = () => {
      backgroundVideo.play().finally(() => {
        document.removeEventListener("pointerdown", resume);
        document.removeEventListener("keydown", resume);
      });
    };

    document.addEventListener("pointerdown", resume, { once: true });
    document.addEventListener("keydown", resume, { once: true });
  }

  function wirePlayerEvents() {
    elements.playPauseButton.addEventListener("click", togglePlay);
    elements.prevButton.addEventListener("click", () => stepTrack(-1));
    elements.nextButton.addEventListener("click", () => stepTrack(1));

    audioEl.addEventListener("loadedmetadata", () => {
      updateTimeDisplay(audioEl.currentTime || 0, audioEl.duration || 0);
    });

    audioEl.addEventListener("timeupdate", () => {
      updateTimeDisplay(audioEl.currentTime || 0, audioEl.duration || 0);
    });

    audioEl.addEventListener("play", () => {
      isPlaying = true;
      updatePlayStateVisual(true);
    });

    audioEl.addEventListener("pause", () => {
      if (!audioEl.ended) {
        isPlaying = false;
        updatePlayStateVisual(false);
      }
    });

    audioEl.addEventListener("ended", () => {
      stepTrack(1);
      play();
    });

    document.addEventListener("keydown", handleKeyControls);
    window.addEventListener("resize", () => {
      updateOverlayTransform();
      updateTrackTitleMarquee();
    });
  }

  function initializePlayer() {
    audioEl.volume = DEFAULT_VOLUME;
    loadTrack(currentTrackIndex);
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

  setupBackgroundVideo();
  wirePlayerEvents();
  initializePlayer();

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

  loadConfig().then(() => {
    setupPlayerGeometryTools();
    updateOverlayTransform();
  });
})();
