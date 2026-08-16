# TravelAI — Your Personal Travel Guide

TravelAI is a web application for planning trips with the help of AI and up-to-date information search. The application consists of a React/Vite frontend and a lightweight Express API that communicates with the OpenAI API on the server side.

## Requirements

- Node.js
- npm
- OpenAI API key

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` or `.env` file in the project root. You can use `.env.example` as a starting point.

Minimum configuration:

```env
OPENAI_API_KEY="your_openai_api_key"
APP_URL="http://localhost:3000"
```

`OPENAI_API_KEY` is used only by the server-side application and must never be exposed in the client bundle.

## Local Development

Start the API server:

```bash
npm run api
```

By default, the API listens on port `8787`.

In a separate terminal, start the frontend:

```bash
npm run dev
```

Vite will start the application on port `3000`.

Once both services are running, open:

```text
http://localhost:3000
```

## npm Scripts

```bash
npm run dev      # Start the Vite development server
npm run api      # Start the Express API
npm run build    # Build the frontend for production
npm run preview  # Preview the production build locally
npm run lint     # Run TypeScript checks without emitting files
npm run clean    # Remove the dist directory
```

## Tech Stack

- React 19
- TypeScript
- Vite
- Express
- Tailwind CSS
- OpenAI API
