# Frontend - React AquaShield Dashboard

React + TypeScript frontend for the AquaShield aquaculture monitoring system.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

Frontend will be available at http://localhost:5173

## Building for Production

```bash
npm run build
npm run preview
```

## Project Structure

- `src/main.tsx` - Application entry point
- `src/App.tsx` - Main application component
- `src/pages/` - Page components
- `src/components/` - Reusable components
- `src/api/` - API service layer
- `src/store/` - Zustand state management
- `src/index.css` - Global styles with Tailwind CSS

## Features

- User authentication with JWT
- Farm management
- Risk assessment dashboard
- Alert notifications
- Map-based farm visualization
- Responsive design with Tailwind CSS
