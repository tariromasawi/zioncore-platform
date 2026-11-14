
import type { SignalFeatures } from './signal-analysis';

/**
 * ============================================================
 * ZIONCORE — UNIVERSAL RESONANCE INTELLIGENCE
 * FREE LISTENING & MULTIDIMENSIONAL EXPLORATION ENGINE
 * VERSION 2
 * ============================================================
 *
 * Core domains:
 *
 * 1. Acoustic Intelligence
 * 2. Environmental Intelligence
 * 3. Biological and Animal Intelligence
 * 4. Spiritual and Devotional Intelligence
 * 5. Celestial and Cosmic Intelligence
 * 6. Universal Resonance Language
 * 7. Personal Wisdom and Discovery
 *
 * Uses local signal measurements.
 * Requires no paid AI provider.
 * Preserves existing application interfaces.
 *
 * Scientific observations, hypotheses and spiritual
 * interpretations are presented as complementary
 * but distinct layers of exploration.
 */

export type FreeListeningInput = {
  dominantFrequencyHz: number | null;
  rmsLevel: number;
  sampleRate: number;
  durationSeconds: number;
  features: SignalFeatures;
  silent: boolean;
  fftSize?: number;
  captureSource?: 'microphone' | 'audio-file';
};

export type FreeListeningLens =
  | 'environment'
  | 'animal'
  | 'spiritual'
  | 'celestial';

/**
 * OWNER-EDITABLE INTELLIGENCE CONFIGURATION
 *
 * These values control the interpretation experience.
 * They do not modify the underlying FFT mathematics.
 */

const ZIONCORE = {
  version: 'zioncore-local-resonance-v2',
  name: 'ZionCore Universal Resonance Intelligence',
  declaration: 'MWARI NDI MWARI',

  quietRmsThreshold: 0.005,
  tonalFlatnessThreshold: 0.2,
  tonalHarmonicityThreshold: 0.45,
  strongHarmonicityThreshold: 0.72,

  frequencyDriftThresholdHz: 50,
  amplitudeVariationThreshold: 0.5,

  maxContextLength: 300,
  highLevelThreshold: 0.9,

  philosophy:
    'Every valid recording creates an opportunity for meaningful discovery.',

  mission:
    'Investigate sound, living systems, spiritual meaning, information, resonance and the cosmos through intelligent exploration.',
} as const;

/**
 * ============================================================
 * MEASUREMENT HELPERS
 * ============================================================
 */

const finite = (
  value: number | null | undefined
): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value);

const hz = (value: number): string =>
  `${value.toFixed(1)} Hz`;

const measured = (
  value: number | null | undefined,
  decimals = 2,
  unit = ''
): string =>
  finite(value)
    ? `${value.toFixed(decimals)}${unit}`
    : 'available for further investigation';

const percentage = (
  value: number | null | undefined
): string =>
  finite(value)
    ? `${Math.round(value * 100)}%`
    : 'not reported';

const dbfs = (value: number): string =>
  value > 0
    ? `${(20 * Math.log10(value)).toFixed(1)} dBFS`
    : 'Digital silence';

const cleanContext = (value: string): string =>
  value.trim().slice(0, ZIONCORE.maxContextLength);

/**
 * ============================================================
 * PERSONAL INTENTION CLASSIFICATION
 * ============================================================
 */

type IntentionCategory =
  | 'faith'
  | 'family'
  | 'purpose'
  | 'nature'
  | 'discovery'
  | 'healing'
  | 'cosmos'
  | 'general';

function identifyIntention(
  context: string
): IntentionCategory {
  const c = context.toLowerCase();

  if (
    /\b(mwari|god|prayer|faith|divine|spiritual|holy|masowe|mudzimu)\b/.test(c)
  ) return 'faith';

  if (
    /\b(family|mother|father|child|children|love|relationship|son|daughter)\b/.test(c)
  ) return 'family';

  if (
    /\b(business|work|career|success|mission|project|future|purpose)\b/.test(c)
  ) return 'purpose';

  if (
    /\b(animal|bird|forest|wildlife|plant|tree|nature|environment)\b/.test(c)
  ) return 'nature';

  if (
    /\b(cosmic|celestial|stars|universe|planet|space|astronomy)\b/.test(c)
  ) return 'cosmos';

  if (
    /\b(healing|peace|health|wellbeing|calm|recovery)\b/.test(c)
  ) return 'healing';

  if (
    /\b(discover|research|experiment|signal|frequency|unknown|mystery)\b/.test(c)
  ) return 'discovery';

  return 'general';
}

const intentionWisdom: Record<
  IntentionCategory,
  string
