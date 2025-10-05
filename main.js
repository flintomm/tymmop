/* Desert Drive static viewport */
const MEDIA_BASE = 'https://media.tymmop.com/portals/';

window.addEventListener('DOMContentLoaded', () => {
  console.info('Desert Drive static view v20241005');

  const scene = document.querySelector('.scene');
  const dashOverlay = document.querySelector('.dash-overlay');
  const titleWrap = document.querySelector('.music-box__title');
  const titleInner = document.querySelector('.music-box__title-inner');
  const titleText = document.querySelector('.music-box__title-text');
  const controls = document.querySelector('.music-box__controls');
  const playButton = controls ? controls.querySelector('[data-action="play"]') : null;
  const audio = document.getElementById('music-player');
  const progressBar = document.querySelector('.music-box__bar');
  const artistLabel = document.querySelector('.music-box__artist');

  const tracks = [
    { title: 'Sand Drive', file: '01-ntro.mp3', artist: 'tymmo p' },
    { title: 'International Desert Drive', file: '02-trouble.mp3', artist: 'tymmo p' },
    { title: 'Floating Airy Helicopty Ride', file: '03-double.mp3', artist: 'tymmo p' },
    { title: '99 to Infinity', file: '04-infinity.mp3', artist: 'tymmo p' },
    { title: 'Rooftop Fireworks', file: '05-rooftop.mp3', artist: 'tymmo p' },
    { title: 'Things Just R', file: '06-justr.mp3', artist: 'tymmo p' }
  ];

  let currentTrackIndex = 0;

  if (!scene || !dashOverlay) {
    return;
  }

  const updateTitleMarquee = () => {
    if (!titleWrap || !titleText || !titleInner) {
      return;
    }

    const clones = titleInner.querySelectorAll('.music-box__title-text--clone');
    clones.forEach((node) => node.remove());

    titleInner.style.removeProperty('--scroll-distance');
    titleInner.style.removeProperty('--scroll-duration');

    const gap = 48;
    titleInner.style.setProperty('--scroll-gap', `${gap}px`);
    const needsScroll = titleText.scrollWidth > titleWrap.clientWidth;
    titleWrap.classList.toggle('music-box__title--scroll', needsScroll);

    if (needsScroll) {
      const cloneNode = titleText.cloneNode(true);
      cloneNode.classList.add('music-box__title-text--clone');
      cloneNode.setAttribute('aria-hidden', 'true');
      titleInner.appendChild(cloneNode);

      const distance = titleText.scrollWidth + gap;
      titleInner.style.setProperty('--scroll-distance', `${distance}px`);
      const duration = Math.max(10, distance / 30);
      titleInner.style.setProperty('--scroll-duration', `${duration}s`);
    }
  };

  const syncPlayButton = () => {
    if (!playButton || !audio) {
      return;
    }
    const playing = !audio.paused && !audio.ended;
    playButton.textContent = playing ? '||' : '|>';
    playButton.setAttribute('aria-label', playing ? 'Pause track' : 'Play track');
  };

  const updateProgress = () => {
    if (!progressBar || !audio || !audio.duration || Number.isNaN(audio.duration)) {
      if (progressBar) {
        progressBar.style.width = '0%';
      }
      return;
    }

    const ratio = Math.min(1, audio.currentTime / audio.duration);
    progressBar.style.width = `${ratio * 100}%`;
  };

  const loadTrack = (index, { autoplay = false } = {}) => {
    if (!audio || !tracks.length) {
      return;
    }

    currentTrackIndex = (index + tracks.length) % tracks.length;
    const track = tracks[currentTrackIndex];

    if (artistLabel) {
      artistLabel.textContent = track.artist;
    }

    if (titleText) {
      titleText.textContent = track.title;
    }

    requestAnimationFrame(() => {
      updateTitleMarquee();
    });

    const encodedSrc = encodeURI(`${MEDIA_BASE}${track.file}`);
    const wasPlaying = !audio.paused && !audio.ended;

    audio.src = encodedSrc;
    audio.load();
    audio.currentTime = 0;

    updateProgress();
    syncPlayButton();

    const shouldAutoPlay = autoplay || wasPlaying;
    if (shouldAutoPlay) {
      const tryPlay = () => {
        audio.play().catch((err) => {
          console.warn('[Player] Unable to start playback', err);
        });
      };

      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        tryPlay();
      } else {
        const onCanPlay = () => {
          audio.removeEventListener('canplay', onCanPlay);
          tryPlay();
        };
        audio.addEventListener('canplay', onCanPlay);
      }
    }
  };

  const markReady = () => {
    scene.classList.add('ready');
    updateTitleMarquee();
  };

  if (!dashOverlay.complete || !dashOverlay.naturalWidth) {
    dashOverlay.addEventListener('load', markReady, { once: true });
  } else {
    markReady();
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(updateTitleMarquee, 150);
  });

  if (controls) {
    controls.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const action = target.dataset.action;
      if (!action) {
        return;
      }

      if (action === 'play' && audio) {
        if (audio.paused) {
          audio.play().catch((err) => {
            console.warn('[Player] Unable to start playback', err);
          });
        } else {
          audio.pause();
        }
      } else if (action === 'prev') {
        const shouldAutoplay = audio && !audio.paused && !audio.ended;
        loadTrack(currentTrackIndex - 1, { autoplay: shouldAutoplay });
      } else if (action === 'next') {
        const shouldAutoplay = audio && !audio.paused && !audio.ended;
        loadTrack(currentTrackIndex + 1, { autoplay: shouldAutoplay });
      }
    });
  }

  if (audio) {
    audio.loop = false;

    audio.addEventListener('play', () => {
      syncPlayButton();
    });

    audio.addEventListener('pause', () => {
      syncPlayButton();
    });

    audio.addEventListener('ended', () => {
      loadTrack(currentTrackIndex + 1, { autoplay: true });
    });

    audio.addEventListener('loadedmetadata', () => {
      updateProgress();
    });

    audio.addEventListener('timeupdate', updateProgress);

    syncPlayButton();
    updateProgress();
    loadTrack(0, { autoplay: true });
  }
});
