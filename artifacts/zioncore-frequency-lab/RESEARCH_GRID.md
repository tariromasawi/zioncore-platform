# ZionCore research grid

## Current architecture

The customer flow remains the existing signed-in Celestial Exploration page. Its working `ResearchSession` shape is retained for compatibility; saved records now carry an optional, versioned `universalExperiment` (`zc-cig-experiment/v1`) with participant reference, domain, methods, instruments, source references, encoded signal metadata, transmission status, normalized observations, analysis provenance, findings, and limitations. Older local records are accepted and receive a derived experiment object on read without being rewritten until a later save.

`ResearchGridRegistry` manages versioned domain and method definitions and notifies the UI when plugins register. `SignalAdapterRegistry` validates and normalizes measurements into named values with units and adapter provenance. `InstrumentRegistry` describes device capabilities, discovers devices, requests access only on acquisition, returns calibration/settings metadata, and releases resources. The live browser-microphone adapter is the only connected physical instrument. It is explicitly uncalibrated; device labels and identifiers are not stored.

`ResearchAgentRouter` selects compatible handlers by task, modality, cost estimate, enabled state, and consent. The current executable handler is deterministic, local acoustic statistics at an estimated cost of $0. The router supports asynchronous provider agents, but no external AI agent is currently registered or invoked.

## Extension contract

1. Register a domain with its version, research framing, and supported modalities.
2. Register methods against domains, including their modality and method kind.
3. Implement a signal adapter that validates its input and returns normalized, unit-labelled observations with provenance.
4. Implement an instrument adapter with discovery, acquisition, release, capabilities, and calibration metadata. Mark synthetic sources as `simulated`; production registries reject them.
5. Add a research agent with declared tasks, modalities, cost estimate, consent requirement, executable handler, and schema-valid output.
6. Add verification tests before connecting the adapter to a customer workflow.

Modality identifiers include acoustic, biological-acoustic, electromagnetic, geophysical, radio-astronomy, symbolic, multimodal, and unknown. These identifiers make extension possible; they do not mean corresponding sensors or datasets are connected.

## Proposed low-cost instrument concept (not built)

**ZC-A1 field acoustic bridge:** a USB-C, receive-only device using a matched two-channel microphone front end, a low-noise preamplifier, anti-alias filtering, and a USB Audio Class interface. Firmware should expose sample format, sample rate, channel count, gain state, clock/timestamp source, device revision, and a signed calibration-profile reference. The adapter would report relative acoustic features unless a traceable calibration profile is present. No RF transmitter is part of this concept. This is a design direction only; no board, firmware, calibration procedure, or connected device has been built or tested.

## Boundaries

- The present instrument path measures browser-microphone acoustics and records summary values, not raw audio.
- Local speaker playback is not an external transmission. No radio or other hardware transmitter is connected.
- The research domain is a framing for the question; changing domains does not change what the microphone measures.
- Current research records remain in account-scoped browser storage, which is not encrypted. Do not store sensitive family material there.
- Cloud persistence stays disabled for these records until production Firestore rules and existing callers are reviewed and safe.
- No generated signal or statistical pattern is presented as a received message, species translation, source identification, or evidence of intelligence.