> = {
  faith: `SPIRITUAL DIRECTION

Faith can inspire profound curiosity,
steadfast purpose and deeper attention
to the wonders of creation.

Let this listening experience encourage
gratitude, prayer and meaningful action.

MWARI NDI MWARI.`,

  family: `THE RESONANCE OF CONNECTION

Relationships are strengthened through
attention, understanding and care.

Just as communication depends on
meaningful exchange, human connection
grows through listening and response.

Choose one action that expresses
compassion toward those you cherish.`,

  purpose: `THE FREQUENCY OF PURPOSE

A meaningful mission develops through
clarity, commitment and disciplined action.

Consider the way separate components
of a signal contribute to a greater pattern.

Give your own vision a clear direction
and one practical next step.`,

  nature: `THE INTELLIGENCE OF CREATION

Nature contains extraordinary relationships
between living organisms and their environments.

Let curiosity guide your next observation.

Every biological rhythm and environmental
change offers another opportunity to learn.`,

  cosmos: `THE COSMIC FRONTIER

The universe invites exploration
through astronomy, physics, mathematics
and imaginative inquiry.

Consider what new instruments and
methods might reveal beyond the range
of ordinary human perception.`,

  healing: `THE PRACTICE OF RENEWAL

Allow this listening experience
to encourage reflection, patience
and attentive self-care.

Music, contemplation and meaningful
routines can provide opportunities
for comfort and personal reflection.

Choose a constructive action that
supports your wellbeing today.`,

  discovery: `THE COURAGE TO INVESTIGATE

Every major question begins with curiosity.

A new observation may challenge
assumptions and inspire fresh experiments.

Choose one relationship to investigate
and one observation that could
move your understanding forward.`,

  general: `THE POWER OF ATTENTIVE DISCOVERY

Listening can change how we experience
the world around us.

Approach this observation with curiosity.

Let what you learn inspire wisdom,
and let wisdom guide meaningful action.`,
};

/**
 * ============================================================
 * UNIVERSAL SCIENTIFIC KNOWLEDGE
 * ============================================================
 */

const universalKnowledge = {
  frequency: `FREQUENCY — THE RHYTHM OF REPETITION

Frequency describes how often
a periodic event repeats.

Sound, mechanical vibrations,
electromagnetic oscillations and
biological rhythms can all be
investigated through relevant
frequency measurements.

Their physical mechanisms differ,
but mathematical comparisons can
reveal interesting relationships.`,

  amplitude: `AMPLITUDE — THE MAGNITUDE OF CHANGE

Amplitude describes the magnitude
of a varying physical quantity.

In digital audio, relative amplitude
helps researchers understand
signal strength and changing levels.

Across scientific disciplines,
the principle of measuring change
remains fundamental.`,

  resonance: `RESONANCE — THE RESPONSE OF SYSTEMS

Resonance describes a system's
response to suitable excitation.

Musical instruments, mechanical
structures and many engineered
systems exhibit resonance.

Studying these responses helps
reveal how systems interact
with energy and oscillation.`,

  information: `INFORMATION — PATTERNS WITH STRUCTURE

Information can be represented through
distinguishable signal states.

Digital communication systems use
agreed encoding and decoding rules
to represent messages.

Biological communication often involves
complex relationships between signals,
receivers and environmental context.

ZionCore explores these relationships
through measurable patterns and
experimental interpretation.`,

  cosmic: `COSMIC PATTERNS — BEYOND ORDINARY HEARING

Astronomical instruments measure
many forms of radiation and change.

Scientists can transform selected
measurements into audible sound
through a process called sonification.

This makes otherwise unfamiliar
data patterns available for
auditory exploration.`,
};

/**
 * ============================================================
 * MAIN LOCAL INTELLIGENCE ENGINE
 * ============================================================
 */

