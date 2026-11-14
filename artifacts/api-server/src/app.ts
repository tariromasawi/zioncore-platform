import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { StripeWebhookHandlers } from "./lib/stripe-webhook";
import { InvalidStripeSignatureError } from "./lib/stripe-webhook-delivery";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json', limit: '2mb' }),
  async (req, res) => {
    const signature = req.get('stripe-signature');
    if (!signature) {
      res.status(400).json({ error: 'Missing Stripe signature.' });
      return;
    }
    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: 'Invalid Stripe webhook body.' });
      return;
    }
    try {
      await StripeWebhookHandlers.processWebhook(req.body, signature);
      res.status(200).json({ received: true });
    } catch (error) {
      if (error instanceof InvalidStripeSignatureError) {
        res.status(400).json({ error: 'Invalid Stripe signature.' });
        return;
      }
      req.log.error({ err: error }, 'Stripe webhook processing failed');
      res.status(500).json({ error: 'Stripe webhook processing failed.' });
    }
  },
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
