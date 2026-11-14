import {
  universalExperimentSchema,
  type UniversalExperiment,
} from '@workspace/frequency-ai-contract';

import {
  buildFreeListeningReading,
  type FreeListeningInput,
  type FreeListeningLens,
} from './free-listening';

/**
 * ============================================================
 * ZIONCORE UNIVERSAL FRONTIER DISCOVERY INTELLIGENCE
 * ============================================================
 *
 * VERSION 2 — ADVANCED EXPLORATION ARCHITECTURE
 *
 * MISSION:
 *
 * Explore the relationships between sound, information,
 * biological intelligence, the living environment,
 * spiritual understanding and the wider cosmos.
 *
 * Transform measured acoustic observations into:
 *
 * - Meaningful discoveries
 * - Scientific explanations
 * - Biological research questions
 * - Environmental interpretations
 * - Spiritual and devotional reflections
 * - Celestial and cosmic exploration
 * - Experimental research programmes
 * - Personal insight and constructive action
 * - Opportunities for further investigation
 *
 * This module operates using local measurements and rules.
 * It does not initiate paid provider processing.
 *
 * Its experimental framework welcomes unfamiliar
 * observations and new hypotheses without inventing
 * measurements or claiming an unobserved source.
 *
 * MWARI NDI MWARI.
 * ============================================================
 */

/**
 * ============================================================
 * FRONTIER RESEARCH INSTRUMENT REGISTRY
 * ============================================================
 *
 * Keep these existing IDs stable.
 * Other application components may depend on them.
 */

export const FRONTIER_TOOLS = [
  {
    id: 'acoustic',
    title: 'Universal Acoustic Intelligence',
    lens: 'environment',
    description:
      'Explore the architecture of recorded sound through frequency, amplitude, resonance, harmonics, spectral complexity and temporal relationships.',
    output: 'Multidimensional acoustic resonance profile',
    method: 'FFT + RMS + spectral and temporal descriptors',
  },
  {
    id: 'environment',
    title: 'Living Environment Intelligence',
    lens: 'environment',
    description:
      'Explore environmental soundscapes, ecological relationships, movement, airflow, water, weather and changing acoustic environments.',
    output: 'Environmental resonance reading and discovery plan',
    method: 'Spectral comparison + environmental inquiry',
  },
  {
    id: 'animal',
    title: 'Biological Communication Explorer',
    lens: 'animal',
    description:
      'Investigate animal vocalisations, biological rhythms, call sequences, frequency contours and the diversity of living communication.',
    output: 'Biological intelligence research interpretation',
    method: 'Bioacoustic descriptors + comparative inquiry',
  },
  {
    id: 'harmonics',
    title: 'Harmonic and Resonance Atlas',
    lens: 'environment',
    description:
      'Investigate harmonic relationships, concentrated frequencies, resonance structures, spectral coherence and changes through time.',
    output: 'Harmonic resonance and spectral relationship report',
    method: 'Harmonicity + flatness + spectral feature analysis',
  },
  {
    id: 'spiritual',
    title: 'Spiritual Resonance Intelligence',
    lens: 'spiritual',
    description:
      'Explore the symbolic and devotional meaning of sound through faith, creation, wisdom, contemplation and personal intention.',
    output: 'Personalised spiritual resonance interpretation',
    method: 'Context-led devotional and philosophical interpretation',
  },
  {
    id: 'vibe',
    title: 'Personal Resonance Experience',
    lens: 'spiritual',
    description:
      'Explore the relationship between personally experienced sound, emotional reflection, acoustic character and meaningful action.',
    output: 'Personal reflection and resonance journey',
    method: 'User-selected feeling + measured acoustic descriptors',
  },
  {
    id: 'celestial',
    title: 'Celestial and Cosmic Intelligence',
    lens: 'celestial',
    description:
      'Explore cosmic patterns, astronomical measurements, sonification, planetary cycles and the possibilities of unfamiliar communication systems.',
    output: 'Cosmic discovery questions and investigation pathways',
    method: 'Acoustic analysis + astronomical research design',
  },
  {
    id: 'divine',
    title: 'Divine Wisdom and Prayer Studio',
    lens: 'spiritual',
    description:
      'Develop devotional reflections, meaningful intentions, prayers and spiritual exploration inspired by recorded experience.',
    output: 'Devotional reflection and constructive spiritual practice',
    method: 'Faith-informed interpretation + personal intention',
  },
  {
    id: 'unknown',
    title: 'Unknown Signal Frontier',
    lens: 'celestial',
    description:
      'Investigate unfamiliar acoustic structures, anomalies, repeating events, possible information patterns and alternative explanations.',
    output: 'Open-frontier research questions and investigation plan',
    method: 'Signal features + anomaly-oriented hypothesis design',
  },
  {
    id: 'alternatives',
    title: 'Multidimensional Hypothesis Explorer',
    lens: 'environment',
    description:
      'Compare environmental, biological, instrumental and experimental explanations while preserving open research possibilities.',
    output: 'Comparative hypothesis matrix',
    method: 'Structured evidence comparison + targeted experiments',
  },
  {
    id: 'guidance',
    title: 'Personal Wisdom and Discovery Guide',
    lens: 'spiritual',
    description:
      'Transform acoustic exploration and personal intentions into meaningful wisdom, deeper questions and practical next steps.',
    output: 'Personal discovery and action pathway',
    method: 'Context classification + reflection and action rules',
  },
  {
    id: 'instruments',
    title: 'Universal Instrument Adviser',
    lens: 'celestial',
    description:
      'Explore which acoustic, vibration, electromagnetic and astronomical instruments can investigate different physical phenomena.',
    output: 'Measurement-domain and instrument recommendations',
    method: 'Instrument capability + research-domain matching',
  },
  {
    id: 'response',
    title: 'Acoustic Message Creation Studio',
    lens: 'spiritual',
    description:
      'Prepare an original message or intention for acoustic encoding, transmission and recovery through the existing ZionCore protocol.',
    output: 'Editable message and acoustic encoding handoff',
    method: 'Message composition + existing acoustic protocol',
  },
  {
    id: 'matrix',
    title: 'Multidimensional Intelligence Matrix',
    lens: 'environment',
    description:
      'Explore one acoustic observation through environmental, biological, spiritual and celestial perspectives.',
    output: 'Four-perspective resonance interpretation',
    method: 'Shared measurements + four independent local readings',
  },
  {
    id: 'compare',
    title: 'Cross-Session Resonance Comparison',
    lens: 'environment',
    description:
      'Compare acoustic observations through frequency, relative signal level, structure, stability and changing conditions.',
    output: 'Comparative acoustic difference report',
    method: 'Matched-setting frequency and amplitude comparison',
  },
  {
    id: 'quality',
    title: 'Acoustic Capture Intelligence',
    lens: 'environment',
    description:
      'Improve recording quality, microphone positioning, signal clarity and the information available for deeper interpretation.',
    output: 'Capture-quality observations and improvements',
    method: 'Capture metadata + digital signal descriptors',
  },
  {
    id: 'export',
    title: 'Personal Discovery Archive',
    lens: 'environment',
    description:
      'Preserve acoustic observations, interpretations, research questions, devotional reflections and exploration history.',
    output: 'Private structured discovery record',
    method: 'Existing browser-local export workflow',
  },
  {
    id: 'notebook',
    title: 'Frontier Research Notebook',
    lens: 'celestial',
    description:
      'Document new research ideas, experimental observations, alternative hypotheses, findings and developing theories.',
    output: 'Versioned experimental discovery record',
    method: 'UniversalExperiment schema + existing archive',
  },
  {
    id: 'synthesis',
    title: 'ZionCore Universal Discovery Synthesis',
    lens: 'environment',
    description:
      'Bring acoustic measurements, environmental intelligence, biological inquiry, spiritual reflection and cosmic exploration into one meaningful discovery journey.',
    output: 'Multidimensional discovery synthesis',
    method: 'Local evidence synthesis + optional supported AI',
  },
] as const satisfies ReadonlyArray<{
  id: string;
  title: string;
  lens: FreeListeningLens;
  description: string;
  output: string;
  method: string;
}>;

