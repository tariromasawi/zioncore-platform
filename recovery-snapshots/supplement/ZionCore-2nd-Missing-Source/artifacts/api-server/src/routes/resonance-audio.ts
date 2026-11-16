import { Router, type IRouter } from 'express';
import { searchPublicAudioObject } from '../lib/public-audio-storage';
import { ownPublicAsset, stopAssetOnDisconnect } from '../lib/public-asset-safety';

const router: IRouter = Router();

const audioAssets = Object.freeze({
  'low-tone-20hz': {
    objectPath: 'zioncore-resonance/CRX1_Low_20Hz_30s_1794007256733.wav',
    contentType: 'audio/wav',
  },
  'low-tone-100hz': {
    objectPath: 'zioncore-resonance/CRX1_JBL_Grip_Low_100Hz_1794007256733.wav',
    contentType: 'audio/wav',
  },
  'reference-1000hz': {
    objectPath: 'zioncore-resonance/CRX1_1000Hz_Reference_Tone_60s_1794007256733.wav',
    contentType: 'audio/wav',
  },
  'high-tone-8khz': {
    objectPath: 'zioncore-resonance/CRX1_JBL_Grip_High_8000Hz_1794007256733.wav',
    contentType: 'audio/wav',
  },
  'high-tone-18khz': {
    objectPath: 'zioncore-resonance/CRX1_High_18000Hz_30s_1794007256733.wav',
    contentType: 'audio/wav',
  },
  'copper-resonance-matrix': {
    objectPath: 'zioncore-resonance/CRX1_Copper_Resonance_Matrix_1794007256733.wav',
    contentType: 'audio/wav',
  },
  'copper-resonance-challenge': {
    objectPath: 'zioncore-resonance/CRX1_Copper_Resonance_Challenge_96s_1794007256733.wav',
    contentType: 'audio/wav',
  },
  'solfeggio-cascade-1': {
    objectPath: 'zioncore-resonance/2[advanced_Tonal_Architecture_Pure_Continuous_Solfeggio_Cascad_1794007423931.mp3',
    contentType: 'audio/mpeg',
  },
  'solfeggio-cascade-2': {
    objectPath: 'zioncore-resonance/[advanced_Tonal_Architecture_Pure_Continuous_Solfeggio_Cascade_1794007423931.mp3',
    contentType: 'audio/mpeg',
  },
  'solfeggio-cascade-3': {
    objectPath: 'zioncore-resonance/3[advanced_Tonal_Architecture_Pure_Continuous_Solfeggio_Cascad_1794007423931.mp3',
    contentType: 'audio/mpeg',
  },
  'mudzimu-unoyera-living-vision': {
    objectPath: 'zioncore-resonance/Simba_raMudzimu_Unoyera_Living_Vision_30s_1794100403373.wav',
    contentType: 'audio/wav',
  },
});

type ByteRange = { start: number; end: number };

function parseByteRange(
  value: string | undefined,
  size: number,
): ByteRange | 'invalid' | null {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return 'invalid';

  let start: number;
  let end: number;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return 'invalid';
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    return 'invalid';
  }

  return { start, end: Math.min(end, size - 1) };
}

router.get('/resonance-audio/:assetId', async (req, res) => {
  const assetId = req.params.assetId;
  const asset = typeof assetId === 'string'
    ? ownPublicAsset(audioAssets, assetId)
    : undefined;

  if (!asset) {
    res.status(404).json({ error: 'That listening-library recording was not found.' });
    return;
  }

  let file;
  try {
    file = await searchPublicAudioObject(asset.objectPath);
  } catch {
    req.log.error({ assetId }, 'Could not locate listening-library audio in App Storage');
    res.status(503).json({ error: 'Listening-library audio is temporarily unavailable.' });
    return;
  }
  if (!file) {
    req.log.warn({ assetId }, 'Listening-library audio asset is missing from App Storage');
    res.status(404).json({ error: 'That listening-library recording is not available.' });
    return;
  }

  let size: number;
  try {
    const [metadata] = await file.getMetadata();
    size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size <= 0) {
      req.log.error({ assetId }, 'Listening-library audio has invalid storage metadata');
      res.status(503).json({ error: 'Listening-library audio is temporarily unavailable.' });
      return;
    }
  } catch (error) {
    if ((error as { code?: number }).code === 404) {
      req.log.warn({ assetId }, 'Listening-library audio asset is missing from storage');
      res.status(404).json({ error: 'That listening-library recording is not available.' });
      return;
    }
    req.log.error({ assetId }, 'Could not read listening-library audio metadata');
    res.status(503).json({ error: 'Listening-library audio is temporarily unavailable.' });
    return;
  }

  const range = parseByteRange(req.get('range'), size);
  if (range === 'invalid') {
    res.setHeader('Content-Range', `bytes */${size}`);
    res.status(416).json({ error: 'The requested audio range is not available.' });
    return;
  }

  if (res.destroyed) return;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Content-Type', asset.contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const stream = range
    ? file.createReadStream({ start: range.start, end: range.end })
    : file.createReadStream();
  stopAssetOnDisconnect(stream, res, { waitForStorageResponse: true });

  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    res.setHeader('Content-Length', String(range.end - range.start + 1));
  } else {
    res.status(200);
    res.setHeader('Content-Length', String(size));
  }

  stream.on('error', () => {
    if (res.destroyed) return;
    req.log.error({ assetId }, 'Listening-library audio stream failed');
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.removeHeader('Content-Length');
    res.removeHeader('Content-Range');
    res.type('application/json').status(503).json({ error: 'Listening-library audio is temporarily unavailable.' });
  });
  stream.pipe(res);
});

export default router;
