# Vite + Vanilla

My Personal Frontend (mpf)

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar).

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Development (Frontend + Serverless ready)

```sh
npm run dev
```

Local APIs: Use `VITE_API_URL=http://localhost:3001 npm run dev` with server.js temp or deploy to Vercel.

### Build

```sh
npm run build
```

### Deploy to Vercel

```sh
npm run deploy
vercel env add DATABASE_URL
```

### Lint

```sh
npm run lint
```

