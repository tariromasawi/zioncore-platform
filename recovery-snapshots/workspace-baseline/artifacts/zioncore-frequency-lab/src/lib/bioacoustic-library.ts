export type BioacousticLicenseCategory =
  | 'recording-specific'
  | 'permission-required'
  | 'safety-policy';

export type BioacousticSourceReference = {
  label: string;
  url: string;
};

export type BioacousticLibraryEntry = {
  id: string;
  name: string;
  publisher: string;
  kind: 'recording-catalog' | 'media-archive' | 'location-policy';
  taxa: string[];
  licenseCategory: BioacousticLicenseCategory;
  licenseSummary: string;
  speciesContext: string;
  locationHandling: string;
  identificationUncertainty: string;
  attribution: string;
  mediaIncluded: false;
  reviewedOn: string;
  references: BioacousticSourceReference[];
};

/**
 * Reviewed source directory only. No third-party recordings or API responses
 * are copied into this app; reuse must be checked against each source item.
 */
export const BIOACOUSTIC_LIBRARY: readonly BioacousticLibraryEntry[] = [
  {
    id: 'xeno-canto-recordings',
    name: 'Xeno-canto recording catalog',
    publisher: 'Xeno-canto',
    kind: 'recording-catalog',
    taxa: ['Birds', 'Grasshoppers', 'Bats'],
    licenseCategory: 'recording-specific',
    licenseSummary: 'Licenses are selected per recording. Check that recording’s license, attribution requirements, commercial-use terms, and derivative-work conditions before reuse; the catalog is not a blanket license.',
    speciesContext: 'The recordist is responsible for the identification. Item metadata can mark an identification as questioned, unconfirmed, or unidentified; background species and annotations may also be incomplete.',
    locationHandling: 'Recording metadata may expose locality and coordinates. Do not copy precise locations into shared records; apply a source-sensitive species review and retain only a coarse region when sharing is authorized.',
    identificationUncertainty: 'Treat the recordist’s species label and any annotation as a claim with source-specific status, not as independently verified ground truth.',
    attribution: 'Preserve the recordist, catalog number, and exact item-level license when a recording is used under its terms.',
    mediaIncluded: false,
    reviewedOn: '2026-11-12',
    references: [
      { label: 'Xeno-canto terms and recording licenses', url: 'https://xeno-canto.org/about/terms' },
      { label: 'Xeno-canto API fields and access requirements', url: 'https://xeno-canto.org/explore/api' },
      { label: 'Xeno-canto search and license fields', url: 'https://xeno-canto.org/help/search' },
    ],
  },
  {
    id: 'macaulay-library-media',
    name: 'Macaulay Library media archive',
    publisher: 'Cornell Lab of Ornithology',
    kind: 'media-archive',
    taxa: ['Birds', 'Other wildlife'],
    licenseCategory: 'permission-required',
    licenseSummary: 'Public listening or viewing does not grant download or reuse rights. Media requests and licensing are handled by the archive; embedding is subject to its stated non-commercial conditions. Verify permission for the exact asset and intended use.',
    speciesContext: 'A broad natural-history archive, not a single standardized experimental dataset. Media descriptions and species labels should be interpreted in the context supplied for each asset.',
    locationHandling: 'Access and display of location details vary. Do not infer that publicly viewable media includes permission to disclose exact collection coordinates.',
    identificationUncertainty: 'Use the item’s own metadata and review status. A catalog label alone does not establish that the sound is a clean or behaviorally contextualized species sample.',
    attribution: 'Follow the archive’s asset-specific permission and credit instructions; do not redistribute audio based only on public playback access.',
    mediaIncluded: false,
    reviewedOn: '2026-11-12',
    references: [
      { label: 'Macaulay Library media access and requests', url: 'https://support.ebird.org/en/support/solutions/articles/48001064551-using-and-requesting-media' },
      { label: 'eBird media copyright and upload FAQ', url: 'https://support.ebird.org/en/support/solutions/articles/48000960529-ebird-media-upload-faq' },
    ],
  },
  {
    id: 'ebird-sensitive-species-guidance',
    name: 'Sensitive-species location guidance',
    publisher: 'eBird / Cornell Lab of Ornithology',
    kind: 'location-policy',
    taxa: ['Birds'],
    licenseCategory: 'safety-policy',
    licenseSummary: 'This is a conservation and location-handling reference, not a license to use recordings or occurrence data. Check the current source policy and any data-product terms separately.',
    speciesContext: 'The source describes species whose public site-level records could create risks such as targeted capture or disturbance. Treatments can differ by region and season.',
    locationHandling: 'Follow source-specific restrictions and suppress exact locations for potentially sensitive observations. This policy is guidance for risk review, not a complete universal sensitivity list.',
    identificationUncertainty: 'Do not infer sensitivity or safety from rarity alone; the source describes threat-based criteria and contextual review.',
    attribution: 'Cite the current eBird policy when applying it as a research or data-handling reference.',
    mediaIncluded: false,
    reviewedOn: '2026-11-12',
    references: [
      { label: 'eBird Sensitive Species policy', url: 'https://support.ebird.org/en/support/solutions/articles/48000803210-sensitive-species-in-ebird' },
      { label: 'eBird privacy and data-use guidance', url: 'https://support.ebird.org/en/support/solutions/articles/48001078113-how-can-your-ebird-data-be-used-' },
    ],
  },
];

export function filterBioacousticLibrary(
  entries: readonly BioacousticLibraryEntry[],
  query: string,
  category: BioacousticLicenseCategory | 'all' = 'all',
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return entries.filter(entry => {
    const matchesCategory = category === 'all' || entry.licenseCategory === category;
    if (!matchesCategory) return false;
    if (!normalizedQuery) return true;
    const searchable = [
      entry.name,
      entry.publisher,
      entry.kind,
      entry.licenseSummary,
      entry.speciesContext,
      entry.locationHandling,
      entry.identificationUncertainty,
      ...entry.taxa,
    ].join(' ').toLocaleLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

export function validateBioacousticLibrary(entries: readonly BioacousticLibraryEntry[]) {
  const ids = new Set<string>();
  return entries.every(entry => {
    const valid = entry.id.trim().length > 0
      && !ids.has(entry.id)
      && entry.name.trim().length > 0
      && entry.taxa.length > 0
      && entry.licenseSummary.trim().length > 0
      && entry.speciesContext.trim().length > 0
      && entry.locationHandling.trim().length > 0
      && entry.identificationUncertainty.trim().length > 0
      && entry.attribution.trim().length > 0
      && entry.mediaIncluded === false
      && /^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedOn)
      && entry.references.length > 0
      && entry.references.every(reference => {
        try {
          return new URL(reference.url).protocol === 'https:';
        } catch {
          return false;
        }
      });
    ids.add(entry.id);
    return valid;
  });
}