export type FrontierToolId =
  typeof FRONTIER_TOOLS[number]['id'];

export type ReportedFeeling =
  | 'unspecified'
  | 'uplifting'
  | 'unsettled'
  | 'neutral';

/**
 * Preserve existing discovery states and their order.
 * The stored archive may already use these strings.
 */

export const DISCOVERY_STATES = [
  'Observed',
  'Unexplained',
  'Hypothesis Generated',
  'Experimental Investigation',
  'Repeated Observation',
  'Independently Corroborated',
  'Established Within Defined Conditions',
] as const;

export type DiscoveryState =
  typeof DISCOVERY_STATES[number];

/**
 * ============================================================
 * OWNER-EDITABLE RESEARCH CONFIGURATION
 * ============================================================
 *
 * These settings affect research interpretation
 * and experimental guidance.
 *
 * Raw acoustic calculation algorithms remain
 * under the signal-analysis module.
 */

const FRONTIER_CONFIG = {
  reportVersion: 'frontier-discovery-v1',
  intelligenceVersion: 'zioncore-frontier-intelligence-v2',

  quietRmsThreshold: 0.005,
  tonalFlatnessThreshold: 0.2,

  harmonicityThreshold: 0.72,
  frequencyDriftThresholdHz: 50,
  amplitudeVariationThreshold: 0.5,

  minimumComparisonDurationSeconds: 3,
  suggestedRepeatedObservations: 3,

  maximumContextCharacters: 300,
  maximumQuestionCharacters: 500,
  maximumMessageCharacters: 220,

  defaultMission:
    'Explore the measurable patterns and deeper possibilities revealed by this listening session.',

  declaration: 'MWARI NDI MWARI',
} as const;

/**
 * ============================================================
 * MEASUREMENT AND TEXT HELPERS
 * ============================================================
 */

const finite = (
  value: number | null | undefined
): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value);

const formatHz = (
  value: number | null | undefined
): string =>
  finite(value)
    ? `${value.toFixed(1)} Hz`
    : 'an open spectral pattern';

const formatNumber = (
  value: number | null | undefined,
  decimals = 2
): string =>
  finite(value)
    ? value.toFixed(decimals)
    : 'not recorded';

const cleanText = (
  value: string | null | undefined,
  maximum: number
): string =>
  typeof value === 'string'
    ? value.trim().slice(0, maximum)
    : '';

const uniqueStrings = (
  values: string[]
): string[] =>
  [...new Set(values.map(x => x.trim()).filter(Boolean))];

/**
 * ============================================================
 * SIGNAL CHARACTERISATION
 * ============================================================
 *
 * Classification guides research narratives.
 * It does not replace acoustic measurements.
 *
 * Several properties may coexist.
 */

