const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('node:path');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const connectDB = require('./config/db');
const routeRoutes = require('./routes/routeRoutes');

const app = express();
const configuredPort = Number(process.env.PORT || 5000);
if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65535) {
  throw new Error('PORT must be a valid integer between 1 and 65535.');
}
const PORT = configuredPort;

app.use(cors({ exposedHeaders: ['X-History-Persistence'] }));
app.use(express.json({ limit: '100kb' }));

app.use('/api', routeRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err.name || 'Error');
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer(port = PORT) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Server port must be a valid integer between 1 and 65535.');
  }
  await connectDB();

  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    server.once('listening', () => {
      console.log(`SmartRoute server running on port ${port}.`);
      resolve(server);
    });
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Reuse the existing SmartRoute server or stop its confirmed process before restarting.`);
      } else {
        console.error(`SmartRoute server failed to listen (${error.code || error.name}).`);
      }
      reject(error);
    });
  });
}

if (require.main === module) {
  let server;
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down SmartRoute.`);

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  };

  process.once('SIGINT', () => shutdown('SIGINT').catch(() => { process.exitCode = 1; }));
  process.once('SIGTERM', () => shutdown('SIGTERM').catch(() => { process.exitCode = 1; }));

  startServer()
    .then((startedServer) => { server = startedServer; })
    .catch(async () => {
      await mongoose.disconnect();
      process.exitCode = 1;
    });
}

module.exports = app;
module.exports.startServer = startServer;