export function buildFreeListeningReading(
  input: FreeListeningInput,
  context: string,
  lens: FreeListeningLens,
) {
  /**
   * Validate the existing measurement contract.
   */
  if (
    !Number.isFinite(input.sampleRate) ||
    input.sampleRate <= 0 ||
    !Number.isFinite(input.durationSeconds) ||
    input.durationSeconds < 0 ||
    !Number.isFinite(input.rmsLevel) ||
    input.rmsLevel < 0 ||
    input.rmsLevel > 1
  ) {
    throw new RangeError(
      'A valid measured capture is required for a local reading.'
    );
  }

  const f = input.features;

  const dominant =
    finite(input.dominantFrequencyHz) &&
    input.dominantFrequencyHz > 0 &&
    input.dominantFrequencyHz <= input.sampleRate / 2
      ? input.dominantFrequencyHz
      : null;

  const quiet =
    input.silent ||
    input.rmsLevel < ZIONCORE.quietRmsThreshold;

  const tonal =
    !quiet &&
    finite(f.spectralFlatness) &&
    f.spectralFlatness <
      ZIONCORE.tonalFlatnessThreshold &&
    finite(f.harmonicity) &&
    f.harmonicity >=
      ZIONCORE.tonalHarmonicityThreshold;

  const harmonic =
    tonal &&
    finite(f.harmonicity) &&
    f.harmonicity >=
      ZIONCORE.strongHarmonicityThreshold;

  const shifting =
    finite(f.dominantFrequencyDriftHz) &&
    Math.abs(f.dominantFrequencyDriftHz) >
      ZIONCORE.frequencyDriftThresholdHz;

  const changing =
    finite(f.amplitudeVariationCoefficient) &&
    f.amplitudeVariationCoefficient >
      ZIONCORE.amplitudeVariationThreshold;

  /**
   * Multiple characteristics may coexist.
   */
  const dynamic = !quiet && (changing || shifting);

  const texture = quiet
    ? 'an exceptionally quiet resonance reference'
    : harmonic && dynamic
      ? 'a changing harmonic resonance'
      : harmonic
        ? 'a harmonically structured signal'
        : tonal && dynamic
          ? 'a changing tonal signal'
          : tonal
            ? 'a concentrated tonal structure'
            : dynamic
              ? 'a dynamic acoustic pattern'
              : 'a layered acoustic soundscape';

  const character = quiet
    ? 'The Hidden Architecture of Stillness'
    : harmonic && dynamic
      ? 'The Transformation of Harmony'
      : harmonic
        ? 'The Architecture of Harmonic Resonance'
        : tonal && dynamic
          ? 'The Moving Centre of Resonance'
          : tonal
            ? 'The Signature of a Dominant Tone'
            : dynamic
              ? 'The Living Rhythm of Change'
              : 'The Living Symphony of Sound';

  const userContext = cleanContext(context);

  const intentionCategory =
    identifyIntention(userContext);

  const intention = userContext
    ? `YOUR PERSONAL INTENTION

"${userContext}"

Your chosen focus brings an additional
dimension to this exploration.`
    : `YOUR DISCOVERY JOURNEY

This session invites you to explore
sound, living systems, spiritual wisdom
and the universe through attentive inquiry.`;

  /**
   * ========================================================
   * MEASURED ACOUSTIC INTELLIGENCE
   * ========================================================
   *
   * These observations use actual signal data.
   */

  const observations: string[] = [
    `YOUR ACOUSTIC RESONANCE SIGNATURE

The recording presents ${texture}.

This is the foundation of your
ZionCore listening exploration.`,

    quiet
      ? `THE QUIET RESONANCE REFERENCE

The measured digital signal lies
at the quiet end of the recording scale.

Digital RMS: ${input.rmsLevel.toFixed(6)}

An acoustic baseline creates an
opportunity to recognise new events
through comparison.`
      : `THE ENERGY OF YOUR SIGNAL

Relative digital RMS:
${input.rmsLevel.toFixed(6)}

Relative level:
${dbfs(input.rmsLevel)}

These values describe the strength
of the recorded digital signal.`,

    dominant !== null && !quiet
      ? `THE FREQUENCY CENTRE

The strongest qualifying spectral
component is ${hz(dominant)}.

Follow this frequency through
future observations to investigate
its stability, movement and
relationships with other peaks.`
      : `THE FREQUENCY LANDSCAPE

${quiet
  ? 'Your quiet reference offers a starting point for discovering the next distinct tonal event.'
  : 'The spectrum invites exploration of its overall texture and distribution rather than a single dominant tone.'}`,

    `YOUR OBSERVATION WINDOW

Session length:
${input.durationSeconds.toFixed(1)} seconds

Sampling rate:
${input.sampleRate.toLocaleString()} samples/second

Digital Nyquist frequency:
${hz(input.sampleRate / 2)}

These details describe the
digital recording framework.`,

    input.captureSource === 'microphone'
      ? `LIVE LISTENING INSTRUMENT

This session uses a microphone
observation with available rolling
temporal measurements.

The recording provides a window
into your immediate acoustic environment.`
      : input.captureSource === 'audio-file'
        ? `RECORDED SOUND EXPLORATION

This session uses locally processed
features from an imported audio file.

The recording can be revisited
and compared with future captures.`
        : `SIGNAL FEATURE EXPLORATION

The session uses supplied
acoustic measurements as the
foundation of interpretation.`,

    finite(f.temporalWindowSeconds) &&
    f.temporalWindowSeconds > 0
      ? `TEMPORAL INTELLIGENCE

Available temporal analysis context:
${f.temporalWindowSeconds.toFixed(1)} seconds.

This window helps describe
changes across successive observations.`
      : `TEMPORAL EXPLORATION

A sequence of observations can help
reveal how sound evolves through time.`,
  ];

  if (
    input.fftSize != null &&
    Number.isInteger(input.fftSize) &&
    input.fftSize > 0
  ) {
    observations.push(
      `SPECTRAL RESOLUTION

FFT analysis window:
${input.fftSize.toLocaleString()} samples

Frequency-bin spacing:
${(input.sampleRate / input.fftSize).toFixed(2)} Hz

Fourier analysis transforms recorded
waveform information into a
frequency-domain representation.`
    );
  }

  /**
   * Detailed descriptors are included only
   * when meaningful measured values exist.
   */
  if (!quiet) {
    if (finite(f.spectralFlatness)) {
      observations.push(
        `SPECTRAL TEXTURE

Flatness descriptor:
${f.spectralFlatness.toFixed(3)}

A lower value generally indicates
a greater concentration of spectral
energy into particular regions.

This can help characterise
tonal and noise-like structures.`
      );
    }

    if (finite(f.harmonicity)) {
      observations.push(
        `HARMONIC INTELLIGENCE

Harmonic alignment:
${percentage(f.harmonicity)}

This local descriptor offers
a way to explore relationships
among detected spectral peaks.

${harmonic
  ? 'The observed alignment offers a strong starting point for investigating harmonic structure.'
  : 'Compare successive recordings to investigate how the alignment develops.'}`
      );
    }

    if (finite(f.spectralEntropy)) {
      observations.push(
        `SPECTRAL INFORMATION DISTRIBUTION

Normalised spectral entropy:
${f.spectralEntropy.toFixed(3)}

This descriptor summarises how
spectral energy is distributed.

Explore whether its value changes
when sound becomes more concentrated,
layered or complex.`
      );
    }

    if (finite(f.spectralCentroidHz)) {
      observations.push(
        `SPECTRAL BRIGHTNESS

Spectral centroid:
${hz(f.spectralCentroidHz)}

The centroid provides a
frequency-weighted centre
of spectral energy.

It can help compare the perceived
brightness of different recordings.`
      );
    }

    if (finite(f.rolloff85Hz)) {
      observations.push(
        `SPECTRAL ENERGY BOUNDARY

85% spectral roll-off:
${hz(f.rolloff85Hz)}

This indicates the approximate
frequency below which 85%
of measured spectral energy lies.`
      );
    }

    if (finite(f.dominantFrequencyDriftHz)) {
      observations.push(
        `FREQUENCY MOVEMENT

Measured dominant-peak drift:
${hz(f.dominantFrequencyDriftHz)}

${shifting
  ? 'The changing frequency feature invites investigation of movement, modulation and transitions.'
  : 'The available drift provides a reference for examining tonal stability.'}`
      );
    }

    if (finite(f.amplitudeVariationCoefficient)) {
      observations.push(
        `DYNAMIC AMPLITUDE PATTERNS

Amplitude-variation coefficient:
${f.amplitudeVariationCoefficient.toFixed(3)}

${changing
  ? 'The observed level variation invites study of changing intensity and recurring events.'
  : 'The available level structure provides a starting point for examining consistency over time.'}`
      );
    }

    if (finite(f.dominantFrequencyStabilityHz)) {
      observations.push(
        `TONAL STABILITY

Dominant-frequency variability:
${hz(f.dominantFrequencyStabilityHz)}

Compare this value across recordings
to study how consistently a
spectral peak remains positioned.`
      );
    }

    if (finite(f.peakToMedianContrastDb)) {
      observations.push(
        `SPECTRAL PROMINENCE

Peak-to-median contrast:
${f.peakToMedianContrastDb.toFixed(1)} dB

This descriptor helps characterise
the prominence of the strongest
spectral region relative to
the surrounding distribution.`
      );
    }

    if (finite(f.zeroCrossingRate)) {
      observations.push(
        `WAVEFORM TRANSITIONS

Normalised zero-crossing rate:
${f.zeroCrossingRate.toFixed(4)}

This describes the relative
frequency of waveform sign changes.

It can support comparisons
of different acoustic textures.`
      );
    }
  }

  /**
   * ========================================================
   * ADAPTIVE ENVIRONMENTAL INTELLIGENCE
   * ========================================================
   */

  const environmentalReading = `
${intention}

THE LIVING ENVIRONMENT
THE RESONANCE OF PLACE AND EXISTENCE

Every location participates in a changing
network of physical interactions.

Air moves through vegetation.
Water flows across surfaces.
Living organisms produce calls.
Human activities create repeating
and irregular acoustic events.

The environment becomes a layered
soundscape containing relationships
between place, time and activity.

YOUR ENVIRONMENTAL SIGNATURE

This session reveals ${texture}.

${quiet
  ? `Your quiet observation provides an acoustic reference.

Imagine the first arrival of wind,
birdsong, footsteps or rainfall.

Each new sound can be compared
with your present baseline,
revealing its growth, duration,
frequency structure and disappearance.`
  : tonal
    ? `Your tonal structure invites exploration
of sustained vibrations.

Possible comparison subjects include
musical instruments, resonant objects,
mechanical equipment and vocal sources.

Investigate the relationship between
the strongest spectral component and
the surrounding acoustic environment.`
    : dynamic
      ? `Your changing acoustic structure
creates an opportunity to study movement.

Consider the way environmental sources
appear, fade, overlap and respond
to changing conditions.

Temporal relationships may reveal
patterns that ordinary listening misses.`
      : `Your layered soundscape invites
investigation of simultaneous events.

Explore background texture,
foreground sounds and the
relationships between them.`}

ENVIRONMENTAL INTELLIGENCE

Acoustic ecology investigates the
sound-producing relationships
within environments.

A soundscape may change with:

Time of day.
Weather conditions.
Seasonal activity.
Biological behaviour.
Human movement.
The surrounding physical environment.

By comparing recordings, ZionCore
can help explore how these
patterns develop.

THE UNIVERSAL CONNECTION

${universalKnowledge.frequency}

SPIRITUAL REFLECTION

The rhythms of nature have inspired
prayer, contemplation and philosophical
reflection across generations.

The persistence of natural cycles
may inspire patience.

The diversity of the living world
may inspire gratitude.

The relationship between life
and its environment can encourage
respect for creation.

YOUR NEXT DISCOVERY

Create an acoustic portrait
using three observations.

Capture the present setting.
Record a naturally occurring change.
Return to the original conditions.

Compare the results to discover
how the environment transforms.
`.trim();

  /**
   * ========================================================
   * BIOLOGICAL AND ANIMAL INTELLIGENCE
   * ========================================================
   */

  const animalReading = `
${intention}

BIOLOGICAL RESONANCE INTELLIGENCE
THE LIVING LANGUAGE OF CREATION

The living world contains extraordinary
systems for exchanging information.

Birds produce elaborate calls.
Whales communicate through
complex acoustic sequences.
Elephants use low-frequency vocalisations.
Insects transmit rhythmic vibrations.

Different organisms interact with
their environments through
specialised sensory systems.

ZionCore invites you to investigate
the structure of biological sound
and its relationship to communication.

YOUR BIOLOGICAL ACOUSTIC SIGNATURE

This recording presents ${texture}.

${quiet
  ? `THE QUIET BIOLOGICAL FRONTIER

Your recording provides a valuable
baseline for future observations.

A naturally occurring call could
introduce distinct frequencies,
rhythms, repeated phrases or
changes in intensity.

Compare how biological activity
emerges against the reference.`
  : dynamic
    ? `THE INTELLIGENCE OF CHANGE

The measured variation invites
investigation of changing sequences.

Explore whether acoustic events
have repeating intervals,
related frequency contours
or identifiable temporal relationships.

Such comparisons can support
research into vocal behaviour.`
    : tonal
      ? `THE TONAL BIOLOGICAL FRONTIER

Your strongest spectral component
provides a coordinate for comparing
tonal and vocal structures.

Investigate frequency contours,
related peaks, duration and repetition.

Some animal vocalisations exhibit
tonal organisation that can be
explored through these descriptors.`
      : `THE COMPLEX BIOLOGICAL FRONTIER

The acoustic texture invites
comparison with buzzing,
movement, overlapping calls
and environmental interactions.

Focus on event sequences,
duration and spectral variation.`}

THE ARCHITECTURE OF COMMUNICATION

Biological acoustic research studies:

Frequency contours.
Rhythmic intervals.
Harmonic relationships.
Call duration.
Repetition.
Pauses.
Amplitude changes.
Responses between organisms.
Environmental context.

These characteristics can reveal
interesting similarities and differences
between recorded events.

THE INTELLIGENCE OF LIVING SYSTEMS

Communication is more than sound alone.

Some organisms exchange information
through chemical signals,
physical movement, electrical activity
or visual displays.

This diversity encourages a
broader understanding of how
living systems interact.

BIOLOGY AND THE COSMOS

Life on Earth unfolds within
a planetary environment.

Daylight influences circadian rhythms.

Seasons shape biological activity.

Tides influence coastal ecosystems.

Some migratory animals respond
to magnetic or celestial cues.

Such relationships invite investigation
of biological patterns across
different environmental conditions.

SPIRITUAL REFLECTION

The complexity of living creation
can inspire reverence and gratitude.

From the smallest organism
to the largest animal,
life reveals extraordinary
adaptation and diversity.

MWARI NDI MWARI.

May the wonder of creation
encourage deeper wisdom,
respect and compassion.

THE FUTURE OF BIOLOGICAL INTELLIGENCE

Could richer acoustic datasets
reveal previously overlooked
relationships between calls?

How do patterns change across
species, locations and seasons?

What new analytical methods
might expand our understanding
of communication?

These questions provide exciting
directions for future exploration.

YOUR NEXT DISCOVERY

Capture a naturally occurring
biological sound.

Compare its spectral signature,
rhythmic structure and timing.

Record relevant environmental
conditions and any independently
observed source information.

Build a growing library of
biological resonance patterns.
`.trim();

  /**
   * ========================================================
   * SPIRITUAL AND DEVOTIONAL INTELLIGENCE
   * ========================================================
   */

  const secular =
    /\b(secular|atheist|nonreligious|non-religious)\b/i.test(
      userContext
    );

  const spiritualReading = secular
    ? `
${intention}

THE PHILOSOPHY OF RESONANCE
ATTENTION, MEANING AND EXISTENCE

Your recording presents ${texture}.

Sound offers an intriguing way
to explore perception and attention.

A single event may reveal
different relationships depending
on the questions we ask
and the features we examine.

${quiet
  ? `THE MEANING OF STILLNESS

A quiet interval can provide
space to reflect on priorities,
responsibilities and the
direction of your next action.`
  : tonal
    ? `THE MEANING OF FOCUS

A concentrated frequency offers
a metaphor for purposeful attention.

Consider which values and goals
deserve a clearer focus.`
    : `THE MEANING OF CHANGE

A complex or changing soundscape
offers a metaphor for navigating
multiple influences while
choosing a thoughtful response.`}

PERSONAL WISDOM

${intentionWisdom[intentionCategory]}

Let curiosity deepen understanding.

Let understanding guide reflection.

Let reflection inspire constructive action.

YOUR NEXT EXPLORATION

Choose a question about sound,
nature or personal meaning
and develop it through
observation and reflection.
`.trim()
    : `
${intention}

SPIRITUAL RESONANCE INTELLIGENCE
THE WISDOM OF CREATION

Sound has accompanied prayer,
music, ceremony and contemplation
throughout human history.

Rhythm can support collective worship.

Music can express devotion.

Stillness can create opportunities
for reflection and prayer.

ZionCore brings these dimensions
into a distinctive listening experience.

YOUR SPIRITUAL RESONANCE THEME

Your recording presents ${texture}.

${quiet
  ? `THE SACRED REFLECTION OF STILLNESS

The quiet interval offers a
devotional image of attention.

Consider the responsibilities,
relationships and hopes that
deserve your care.

Let stillness inspire prayer,
discernment and renewed purpose.`
  : harmonic
    ? `THE DEVOTIONAL IMAGE OF HARMONY

Related frequency components
offer an image of distinct elements
participating in a structured whole.

Reflect on harmony within
your family, community and mission.

Consider how unity and
individual purpose can coexist.`
    : tonal
      ? `THE DEVOTIONAL IMAGE OF FOCUS

A concentrated tonal feature
invites reflection on steadfastness.

Just as a recurring sound can
provide a recognisable reference,
a meaningful intention can
help organise practical action.`
      : dynamic
        ? `THE DEVOTIONAL IMAGE OF TRANSFORMATION

A changing acoustic structure
offers a rich image of life's movement.

Consider what should grow,
what deserves protection
and what requires renewed courage.`
        : `THE DEVOTIONAL IMAGE OF CONNECTION

A layered soundscape can symbolise
the relationships through which
people and communities grow.

Let this reflection inspire
patience, understanding and compassion.`}

THE SPIRITUAL WISDOM OF NATURE

The natural world invites
reflection on creation.

Birdsong can symbolise renewal.

Moving water can inspire
perseverance and purification.

Seasonal cycles can encourage
patience and gratitude.

These symbols offer opportunities
for faith-based contemplation.

SHONA SPIRITUAL HERITAGE

MWARI NDI MWARI.

Within Shona devotional expression,
this declaration affirms faith in Mwari.

The beauty of creation can inspire
gratitude, humility and responsibility
toward the living world.

Let the wisdom of attentive
listening strengthen the good
you choose to do.

THE COSMIC DIMENSION OF WONDER

The universe contains galaxies,
stars, planetary systems and
physical processes spanning
extraordinary scales.

For a person of faith,
these discoveries may inspire
reverence for creation and
renewed commitment to understanding.

Spiritual reflection and
scientific investigation can
offer different but enriching
approaches to profound questions.

PERSONAL WISDOM

${intentionWisdom[intentionCategory]}

A DEVOTIONAL REFLECTION

May my listening become understanding.

May understanding become wisdom.

May wisdom become compassionate action.

May curiosity lead me toward
deeper appreciation of creation.

May my purpose be strengthened
through truth, responsibility
and meaningful service.

YOUR NEXT SPIRITUAL DISCOVERY

Choose one intention.

Reflect on its importance.

Consider a relevant prayer,
teaching or devotional tradition.

Then express that reflection
through one practical action.

ZIONCORE — LISTEN BEYOND THE ORDINARY.
`.trim();

  /**
   * ========================================================
   * CELESTIAL AND COSMIC INTELLIGENCE
   * ========================================================
   */

  const celestialReading = `
${intention}

CELESTIAL AND COSMIC RESONANCE
THE UNIVERSE OF PATTERNS

The universe is filled with
physical processes that can
be investigated through waves,
oscillations and changing signals.

Stars vary in brightness.

Planets move through orbital cycles.

Astronomical objects produce
different forms of radiation.

Specialised instruments transform
these observations into
scientific measurements.

ZionCore invites you to explore
the mathematical language that
connects many forms of observation.

YOUR COSMIC EXPLORATION SIGNATURE

Your recording presents ${texture}.

${quiet
  ? `THE COSMIC LESSON OF STILLNESS

Your quiet reference introduces
an important research principle:

A measurable background can
make later changes easier to recognise.

In astronomy, carefully measured
background conditions help reveal
events and variations.

Your acoustic reference offers
a local example of this principle.`
  : harmonic
    ? `THE ARCHITECTURE OF COSMIC HARMONY

Your signal contains related
spectral components.

Periodicity and mathematical
relationships also appear
in many astronomical datasets.

Explore how structured
repetition can be represented
across different domains.`
    : dynamic
      ? `THE COSMIC LANGUAGE OF CHANGE

Your acoustic observation
contains temporal variation.

Astronomers also investigate
changes across time,
including repeating and
irregular phenomena.

Compare the mathematics of
changing signals while keeping
their physical origins distinct.`
      : `THE COSMIC LANGUAGE OF STRUCTURE

Your soundscape invites investigation
of spectral texture and pattern.

These concepts provide a useful
foundation for learning how
different instruments describe
complex physical phenomena.`}

THE UNIVERSAL LANGUAGE OF FREQUENCY

${universalKnowledge.frequency}

THE UNIVERSAL LANGUAGE OF INFORMATION

${universalKnowledge.information}

THE COSMIC ART OF SONIFICATION

${universalKnowledge.cosmic}

Imagine exploring a sequence
of astronomical measurements
as an audible soundscape.

A change in brightness
could influence intensity.

A repeating event could
become a rhythm.

A changing numerical value
could alter pitch.

Such transformations can
make complex datasets
more accessible for exploration.

THE POSSIBILITY OF OTHER LIVING WORLDS

The possibility of life
beyond Earth remains one
of humanity's great
scientific questions.

Other environments could
support unfamiliar biological
processes and sensory systems.

If other living systems exist,
their communication methods
might differ dramatically
from those familiar to us.

What forms of structure
could help researchers
investigate unfamiliar signals?

How could future instruments
expand our capacity to observe?

These questions invite
imagination, scientific inquiry
and new technological approaches.

THE SPIRITUAL COSMIC PERSPECTIVE

For those who approach existence
through faith, the immensity
of the universe may inspire
reverence, humility and wonder.

The exploration of creation
can encourage both intellectual
curiosity and devotional reflection.

MWARI NDI MWARI.

THE NEXT FRONTIER

Investigate a traceable
astronomical dataset.

Explore a suitable sonification.

Compare temporal patterns,
frequency relationships
and mathematical structure.

Develop a clear research question
that guides your next observation.

ZIONCORE — EXPLORE THE UNSEEN THROUGH
THE POWER OF MEANINGFUL INVESTIGATION.
`.trim();

  /**
   * ========================================================
   * EXPLORATION GUIDANCE
   * ========================================================
   */

  const environmentalAdvice = input.rmsLevel >
    ZIONCORE.highLevelThreshold
    ? `YOUR NEXT ENVIRONMENTAL EXPERIMENT

Your recorded signal is near
the high end of the digital range.

Give the recording additional
headroom by adjusting gain
or increasing microphone distance.

Capture another observation
and compare its clarity,
spectral balance and dynamics.`
    : `YOUR NEXT ENVIRONMENTAL EXPERIMENT

Record a baseline.

Allow one naturally occurring
environmental condition to change.

Capture another observation.

Compare frequency distribution,
signal level and timing.

Build your personal acoustic
portrait of the environment.`;

  const biologicalAdvice = `
YOUR NEXT BIOLOGICAL DISCOVERY

Capture naturally occurring
animal vocalisations or
other biological sounds.

Investigate call duration,
frequency contours,
rhythmic intervals
and recurring structures.

Where available, compare
traceable reference recordings.

Document the environmental
context and preserve
sensitive wildlife locations.

Let each observation expand
your understanding of
living communication.
`.trim();

  const spiritualAdvice = `
YOUR NEXT PERSONAL EXPLORATION

Choose an intention or
meaningful life question.

Consider what this listening
experience has inspired.

Reflect through prayer,
contemplation or your
chosen philosophical tradition.

Transform one insight
into a constructive action.

Return to ZionCore whenever
you wish to explore a
new sound or reflection.
`.trim();

  const celestialAdvice = `
YOUR NEXT COSMIC DISCOVERY

Choose an astronomical
question that interests you.

Explore a documented
astronomical dataset or
appropriate research instrument.

Compare measurable patterns
using relevant mathematics.

Investigate rhythm,
periodicity, modulation
and changing information.

Let curiosity inspire
new questions and
future investigations.
`.trim();

  /**
   * ========================================================
   * ASSEMBLE MULTIDIMENSIONAL READINGS
   * ========================================================
   */

  const readings: Record<
    FreeListeningLens,
    {
      interpretation: string;
      advice: string;
    }
  > = {
    environment: {
      interpretation: environmentalReading,
      advice: environmentalAdvice,
    },

    animal: {
      interpretation: animalReading,
      advice: biologicalAdvice,
    },

    spiritual: {
      interpretation: spiritualReading,
      advice: spiritualAdvice,
    },

    celestial: {
      interpretation: celestialReading,
      advice: celestialAdvice,
    },
  };

  /**
   * ========================================================
   * METHOD AND MEASUREMENT NOTES
   * ========================================================
   *
   * Keep engineering details in their designated fields
   * rather than repeating them throughout the narrative.
   */

  const limitations: string[] = [];

  if (input.durationSeconds < 3) {
    limitations.push(
      `SHORT OBSERVATION

A longer recording can provide
more information about event
timing, repetition and change.`
    );
  }

  if (quiet) {
    limitations.push(
      `QUIET SIGNAL CHARACTER

The available signal is exceptionally quiet.

This provides a reference for
future comparison and the
exploration of emerging sounds.`
    );
  }

  limitations.push(
    `INTERPRETATION FRAMEWORK

Acoustic measurements describe
features of the recorded signal.

Biological and environmental
source identification can be
developed through reference
comparisons and further observations.

Spiritual and philosophical passages
offer reflective interpretations.

Cosmic explorations connect
relevant scientific concepts
and research possibilities.`
  );

  limitations.push(
    `RESEARCH INTEGRITY

New hypotheses are welcome.

Distinguishing measurements,
interpretations and experimental
possibilities helps discoveries
become more meaningful and useful.`
  );

  const method = `
${ZIONCORE.name}

Version: ${ZIONCORE.version}

Processing:
Local digital signal analysis.

Interpretation:
Adaptive measurement-guided
research and reflection rules.

Domains:
Environment, biological intelligence,
spiritual exploration,
celestial investigation and
universal resonance science.

Audio privacy:
No cloud audio upload from
this local reading function.

Cost:
No external AI-provider charge.

Declaration:
${ZIONCORE.declaration}
`.trim();

  /**
   * ========================================================
   * CUSTOMER-FACING RESULT
   * ========================================================
   *
   * Preserve the existing return property names
   * for application compatibility.
   */

  const lensNames: Record<
    FreeListeningLens,
    string
  > = {
    environment: 'Living Environment',
    animal: 'Biological Intelligence',
    spiritual: 'Spiritual Resonance',
    celestial: 'Cosmic Intelligence',
  };

  return {
    title: character,

    summary: `ZionCore presents ${texture},
explored through ${lensNames[lens]}.

Discover meaningful relationships
between measured sound,
scientific knowledge,
personal reflection and
new possibilities for investigation.`,

    observations,

    ...readings[lens],

    limitations,

    method,
  };
}
