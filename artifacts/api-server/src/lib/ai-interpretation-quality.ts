import type { AnalysisMeasurement } from '@workspace/frequency-ai-contract';

export type InterpretationQualityCode =
  | 'INTERNAL_ATTRIBUTION'
  | 'CONTRAST_AS_NOISE'
  | 'UNSUPPORTED_ALIASING_CLAIM'
  | 'MATRIX_OVERCLAIM'
  | 'PRESSURE_OVERCLAIM'
  | 'SOURCE_PROXIMITY'
  | 'EXACT_HARMONIC_OVERCLAIM'
  | 'SYNTHETIC_LABEL_MISSING'
  | 'UNVALIDATED_BIOACOUSTIC_CLASSIFICATION'
  | 'UNSUPPORTED_ANIMAL_INTENT'
  | 'CONFIDENCE_SCOPE_OVERCLAIM'
  | 'UNVERIFIED_DIVINE_ATTRIBUTION'
  | 'COERCIVE_OR_ALARMING_GUIDANCE'
  | 'FAITH_REFLECTION_MISSING'
  | 'FAITH_REFLECTION_TOO_SHALLOW';

const MIN_FAITH_PARAGRAPH_WORDS = 30;

export class AiInterpretationQualityError extends Error {
  constructor(readonly codes: InterpretationQualityCode[]) {
    super('The provider response failed ZionCore interpretation quality checks.');
    this.name = 'AiInterpretationQualityError';
  }
}

type MeasurementEvidence = Pick<
  AnalysisMeasurement,
  'dominantFrequencyHz' | 'topPeaksHz' | 'frequencyResolutionHz'
>;

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

function hasNegatedClaim(sentence: string, claim: RegExp): boolean {
  const negated = new RegExp(
    `\\b(?:not|never|cannot|can not|does not|doesn't|is not|isn't)\\b[^.!?;]{0,90}${claim.source}`,
    'i',
  );
  return negated.test(sentence);
}

const bioacousticSourceTerms =
  /\b(?:animals?|species|wildlife|bird|birds|bat|bats|whale|whales|dolphin|dolphins|frog|frogs|amphibians?|insect|insects|mammal|mammals|walruses?|seals?|fish|avian|canine|feline|wolf|wolves|fox|foxes|deer|owl|owls|crow|crows|raven|ravens|sparrow|sparrows|songbird|songbirds|vocali[sz]ation|birdsong|rain|wind|water|river|stream|traffic|vehicle|engine|footsteps|machine|alarm|siren|thunder|thunderstorm|storm|geyser|geothermal|fumarole|wildfire|fire|weather)\b/i;

const explicitSourceAssertion =
  /\b(?:identified|confirmed|verified|classified|determined|proven|recognized|recognised)\s+(?:as|to be)\b|\b(?:this|the|a|an)\s+(?:recording|audio|clip|sound|signal|event|capture|call|vocali[sz]ation|source|species)\s+(?:is|was|contains|includes|captures|records|comes from|originates from|was produced by|was made by)\b|\b(?:a|an|the)\s+(?:[\w-]+\s+){0,2}(?:bird|bat|whale|dolphin|frog|amphibian|walrus|seal|insect|animal|species|vocali[sz]ation)\s+(?:call|song|vocali[sz]ation|chorus)\b|\b(?:i|we|the model|zioncore)\s+(?:hear|heard|detected|identified|recognized|recognised)\b/i;

const animalEventAssertion =
  /\b(?:animals?|birds?|bats?|whales?|dolphins?|frogs?|amphibians?|walruses?|seals?|insects?|mammals?|fish|wolves?|foxes?|deer|owls?|crows?|ravens?|sparrows?|songbirds?|vocali[sz]ations?|birdsong)\b[\s\S]{0,45}\b(?:chirp(?:ing|ed)?|sing(?:ing)?|call(?:ing|ed)?|howl(?:ing|ed)?|bark(?:ing|ed)?|growl(?:ing|ed)?|meow(?:ing|ed)?|purr(?:ing|ed)?|roar(?:ing|ed)?|quack(?:ing|ed)?|coo(?:ing|ed)?|hoot(?:ing|ed)?|tweet(?:ing|ed)?|croak(?:ing|ed)?|buzz(?:ing|ed)?|click(?:ing|ed)?|echolocat(?:e|es|ing|ed))\b/i;