function describeSignal(
  input: FreeListeningInput
) {
  const f = input.features;

  const quiet =
    input.silent ||
    input.rmsLevel < FRONTIER_CONFIG.quietRmsThreshold;

  const peak =
    finite(input.dominantFrequencyHz) &&
    input.dominantFrequencyHz > 0 &&
    input.dominantFrequencyHz <= input.sampleRate / 2
      ? input.dominantFrequencyHz
      : null;

  const flatness = finite(f.spectralFlatness)
    ? f.spectralFlatness
    : null;

  const harmonicity = finite(f.harmonicity)
    ? f.harmonicity
    : null;

  const drift = finite(f.dominantFrequencyDriftHz)
    ? f.dominantFrequencyDriftHz
    : null;

  const variation =
    finite(f.amplitudeVariationCoefficient)
      ? f.amplitudeVariationCoefficient
      : null;

  const tonal =
    !quiet &&
    peak !== null &&
    flatness !== null &&
    flatness < FRONTIER_CONFIG.tonalFlatnessThreshold;

  const harmonic =
    tonal &&
    harmonicity !== null &&
    harmonicity >= FRONTIER_CONFIG.harmonicityThreshold;

  const changing =
    !quiet &&
    (
      (drift !== null &&
        Math.abs(drift) >
          FRONTIER_CONFIG.frequencyDriftThresholdHz) ||
      (variation !== null &&
        variation >
          FRONTIER_CONFIG.amplitudeVariationThreshold)
    );

  const character = quiet
    ? 'Quiet Resonance Reference'
    : harmonic && changing
      ? 'Changing Harmonic Resonance'
      : harmonic
        ? 'Harmonic Resonance'
        : tonal && changing
          ? 'Moving Tonal Structure'
          : tonal
            ? 'Concentrated Tonal Structure'
            : changing
              ? 'Dynamic Acoustic Pattern'
              : peak === null
                ? 'Open Spectral Texture'
                : 'Layered Soundscape';

  const discovery = quiet
    ? `Your recording offers an exceptionally quiet reference.

This provides a foundation for examining the
next measurable event and investigating how
new acoustic patterns emerge.`
    : harmonic
      ? `Your signal presents relationships among
spectral components that invite deeper
investigation of harmonic structure.

These relationships can be compared across
recordings and experimental conditions.`
      : changing
        ? `Your recording contains temporal variation.

The changing acoustic features invite
exploration of movement, modulation,
event sequences and recurring patterns.`
        : tonal
          ? `Your recording contains a concentrated
spectral feature.

Follow its frequency, stability and
neighbouring components to investigate
the behaviour of the signal.`
          : `Your recording presents an acoustic texture
that invites investigation of the distribution
and interaction of sound components.`;

  return {
    quiet,
    peak,
    tonal,
    harmonic,
    changing,
    character,
    discovery,
    drift,
    variation,
    flatness,
    harmonicity,
  };
}

/**
 * ============================================================
 * PERSONAL INTERPRETATION GUIDANCE
 * ============================================================
 */

function buildPersonalWisdom(
  context: string,
  feeling: ReportedFeeling
): string {
  const focus = context.toLowerCase();

  let wisdom = `THE POWER OF ATTENTIVE DISCOVERY

Every new observation invites a new question.

Consider what this experience has taught you
and which action could help you develop
that understanding further.`;

  if (
    /\b(mwari|prayer|faith|god|spiritual|divine)\b/.test(focus)
  ) {
    wisdom = `THE WISDOM OF FAITH AND DISCOVERY

Faith can inspire perseverance, curiosity
and commitment to meaningful purpose.

Let this exploration encourage prayer,
gratitude and responsibility.

MWARI NDI MWARI.

May understanding become wisdom and
wisdom become constructive action.`;
  } else if (
    /\b(family|love|mother|father|son|daughter|relationship)\b/.test(focus)
  ) {
    wisdom = `THE RESONANCE OF HUMAN CONNECTION

Human relationships develop through
communication, listening and care.

Consider one person who matters to you.

What new understanding could emerge
from giving their words greater attention?

Choose one act that strengthens
connection and compassion.`;
  } else if (
    /\b(business|purpose|career|mission|success|project)\b/.test(focus)
  ) {
    wisdom = `THE INTELLIGENCE OF PURPOSE

A meaningful project develops through
structure, consistency and adaptation.

Like an evolving signal, a business
can be understood through recurring
patterns and measurable change.

Choose one valuable objective,
one practical action and one
indicator of progress.`;
  } else if (
    /\b(nature|animal|bird|tree|forest|environment)\b/.test(focus)
  ) {
    wisdom = `THE WISDOM OF LIVING SYSTEMS

The natural world reveals extraordinary
relationships between organisms
and their environments.

Observe a living pattern with curiosity.

What repeats?
What changes?
What conditions accompany the change?

Allow the observation to deepen
your appreciation of creation.`;
  } else if (
    /\b(cosmic|celestial|space|universe|stars|planet)\b/.test(focus)
  ) {
    wisdom = `THE COSMIC FRONTIER OF CURIOSITY

The universe contains phenomena
far beyond ordinary human perception.

New instruments and analytical methods
can expand what we understand.

Choose one cosmic question and
investigate the type of evidence
that could help explore it.`;
  }

  const emotional = feeling === 'uplifting'
    ? `PERSONAL RESONANCE

You described this experience as uplifting.

Preserve the insight that inspired you
and consider how it can influence
one meaningful action today.`
    : feeling === 'unsettled'
      ? `PERSONAL RESONANCE

You described this experience as unsettled.

Choose a comfortable environment and
consider which question or concern
deserves calm, thoughtful attention.

Your experience can become an opportunity
for reflection and constructive care.`
      : feeling === 'neutral'
        ? `PERSONAL RESONANCE

You selected a neutral interpretation.

This offers a useful opportunity
to investigate patterns without
preselecting an emotional outcome.`
        : `PERSONAL RESONANCE

Your experience belongs to you.

Choose an emotional or spiritual theme
if you want the reflection to follow
your own experience more closely.`;

  return `${wisdom}

${emotional}`;
}

/**
 * ============================================================
 * UNIVERSAL RESEARCH QUESTION LIBRARY
 * ============================================================
 */

const FRONTIER_QUESTIONS: Record<
  FrontierToolId,
  string
