import { Router, type IRouter, type RequestHandler } from 'express';
import {
  GetWalletResponse,
  ListWalletTransactionsQueryParams,
  ListWalletTransactionsResponse,
} from '@workspace/api-zod';
import { CreditLedgerError, getCreditLedger } from '../lib/credit-ledger';
import { requireFirebaseIdentity } from '../middlewares/firebase-identity';

type WalletLedgerReader = Pick<
  ReturnType<typeof getCreditLedger>,
  'readWallet' | 'listTransactions'
>;

function verifiedUid(res: Parameters<typeof requireFirebaseIdentity>[1]): string | null {
  const uid = res.locals.firebaseUid;
  return typeof uid === 'string' && uid.length > 0 ? uid : null;
}

export function createWalletRouter(
  identityMiddleware: RequestHandler = requireFirebaseIdentity,
  ledgerProvider: () => WalletLedgerReader = getCreditLedger,
): IRouter {
  const router: IRouter = Router();

  router.get('/wallet', identityMiddleware, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const uid = verifiedUid(res);
    if (!uid) {
      res.status(401).json({ error: 'A signed-in account is required.' });
      return;
    }

    try {
      const wallet = await ledgerProvider().readWallet(uid);
      res.status(200).json(GetWalletResponse.parse(wallet));
    } catch (error) {
      req.log.error({ err: error }, 'Could not read the Firebase credit wallet');
      res.status(503).json({
        error: 'The wallet is temporarily unavailable.',
      });
    }
  });

  router.get('/wallet/transactions', identityMiddleware, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const uid = verifiedUid(res);
    if (!uid) {
      res.status(401).json({ error: 'A signed-in account is required.' });
      return;
    }

    const parsedQuery = ListWalletTransactionsQueryParams.safeParse(req.query);
    if (!parsedQuery.success) {
      res.status(400).json({
        error: 'The transaction-history limit must be between 1 and 100.',
      });
      return;
    }

    try {
      const transactions = await ledgerProvider().listTransactions(
        uid,
        parsedQuery.data.limit,
      );
      res.status(200).json(
        ListWalletTransactionsResponse.parse({ transactions }),
      );
    } catch (error) {
      if (error instanceof CreditLedgerError && error.code === 'INVALID_INPUT') {
        res.status(400).json({ error: 'Invalid transaction-history limit.' });
        return;
      }
      req.log.error({ err: error }, 'Could not read the Firebase credit ledger');
      res.status(503).json({
        error: 'The wallet transaction history is temporarily unavailable.',
      });
    }
  });

  return router;
}

const router = createWalletRouter();

export default router;
