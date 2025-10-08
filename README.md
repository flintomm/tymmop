## Car Interior Audio Prototype

Interactive single-page prototype featuring a full-bleed driving video, an overlay PNG for the car interior, and a custom in-dash audio player.

### Run locally
- Place the provided media assets into `assets/`:
  - `overlay-car.png` (transparent interior overlay)
  - `road.mp4` with `road.gif` fallback
  - `track1.mp3`, `track2.mp3`, `track3.mp3`
- Serve the folder over HTTP so `config/player.json` can be fetched (opening the file directly via `file://` will block the request in most browsers).
  ```
  cd car-dashboard-prototype
  python3 -m http.server
  ```
- Visit `http://localhost:8000` in a desktop browser.

### Geometry configuration
`config/player.json` is the single source of truth for all player and overlay geometry. Percentages are relative to the overlay image dimensions.

| Key | Description |
| --- | --- |
| `playerLeftPct`, `playerTopPct` | Player anchor point (center) within the overlay. |
| `playerWidthPct`, `playerHeightPct` | Player footprint relative to overlay. |
| `overlayScale` | Uniform `scale()` applied to the overlay wrapper. |
| `overlayTranslateXPct`, `overlayTranslateYPct` | Translation applied after scaling (percent relative to overlay width/height). |
### Calibration protocol
1. Start the local server and open the prototype.
2. Temporarily add a semi-transparent CSS mask inside `.player-shell` to highlight the radio bezel.
3. Adjust the values in `config/player.json` (left/top/width/height) until the player matches the radio screen.
4. Remove any temporary mask, verify the alignment at your target desktop resolutions, and save the updated JSON.

#### Quick tuning in DevTools
- Modify the CSS custom properties on `:root` (e.g. `--desktop-player-left-pct`, `--desktop-player-top-pct`, `--desktop-overlay-scale`) in DevTools to see the player move live.
- Alternatively, run `playerGeometryTools.set({ playerLeftPct: 48.2, playerTopPct: 51.1 })` in the console.
- `playerGeometryTools.log()` prints the current desktop values; copy them back into `config/player.json` once aligned.

### Test checklist
- Video loads, loops smoothly, and stays muted until user interaction.
- GIF fallback appears if the video fails.
- Overlay preserves aspect ratio on resize with no scrollbars.
- Custom audio controls operate correctly with mouse, touch, and keyboard (`Space/Enter` toggle, `←/→` seek ±5s).
- Playlist cycles through the three tracks and wraps around.
- Layout remains correct at 1920×1080, 1536×864, 1366×768, and 1280×720 orientations.