> = {
  acoustic:
    'Which measurable acoustic relationships distinguish this recording from a matched reference?',

  environment:
    'How does the surrounding environment influence the soundscape across time and changing conditions?',

  animal:
    'Which patterns of repetition, frequency contour and event timing could support a biological comparison?',

  harmonics:
    'Which harmonic relationships remain stable across observations, and how do they respond to changes in the sound source?',

  spiritual:
    'What meaningful wisdom can be explored through this listening experience and the chosen personal intention?',

  vibe:
    'How does the user’s reported experience relate to the acoustic character and reflective themes of the session?',

  celestial:
    'Which mathematical patterns can be compared with relevant astronomical observations or sonified datasets?',

  divine:
    'How can devotional listening inspire prayer, deeper understanding and constructive action?',

  unknown:
    'What unfamiliar acoustic structure is present, and which measurements could distinguish its possible explanations?',

  alternatives:
    'Which competing explanations best account for the observed acoustic characteristics?',

  guidance:
    'What practical next action could transform this experience into meaningful personal progress?',

  instruments:
    'Which instrument or measurement domain is best suited to investigate the proposed phenomenon?',

  response:
    'How can an original message be encoded, transmitted and recovered through a supported acoustic protocol?',

  matrix:
    'What distinct scientific, biological, spiritual and cosmic perspectives can be developed from this observation?',

  compare:
    'Which acoustic features change between repeated observations under matched conditions?',

  quality:
    'Which recording conditions could improve the clarity and interpretability of the next observation?',

  export:
    'How can the observation and interpretation be preserved for future discovery and comparison?',

  notebook:
    'How should this research question, evidence and experimental progress be documented for future investigation?',

  synthesis:
    'What meaningful understanding emerges when the measured signal and multiple interpretive perspectives are considered together?',
};

/**
 * ============================================================
 * TOOL-SPECIFIC EXPERIMENTAL PATHWAYS
 * ============================================================
 *
 * Each instrument offers its own research journey.
 */

type FrontierPlan = {
  instrument: string;
  steps: string[];
  controls: string[];
  outcomes: string[];
};

