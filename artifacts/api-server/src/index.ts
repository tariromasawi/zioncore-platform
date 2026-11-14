import app from "./app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "./lib/logger";
import { getFirebaseAdminApp } from "./lib/firebase-admin";
import { deleteExpiredAiInterpretationJobs } from "./lib/ai-interpretation-jobs";

async function cleanupExpiredInterpretationJobs() {
  try {
    const deleted = await deleteExpiredAiInterpretationJobs(
      getFirestore(getFirebaseAdminApp()),
    );
    if (deleted > 0) logger.info({ deleted }, "Expired interpretation retry records removed");
  } catch (err) {
    logger.warn({ err }, "Could not clean up expired interpretation retry records");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

if (process.env.NODE_ENV === 'production') {
  const cleanupTimer = setInterval(() => {
    void cleanupExpiredInterpretationJobs();
  }, 15 * 60 * 1000);
  cleanupTimer.unref();
  void cleanupExpiredInterpretationJobs();
}
