# Popup Video Player

A desktop application that randomly pops up fullscreen and plays a video.

## Features

- Starts minimized in the system tray
- Randomly pops up every 30-300 seconds
- Plays video fullscreen with audio
- Automatically minimizes when video ends
- Prevents manual unminimizing before the timer is up

## Installation

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Setup

1. Navigate to the electron-app directory:
   ```bash
   cd electron-app
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Run the app:
   ```bash
   npm start
   # or
   yarn start
   ```

### Building Distributable

To create a distributable executable:

```bash
# For Windows
npm run dist:win

# For macOS
npm run dist:mac

# For Linux
npm run dist:linux
```

The built application will be in the `dist` folder.

## How It Works

1. When launched, the app starts minimized
2. A random timer between 30-300 seconds starts
3. When the timer fires:
   - The window appears fullscreen
   - The video plays with audio
4. When the video ends:
   - The window minimizes
   - A new random timer starts
5. If you try to show the window before the timer fires, it will minimize itself

## Configuration

To change the timer intervals, edit `main.js`:

```javascript
const MIN_INTERVAL = 30 * 1000;  // 30 seconds
const MAX_INTERVAL = 300 * 1000; // 300 seconds (5 minutes)
```

## Replacing the Video

Replace the `assets/A90.mp4` file with your own video file (keep the same filename).
