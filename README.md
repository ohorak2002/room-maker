# Room Maker - 3D Room Generator

Generate your dream room by describing what you like! Input your preferences (colors, patterns, architecture, furniture, lighting) and the app will create a 3D visualization of your personalized room.

## Features

- **Room Preferences**: Set colors, patterns, and architectural styles
- **Settings**: Configure temperature, lighting, windows, and floorplan
- **Objects & Furniture**: Add paintings, LED lights, computers, desks, chairs, and more
- **3D Visualization**: Real-time 3D model of your room
- **Future**: Shopping integration for furniture items

## Tech Stack

- **Frontend**: React + Three.js + Vite
- **State Management**: Zustand
- **Hosting**: Vercel/Netlify (planned)

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

## Project Structure

```
room-maker/
├── src/
│   ├── components/      # React components
│   ├── stores/          # Zustand stores
│   ├── three/           # Three.js scene setup
│   ├── App.jsx
│   └── main.jsx
├── public/
├── index.html
├── vite.config.js
└── package.json
```

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT
