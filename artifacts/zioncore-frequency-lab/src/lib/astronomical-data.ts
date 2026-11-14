import { z } from 'zod';

export const NOAASWPC_KP_ADAPTER_ID = 'astronomy.noaa-swpc-planetary-kp-1m';
export const NOAASWPC_KP_ADAPTER_VERSION = '1.0.0';
export const NOAA_SWPC_KP_ENDPOINT = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
export const NOAA_SWPC_KP_PRODUCT = 'https://www.swpc.noaa.gov/products/planetary-k-index';
export const NOAA_PUBLIC_DATA_TERMS = 'https://psl.noaa.gov/disclaimer';
export const MAX_ASTRONOMY_RESPONSE_BYTES = 512 * 1024;
export const MAX_ASTRONOMY_OBSERVATIONS = 2_000;

export type AstronomicalObservation = {
  id: string;
  timestampUtc: string;
  sourceTimestamp: string;
  parameter: 'estimated-planetary-kp';
  value: number;
  unit: 'dimensionless Kp index';
  reportedKpIndex: number;
  reportedKpLabel: string;
};

export type AstronomicalDataset = {
  schema: 'zioncore.astronomy.dataset/v1';
  adapter: {
    id: typeof NOAASWPC_KP_ADAPTER_ID;
    version: typeof NOAASWPC_KP_ADAPTER_VERSION;
  };
  source: {
    provider: 'NOAA Space Weather Prediction Center';
    dataset: 'Estimated Planetary K-index, 1-minute feed';
    endpointUrl: typeof NOAA_SWPC_KP_ENDPOINT;
    productUrl: typeof NOAA_SWPC_KP_PRODUCT;
    termsUrl: typeof NOAA_PUBLIC_DATA_TERMS;
    retrievedAtUtc: string;
    attribution: string;
    reuseNote: string;
  };
  measurement: {
    parameter: 'estimated-planetary-kp';
    unit: 'dimensionless Kp index';
    processing: string;
    instrumentCalibration: {
      status: 'not-provided';
      note: string;
    };
  };
  observations: AstronomicalObservation[];
};

const rawRecordSchema = z.object({
  time_tag: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
  kp_index: z.number().finite().int().min(0).max(9),
  estimated_kp: z.number().finite().min(0).max(9),
  kp: z.string().min(1).max(4),
}).strict();

const noaaRowsSchema = z.array(rawRecordSchema).min(1).max(MAX_ASTRONOMY_OBSERVATIONS);

function toUtcIso(sourceTimestamp: string) {
  const timestamp = new Date(`${sourceTimestamp}Z`);
  if (!Number.isFinite(timestamp.getTime())) throw new Error(`Invalid NOAA UTC timestamp: ${sourceTimestamp}`);
  const normalized = timestamp.toISOString();
  if (normalized.slice(0, 19) !== sourceTimestamp) throw new Error(`Invalid NOAA UTC timestamp: ${sourceTimestamp}`);
  return normalized;
}