function buildResearchPlan(
  toolId: FrontierToolId,
  lens: FreeListeningLens,
  question: string
): FrontierPlan {
  const base: FrontierPlan = {
    instrument:
      'Use the same microphone, input settings and fixed distance for comparable acoustic captures. An independent recorder can help investigate recording-chain effects.',

    steps: [
      'Describe the research question and the conditions of the recording.',
      'Preserve the current observation as a baseline.',
      'Collect three observations using matched capture settings.',
      'Change one proposed influencing condition and collect another observation.',
      'Compare measured acoustic features and document the result.',
      'Develop the next research question using the findings.',
    ],

    controls: [
      'Keep recording settings and observation duration comparable.',
      'Check for playback leakage and background sources.',
      'Record alternative explanations alongside the leading hypothesis.',
    ],

    outcomes: [
      'A repeatable acoustic feature provides a stronger basis for comparison.',
      'A change associated with a controlled condition identifies a useful relationship to investigate.',
      'An unfamiliar result can generate a new hypothesis and an additional experiment.',
    ],
  };

  if (toolId === 'animal') {
    return {
      instrument:
        'Use an appropriate field microphone and traceable reference recordings. Ultrasonic research requires a receiver with suitable verified bandwidth.',

      steps: [
        'Describe the biological sound or question of interest.',
        'Observe naturally occurring calls without disturbing wildlife.',
        'Record relevant environmental conditions and independently observed species information.',
        'Identify call durations, pauses, contours and repeating sequences.',
        'Compare multiple observations and suitable labelled reference recordings.',
        'Document similarities, differences and possible biological research questions.',
      ],

      controls: [
        'Use passive recording and avoid disruptive playback or lures.',
        'Protect sensitive habitat and location information.',
        'Separate observed source information from acoustic resemblance.',
      ],

      outcomes: [
        'Recurring call characteristics may support comparisons of biological activity.',
        'Differences in timing or spectral shape may reveal contextual variation.',
        'A growing set of documented observations can support deeper bioacoustic research.',
      ],
    };
  }

  if (toolId === 'celestial' || toolId === 'unknown') {
    return {
      instrument:
        'Use a microphone for local acoustics. For astronomical or electromagnetic questions, use an appropriate receive-only instrument or a traceable observatory dataset. Preserve the original measurement units and timestamps.',

      steps: [
        'Write a precise description of the unfamiliar pattern or cosmic research question.',
        'Record the acoustic measurement and its acquisition conditions.',
        'Investigate whether the event repeats.',
        'Compare against a matched local background and recording-chain explanation.',
        'Choose an appropriate independent instrument or documented astronomical dataset.',
        'Compare mathematical patterns while preserving the physical origin of each dataset.',
        'Document which hypotheses the observations support and which remain open.',
      ],

      controls: [
        'Distinguish local acoustic measurements from astronomical or radio observations.',
        'Preserve timestamps, units and instrument provenance.',
        'Compare alternative environmental and instrumental explanations.',
      ],

      outcomes: [
        'Recurring local patterns can be documented for further investigation.',
        'Independent measurements may strengthen or revise a research hypothesis.',
        'New mathematical relationships may motivate additional experiments without requiring a premature source attribution.',
      ],
    };
  }

  if (toolId === 'spiritual' || toolId === 'divine') {
    return {
      instrument:
        'Use the existing acoustic observation, the user’s voluntarily supplied intention and an optional devotional notebook.',

      steps: [
        'Choose a question, prayer or meaningful intention.',
        'Listen to the available recording and review its measured characteristics.',
        'Explore relevant spiritual teachings or philosophical ideas.',
        'Write an original devotional reflection inspired by the experience.',
        'Choose one compassionate or constructive action.',
        'Record what the reflection meant to you and whether it inspired further questions.',
      ],

      controls: [
        'Keep user-supplied spiritual context separate from measured acoustic features.',
        'Allow the user to choose their own tradition and meaning.',
        'Present devotional interpretation as reflection rather than instrument-derived source identification.',
      ],

      outcomes: [
        'A meaningful personal reflection may emerge from the listening experience.',
        'The user can identify a practical action connected with their intention.',
        'Further listening sessions can explore new themes and questions.',
      ],
    };
  }

  if (toolId === 'response') {
    return {
      instrument:
        'Use the existing ZionCore acoustic message encoder and compatible decoder with an ordinary audio output and receiver.',

      steps: [
        'Compose an original message or intention.',
        'Review its wording and intended recipient or purpose.',
        'Encode the message using the supported ZionCore protocol.',
        'Transmit or play the encoded audio at a comfortable level.',
        'Capture the signal using a compatible receiving device.',
        'Decode the recording and compare the recovered information with the original message.',
        'Save the result and refine transmission settings if needed.',
      ],

      controls: [
        'Use the supported acoustic protocol and compatible receiving equipment.',
        'Avoid disruptive or excessively loud playback.',
        'Use recovered payload checks to establish successful protocol communication.',
      ],

      outcomes: [
        'A correctly recovered message demonstrates successful acoustic encoding and decoding.',
        'Transmission errors can guide further protocol refinement.',
        'A repeatable communication experiment creates a useful foundation for future signal research.',
      ],
    };
  }

  if (toolId === 'instruments') {
    return {
      instrument:
        'Select the measurement device according to the physical phenomenon: microphone for audible sound, vibration sensor for mechanical movement, appropriate RF receiver for radio signals or documented instruments for astronomical data.',

      steps: [
        'Define the physical phenomenon to investigate.',
        'Determine whether it involves acoustics, mechanical vibration, electromagnetic radiation or another measurable process.',
        'Identify the required frequency range and measurement units.',
        'Select an instrument with appropriate capability.',
        'Document calibration, acquisition settings and measurement uncertainty.',
        'Collect an observation and compare it with a suitable reference.',
      ],

      controls: [
        'Match the instrument to the measurement domain.',
        'Record actual supported bandwidth and acquisition settings.',
        'Preserve original units when comparing different instruments.',
      ],

      outcomes: [
        'Appropriate instrumentation expands the range of investigable phenomena.',
        'Well-documented measurements make later comparisons more meaningful.',
        'Additional instruments can reveal dimensions unavailable to a microphone alone.',
      ],
    };
  }

  if (toolId === 'compare') {
    return {
      ...base,
      steps: [
        'Preserve the first acoustic observation.',
        'Capture a second observation using matching sample rate, FFT settings and capture source.',
        'Compare relative level and qualifying dominant-frequency measurements.',
        'Inspect temporal changes and environmental conditions.',
        'Identify similarities, differences and possible influencing factors.',
        'Record a follow-up question for the next comparison.',
      ],
    };
  }

  if (toolId === 'harmonics') {
    return {
      ...base,
      steps: [
        'Record a signal containing a distinct spectral structure.',
        'Identify the strongest qualifying spectral component.',
        'Inspect harmonic alignment and spectral flatness.',
        'Observe frequency stability and drift.',
        'Compare the pattern with a second matched recording.',
        'Investigate how changes in the source or environment affect the structure.',
      ],
    };
  }

  if (toolId === 'quality') {
    return {
      ...base,
      steps: [
        'Check microphone permissions and the selected input.',
        'Inspect digital RMS and available recording headroom.',
        'Confirm duration, sample rate and FFT settings.',
        'Capture a comfortable reference sound.',
        'Compare the clarity of the resulting measurement.',
        'Retain the settings that produce repeatable observations.',
      ],
    };
  }

  if (toolId === 'notebook' || toolId === 'export') {
    return {
      ...base,
      steps: [
        'Record the observation and its acquisition context.',
        'Write the main research question.',
        'Save measured features separately from interpretations.',
        'Document alternative hypotheses and next investigations.',
        'Create a private versioned record using the existing archive.',
        'Review the record when new observations become available.',
      ],
    };
  }

  if (toolId === 'vibe' || toolId === 'guidance') {
    return {
      ...base,
      steps: [
        'Review the acoustic observations.',
        'Select a personal feeling or intention.',
        'Explore the reflection most relevant to that context.',
        'Identify one meaningful practical action.',
        'Record how the experience influenced your thinking.',
        'Return with a new question or observation.',
      ],
    };
  }

  if (toolId === 'matrix' || toolId === 'synthesis') {
    return {
      ...base,
      steps: [
        'Review the measured acoustic signature.',
        'Explore the environmental interpretation.',
        'Examine the biological communication perspective.',
        'Consider the spiritual or philosophical reflection.',
        'Explore relevant cosmic patterns and research possibilities.',
        'Identify connections and differences between the perspectives.',
        'Create a new research question or practical next step.',
      ],
    };
  }

  if (toolId === 'alternatives') {
    return {
      ...base,
      steps: [
        'Describe the observed signal without assigning a source.',
        'List environmental, biological and instrumental explanations.',
        'Include an open experimental hypothesis if relevant.',
        'Identify a measurable prediction for each explanation.',
        'Collect matched observations and compare the predictions.',
        'Document which interpretations gain support.',
      ],
    };
  }

  return {
    ...base,
    instrument:
      lens === 'celestial'
        ? 'Use the correct instrument for the physical phenomenon under investigation and retain the original measurement units.'
        : base.instrument,
  };
}

/**
 * ============================================================
 * MULTIDIMENSIONAL HYPOTHESIS ENGINE
 * ============================================================
 *
 * Generates meaningful research directions.
 * Hypotheses are not represented as verified discoveries.
 */

