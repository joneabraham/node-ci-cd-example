'use strict';

const { createApp } = require('./app');

const port = Number(process.env.PORT) || 8080;
const server = createApp().listen(port, () => {
  console.log(`todo-service listening on :${port}`);
});

// Graceful shutdown so in-flight requests finish during a slot swap or restart.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, closing server`);
    server.close(() => process.exit(0));
  });
}