async function readBoundedResponse(response: Response) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_ASTRONOMY_RESPONSE_BYTES) {
    throw new Error(`NOAA SWPC response exceeds the ${MAX_ASTRONOMY_RESPONSE_BYTES / 1024} KiB safety limit.`);
  }
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_ASTRONOMY_RESPONSE_BYTES) {
      throw new Error(`NOAA SWPC response exceeds the ${MAX_ASTRONOMY_RESPONSE_BYTES / 1024} KiB safety limit.`);
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_ASTRONOMY_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error(`NOAA SWPC response exceeds the ${MAX_ASTRONOMY_RESPONSE_BYTES / 1024} KiB safety limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  chunks.forEach(chunk => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return new TextDecoder().decode(bytes);
}

export function normalizeNoaaPlanetaryKp(payload: unknown, retrievedAtUtc = new Date().toISOString()): AstronomicalDataset {
  const rows = noaaRowsSchema.parse(payload);
  const retrievedAt = new Date(retrievedAtUtc);
  if (!Number.isFinite(retrievedAt.getTime())) throw new Error('Dataset retrieval time must be a valid ISO timestamp.');

  const timestamps = new Set<string>();
  const observations = rows.map(row => {
    const timestampUtc = toUtcIso(row.time_tag);
    if (timestamps.has(timestampUtc)) throw new Error(`Duplicate NOAA observation timestamp: ${timestampUtc}`);
    timestamps.add(timestampUtc);
    return {
      id: `${NOAASWPC_KP_ADAPTER_ID}:${timestampUtc}`,
      timestampUtc,
      sourceTimestamp: row.time_tag,
      parameter: 'estimated-planetary-kp' as const,
      value: row.estimated_kp,
      unit: 'dimensionless Kp index' as const,
      reportedKpIndex: row.kp_index,
      reportedKpLabel: row.kp,
    };
  }).sort((left, right) => left.timestampUtc.localeCompare(right.timestampUtc));

  return {
    schema: 'zioncore.astronomy.dataset/v1',
    adapter: { id: NOAASWPC_KP_ADAPTER_ID, version: NOAASWPC_KP_ADAPTER_VERSION },
    source: {
      provider: 'NOAA Space Weather Prediction Center',
      dataset: 'Estimated Planetary K-index, 1-minute feed',
      endpointUrl: NOAA_SWPC_KP_ENDPOINT,
      productUrl: NOAA_SWPC_KP_PRODUCT,
      termsUrl: NOAA_PUBLIC_DATA_TERMS,
      retrievedAtUtc: retrievedAt.toISOString(),
      attribution: 'Data provided by NOAA Space Weather Prediction Center (SWPC).',
      reuseNote: 'NOAA government-server information is public domain unless specifically annotated otherwise. Preserve attribution, check product-specific terms, and do not imply NOAA endorsement.',
    },
    measurement: {
      parameter: 'estimated-planetary-kp',
      unit: 'dimensionless Kp index',
      processing: 'Provider-estimated Planetary Kp product; this feed is not raw magnetometer or radio-astronomy data.',
      instrumentCalibration: {
        status: 'not-provided',
        note: 'The feed does not provide instrument-level calibration metadata. Do not infer or fabricate calibration from an estimated index.',
      },
    },
    observations,
  };
}

export async function fetchNoaaPlanetaryKp(
  options: {
    signal?: AbortSignal;
    fetcher?: typeof fetch;
    now?: () => Date;
  } = {},
): Promise<AstronomicalDataset> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(NOAA_SWPC_KP_ENDPOINT, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`NOAA SWPC dataset request failed with HTTP ${response.status}.`);

  const text = await readBoundedResponse(response);
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('NOAA SWPC returned invalid JSON.');
  }
  return normalizeNoaaPlanetaryKp(payload, (options.now ?? (() => new Date()))().toISOString());
}

export function astronomicalDatasetToCsv(dataset: AstronomicalDataset) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const rows = [
    [
      'timestamp_utc', 'parameter', 'value', 'unit', 'reported_kp_index', 'reported_kp_label',
      'provider', 'dataset', 'source_url', 'product_url', 'terms_url', 'retrieved_at_utc',
      'adapter_id', 'adapter_version', 'attribution', 'reuse_note', 'processing',
      'calibration_status', 'calibration_note',
    ],
    ...dataset.observations.map(point => [
      point.timestampUtc,
      point.parameter,
      point.value,
      point.unit,
      point.reportedKpIndex,
      point.reportedKpLabel,
      dataset.source.provider,
      dataset.source.dataset,
      dataset.source.endpointUrl,
      dataset.source.productUrl,
      dataset.source.termsUrl,
      dataset.source.retrievedAtUtc,
      dataset.adapter.id,
      dataset.adapter.version,
      dataset.source.attribution,
      dataset.source.reuseNote,
      dataset.measurement.processing,
      dataset.measurement.instrumentCalibration.status,
      dataset.measurement.instrumentCalibration.note,
    ]),
  ];
  return rows.map(row => row.map(escape).join(',')).join('\r\n');
}
