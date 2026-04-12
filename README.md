# Fullscreen Image App

Displays an image fullscreen with looping audio. Can't be closed except by typing **WASHY**.

## Quick Build (Windows)

```bash
npm install
npm run build
```

Your `.exe` will be in the `dist/` folder.

## Features
- Fullscreen + always on top + kiosk mode
- Blocks Alt+F4, Ctrl+W, Escape, minimize, close
- Loops audio non-stop
- Type **W-A-S-H-Y** to exit

## Customize
- Replace `image.png` with your image
- Replace `audio.wav` with your audio
- Edit `exitCode` in `main.js` to change exit sequence