const environmentalEventAssertion =
  /\b(?:rain|wind|water|river|stream|traffic|vehicle|engine|footsteps|machine|alarm|siren|thunder|thunderstorm|storm|geyser|geothermal|fumarole|wildfire|fire|weather)\b[\s\S]{0,45}\b(?:falling|blowing|flowing|rushing|passing|running|idling|echoing|sounding|wailing|rumbling|raining|storming|beeping|ringing|roaring|erupting|crackling|burning)\b/i;

const animalIntentAssertion =
  /\b(?:animal|species|bird|bat|whale|dolphin|frog|amphibian|walrus|seal|insect|mammal|fish|wolf|fox|deer|owl|crow|raven|sparrow|wildlife)\b[\s\S]{0,80}\b(?:says|means|warns|communicates|intends|wants|asks|tells|instructs|is telling|is warning|is communicating)\b|\b(?:message|warning|instruction)\b[\s\S]{0,60}\b(?:from|by|through)\s+(?:an?\s+)?(?:animal|species|bird|bat|whale|dolphin|frog|amphibian|walrus|seal|insect|mammal|fish|wildlife)\b|\b(?:animal|species|bird|bat|whale|dolphin|frog|amphibian|walrus|seal|insect|mammal|fish|wolf|fox|deer|owl|crow|raven|sparrow|wildlife)s?\b[\s\S]{0,45}\b(?:is|are|was|were)\s+(?:singing|calling|mating|feeding|migrating|nesting|hunting|communicating|warning|distressed|territorial)\b/i;

const explicitUncertainty =
  /\b(?:possible|possibly|maybe|perhaps|may|might|could|tentative|hypothesis|hypothetical|candidate|unverified|unconfirmed|uncertain|unknown|unidentified|unvalidated|not validated|not verified|not confirmed|not identified|not independently verified|not proof|not evidence|no reference|without a reference|cannot identify|cannot confirm|cannot determine|not enough evidence|insufficient evidence|resembles?|consistent with|compatible with|sounds? like|appears? to be|seems? to be|bird[- ]like|animal[- ]like|environmental[- ]sound hypothesis)\b/i;

const explicitBioacousticNegation =
  /\b(?:no|not|never|cannot|can't|does not|doesn't|is not|isn't|was not|wasn't|are not|aren't|were not|weren't)\b[\s\S]{0,60}\b(?:animals?|species|wildlife|birds?|bats?|whales?|dolphins?|frogs?|amphibians?|walruses?|seals?|insects?|mammals?|fish|wolves?|foxes?|deer|owls?|crows?|ravens?|sparrows?|vocali[sz]ations?|rain|wind|water|river|stream|traffic|vehicle|engine|footsteps|machine|alarm|siren|thunder|thunderstorm|storm|geyser|geothermal|fumarole|wildfire|fire|weather|identified|confirmed|verified|classified|detected|present|singing|calling|warning|communicating)\b/i;

function getBioacousticClaimViolations(value: unknown): InterpretationQualityCode[] {
  const violations = new Set<InterpretationQualityCode>();
  const text = collectStrings(value).join('\n');
  const sentences = text.split(/(?<=[.!?;])\s+/u);
  for (const sentence of sentences) {
    if (!bioacousticSourceTerms.test(sentence)) continue;
    const qualified = explicitUncertainty.test(sentence) ||
      explicitBioacousticNegation.test(sentence);
    if (animalIntentAssertion.test(sentence) && !qualified) {
      violations.add('UNSUPPORTED_ANIMAL_INTENT');
      continue;
    }
    if (
      (explicitSourceAssertion.test(sentence) ||
        animalEventAssertion.test(sentence) ||
        environmentalEventAssertion.test(sentence)) &&
      !qualified
    ) {
      violations.add('UNVALIDATED_BIOACOUSTIC_CLASSIFICATION');
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const candidates = (value as Record<string, unknown>).candidateExplanations;
    if (Array.isArray(candidates)) {
      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
        const record = candidate as Record<string, unknown>;
        if (typeof record.label !== 'string' || !bioacousticSourceTerms.test(record.label)) continue;
        if (!explicitUncertainty.test(record.label) || record.confidence !== 'low') {
          violations.add('UNVALIDATED_BIOACOUSTIC_CLASSIFICATION');
        }
      }
    }
  }
  return [...violations];
}

