import React from 'react';
import { Link } from 'wouter';
import type { FrontierReport } from '@/lib/frontier-discovery';
import type { FreeListeningInput } from '@/lib/free-listening';
import { buildListeningDossier } from '@/lib/listening-dossier';

export default function ComprehensiveListeningReport({ input, report, context, aiResult }: {
  input: FreeListeningInput; report: FrontierReport; context: string;
  aiResult: { insight: { reflection: string; question: string; nextStep: string; model: string }; snapshot: FrontierReport } | null;
}) {
  const dossier = buildListeningDossier(input, report, context);
  return <section className="zc-free-block measured zc-listening-dossier" aria-label="Comprehensive free listening report" data-testid="comprehensive-free-report">
    <div className="zc-free-tag">ZionCore · Free resonance experience</div>
    <h4 data-testid="text-resonance-title">{dossier.title}</h4>
    <p className="zc-dossier-theme">{dossier.theme}</p>
    <p>{dossier.overview}</p>
    <div className="zc-dossier-session" aria-label="Session reference">
      <span>Session · {input.durationSeconds.toFixed(1)}s</span>
      <span>{input.captureSource === 'microphone' ? 'Live snapshot' : 'Local capture'}</span>
      <span>On your device</span>
    </div>
    <p className="zc-dossier-invitation">Your discovery begins here. Explore the signal, the ideas it opens and the next question you choose.</p>
    {dossier.chapters.map((chapter, index) => <section key={chapter.id} aria-label={chapter.title}
      className="zc-dossier-chapter" data-testid={['environment', 'animal', 'spiritual', 'celestial'].includes(chapter.id) ? `dossier-perspective-${chapter.id}` : `dossier-chapter-${chapter.id}`}>
      <span className="zc-dossier-label">{String(index + 1).padStart(2, '0')} · {chapter.kind}</span>
      <h5>{chapter.title}</h5>
      {chapter.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      {chapter.id === 'language' && <dl className="zc-dossier-structure">{dossier.universalLanguage.map(term =>
        <div key={term.name}><dt>{term.name}</dt><dd>{term.detail}</dd></div>)}</dl>}
      {chapter.id === 'next' && <>
        <p><strong>Your research question. </strong>{report.experiment.question}</p>
        <div className="zc-dossier-links">
          <a href="#zc-fx-base">Compare another observation</a>
          <Link href="/messages">Create an acoustic message</Link>
          <a href="#interpretation">Explore a deeper interpretation</a>
        </div>
      </>}
    </section>)}
    <details className="zc-dossier-method" data-testid="details-report-measurements">
      <summary>Explore your measurements and how this reading is created</summary>
      <p className="zc-dossier-scope">{dossier.coverage}</p>
      <ul>{report.reading.observations.map((observation, index) =>
        <li key={index} data-testid={`text-free-observation-${index}`}>{observation}</li>)}</ul>
      <dl className="zc-dossier-structure">{dossier.acousticStructure.map(item =>
        <div key={item.name}><dt>{item.name}</dt><dd>{item.detail}</dd></div>)}</dl>
      <p>This reading combines measured signal descriptors, educational connections, investigative possibilities and personal or devotional reflections. Source identification uses suitable reference evidence; decoded messages use a supported protocol and integrity check.</p>
      <p>RMS/dBFS describe the digital recording chain. Environmental sound-pressure level and sensor bandwidth require a calibrated instrument; FFT bin spacing describes the analysis grid. Exact digital zero also warrants a microphone selection/permission check with a comfortable test sound.</p>
      <p>{report.reading.method}</p>
      <ul>{report.reading.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
      <h6>Paths for further discovery</h6>
      <ol>{report.hypotheses.map((hypothesis, index) =>
        <li key={index}><p>{hypothesis.explanation}</p><p>{hypothesis.test}</p></li>)}</ol>
    </details>
    {aiResult && <section aria-label="On-device AI reflection">
      <h5>A further reflection from ZionCore</h5>
      <p className="zc-dossier-label">On-device AI · “{aiResult.snapshot.tool.title}” saved snapshot</p>
      <p>{aiResult.insight.reflection}</p><p><strong>Your question. </strong>{aiResult.insight.question}</p>
      <p><strong>Your next step. </strong>{aiResult.insight.nextStep}</p><p>Model: {aiResult.insight.model}</p>
    </section>}
    <section aria-label="Free report method and optional upgrades">
      <h5>Continue your resonance journey</h5>
      <p>{dossier.freeBoundary}</p>
      <p>Bring a new recording into a deeper AI-assisted exploration with contextual knowledge and personalised commentary. Discover Premium at <strong>£1/month</strong>; specialist AI services use separately purchased credits and show a quote for your approval before processing.</p>
      <div className="zc-dossier-links">
        <Link href="/premium">Explore Premium · £1/month</Link>
        <Link href="/wallet">View credit options</Link>
        <a href="#interpretation">See deeper interpretation prices</a>
        <a href="#zc-fx-ai">Explore optional on-device AI</a>
      </div>
      <p className="zc-dossier-invitation">ZionCore — listen beyond the ordinary. Every question can open a new discovery.</p>
    </section>
  </section>;
}
