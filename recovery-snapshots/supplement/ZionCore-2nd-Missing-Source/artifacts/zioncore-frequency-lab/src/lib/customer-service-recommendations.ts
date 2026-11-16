export const customerServiceGoals = [
  'frequency',
  'wildlife',
  'spiritual',
  'celestial',
  'message',
  'compare',
] as const;

export type CustomerServiceGoal = (typeof customerServiceGoals)[number];

export type ServiceRecommendation = {
  label: string;
  title: string;
  summary: string;
  steps: string[];
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
};

const recommendations: Record<Exclude<CustomerServiceGoal, 'compare'>, ServiceRecommendation> = {
  frequency: {
    label: 'Measure a frequency pattern',
    title: 'Start with a real capture.',
    summary: 'Use the microphone or import a supported recording, then review its spectrum and measured peaks in the Frequency Lab.',
    steps: [
      'Choose microphone capture or select an audio file.',
      'Review the sample rate, peaks, and pattern details.',
      'If you request a paid interpretation, review and approve its live quote before it runs.',
    ],
    primary: { href: '/', label: 'Open Frequency Lab' },
    secondary: { href: '/devices', label: 'Check supported inputs' },
  },
  wildlife: {
    label: 'Explore wildlife or nature sound',
    title: 'Bring a field recording to ZionCore.',
    summary: 'Compare acoustic patterns and environmental conditions; use animal-source suggestions as research hypotheses, not confirmed species or intent.',
    steps: [
      'Import a recording in the Frequency Lab or Device Centre.',
      'Keep its time, location context, and capture method with your own field notes.',
      'Repeat with a quiet or known reference recording to test whether a pattern recurs.',
    ],
    primary: { href: '/', label: 'Analyze a recording' },
    secondary: { href: '/devices', label: 'Explore device paths' },
  },
  spiritual: {
    label: 'Explore spiritual meaning',
    title: 'Choose the reflection that fits you.',
    summary: 'Start with a sound or frequency measurement, then add an optional faith or personal context when requesting a reading.',
    steps: [
      'Capture or import the signal you want to explore.',
      'Review the measured pattern before choosing an interpretation.',
      'Your selected spiritual context informs reflection; the sensor reading remains separate.',
      'Review and approve the current quote before any paid interpretation begins.',
    ],
    primary: { href: '/', label: 'Begin a reflection reading' },
  },
  celestial: {
    label: 'Design a celestial communication experiment',
    title: 'Prepare a message and an observation.',
    summary: 'Use the local message protocol to encode and play a user-written acoustic message, then record any measurable result as a separate observation.',
    steps: [
      'Create a short message in the Message Studio.',
      'Preview and start playback yourself; the signal is emitted locally.',
      'Use the Frequency Lab to inspect a separately captured response, if one is recorded.',
    ],
    primary: { href: '/messages', label: 'Open Message Studio' },
    secondary: { href: '/', label: 'Open Frequency Lab' },
  },
  message: {
    label: 'Create or decode an acoustic message',
    title: 'Encode, play, receive, or decode locally.',
    summary: 'The Message Studio supports its documented acoustic packet formats, playback controls, file export, and local decoding.',
    steps: [
      'Choose text, prayer, or a supported voice packet.',
      'Preview the encoded audio and use Play or Stop when ready.',
      'Decode a compatible recording and check its integrity result.',
    ],
    primary: { href: '/messages', label: 'Open Message Studio' },
  },
};

export function getCustomerServiceRecommendation(
  goal: CustomerServiceGoal,
  premiumActive = false,
): ServiceRecommendation {
  if (goal !== 'compare') return recommendations[goal];
  return premiumActive
    ? {
      label: 'Compare previous sessions',
      title: 'Continue in your private Premium workspace.',
      summary: 'Compare saved account observations side by side. This uses existing measurements and does not request another AI reading or spend interpretation credits.',
      steps: [
        'Open the Premium comparison workspace.',
        'Choose two account-saved captures and review their peaks and recording conditions.',
        'For a quick local experiment comparison, use the Field Guide on this device.',
      ],
      primary: { href: '/premium', label: 'Open Premium workspace' },
      secondary: { href: '/discover', label: 'Compare local captures' },
    }
    : {
      label: 'Compare previous sessions',
      title: 'Try a local comparison, or explore the Premium workspace.',
      summary: 'Compare two captures saved in this browser, or view the Premium account workspace for side-by-side comparison of account-saved observations.',
      steps: [
        'Open the Field Guide to compare local captures without uploading them.',
        'Use the Premium page to check eligibility and preview its private account workspace.',
        'Any paid service still shows its current quote before processing begins.',
      ],
      primary: { href: '/discover', label: 'Compare local captures' },
      secondary: { href: '/premium', label: 'Explore Premium workspace' },
    };
}