function getSpiritualClaimViolations(
  analysis: unknown,
  text: string,
): InterpretationQualityCode[] {
  const violations = new Set<InterpretationQualityCode>();
  const directDivineAttribution =
    /\b(?:this|the|a|an)\s+(?:frequency|signal|sound|recording|pattern|tone)\s+(?:is|was|proves?|confirms?)\s+(?:a\s+)?(?:message|sign|warning|revelation)\s+from\s+(?:god|the divine|divine beings?|an? angel|a spirit)\b|\b(?:god|the divine|divine beings?|an? angel|a spirit)\b[\s\S]{0,70}\b(?:sent this|spoke through this|is telling you|warns? you|commands? you|revealed this)\b|\b(?:dark energy|evil spirit|demonic presence|curse)\b[\s\S]{0,50}\b(?:detected|confirmed|present|targeting|causing)\b/i;
  const coerciveOrDisparaging =
    /\b(?:you must|you have to|you need to)\s+(?:convert|abandon|leave|reject)\s+(?:your\s+)?(?:faith|religion)\b|\b(?:your|another|other)\s+(?:faith|religion|beliefs?)\s+(?:is|are)\s+(?:false|wrong|inferior|evil|primitive)\b/i;
  const audioBasedDanger =
    /\b(?:sound|signal|frequency|recording|tone)\b[\s\S]{0,80}\b(?:proves?|confirms?|shows?|means)\b[\s\S]{0,60}\b(?:you are in danger|a threat|dark energy|evil spirit|demonic presence|a curse)\b/i;
  const userAttributedBelief =
    /\b(?:you (?:shared|said|described|wondered|believe|feel|interpret)|your (?:belief|view|interpretation|question))\b/i;
  const endorsement =
    /\b(?:that confirms|this proves|zioncore confirms|i agree|indeed,? it is|therefore it is true)\b/i;

  for (const sentence of text.split(/(?<=[.!?;])\s+/u)) {
    const explicitlyAttributed = userAttributedBelief.test(sentence) && !endorsement.test(sentence);
    if (
      (directDivineAttribution.test(sentence) || audioBasedDanger.test(sentence)) &&
      !explicitUncertainty.test(sentence) &&
      !hasNegatedClaim(sentence, /\b(?:proves?|confirms?|shows?|means)\b/i) &&
      !explicitlyAttributed
    ) {
      violations.add('UNVERIFIED_DIVINE_ATTRIBUTION');
    }
    if (coerciveOrDisparaging.test(sentence)) {
      violations.add('COERCIVE_OR_ALARMING_GUIDANCE');
    }
  }

  const confidenceScope = analysis && typeof analysis === 'object' && !Array.isArray(analysis)
    ? (analysis as Record<string, unknown>).confidenceScope
    : null;
  if (
    typeof confidenceScope === 'string' &&
    /\b(?:confidence|certain|sure)\b[\s\S]{0,100}\b(?:source|species|origin|cause|message|divine|spiritual meaning|intent|danger|healing)\b/i.test(confidenceScope) &&
    !explicitUncertainty.test(confidenceScope) &&
    !/\b(?:not|no|never|cannot|does not|doesn't|isn't|is not|unknown|unverified|uncertain)\b[\s\S]{0,45}\b(?:source|species|origin|cause|message|divine|spiritual meaning|intent|danger|healing)\b/i.test(confidenceScope)
  ) {
    violations.add('CONFIDENCE_SCOPE_OVERCLAIM');
  }
  return [...violations];
}

export function assertBioacousticClaimsAreQualified(value: unknown): void {
  const codes = getBioacousticClaimViolations(value);
  if (codes.length > 0) throw new AiInterpretationQualityError(codes);
}

