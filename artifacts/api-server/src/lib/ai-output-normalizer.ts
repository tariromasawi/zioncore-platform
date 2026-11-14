type JsonRecord = Record<string, unknown>;

const confidenceValues = ['low', 'moderate', 'high'] as const;
const relevanceValues = ['direct', 'tentative', 'needs_more_data'] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeConfidence(value: unknown): unknown {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    const match = confidenceValues.find(option => normalized === option || normalized.includes(option));
    return match ?? value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = value > 1 ? value / 100 : value;
    if (normalized >= 0.7) return 'high';
    if (normalized >= 0.4) return 'moderate';
    return 'low';
  }
  return value;
}

function normalizeSignalFamily(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'insufficient' || /insufficient|too weak|no clear signal/.test(normalized)) return 'insufficient';
  if (normalized === 'broadband' || /broadband|noise-like|diffuse spectrum/.test(normalized)) return 'broadband';
  if (normalized === 'mixed' || /mixed|complex spectrum/.test(normalized)) return 'mixed';
  if (normalized === 'harmonic' || /harmonic|overtone/.test(normalized)) return 'harmonic';
  if (normalized === 'tonal' || /tonal|pure tone|single tone/.test(normalized)) return 'tonal';
  return value;
}

function normalizeDomain(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.toLowerCase().replace(/[^a-z]+/g, '_');
  if (normalized === 'environmental_bioacoustics' || normalized.includes('environment') || normalized.includes('bioacoustic')) {
    return 'environmental_bioacoustics';
  }
  if (normalized === 'acoustics' || normalized.includes('acoustic')) return 'acoustics';
  if (normalized === 'signal_processing' || normalized.includes('signal_process')) return 'signal_processing';
  if (normalized === 'mathematics' || normalized.includes('math') || normalized.includes('statistic')) return 'mathematics';
  if (normalized === 'communications' || normalized.includes('communicat')) return 'communications';
  return value;
}

function normalizeRelevance(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (relevanceValues.includes(normalized as typeof relevanceValues[number])) return normalized;
  if (/need|more data|additional data|not enough|cannot determine|insufficient/.test(normalized)) {
    return 'needs_more_data';
  }
  if (/direct|essential|primary|strong|evaluates|analyzes|assesses|examines|fundamental/.test(normalized)) {
    return 'direct';
  }
  return 'tentative';
}

function limitText(value: unknown, maxLength: number): unknown {
  if (typeof value !== 'string' || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeEvidence(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(item => typeof item === 'string' ? item : JSON.stringify(item))
      .filter(Boolean)
      .join('\n');
  }
  return value;
}

export function normalizeAnalysisOutput(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const output: JsonRecord = {
    ...value,
    signalFamily: normalizeSignalFamily(value.signalFamily),
    confidence: normalizeConfidence(value.confidence),
    patternSignature: limitText(value.patternSignature, 1200),
  };

  if (Array.isArray(value.domainPerspectives)) {
    output.domainPerspectives = value.domainPerspectives.map(item => {
      if (!isRecord(item)) return item;
      const rawRelevance = item.relevance;
      const relevance = normalizeRelevance(rawRelevance);
      let analysis = item.analysis;
      if (
        typeof rawRelevance === 'string' &&
        !relevanceValues.includes(rawRelevance.trim().toLowerCase() as typeof relevanceValues[number]) &&
        typeof analysis === 'string'
      ) {
        const suffix = `\n\nRelevance note: ${rawRelevance.trim()}`;
        analysis = `${analysis.slice(0, Math.max(0, 1800 - suffix.length))}${suffix}`;
      }
      return {
        ...item,
        domain: normalizeDomain(item.domain),
        relevance,
        analysis,
      };
    });
  }

  if (Array.isArray(value.candidateExplanations)) {
    output.candidateExplanations = value.candidateExplanations.map(item => {
      if (!isRecord(item)) return item;
      return {
        ...item,
        evidenceFor: limitText(normalizeEvidence(item.evidenceFor), 1000),
        evidenceAgainst: limitText(normalizeEvidence(item.evidenceAgainst), 1000),
        confidence: normalizeConfidence(item.confidence),
      };
    });
  }

  return output;
}