function buildHypotheses(
  input: FreeListeningInput,
  toolId: FrontierToolId
) {
  const signal = describeSignal(input);

  const hypotheses = [
    {
      explanation: signal.quiet
        ? `QUIET RESONANCE HYPOTHESIS

The current observation provides a quiet
reference against which the emergence
of future acoustic events can be studied.`
        : signal.harmonic
          ? `HARMONIC STRUCTURE HYPOTHESIS

A periodic or resonant local source may
contribute to the observed harmonic
relationships.`
          : signal.changing
            ? `DYNAMIC SOURCE HYPOTHESIS

Movement, modulation or changing source
conditions may contribute to the
observed temporal variation.`
            : `LAYERED SOUNDSCAPE HYPOTHESIS

One or more local sources may contribute
to the measured spectral distribution.`,

      test:
        'Capture a matched baseline and compare recordings while isolating candidate sound sources.',
    },
    {
      explanation: `INSTRUMENT AND ENVIRONMENT HYPOTHESIS

Microphone positioning, recording gain,
acoustic reflections or device processing
may influence the observed signal.`,

      test:
        'Repeat the observation at a fixed position with playback stopped, then compare using another suitable recorder.',
    },
    {
      explanation: `RECURRING PATTERN HYPOTHESIS

A feature that appears in several
independent observations may provide
a useful foundation for further research.`,

      test:
        'Define one measurable prediction, repeat the recording and compare the observed feature across conditions.',
    },
  ];

  if (toolId === 'animal') {
    hypotheses.push({
      explanation: `BIOLOGICAL COMMUNICATION HYPOTHESIS

Recurring acoustic events may have
structural similarities to naturally
occurring animal vocalisations.`,

      test:
        'Compare documented call timing, frequency contours and suitable labelled reference recordings.',
    });
  }

  if (
    toolId === 'celestial' ||
    toolId === 'unknown' ||
    toolId === 'instruments'
  ) {
    hypotheses.push({
      explanation: `FRONTIER INSTRUMENT HYPOTHESIS

An unfamiliar pattern may motivate
investigation through a different
measurement domain or instrument.`,

      test:
        'Identify the proposed physical signal and investigate it using a suitable independent instrument or traceable dataset.',
    });
  }

  if (
    toolId === 'spiritual' ||
    toolId === 'divine' ||
    toolId === 'vibe'
  ) {
    hypotheses.push({
      explanation: `PERSONAL MEANING EXPLORATION

The listening experience may inspire
devotional, philosophical or personally
meaningful interpretations.`,

      test:
        'Document the chosen intention, the interpretation and any constructive personal insight arising from the reflection.',
    });
  }

  if (toolId === 'response') {
    hypotheses.push({
      explanation: `ACOUSTIC COMMUNICATION HYPOTHESIS

A correctly encoded acoustic message
can be recovered by a compatible
receiver and decoder under suitable
transmission conditions.`,

      test:
        'Encode a known message, transmit it through supported equipment, decode the capture and compare the recovered payload.',
    });
  }

  return hypotheses;
}

/**
 * ============================================================
 * DISCOVERY SYNTHESIS ENGINE
 * ============================================================
 */

function buildSynthesis(
  input: FreeListeningInput,
  toolId: FrontierToolId,
  context: string,
  question: string
): string {
  const signal = describeSignal(input);

  const focus = cleanText(
    context,
    FRONTIER_CONFIG.maximumContextCharacters
  );

  const opening = `ZIONCORE UNIVERSAL DISCOVERY SYNTHESIS

YOUR RESONANCE SIGNATURE:
${signal.character}

${signal.discovery}`;

  const measurement = signal.quiet
    ? `ACOUSTIC FOUNDATION

Your observation offers a quiet
baseline for future comparison.

The next distinct event can provide
new information about frequency,
timing, intensity and spectral texture.`
    : `ACOUSTIC FOUNDATION

Relative digital RMS:
${formatNumber(input.rmsLevel, 6)}

Strongest qualifying spectral component:
${formatHz(signal.peak)}

Harmonic alignment:
${formatNumber(signal.harmonicity, 3)}

Spectral flatness:
${formatNumber(signal.flatness, 3)}

These measured descriptors provide
a foundation for deeper exploration.`;

  const domain = toolId === 'animal'
    ? `BIOLOGICAL DISCOVERY

Investigate the architecture of
living communication through
call timing, frequency contours,
repetition and environmental context.

Consider how biological signals
interact with planetary and
ecological rhythms.`
    : toolId === 'spiritual' || toolId === 'divine'
      ? `SPIRITUAL DISCOVERY

Let the listening experience
inspire devotion, wisdom,
gratitude and reflection.

MWARI NDI MWARI.

Consider how your understanding
can become meaningful action.`
      : toolId === 'celestial' || toolId === 'unknown'
        ? `COSMIC DISCOVERY

Explore the mathematical
relationships among periodicity,
frequency, modulation and
information across scientific domains.

New instruments and datasets may
expand the questions that can
be investigated.`
        : toolId === 'response'
          ? `COMMUNICATION DISCOVERY

Explore how written information
can become an encoded acoustic
signal and how compatible
receivers recover its message.

This creates a practical
foundation for bidirectional
acoustic communication research.`
          : `MULTIDIMENSIONAL DISCOVERY

Explore the living environment,
biological intelligence,
spiritual meaning and
cosmic patterns through
distinct but complementary
interpretive perspectives.`;

  const personal = focus
    ? `YOUR PERSONAL RESEARCH FOCUS

"${focus}"

Use this focus to guide
your next observation
and interpretive journey.`
    : `YOUR PERSONAL DISCOVERY

Choose a meaningful question
that you would like to explore
through future listening sessions.`;

  return `${opening}

${measurement}

${domain}

${personal}

YOUR NEXT RESEARCH QUESTION

${question}

CONTINUE THE JOURNEY

Record, compare, investigate,
reflect and preserve discoveries.

Each new observation can
expand your knowledge and
inspire the next question.

ZIONCORE — LISTEN BEYOND THE ORDINARY.`;
}

/**
 * ============================================================
 * BUILD FRONTIER REPORT
 * ============================================================
 *
 * Preserve the existing exported function
 * and public result fields.
 */

