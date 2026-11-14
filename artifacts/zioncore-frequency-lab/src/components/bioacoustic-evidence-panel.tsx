import { Microscope } from 'lucide-react';
import {
  BIOACOUSTIC_BENCHMARK_STATUS,
  BIOACOUSTIC_CLASS_CANDIDATES,
  BIOACOUSTIC_REFERENCE_CLIPS,
  BIOACOUSTIC_REFERENCE_SOURCES,
} from '@/lib/bioacoustic-scope';

export default function BioacousticEvidencePanel() {
  return (
    <section className="zc-output-section zc-bioacoustic-evidence" data-testid="output-bioacoustic-evidence">
      <div className="zc-output-heading"><Microscope size={14} aria-hidden="true" /><h3>Animal &amp; environmental evidence scope</h3></div>
      <p>Measured signal families describe acoustic shape, not source identity. The classes below are exploratory hypotheses only; ZionCore has not benchmarked these reference recordings, so source-class precision and recall are not established.</p>
      <ul className="zc-bioacoustic-class-list">
        {BIOACOUSTIC_CLASS_CANDIDATES.map(candidate => (
          <li key={candidate.id}>
            <strong>{candidate.label}</strong>
            <span>Hypothesis only · {candidate.limit}</span>
          </li>
        ))}
      </ul>
      <p className="zc-bioacoustic-metrics" data-testid="bioacoustic-benchmark-status">
        Benchmark · {BIOACOUSTIC_BENCHMARK_STATUS.evaluatedRecordings} reference recordings scored · precision unavailable · recall unavailable.
      </p>
      <details className="zc-bioacoustic-references">
        <summary>Traceable reference sources and rights</summary>
        <ul className="zc-bioacoustic-reference-clips">
          {BIOACOUSTIC_REFERENCE_CLIPS.map(reference => (
            <li key={reference.id}>
              <a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.title}</a>
              <span>{BIOACOUSTIC_CLASS_CANDIDATES.find(candidate => candidate.id === reference.classId)?.label}</span>
            </li>
          ))}
        </ul>
        <ul className="zc-bioacoustic-source-rights">
          {BIOACOUSTIC_REFERENCE_SOURCES.map(source => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
              <span>{source.rights}</span>
            </li>
          ))}
        </ul>
        <small>These are provenance links only; their audio has not been copied into ZionCore or used for training or evaluation.</small>
      </details>
    </section>
  );
}
