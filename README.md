# psalm95

A fan-driven ranking platform for Korean, Chinese, and Japanese idol groups and
solo artists. Rankings blend three equally-weighted factors: online popularity
and weekly + monthly fan votes cast by signed-in users.

## Stack

- Vite + React + TypeScript + Tailwind CSS
- Firebase: Auth (Google), Firestore, Cloud Storage, Cloud Functions, Hosting
- GitHub Actions CI/CD

## Development

```bash
npm install
npm run dev

cd functions && npm install
```

Copy `.env.example` to `.env` and fill in the Firebase web app config
(`firebase apps:sdkconfig WEB <appId>`).

To run against the local Firebase emulator suite:

```bash
firebase emulators:start
```