export function buildFrontierReport(
  input: FreeListeningInput,
  options: {
    toolId: FrontierToolId;
    context: string;
    feeling: ReportedFeeling;
    hypothesis: string;
  }
) {
  const tool = FRONTIER_TOOLS.find(
    item => item.id === options.toolId
  );

  if (!tool) {
    throw new Error(
      'Select a supported discovery instrument.'
    );
  }

  /**
   * Run the existing local reading engine.
   * Its input validation is retained.
   */
  const reading = buildFreeListeningReading(
    input,
    options.context,
    tool.lens
  );

  const signal = describeSignal(input);

  const question = cleanText(
    options.hypothesis,
    FRONTIER_CONFIG.maximumQuestionCharacters
  ) || FRONTIER_QUESTIONS[tool.id];

  const hypotheses = buildHypotheses(
    input,
    tool.id
  );

  const plan = buildResearchPlan(
    tool.id,
    tool.lens,
    question
  );

  /**
   * Preserve the existing experiment structure.
   */
  const experiment = {
    question,
    instrument: plan.instrument,
    steps: plan.steps,
    controls: plan.controls,
    outcomes: plan.outcomes,
  };

  /**
   * User-selected feeling remains user supplied.
   * It is never inferred from the microphone.
   */
  const feeling = buildPersonalWisdom(
    options.context,
    options.feeling
  );

  /**
   * Preserve the original lens order.
   * Other report components may rely on it.
   */
  const lenses = [
    'environment',
    'animal',
    'spiritual',
    'celestial',
  ] as const;

  const matrix = lenses.map(lens => ({
    lens,
    ...buildFreeListeningReading(
      input,
      options.context,
      lens
    ),
  }));

  const synthesis = buildSynthesis(
    input,
    tool.id,
    options.context,
    experiment.question
  );

  const message = cleanText(
    options.context,
    FRONTIER_CONFIG.maximumMessageCharacters
  ) ||
    'May this exploration inspire wisdom, discovery, compassion and deeper understanding.';

  /**
   * Preserve report version and return keys.
   */
  return {
    version: FRONTIER_CONFIG.reportVersion,
    tool,
    reading,
    hypotheses,
    experiment,
    matrix,
    feeling,
    synthesis,
    message,
  };
}

/**
 * ============================================================
 * CROSS-SESSION RESONANCE COMPARISON
 * ============================================================
 *
 * Compare actual measurements without changing
 * existing return property names.
 */

export function compareFrontierCaptures(
  first: FreeListeningInput,
  second: FreeListeningInput
) {
  /**
   * Validate both recordings through the
   * existing local analysis input contract.
   */
  buildFreeListeningReading(
    first,
    '',
    'environment'
  );

  buildFreeListeningReading(
    second,
    '',
    'environment'
  );

  const comparable =
    first.sampleRate === second.sampleRate &&
    first.fftSize != null &&
    first.fftSize === second.fftSize &&
    first.captureSource != null &&
    first.captureSource === second.captureSource;

  const firstPeakValid =
    finite(first.dominantFrequencyHz) &&
    first.dominantFrequencyHz > 0 &&
    first.dominantFrequencyHz <= first.sampleRate / 2;

  const secondPeakValid =
    finite(second.dominantFrequencyHz) &&
    second.dominantFrequencyHz > 0 &&
    second.dominantFrequencyHz <= second.sampleRate / 2;

  const firstQuiet =
    first.silent ||
    first.rmsLevel <
      FRONTIER_CONFIG.quietRmsThreshold;

  const secondQuiet =
    second.silent ||
    second.rmsLevel <
      FRONTIER_CONFIG.quietRmsThreshold;

  const canCompare =
    comparable &&
    !firstQuiet &&
    !secondQuiet &&
    firstPeakValid &&
    secondPeakValid;

  const frequencyDifferenceHz = canCompare
    ? second.dominantFrequencyHz! -
      first.dominantFrequencyHz!
    : null;

  const relativeLevelDifference =
    second.rmsLevel - first.rmsLevel;

  let conclusion: string;

  if (!comparable) {
    conclusion = `MATCHED-SETTING EXPLORATION

The two observations use different
capture settings or sources.

For a more meaningful spectral comparison,
repeat the recording with matched
sample rate, FFT configuration
and capture source.

The recordings can still inspire
further questions, while a matched
capture will make the numerical
comparison more informative.`;
  } else if (!canCompare) {
    conclusion = `QUIET AND OPEN-PATTERN COMPARISON

At least one observation provides
a quiet reference or lacks a qualifying
dominant-frequency component.

The relative digital RMS difference is
${relativeLevelDifference.toFixed(6)}.

This is an opportunity to examine
how acoustic activity emerges,
changes or disappears.

Use the next recording to investigate
the arrival of distinguishable events.`;
  } else {
    const direction =
      frequencyDifferenceHz! > 0
        ? 'increased'
        : frequencyDifferenceHz! < 0
          ? 'decreased'
          : 'remained at the same measured value';

    conclusion = `CROSS-SESSION RESONANCE DISCOVERY

The strongest measured spectral
component ${direction}.

Frequency difference:
${frequencyDifferenceHz!.toFixed(2)} Hz

Relative digital RMS difference:
${relativeLevelDifference.toFixed(6)}

These observations create a
measurable basis for investigating
frequency movement and level changes.

THE NEXT QUESTION

Which condition contributed
to the difference?

Compare the environment,
source position, timing and
recording settings.

A repeated relationship can
become the foundation for a
deeper acoustic investigation.`;
  }

  return {
    comparable,
    frequencyDifferenceHz,
    relativeLevelDifference,
    conclusion,
  };
}

/**
 * ============================================================
 * UNIVERSAL EXPERIMENT ARCHIVE
 * ============================================================
 *
 * Preserve the existing validated storage schema.
 *
 * This function stores measurement provenance
 * and a user-assessed discovery state.
 *
 * It does not independently authenticate
 * the user's research conclusions.
 */

