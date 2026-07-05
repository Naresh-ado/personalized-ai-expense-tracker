import app, { initializeDatabase } from './app.js';

const port = Number(process.env.PORT || 5000);

async function start() {
  await initializeDatabase();
  app.listen(port, '0.0.0.0', () => {
    console.log(`Backend listening on http://0.0.0.0:${port}`);
  });
}

start();