export function assertAiInterpretationQuality(
  analysis: unknown,
  measurement: MeasurementEvidence,
  listeningContext: string,
  includeFaithReflection = false,
): void {
  const text = collectStrings(analysis).join('\n');
  const sentences = text.split(/(?<=[.!?])\s+/u);
  const codes = new Set<InterpretationQualityCode>();

  if (
    /\bZIONCORE GENESIS SEED\b|\bHRH\s+SAINT\s+TARIRO\s+MASAWI\b|\bMWARI NDI MWARI\b|\bcreator attribution\b|\bproject owner\b|\bowner(?:'s)? faith\b/i.test(text)
  ) {
    codes.add('INTERNAL_ATTRIBUTION');
  }

  const contrastClaim = /\b(?:noise floor|signal[- ]to[- ]noise ratio|\bSNR\b)\b/i;
  if (sentences.some(sentence =>
    /\b(?:peak[- ]to[- ]median|spectral) contrast\b/i.test(sentence)
    && contrastClaim.test(sentence)
    && !hasNegatedClaim(sentence, contrastClaim),
  )) {
    codes.add('CONTRAST_AS_NOISE');
  }

  if (/\b(?:no aliasing (?:is|was) detected|aliasing (?:is|was) absent|without aliasing)\b/i.test(text)) {
    codes.add('UNSUPPORTED_ALIASING_CLAIM');
  }

  const matrixClaim = /\b(?:principal(?: component)? variance|variance share|correlation matrix|spectral matrix)\b[\s\S]{0,180}\b(?:confirm\w*|prove\w*|establish\w*|demonstrat\w*)\b[\s\S]{0,100}\b(?:stable|stability|steady[- ]state|coherent|coherence|single source|one source|causation|cause)\b/i;
  if (sentences.some(sentence =>
    matrixClaim.test(sentence)
    && !hasNegatedClaim(sentence, /\b(?:confirm|prove|establish|demonstrate)\w*\b/i),
  )) {
    codes.add('MATRIX_OVERCLAIM');
  }

  if (/\b(?:consistent|measured|calibrated|significant)\s+pressure variation\b/i.test(text)) {
    codes.add('PRESSURE_OVERCLAIM');
  }

  const proximityClaim = /\b(?:source|signal)\b[\s\S]{0,90}\b(?:proximal|near(?:by)?|close to (?:the )?(?:microphone|mic))\b/i;
  if (sentences.some(sentence =>
    proximityClaim.test(sentence)
    && !hasNegatedClaim(sentence, /\b(?:proximal|near(?:by)?|close to (?:the )?(?:microphone|mic))\b/i),
  )) {
    codes.add('SOURCE_PROXIMITY');
  }

  const fundamental = measurement.dominantFrequencyHz;
  if (fundamental !== null && fundamental > 0) {
    const hasNearHarmonicBin = measurement.topPeaksHz.some(peak => {
      if (peak <= fundamental) return false;
      const harmonicNumber = Math.round(peak / fundamental);
      if (harmonicNumber < 2) return false;
      const mismatchHz = Math.abs(peak - (harmonicNumber * fundamental));
      return mismatchHz > 0.000001 && mismatchHz <= measurement.frequencyResolutionHz;
    });
    if (
      hasNearHarmonicBin &&
      /\b(?:exactly|precisely|perfectly|an exact)\b[\s\S]{0,60}\b(?:double|doubling|harmonic|octave)\b|\b(?:double|doubling|harmonic|octave)\b[\s\S]{0,60}\b(?:exactly|precisely|perfectly|exact)\b/i.test(text) &&
      !/\b(?:not exactly|not precisely|not a perfect|not an exact)\b/i.test(text)
    ) {
      codes.add('EXACT_HARMONIC_OVERCLAIM');
    }
  }

  if (
    /\b(?:synthetic|internal QA|QA sample|test data)\b/i.test(listeningContext)
    && !/\b(?:synthetic|internal QA|QA sample|test data)\b/i.test(text)
  ) {
    codes.add('SYNTHETIC_LABEL_MISSING');
  }

  for (const code of getBioacousticClaimViolations(analysis)) codes.add(code);
  for (const code of getSpiritualClaimViolations(analysis, text)) codes.add(code);

  if (includeFaithReflection) {
    const reflection = (
      analysis && typeof analysis === 'object' && !Array.isArray(analysis)
        ? (analysis as Record<string, unknown>).faithReflection
        : null
    );
    const reflectionBody = typeof reflection === 'string'
      ? reflection.split(/\n\s*\nOptional sacred-text echo:\s*/i, 1)[0]?.trim() ?? ''
      : '';
    const reflectionParagraphs = reflectionBody
      .split(/\n\s*\n+/)
      .map(paragraph => paragraph.trim())
      .filter(Boolean);
    if (reflectionParagraphs.length < 3) {
      codes.add('FAITH_REFLECTION_MISSING');
    } else if (reflectionParagraphs.some(paragraph => paragraph.split(/\s+/).length < MIN_FAITH_PARAGRAPH_WORDS)) {
      codes.add('FAITH_REFLECTION_TOO_SHALLOW');
    }
  }

  if (codes.size > 0) throw new AiInterpretationQualityError([...codes]);
}