export function createFrontierExperiment(
  input: FreeListeningInput,
  report: FrontierReport,
  options: {
    id: string;
    createdAt: string;
    state: DiscoveryState;
    evidence: string;
    parentId?: string;
  }
): UniversalExperiment {
  /**
   * Validate the existing measurement input.
   */
  buildFreeListeningReading(
    input,
    '',
    'environment'
  );

  if (
    input.dominantFrequencyHz != null &&
    (
      !Number.isFinite(input.dominantFrequencyHz) ||
      input.dominantFrequencyHz <= 0 ||
      input.dominantFrequencyHz > input.sampleRate / 2
    )
  ) {
    throw new Error(
      'The measurement peak is outside the supported digital bandwidth.'
    );
  }

  if (!DISCOVERY_STATES.includes(options.state)) {
    throw new Error(
      'Choose a supported discovery state.'
    );
  }

  const evidence = options.evidence.trim();

  if (
    DISCOVERY_STATES.indexOf(options.state) >= 4 &&
    evidence.length < 20
  ) {
    throw new Error(
      'Document at least 20 characters of supporting evidence before recording this research assessment.'
    );
  }

  /**
   * Preserve original measurement field names.
   */
  const measurements = [
    {
      name: 'dominant-frequency',
      value: input.dominantFrequencyHz,
      unit: 'Hz',
      uncertainty: input.fftSize
        ? input.sampleRate / input.fftSize
        : null,
    },
    {
      name: 'relative-rms',
      value: input.rmsLevel,
      unit: 'relative-amplitude',
      uncertainty: null,
    },
    {
      name: 'capture-duration',
      value: input.durationSeconds,
      unit: 'seconds',
      uncertainty: null,
    },
  ];

  /**
   * Preserve the established research domains.
   */
  const domainId =
    report.tool.lens === 'animal'
      ? 'bioacoustic-exploration'
      : report.tool.lens === 'spiritual'
        ? 'spiritual-reflection'
        : report.tool.lens === 'celestial'
          ? 'celestial-inquiry'
          : 'environmental-acoustics';

  /**
   * Preserve compatibility with the
   * UniversalExperiment archive.
   */
  return universalExperimentSchema.parse({
    schemaVersion: 1,

    id: options.id,
    createdAt: options.createdAt,

    participant: {
      scope: 'browser-profile',
      reference: 'current-local-participant',
    },

    domainId,

    instrument: {
      category:
        input.captureSource === 'audio-file'
          ? 'recording-file'
          : 'browser-audio',
      model: null,
      identification: 'generic',
    },

    source: {
      kind:
        input.captureSource === 'audio-file'
          ? 'imported-recording'
          : 'live-capture',
      label: 'User-selected local discovery snapshot',
      observationIds: [],
    },

    signals: [
      {
        id: `${options.id}-signal`,
        modality: 'acoustic',

        source: {
          kind: input.captureSource ?? 'microphone',
          label: 'Browser acoustic measurements',
          deviceModel: null,
        },

        sampleRateHz: input.sampleRate,
        channelCount: null,

        measurements,
        capturedAt: options.createdAt,

        timebase: {
          startAt: options.createdAt,
          durationSeconds: input.durationSeconds,
          sampleClockHz: input.sampleRate,
        },

        spatialContext: null,

        calibration: {
          status: 'unknown',
          method: null,
          reference: null,
          uncertaintyUnit: 'Hz',
        },

        provenance: {
          sourceRecordId: options.id,
          origin: input.captureSource ?? 'microphone',
          transformations: [
            'Local feature snapshot; no raw audio, optional listening context or private observation notes copied.',
          ],
        },
      },
    ],

    hypothesis: {
      statement: report.experiment.question,
      status: 'unverified',
    },

    methods: [
      'local-spectral-descriptors',
      'controlled-comparison-plan',
    ],

    interpretation: [
      {
        layer: 'measurement',
        content: report.reading.observations
          .join(' ')
          .slice(0, 2000),
        evidenceRefs: [options.id],
      },
    ],

    transmission: {
      status: 'not-used',
      protocol: null,
      evidenceRef: null,
    },

    results: [
      {
        name: 'user-assessed-discovery-state',
        value: options.state,
        status: 'hypothesis',
      },
      {
        name: 'evidence-review',
        value:
          evidence.slice(0, 500) ||
          'No additional evidence supplied.',
        status: 'hypothesis',
      },
      {
        name: 'assessment-provenance',
        value:
          'User research assessment, recorded with the existing ZionCore experiment schema. Measurement observations and interpretive conclusions remain distinguishable.',
        status: 'derived',
      },
      ...(options.parentId
        ? [
            {
              name: 'previous-revision',
              value: options.parentId,
              status: 'derived' as const,
            },
          ]
        : []),
    ],

    provenance: {
      application: 'ZionCore',
      algorithmVersion:
        FRONTIER_CONFIG.reportVersion,
      storage: 'browser-local',
      rawAudioIncluded: false,
      sourceObservationNotesIncluded: false,
    },
  });
}

/**
 * ============================================================
 * ZIONCORE FRONTIER INTELLIGENCE DECLARATION
 * ============================================================
 *
 * The purpose of this engine is not to decide
 * the boundaries of future discovery.
 *
 * Its purpose is to provide structured ways
 * to investigate questions, compare observations,
 * explore meaning and develop new knowledge.
 *
 * Scientific measurements provide observations.
 *
 * Experimental reasoning creates questions
 * and identifies ways to investigate them.
 *
 * Biological knowledge connects acoustic
 * structures with living systems.
 *
 * Spiritual reflection provides opportunities
 * for wisdom, prayer and contemplation.
 *
 * Cosmic exploration expands curiosity toward
 * planetary and astronomical phenomena.
 *
 * Responsible interpretation keeps these
 * contributions distinguishable while
 * welcoming new questions and discoveries.
 *
 * ZIONCORE — LISTEN BEYOND THE ORDINARY.
 *
 * MWARI NDI MWARI.
 * ============================================================
 */

export type FrontierReport =
  ReturnType<typeof buildFrontierReport>;
