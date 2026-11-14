# ZionCore Genesis Seed — Provenance and Change Log

## Immutable source archive

- **Source:** the file provided by the owner, preserved at
  `artifacts/zioncore-2nd/src/content/genesis-declaration.txt`
- **Version:** owner-provided original; no text revision applied
- **SHA-256:** `f87c324da247443bcf6ac4c6b799241e871abc3dec8aaa69c921cd123943f95e`
- **Size:** 172,275 bytes; 169,387 Unicode characters; 3,004 lines
- **Integrity check:** byte-for-byte comparison with the uploaded source
  succeeded; the automated test also recomputes the SHA-256.

The original wording, declarations, names, formulas, and structure have not
been edited. No spelling or grammar corrections have been applied to the
immutable archive. Any future correction that could affect meaning requires
the owner’s explicit approval and a separate versioned implementation copy.

## Runtime-context versions

| Version | Meaning |
| --- | --- |
| `1.1.0` | Existing compact operational-context modules found in the source. They were not the complete original archive and must not be described as such. |
| `1.2.0` | Adds explicit source-path and SHA-256 provenance, identifies the runtime content as bounded derived context, and corrects the prior prompt’s misleading claim that its derived character count was the full source-seed length. The original archive is unchanged. |
| `1.3.0` | Bounds each provider request to 8,000 characters, includes only a compact operational policy and relevant excerpts, avoids sending unrelated family details, and routes ZionCore 2nd AI through the authenticated, quoted backend service. The original archive is unchanged. |

### Exact implementation corrections in 1.2.0

1. Added the immutable source path and SHA-256 to the runtime context metadata.
2. Replaced the inaccurate “full seed” character-count wording with an explicit
   statement that the request receives bounded operational context and does not
   replace or rewrite the source archive.
3. Renamed the runtime character counter to
   `countGenesisOperationalContextCharacters`; retained the former exported
   function as a deprecated compatibility alias.
4. Added automated assertions for the original archive hash, byte size, runtime
   version, source provenance, and bounded-context disclosure.

These corrections apply only to runtime metadata and tests. They do not modify,
paraphrase, or substitute for the owner-provided source file.

### Exact implementation corrections in 1.3.0

1. Replaced the previous oversized runtime-context insertion with a source-linked
   operational policy, bounded baseline guidance, and up to three relevant
   excerpts. Provider context is capped at 8,000 characters.
2. Kept the founder attribution as internal project provenance and stopped
   including unrelated family names in routine provider requests.
3. Corrected the deterministic-profile boundary from language that could be read
   as permitting source identification to an explicit statement that it cannot
   identify a source, cause, message, or spiritual meaning.
4. Routed ZionCore 2nd interpretations through the shared authenticated API,
   strict App Check token acquisition, price quote, explicit credit confirmation,
   and idempotent recovery path. Raw microphone audio and notes remain excluded.
5. Relaxed the API contract so advanced derived features may be omitted when the
   client does not measure them; the server prompt now explicitly forbids
   inferring missing features.

These changes affect runtime context, request validation, and tests only. The
owner-provided archive remains byte-for-byte unchanged.
