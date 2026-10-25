const mongoose = require('mongoose');

let connectionAttempt;

function classifyConnectionError(error) {
  const codes = new Set([
    error?.code,
    error?.cause?.code,
    error?.reason?.code,
    ...[...(error?.reason?.servers?.values?.() || [])].flatMap((server) => [
      server.error?.code,
      server.error?.cause?.code,
    ]),
  ].filter(Boolean));

  if (codes.has(18) || codes.has('18') || error?.codeName === 'AuthenticationFailed') return 'authentication failed';
  if ([...codes].some((code) => ['ENOTFOUND', 'ECONNREFUSED', 'ENODATA', 'EAI_AGAIN'].includes(code))) return 'DNS/SRV lookup failed';
  if ([...codes].some((code) => ['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(code))) return 'network timeout';
  if (error?.name === 'MongoServerSelectionError') return 'server selection failed; check Atlas network access and cluster status';
  if (error?.name === 'MongoParseError' || error?.name === 'TypeError') return 'invalid MongoDB URI configuration';
  return 'connection failed; verify the URI, database user, cluster status, and network access';
}

const connectDB = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(true);
  if (connectionAttempt) return connectionAttempt;

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    connectDB.lastFailureReason = 'MONGODB_URI is not configured';
    console.warn('MONGODB_URI is not set. MongoDB is unavailable; route calculation remains available, but history is temporary.');
    return Promise.resolve(false);
  }

  connectionAttempt = mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 })
    .then(() => {
      connectDB.lastFailureReason = null;
      console.log('MongoDB connected successfully.');
      connectionAttempt = null;
      return true;
    })
    .catch((error) => {
      connectDB.lastFailureReason = classifyConnectionError(error);
      console.error(`MongoDB ${connectDB.lastFailureReason}. Route calculation remains available; history is temporary.`);
      connectionAttempt = null;
      return false;
    });

  return connectionAttempt;
};

module.exports = connectDB;
