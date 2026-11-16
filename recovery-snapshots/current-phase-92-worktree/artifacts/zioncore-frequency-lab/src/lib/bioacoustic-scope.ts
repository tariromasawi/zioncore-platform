export const BIOACOUSTIC_SCOPE_VERSION = '1.0.0';

export const BIOACOUSTIC_REFERENCE_SOURCES = [
  {
    id: 'nps-yellowstone-sound-library',
    title: 'Yellowstone National Park Sound Library',
    url: 'https://www.nps.gov/yell/learn/photosmultimedia/soundlibrary.htm',
    rights: 'The NPS library page states its recordings are public domain and asks users to credit the National Park Service where appropriate.',
  },
  {
    id: 'usgs-walrus-point-lay-2024',
    title: 'Walrus Haulout Audio Recordings Near Point Lay, Alaska, 2024',
    url: 'https://data.usgs.gov/datacatalog/data/USGS%3A671bbdaed34efed56210c8a0',
    rights: 'The USGS catalog lists this data release as CC0 1.0 Universal and requests citation of the release.',
  },
] as const;

export type BioacousticReferenceSourceId =
  typeof BIOACOUSTIC_REFERENCE_SOURCES[number]['id'];

export const BIOACOUSTIC_REFERENCE_CLIPS = [
  {
    id: 'nps-american-robin',
    classId: 'bird-vocalization-event',
    title: 'American Robin',
    url: 'https://www.nps.gov/yell/learn/photosmultimedia/sounds-americanrobins.htm',
    sourceId: 'nps-yellowstone-sound-library',
  },
  {
    id: 'nps-dawn-chorus',
    classId: 'bird-vocalization-event',
    title: 'Dawn Chorus',
    url: 'https://www.nps.gov/yell/learn/photosmultimedia/sounds-birdchorus.htm',
    sourceId: 'nps-yellowstone-sound-library',
  },
  {
    id: 'nps-boreal-chorus-frogs',
    classId: 'amphibian-chorus-event',
    title: 'Boreal Chorus Frogs',
    url: 'https://www.nps.gov/yell/learn/photosmultimedia/sounds-chorusfrogs.htm',
    sourceId: 'nps-yellowstone-sound-library',
  },
  {
    id: 'usgs-walrus-haulout-2024',
    classId: 'walrus-haulout-vocalization-event',
    title: 'Walrus haulout recording collection',
    url: 'https://data.usgs.gov/datacatalog/data/USGS%3A671bbdaed34efed56210c8a0',
    sourceId: 'usgs-walrus-point-lay-2024',
  },
  {
    id: 'nps-old-faithful',
    classId: 'geothermal-sound-event',
    title: 'Old Faithful Geyser',
    url: 'https://www.nps.gov/yell/learn/photosmultimedia/sounds-oldfaithful.htm',
    sourceId: 'nps-yellowstone-sound-library',
  },
  {
    id: 'nps-thunder',
    classId: 'thunder-weather-event',
    title: 'Thunder',
    url: 'https://www.nps.gov/yell/learn/photosmultimedia/sounds-thunder.htm',
    sourceId: 'nps-yellowstone-sound-library',
  },
] as const;

export type BioacousticClassId =
  typeof BIOACOUSTIC_REFERENCE_CLIPS[number]['classId'];

export const BIOACOUSTIC_CLASS_CANDIDATES = [
  {
    id: 'bird-vocalization-event',
    label: 'Bird vocalization or chorus event',
    domain: 'animal',
    status: 'hypothesis-only',
    limit: 'No bird species, call type, behavior, or intent is validated.',
  },
  {
    id: 'amphibian-chorus-event',
    label: 'Amphibian chorus event',
    domain: 'animal',
    status: 'hypothesis-only',
    limit: 'No frog species, behavior, or intent is validated.',
  },
  {
    id: 'walrus-haulout-vocalization-event',
    label: 'Walrus haulout vocalization event',
    domain: 'animal',
    status: 'hypothesis-only',
    limit: 'This is a reference-corpus candidate, not a validated walrus detector.',
  },
  {
    id: 'geothermal-sound-event',
    label: 'Geyser or geothermal sound event',
    domain: 'environment',
    status: 'hypothesis-only',
    limit: 'No geothermal source or event is identified by measured features alone.',
  },
  {
    id: 'thunder-weather-event',
    label: 'Thunder or weather sound event',
    domain: 'environment',
    status: 'hypothesis-only',
    limit: 'No weather event is identified by measured features alone.',
  },
] as const;

export const BIOACOUSTIC_BENCHMARK_STATUS = {
  status: 'reference-links-curated-not-benchmarked',
  recordingsInRuntime: 0,
  evaluatedRecordings: 0,
  precision: null as number | null,
  recall: null as number | null,
  confidenceLimit:
    'The linked recordings are provenance candidates only. They are not bundled, used for training, or scored by ZionCore; real-world class precision and recall are not established.',
} as const;
