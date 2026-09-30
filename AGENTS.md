# LNHS Attendance Monitoring System

A school attendance application with QR scanning, SMS notifications, and Firebase-backed data and authentication.

## Development
- Frontend: Vite at `http://localhost:8443` by default (`PORT` can override it).
- Backend: Express API at `http://localhost:5000`.
- Start the frontend with `npm run dev` and the backend with `npm start` from `server/`.
- Build the frontend with `npm run build`.

## Project Structure

- `src/main.jsx` - React entry point; imports `src/index.css` and mounts `src/App.jsx`.
- `src/App.jsx` - Application routes and context providers.
- `src/index.css` - Global CSS and Tailwind CSS import.
- `src/styles/tokens.css` - Design tokens and theme variables.
- `src/pages/` - Application pages, including Dashboard, Scanner, Settings, and Reports.
- `src/components/` - Shared UI components.
- `src/context/` - Authentication, application data, and theme contexts.
- `src/firebase.js` - Firebase client initialization.
- `server/index.js` - Express API, Firebase Admin integration, and SMS handling.
- `server/.env.example` - Example backend environment configuration; never put real secrets here.
- `index.html` - Vite HTML shell.
- `package.json` and `server/package.json` - Frontend and backend dependencies/scripts.
- `vite.config.ts` - Vite configuration.

## Stack And Styling

- Frontend: React 19, Vite, and React Router.
- Backend: Node.js and Express.
- Data and authentication: Firebase Firestore and Firebase Authentication; the server uses Firebase Admin.
- SMS providers: Semaphore or Twilio, configured server-side.
- Styling: Custom CSS and design tokens are used throughout. Tailwind CSS v4 is also imported and configured through `@tailwindcss/vite`; do not assume the UI is implemented exclusively with utility classes.
- Icons: `lucide-react`.

Follow the existing institutional design system. Shared theme values belong in `src/styles/tokens.css`; global styles belong in `src/index.css`.

## Domain And Safety Rules

1. Attendance has four daily periods: `AM-1`, `AM-2`, `PM-1`, and `PM-2`.
2. The 7:30 AM cutoff applies to `AM-1` only.
3. Preserve the existing attendance status values and period behavior; check current code before changing domain rules.
4. Never commit `.env` files, credentials, or private keys. Use example environment templates for documentation.
5. Firebase is the current backend. Do not introduce Azure, Docker, Postgres, or other infrastructure without an explicit request.
6. Preserve the server-side `checkSmsAllowed()` guard on SMS send paths. It enforces runtime mode, the emergency disable switch, and the daily cap.
7. The runtime SMS setting is stored in Firestore. When its mode is `inherit`, `SMS_MODE` from the server environment is the fallback.
8. Do not invoke unrelated agent workflows or generate infrastructure/debug configuration unless explicitly requested.

## Common Pitfalls

- Restart the Express server after changing `server/index.js`.
- The browser reports the scanner's HID keyboard identity; do not infer a device brand from that report alone.
- Check the relevant source and tests when this guide and the implementation disagree; the implementation is authoritative.
