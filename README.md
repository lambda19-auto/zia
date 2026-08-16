# TravelAI — ваш персональный гид

TravelAI — веб-приложение для планирования путешествий с помощью ИИ и поиска актуальной информации. Приложение состоит из React/Vite-фронтенда и небольшого Express API, который обращается к OpenAI API на серверной стороне.

## Требования

- Node.js
- npm
- OpenAI API key

## Настройка

1. Установите зависимости:

```bash
npm install
```

2. Создайте файл `.env.local` или `.env` в корне проекта. В качестве основы можно использовать `.env.example`.

Минимальная конфигурация:

```env
OPENAI_API_KEY="your_openai_api_key"
APP_URL="http://localhost:3000"
```

`OPENAI_API_KEY` используется только серверной частью приложения и не должен попадать в клиентский bundle.

## Локальный запуск

Запустите API-сервер:

```bash
npm run api
```

По умолчанию API слушает порт `8787`.

В отдельном терминале запустите фронтенд:

```bash
npm run dev
```

Vite запустит приложение на порту `3000`.

После запуска откройте:

```text
http://localhost:3000
```

## npm-команды

```bash
npm run dev      # запуск Vite dev server
npm run api      # запуск Express API
npm run build    # production-сборка фронтенда
npm run preview  # локальный просмотр production-сборки
npm run lint     # проверка TypeScript без генерации файлов
npm run clean    # удаление каталога dist
```

## Стек

- React 19
- TypeScript
- Vite
- Express
- Tailwind CSS
- OpenAI API
