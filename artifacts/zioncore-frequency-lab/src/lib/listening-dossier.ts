import type { FreeListeningInput } from './free-listening';
import type { FrontierReport } from './frontier-discovery';

/**
 * ZIONCORE RESONANCE INTELLIGENCE
 * Complete free listening dossier.
 * Local processing, no AI provider charge.
 * Preserves the existing v2 report interface.
 */

type Chapter = {
  id: string;
  title: string;
  kind: string;
  paragraphs: string[];
};

type Mode =
  | 'quiet'
  | 'harmonic'
  | 'tonal'
  | 'changing'
  | 'soundscape'
  | 'open-pattern';

type Lens =
  | 'environment'
  | 'animal'
  | 'spiritual'
  | 'celestial';

/**
 * OWNER CONFIGURATION
 * Edit values here when tuning the experience.
 * These thresholds control report classification,
 * not the underlying FFT calculation.
 */
const CONFIG = {
  dossierVersion: 'free-listening-dossier-v2',
  quietReportRms: 0.005,
  harmonicMinimum: 0.72,
  tonalFlatnessMaximum: 0.2,
  amplitudeChangeThreshold: 0.5,
  driftChangeHz: 50,
  maxIntentionCharacters: 300,
} as const;

const finite = (
  value: number | null | undefined
): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const fixed = (
  value: number | null | undefined,
  digits = 2,
  unit = ''
): string =>
  finite(value)
    ? `${value.toFixed(digits)}${unit}`
    : 'not captured in this snapshot';

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const pct = (
  value: number | null | undefined
): string =>
  finite(value)
    ? `${Math.round(value * 100)}%`
    : 'not recorded';

/**
 * MAIN INTERPRETATION ENGINE
 *
 * Measurements remain distinct from creative,
 * spiritual, biological and cosmic interpretations.
 *
 * This engine transforms observations into useful,
 * engaging, personalised exploration.
 */
export function buildListeningDossier(
  input: FreeListeningInput,
  report: FrontierReport,
  context: string
) {
  const focus = clean(context).slice(
    0,
    CONFIG.maxIntentionCharacters
  );

  const f = input.features;

  const quiet =
    input.silent ||
    (finite(input.rmsLevel) &&
      input.rmsLevel < CONFIG.quietReportRms);

  const peak =
    finite(input.dominantFrequencyHz) &&
    input.dominantFrequencyHz > 0 &&
    finite(input.sampleRate) &&
    input.dominantFrequencyHz <= input.sampleRate / 2
      ? input.dominantFrequencyHz
      : null;

  const flatness = finite(f.spectralFlatness)
    ? f.spectralFlatness
    : null;

  const entropy = finite(f.spectralEntropy)
    ? f.spectralEntropy
    : null;

  const harmonicity = finite(f.harmonicity)
    ? f.harmonicity
    : null;

  const drift = finite(f.dominantFrequencyDriftHz)
    ? f.dominantFrequencyDriftHz
    : null;

  const variation = finite(
    f.amplitudeVariationCoefficient
  )
    ? f.amplitudeVariationCoefficient
    : null;

  const tonal =
    !quiet &&
    peak !== null &&
    flatness !== null &&
    flatness < CONFIG.tonalFlatnessMaximum;

  const harmonic =
    tonal &&
    harmonicity !== null &&
    harmonicity >= CONFIG.harmonicMinimum &&
    harmonicity <= 1;

  const changing =
    !quiet &&
    (
      (variation !== null &&
        variation > CONFIG.amplitudeChangeThreshold) ||
      (drift !== null &&
        Math.abs(drift) > CONFIG.driftChangeHz)
    );

  const mode: Mode = quiet
    ? 'quiet'
    : peak === null
      ? 'open-pattern'
      : harmonic
        ? 'harmonic'
        : tonal
          ? 'tonal'
          : changing
            ? 'changing'
            : 'soundscape';

  const titles: Record<Mode, string> = {
    quiet: 'The Hidden Architecture of Stillness',
    harmonic: 'The Architecture of Harmony',
    tonal: 'The Resonance of a Living Moment',
    changing: 'The Shape of Transformation',
    soundscape: 'The Living Symphony of Existence',
    'open-pattern': 'Beyond the Familiar Signal',
  };

  const themes: Record<Mode, string> = {
    quiet: 'Stillness · Awareness · Possibility',
    harmonic: 'Coherence · Relationship · Wonder',
    tonal: 'Focus · Frequency · Exploration',
    changing: 'Movement · Transformation · Discovery',
    soundscape: 'Nature · Complexity · Connection',
    'open-pattern': 'Mystery · Inquiry · New Frontiers',
  };

  const signalIdentity = quiet
    ? 'an exceptionally quiet acoustic reference'
    : peak !== null
      ? `a soundscape with a strongest measured spectral component near ${peak.toFixed(1)} Hz`
      : 'an open-textured soundscape without a single qualifying dominant tone';

  const overview = `
WELCOME TO YOUR ZIONCORE RESONANCE EXPLORATION

Your session presents ${signalIdentity}.

This is the beginning of a journey through sound,
biology, environment, mathematical patterns,
devotion and the cosmos.

Every recording offers a way to ask a deeper question:
what changes, what endures, and what new relationships
become visible when we learn how to listen?

${quiet
  ? 'In this chapter of stillness, quiet becomes a reference against which future movement, calls and rhythms can be discovered.'
  : harmonic
    ? 'Related spectral components invite you into the architecture of harmony: multiple parts forming a recognisable relationship.'
    : changing
      ? 'The measured variation invites exploration of motion, transitions and the organisation of events over time.'
      : 'The shapes and textures in this signal invite a closer examination of their structure, origin and context.'}

Your chosen meaning and your next observation can turn
this encounter into an unfolding personal research journey.
`.trim();

  const seconds = finite(input.durationSeconds)
    ? input.durationSeconds.toFixed(1)
    : 'unknown';

  const temporalSeconds =
    finite(f.temporalWindowSeconds) &&
    f.temporalWindowSeconds > 0
      ? `${f.temporalWindowSeconds.toFixed(1)} seconds of temporal feature context`
      : 'temporal window not reported';

  const coverage = `
Listening session: ${seconds} seconds;
${temporalSeconds}.

${input.captureSource === 'microphone'
  ? 'The amplitude and spectrum describe an available live observation; temporal descriptors summarise their rolling window.'
  : 'Measurements summarise the imported recording through the local analysis path.'}
`.trim();

  /**
   * CHAPTER ONE
   * RESONANCE SIGNATURE
   */
  const signature: string[] = [
    `YOUR RESONANCE SIGNATURE

Your recording presents ${signalIdentity}.

This signature is your starting coordinate, not the
end of your interpretation.

Learn how its measured structure behaves, then
discover what further comparison may reveal.`,

    quiet
      ? `THE SCIENCE OF STILLNESS

The digital RMS in the available observation is
${fixed(input.rmsLevel, 6)}.

A quiet baseline is valuable because a later birdcall,
rainfall, whisper, footstep or tuned instrument can be
compared against it.

Observe the first measurable change and let its
structure guide your next scientific question.`
      : `THE MEASURED STRUCTURE

Digital RMS: ${fixed(input.rmsLevel, 6)}
Spectral flatness: ${fixed(flatness, 3)}
Spectral entropy: ${fixed(entropy, 3)}

These values describe the strength and distribution
of the analysed signal.

${peak !== null
  ? `The strongest qualifying spectral component appears near ${peak.toFixed(1)} Hz.`
  : 'The overall spectral distribution invites exploration of texture and frequency relationships.'}`,

    harmonic
      ? `HARMONIC INTELLIGENCE

A harmonic-alignment descriptor of
${pct(harmonicity)} invites investigation of
relationships among frequency components.

Harmonic structures may emerge from vibrating
instruments, machinery, vocal processes and other
periodic physical systems.

Explore whether these relationships persist,
weaken or transform in later observations.`
      : tonal
        ? `TONAL INTELLIGENCE

Your concentrated spectral feature provides a
reference for studying pitch stability, resonance,
harmonics and potential source families.

Follow neighbouring peaks and investigate
how the tonal structure evolves.`
        : quiet
          ? `STILLNESS INTELLIGENCE

An acoustic baseline provides a reference that
can help small changes become distinguishable.

A second recording offers an opportunity to
discover which acoustic feature appears first
and how it develops.`
          : `TEXTURAL INTELLIGENCE

A layered spectrum invites investigation of
broadband movement, changing events and
possible overlapping sources.

Explore which features lead, repeat or remain
in the background.`,

    changing
      ? `TEMPORAL INTELLIGENCE

The available analysis indicates movement.

Dominant-frequency drift:
${fixed(drift, 2, ' Hz')}

Amplitude-variation coefficient:
${fixed(variation, 3)}

Investigate whether these changes are gradual,
abrupt, cyclical or associated with recurring events.`
      : `TEMPORAL INTELLIGENCE

Compare successive observations to investigate
whether the acoustic structure remains stable,
alternates between states or responds to changes
in its surroundings.`,

    `THE FRONTIER QUESTION

Could similar mathematical structures emerge
from different physical processes?

Build a library of carefully documented comparisons.

Each meaningful difference becomes an opportunity
to develop a new question and pursue a deeper
understanding of resonance.`,
  ];

  const environmentalLens = report.matrix.find(
    view => view.lens === 'environment'
  );

  const animalLens = report.matrix.find(
    view => view.lens === 'animal'
  );

  const spiritualLens = report.matrix.find(
    view => view.lens === 'spiritual'
  );

  const celestialLens = report.matrix.find(
    view => view.lens === 'celestial'
  );

  /**
   * CHAPTER TWO
   * THE LIVING ENVIRONMENT
   */
  const environment: string[] = [
    `THE LIVING ENVIRONMENT

Every place possesses an acoustic identity.

Moving air, flowing water, geological surfaces,
human activity and living organisms all contribute
to the surrounding soundscape.

ZionCore invites you to explore sound as a
relationship between source, environment,
time, movement and listener.`,

    quiet
      ? `THE QUIET ENVIRONMENTAL REFERENCE

Your present observation establishes a quiet
starting point for comparison.

The next naturally occurring event may reveal
how the environment changes:

A bird begins calling.
Wind moves through vegetation.
Rain reaches a surface.
A distant rhythm approaches and fades.

Each event can contribute a new layer
to your environmental portrait.`
      : `YOUR ENVIRONMENTAL RESONANCE

Your recording exhibits a ${
          tonal ? 'tonal' : changing ? 'changing' : 'textured'
        } acoustic character.

Explore the foreground and background of the
soundscape.

Which structures recur?
Which frequencies remain stable?
Which events appear together?

Such relationships can reveal how a listening
environment changes across time.`,

    `THE ECOLOGY OF LISTENING

Compare natural soundscapes at different
times of day and under different conditions.

Consider dawn and evening, open spaces and
sheltered locations, calm weather and moving air.

Document your observations to create an expanding
acoustic portrait of the living environment.`,

    `THE SPIRITUAL DIMENSION OF NATURE

Across spiritual traditions, natural rhythms
inspire reflections on renewal, endurance,
responsibility and the mystery of creation.

Sunrise may symbolise new beginnings.

Flowing water may inspire perseverance.

The diversity of living sound may encourage
gratitude and respect for creation.

Let scientific inquiry and spiritual reflection
offer complementary paths toward understanding.`,

    environmentalLens?.interpretation
      ? `ADDITIONAL ENVIRONMENTAL PERSPECTIVE

${environmentalLens.interpretation}`
      : `YOUR NEXT DISCOVERY

Choose one part of the soundscape for a closer
observation and compare it with the original.`,
  ];

  /**
   * CHAPTER THREE
   * BIOLOGICAL INTELLIGENCE
   */
  const biologicalComparison = quiet
    ? `BIOLOGICAL COMPARISON — THE QUIET FRONTIER

Your quiet acoustic reference offers a meaningful
foundation for exploring the emergence of
biological sound.

Birds, insects, mammals and other organisms
produce many distinctive acoustic patterns.

A naturally occurring call may introduce new
frequency contours, rhythmic intervals,
repetitions and changing intensities.

Compare how a living sound emerges against
the quiet reference.

SPIRITUAL CONNECTION

The diversity of life invites reflection on
creation, coexistence, wisdom and the
interconnectedness of living systems.

COSMIC CONNECTION

Biological rhythms unfold within planetary
cycles including daylight, seasons and
environmental changes.

YOUR NEXT DISCOVERY

Capture a naturally occurring call and compare
its frequency structure, timing and repetition
with this reference.`
    : `BIOLOGICAL COMPARISON — THE LIVING SIGNAL

Your recording contains acoustic features
that invite a deeper exploration of biological
communication and its wider environment.

${tonal
  ? 'The tonal structure invites comparison with whistles, vocal calls and other periodic acoustic sources.'
  : changing
    ? 'The temporal variation invites investigation of event spacing, changing calls, movement and environmental responses.'
    : 'The spectral texture invites comparison with buzzing, rustling, overlapping calls and other sound-producing processes.'}

${peak !== null
  ? `A strongest spectral component near ${peak.toFixed(1)} Hz provides a useful coordinate for comparison.`
  : 'Spectral texture and temporal relationships provide useful starting points for comparison.'}

BIOLOGICAL INTELLIGENCE

Investigate rhythmic organisation, pitch contours,
repetition, modulation, harmonic relationships
and possible response sequences.

SPIRITUAL RESONANCE

The richness of living creation invites reflection
on purpose, harmony, awareness and humanity's
responsibility toward other life.

COSMIC CONNECTION

Explore how living activity may relate to
daylight, seasonal cycles, temperature,
tides and other planetary conditions.

THE NEXT FRONTIER

Compare the recording with documented examples
and further naturally occurring observations.

Discover which relationships persist, which
change and which questions become possible
through deeper investigation.`;

  const animal: string[] = [
    `BIOLOGICAL INTELLIGENCE — BEYOND HUMAN LANGUAGE

Life communicates through a remarkable diversity
of signals, movements, rhythms and responses.

Birds use structured vocal sequences.

Whales produce complex acoustic patterns.

Elephants communicate through low-frequency calls.

Insects create rhythmic vibrations.

Many other organisms respond to environmental
information through specialised sensory systems.

Every biological system offers a different
window into the possibilities of communication.`,

    biologicalComparison,

    `THE ARCHITECTURE OF LIVING SOUND

Investigate:

Frequency contours.
Harmonic relationships.
Rhythmic sequences.
Repetition and modulation.
Duration and pauses.
Amplitude variation.
Call-and-response patterns.
Environmental conditions.

Relationships between these characteristics
can create useful questions about behaviour
and communication.

ZionCore invites you to compare observations
and explore possible biological structures.`,

    `THE SPIRITUAL INTELLIGENCE OF CREATION

The living world has inspired spiritual
contemplation across generations.

A bird's song can symbolise renewal.

The persistence of a seasonal rhythm can
inspire patience.

The coordination of living communities
can invite reflection on cooperation
and responsibility.

MWARI NDI MWARI.

May curiosity lead to wisdom, and may wisdom
encourage respect for the diversity of creation.`,

    `THE COSMIC DIMENSION OF BIOLOGICAL LIFE

Life on Earth operates within a wider
planetary and astronomical environment.

Daylight influences circadian rhythms.

Seasons shape many biological cycles.

Tides influence coastal ecosystems.

Some animals use magnetic or celestial
information during navigation.

These relationships show how biological
activity can be shaped by processes
operating beyond an individual organism.`,

    `THE BIOLOGICAL FRONTIER

How much information can a recurring acoustic
structure carry?

What differences emerge when calls are compared
across times, places and conditions?

Could new analytical approaches help researchers
recognise previously overlooked patterns?

These are meaningful questions for continuing
biological and acoustic exploration.`,

    animalLens?.interpretation
      ? `ADDITIONAL ANIMAL INTELLIGENCE

${animalLens.interpretation}`
      : `YOUR NEXT DISCOVERY

Build a collection of naturally occurring
biological sounds, recording their timing,
environmental context and distinctive patterns.`,
  ];

  /**
   * CHAPTER FOUR
   * SPIRITUAL INTELLIGENCE
   */
  const secular = /\b(secular|religious|-religious)\b/i.test(
    focus
  );

  const shona = /\b(mwari|mudzimu|shona|masowe|zimbabwe)\b/i.test(
    focus
  );

  const spiritual: string[] = secular
    ? [
        `THE PHILOSOPHY OF ATTENTION

Sound offers a fascinating lesson about perspective.

The same environment can reveal different
relationships depending on where we direct
our attention.

Your recording invites curiosity, compassion
and thoughtful investigation.`,

        quiet
          ? `STILLNESS AND PURPOSE

A quiet interval offers an opportunity to
reflect on what deserves your attention
and which values should guide your next action.`
          : `RHYTHM AND PURPOSE

Patterns, movement and repetition can become
metaphors for habits, progress and deliberate
personal growth.`,

        `PERSONAL WISDOM

Choose one important question and one
constructive action that expresses
the values you wish to strengthen.`,
      ]
    : [
        `SPIRITUAL RESONANCE — THE WISDOM OF CREATION

This devotional exploration draws inspiration
from the sound, stillness and rhythms
experienced during your listening session.

Throughout human history, prayer, music,
contemplation and natural sound have
accompanied spiritual reflection.

Let your recording inspire gratitude,
discernment and renewed purpose.`,

        quiet
          ? `THE WISDOM OF STILLNESS

Quiet can become a place of spiritual attention.

In stillness, a person may reflect on
responsibilities, relationships, faith
and opportunities for growth.

Let this listening moment invite wisdom,
patience and meaningful action.`
          : harmonic
            ? `THE WISDOM OF HARMONY

Related vibrations offer a devotional
image of different elements contributing
to a greater whole.

Consider where harmony, understanding
and shared purpose could strengthen
your relationships and work.`
            : changing
              ? `THE WISDOM OF TRANSFORMATION

A changing soundscape can symbolise
life's continuing movement.

Consider what deserves to grow,
what should be preserved and
which choices can express courage
alongside compassion.`
              : `THE WISDOM OF LISTENING

The diversity of sound invites reflection
on patience, discernment and the value
of listening beyond first impressions.`,

        shona
          ? `MWARI NDI MWARI

Within Shona devotional expression,
this declaration affirms faith in Mwari.

Let the wonder of creation inspire reverence,
responsibility and wisdom that benefits
your family and community.`
          : `MWARI NDI MWARI

The diversity of existence can inspire
a profound appreciation of creation.

Bring your own spiritual tradition,
prayer or philosophical reflections
into this listening experience.`,

        `A PRAYERFUL REFLECTION

May my hearing grow into understanding.

May understanding mature into wisdom.

May wisdom become actions that protect,
uplift and bring goodness into the world.

May my exploration of creation deepen
my compassion and strengthen my purpose.`,

        spiritualLens?.interpretation
          ? `FURTHER DEVOTIONAL PERSPECTIVE

${spiritualLens.interpretation}`
          : `YOUR SPIRITUAL DISCOVERY

What would change today if you listened
more attentively to what matters most?`,
      ];

  /**
   * CHAPTER FIVE
   * COSMIC INTELLIGENCE
   */
  const cosmic: string[] = [
    `THE COSMIC DIMENSION OF RESONANCE

Our planet exists within an extraordinary
universe of oscillations, radiation,
cycles and complex physical relationships.

Sound waves travel through matter.

Light and radio waves are electromagnetic.

Different instruments reveal different
aspects of the physical universe.

ZionCore invites you to explore the
mathematical relationships that make
these investigations possible.`,

    `THE UNIVERSAL LANGUAGE OF PATTERN

Frequency, duration, modulation, phase,
rhythm and information provide useful
concepts across scientific disciplines.

The same mathematical vocabulary can
help researchers compare different systems
while respecting their distinct physical
properties.

Every new instrument can open another
window into previously unexplored phenomena.`,

    quiet
      ? `THE COSMIC LESSON OF STILLNESS

Your quiet acoustic reference inspires
a powerful research question:

How does a small event become distinguishable
against a larger background?

Across acoustics and astronomy,
carefully established baselines help
researchers recognise subtle changes.

The quietest reference can become
the foundation for an extraordinary
investigation.`
      : `YOUR SIGNAL AND THE COSMOS

${
  peak !== null
    ? `Your strongest measured spectral component appears near ${peak.toFixed(1)} Hz.`
    : 'Your observed spectral structure contains relationships worth exploring.'
}

Astronomical variability can be studied
using specialised instruments and represented
through sonification.

Explore how mathematical patterns may be
translated between visual data and sound,
while preserving the original measurements.`,

    `LIFE AND PLANETARY RHYTHMS

Biological activity unfolds within
planetary cycles.

Daylight, seasons, temperature and other
environmental conditions influence
living systems.

Some organisms respond to tides or
magnetic cues.

These connections reveal a fascinating
relationship between local life and
wider planetary processes.`,

    `THE OPEN COSMIC FRONTIER

One of humanity's greatest questions
concerns the possibility of life
beyond Earth.

If other living systems exist,
their environments and communication
methods may differ greatly from ours.

Could unfamiliar patterns of repetition,
modulation or information inspire
new research methods?

What instruments would allow us
to investigate unfamiliar signals?

ZionCore embraces these questions
as opportunities for creative
and disciplined exploration.`,

    `SPIRITUAL COSMIC REFLECTION

For a person of faith, the immensity
of the cosmos may inspire reverence
for creation and renewed purpose.

The universe invites curiosity,
humility and wonder.

Let the search for understanding
strengthen appreciation for life
and the responsibilities we share.`,

    celestialLens?.interpretation
      ? `ADDITIONAL COSMIC PERSPECTIVE

${celestialLens.interpretation}`
      : `YOUR NEXT COSMIC EXPLORATION

Investigate a documented astronomical
dataset through sonification, then
compare its repeating patterns
with the mathematical structures
found in your acoustic observations.`,
  ];

  /**
   * CHAPTER SIX
   * UNIVERSAL RESONANCE LANGUAGE
   */
  const universalLanguage = [
    {
      name: 'Frequency · cycles and repetition',
      detail: `Frequency measures how often a periodic
event repeats. Explore sound spectra, biological
rhythms and cyclic astronomical observations.`,
    },
    {
      name: 'Amplitude · the strength of change',
      detail: `Amplitude describes the magnitude
of signal variation. Compare like-for-like
recordings to understand relative signal levels.`,
    },
    {
      name: 'Harmonics · relationships among tones',
      detail: `Harmonics reveal structured relationships
between frequencies in periodic systems.
Explore how these relationships develop.`,
    },
    {
      name: 'Spectral texture · the distribution of energy',
      detail: `Flatness and spectral entropy describe
how energy is distributed across frequencies.
Explore concentrated and broadband structures.`,
    },
    {
      name: 'Phase · relationships within cycles',
      detail: `Phase describes position within an
oscillation. Relative phase helps explain
interference, reinforcement and signal design.`,
    },
    {
      name: 'Rhythm · the architecture of time',
      detail: `Rhythm concerns the timing, spacing
and repetition of events. Explore sequences
in music, animal calls and environmental sounds.`,
    },
    {
      name: 'Modulation · structured change',
      detail: `Modulation changes signal characteristics
such as amplitude, frequency or phase.
Communication protocols can use these
changes to encode and recover information.`,
    },
    {
      name: 'Resonance · the response of a system',
      detail: `Resonance occurs when a system
responds strongly under suitable stimulation.
Study how physical systems behave at
different excitation frequencies.`,
    },
    {
      name: 'Information · differences with meaning',
      detail: `Patterns can carry information within
systems capable of encoding and interpreting
them. Explore the relationship between
signal structure and communication.`,
    },
    {
      name: 'Universal inquiry · connecting domains',
      detail: `Science, biology, philosophy and
spirituality offer different approaches
to understanding experience.

Together they can inspire deeper questions
about existence, patterns and meaning.`,
    },
  ];

  /**
   * CHAPTER SEVEN
   * PERSONAL INTELLIGENCE
   */
  const focusKind =
    /\b(family|relationship|love|friend|mother|father|child)\b/i.test(focus)
      ? 'connection'
      : /\b(work|business|career|project|purpose|success)\b/i.test(focus)
        ? 'purpose'
        : /\b(grief|loss|died|bereave|sad)\b/i.test(focus)
          ? 'care'
          : /\b(decision|choose|choice|direction)\b/i.test(focus)
            ? 'direction'
            : /\b(nature|animal|bird|forest|environment)\b/i.test(focus)
              ? 'nature'
              : /\b(prayer|faith|mwari|god|spiritual)\b/i.test(focus)
                ? 'faith'
                : 'beginning';

  const wisdom = {
    connection: [
      'Listening as an act of care',
      `Relationships can deepen through sincere attention.

Let your exploration invite understanding,
compassion and meaningful communication.`,
      'Today: make room for one thoughtful conversation.',
    ],

    purpose: [
      'Give your vision a living structure',
      `A strong signal becomes easier to follow
when its structure is clear.

Apply that principle to a project.

Define an outcome, choose a practical
next step and recognise progress.`,
      'Today: move one valuable idea into action.',
    ],

    care: [
      'Honour what matters',
      `Memory, connection and reflection
remain meaningful through change.

Choose an act of kindness that honours
something important to you.`,
      'Today: preserve a meaningful memory or connection.',
    ],

    direction: [
      'Let discernment shape movement',
      `Approach your next decision with curiosity.

Separate your values from unanswered questions.

Identify one practical action that can
help clarify the direction.`,
      'Today: identify one useful next step.',
    ],

    nature: [
      'Become a witness to living intelligence',
      `Observe the natural environment
at two different moments.

Discover what changes, what persists
and what new relationships emerge.`,
      'Today: capture one distinctive natural sound.',
    ],

    faith: [
      'Bring devotion into daily action',
      `Faith can inspire perseverance,
compassion and the courage to investigate
new possibilities.

Let spiritual reflection become
practical wisdom that benefits others.`,
      'Today: choose one act of prayer, gratitude or service.',
    ],

    beginning: [
      'The power of an intentional beginning',
      quiet
        ? `A quiet reference shows how even a small
distinguishable change can become meaningful.

Choose a possibility worth pursuing
and transform attention into action.`
        : `Your recording invites exploration
beyond first impressions.

Choose a worthwhile question
and give it a practical direction.`,
      'Today: ask one meaningful question and act on it.',
    ],
  }[focusKind];

  const personal = [
    focus
      ? `YOUR CHOSEN INTENTION

"${focus}"

${wisdom[0]}`
      : `YOUR PERSONAL THEME

${wisdom[0]}

Add an intention or question to give future
explorations an even more personal direction.`,

    wisdom[1],
    wisdom[2],

    `A THOUGHT TO CARRY FORWARD

Let what you observe inspire what you investigate.

Let what you understand inspire what you create.

Let what you believe inspire the good
you bring into the world.`,

    clean(report.feeling) ||
      `YOUR INNER REFLECTION

What did this experience inspire within you?

Your own response can guide the next
chapter of your personal exploration.`,
  ];

  /**
   * CHAPTER EIGHT
   * CONTINUING THE DISCOVERY
   */
  const nextSteps = [
    quiet
      ? `YOUR NEXT ACOUSTIC DISCOVERY

Save this quiet reference, then record
one comfortable, naturally occurring sound.

Compare its timing and frequency structure.

If the microphone continues to record
digital zero during an ordinary nearby sound,
check its selected input and permissions.`
      : clean(report.reading.advice) ||
        `YOUR NEXT ACOUSTIC DISCOVERY

Compare your recording against another
observation using consistent capture settings.`,

    `THE BIOLOGICAL FRONTIER

Compare naturally occurring calls
and environmental soundscapes.

Observe how their acoustic structures
change across time and conditions.`,

    `THE SPIRITUAL FRONTIER

Choose a devotional or philosophical
theme that matters to you.

Explore its meaning and transform
one insight into a practical action.`,

    `THE COSMIC FRONTIER

Explore astronomical information
through an appropriate sonification
or research tool.

Investigate patterns across different
scientific domains.`,

    `THE MESSAGE FRONTIER

Create an original acoustic message
using ZionCore's encoder.

Transmit it through supported equipment
and explore how a compatible decoder
recovers the information.`,

    `CONTINUE YOUR JOURNEY

Save or export your free exploration.

Discover deeper interpretation options
when you want additional analysis,
comparisons and personalised insights.

Review the available service quotation
before approving paid processing.`,
  ];

  /**
   * REPORT CHAPTER ASSEMBLY
   * Keep the existing IDs for UI compatibility.
   */
  const chapters: Chapter[] = [
    {
      id: 'signature',
      title: 'Your Resonance Signature',
      kind: 'Acoustic insight',
      paragraphs: signature,
    },
    {
      id: 'environment',
      title: 'The Living Environment',
      kind: 'Environmental exploration',
      paragraphs: environment,
    },
    {
      id: 'animal',
      title: 'Biological Intelligence · Beyond Human Language',
      kind: 'Animal-pattern research',
      paragraphs: animal,
    },
    {
      id: 'spiritual',
      title: secular
        ? 'The Wisdom of Attention'
        : 'Spiritual Resonance · The Wisdom of Creation',
      kind: secular
        ? 'Philosophical reflection'
        : 'Devotional reflection',
      paragraphs: spiritual,
    },
    {
      id: 'celestial',
      title: 'Cosmic Resonance · The Universe of Patterns',
      kind: 'Cosmic exploration',
      paragraphs: cosmic,
    },
    {
      id: 'language',
      title: 'The Universal Language of Resonance',
      kind: 'Science in everyday language',
      paragraphs: [
        `THE LANGUAGE OF EXISTENCE

Frequency, amplitude, rhythm, phase,
resonance and modulation help describe
changing physical systems.

Together they provide a vocabulary
for investigating natural patterns,
engineered communication and
astronomical observations.`,

        quiet
          ? `YOUR SCIENTIFIC STARTING POINT

A quiet acoustic reference provides
a foundation for exploring what
changes in the next observation.`
          : peak !== null
            ? `YOUR SCIENTIFIC STARTING POINT

Your strongest qualifying spectral component
appears near ${peak.toFixed(1)} Hz.

Use this feature to compare acoustic
structure across observations.`
            : `YOUR SCIENTIFIC STARTING POINT

Your spectral structure invites
investigation of texture, timing
and recurring events.`,

        `YOUR EXPLORATION

Study how messages can be encoded into sound.

Observe changing patterns within nature.

Investigate how astronomical information
can be transformed into audible representations.

Each investigation opens another way
of studying structure, information and meaning.`,
      ],
    },
    {
      id: 'personal',
      title: 'Your Personal Resonance Message',
      kind: 'Context-led wisdom',
      paragraphs: personal,
    },
    {
      id: 'next',
      title: 'Your Next Discovery',
      kind: 'Continue your exploration',
      paragraphs: nextSteps,
    },
  ];

  /**
   * PERSPECTIVE ADVICE
   * Use named lenses rather than matrix positions.
   */
  const lensMap: Partial<Record<Lens, string>> = {
    environment: environmentalLens?.advice,
    animal: animalLens?.advice,
    spiritual: spiritualLens?.advice,
    celestial: celestialLens?.advice,
  };

  const fallbackAdvice: Record<Lens, string> = {
    environment:
      'Create a comparable environmental recording and study the changes.',

    animal:
      'Record naturally occurring biological sounds and compare their timing and spectral structure.',

    spiritual:
      'Choose a meaningful reflection and transform it into practical wisdom.',

    celestial:
      'Explore documented astronomical information through appropriate research instruments.',
  };

  /**
   * RETURN CONTRACT
   * Preserve existing fields consumed by the UI.
   */
  return {
    version: CONFIG.dossierVersion,
    mode,
    title: titles[mode],
    theme: themes[mode],
    overview,
    coverage,
    chapters,

    acousticStructure: [
      {
        name: 'Dominant frequency',
        detail: quiet
          ? 'Quiet resonance reference'
          : peak === null
            ? 'Open spectral structure'
            : `${peak.toFixed(1)} Hz · strongest qualifying component`,
      },
      {
        name: 'Harmonic alignment',
        detail: quiet
          ? 'Quiet resonance reference'
          : fixed(harmonicity, 3),
      },
      {
        name: 'Digital RMS',
        detail: fixed(input.rmsLevel, 6),
      },
      {
        name: 'Temporal change',
        detail: quiet
          ? 'Quiet resonance reference'
          : `${fixed(drift, 2, ' Hz')} peak drift; ${fixed(variation, 3)} amplitude-variation coefficient`,
      },
      {
        name: 'Spectral texture',
        detail: quiet
          ? 'Quiet resonance reference'
          : `${fixed(flatness, 3)} flatness; ${fixed(entropy, 3)} entropy`,
      },
    ],

    biologicalComparison,
    personal,
    universalLanguage,

    perspectives: chapters
      .filter(chapter =>
        ['environment', 'animal', 'spiritual', 'celestial']
          .includes(chapter.id)
      )
      .map(chapter => {
        const lens = chapter.id as Lens;

        return {
          lens,
          title: chapter.title,
          interpretation: chapter.paragraphs.join('\n\n'),
          advice:
            clean(lensMap[lens]) ||
            fallbackAdvice[lens],
          evidenceKind: chapter.kind,
        };
      }),

    nextSteps,

    freeBoundary: `Your complete local resonance
exploration is available without a purchase.

Save your discoveries, compare new recordings
and explore additional perspectives.

For deeper AI-assisted analysis, review
the available services and approve a clear
quotation before paid processing.`,
  };
}
