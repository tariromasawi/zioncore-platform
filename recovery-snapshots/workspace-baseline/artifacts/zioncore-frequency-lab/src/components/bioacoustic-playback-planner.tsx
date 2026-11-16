import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Download, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { assessPlaybackStudy, playbackStudySchema, type PlaybackStudyDraft } from '@/lib/playback-study';
import { downloadFile } from '@/lib/observations';
import './bioacoustic-playback-planner.css';

const defaultValues: PlaybackStudyDraft = {
  protocolName: '',
  targetTaxon: '',
  habitat: '',
  stimulusDescription: '',
  sourceRightsReviewed: false,
  playbackLevelDbSPL: undefined,
  ambientLevelDbA: undefined,
  measurementDistanceMeters: undefined,
  calibrationReference: '',
  trialDurationSeconds: undefined,
  trialsPerSession: undefined,
  sessionsPerDay: undefined,
  restIntervalSeconds: undefined,
  restIntervalRationale: '',
  baselinePlan: '',
  controlPlan: '',
  observerPlan: '',
  stopCriteria: '',
  localReviewReference: '',
  localRequirementsReviewed: false,
  locationPrivacyReviewed: false,
};

function StudyTextField({
  form,
  name,
  label,
  placeholder,
  multiline = false,
  description,
}: {
  form: ReturnType<typeof useForm<PlaybackStudyDraft>>;
  name: 'protocolName' | 'targetTaxon' | 'stimulusDescription' | 'calibrationReference' | 'baselinePlan' | 'controlPlan' | 'observerPlan' | 'stopCriteria' | 'localReviewReference' | 'restIntervalRationale';
  label: string;
  placeholder: string;
  multiline?: boolean;
  description?: string;
}) {
  return <FormField control={form.control} name={name} render={({ field }) => <FormItem className="playback-study-field">
    <FormLabel>{label}</FormLabel>
    <FormControl>
      {multiline
        ? <textarea {...field} value={field.value ?? ''} placeholder={placeholder} rows={3} data-testid={`input-playback-${name}`} />
        : <input {...field} value={field.value ?? ''} placeholder={placeholder} data-testid={`input-playback-${name}`} />}
    </FormControl>
    {description && <FormDescription>{description}</FormDescription>}
    <FormMessage />
  </FormItem>} />;
}

function StudyNumberField({
  form,
  name,
  label,
  unit,
  min,
  max,
  step = 1,
  description,
}: {
  form: ReturnType<typeof useForm<PlaybackStudyDraft>>;
  name: 'playbackLevelDbSPL' | 'ambientLevelDbA' | 'measurementDistanceMeters' | 'trialDurationSeconds' | 'trialsPerSession' | 'sessionsPerDay' | 'restIntervalSeconds';
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  description?: string;
}) {
  return <FormField control={form.control} name={name} render={({ field }) => <FormItem className="playback-study-field">
    <FormLabel>{label}</FormLabel>
    <FormControl><input
      ref={field.ref}
      name={field.name}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={typeof field.value === 'number' && Number.isFinite(field.value) ? field.value : ''}
      onBlur={field.onBlur}
      onChange={event => field.onChange(event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value))}
      placeholder="Required"
      data-testid={`input-playback-${name}`}
    /></FormControl>
    <span className="playback-study-unit">{unit}</span>
    {description && <FormDescription>{description}</FormDescription>}
    <FormMessage />
  </FormItem>} />;
}

function StudyCheck({
  form,
  name,
  label,
}: {
  form: ReturnType<typeof useForm<PlaybackStudyDraft>>;
  name: 'sourceRightsReviewed' | 'localRequirementsReviewed' | 'locationPrivacyReviewed';
  label: string;
}) {
  return <FormField control={form.control} name={name} render={({ field }) => <FormItem className="playback-study-check">
    <FormControl><input
      ref={field.ref}
      name={field.name}
      type="checkbox"
      checked={field.value === true}
      onBlur={field.onBlur}
      onChange={event => field.onChange(event.currentTarget.checked)}
      data-testid={`check-playback-${name}`}
    /></FormControl>
    <FormLabel>{label}</FormLabel>
    <FormMessage />
  </FormItem>} />;
}

export default function BioacousticPlaybackPlanner() {
  const form = useForm<PlaybackStudyDraft>({
    resolver: zodResolver(playbackStudySchema),
    defaultValues,
    mode: 'onChange',
  });
  const values = form.watch();
  const assessment = useMemo(() => assessPlaybackStudy(values), [values]);
  const [readinessChecked, setReadinessChecked] = useState(false);

  const exportReviewPlan = () => {
    const result = assessPlaybackStudy(form.getValues());
    if (!result.readyForQualifiedReview || !result.study) return;
    downloadFile(
      'zioncore-bioacoustic-playback-review-plan.json',
      JSON.stringify({
        schema: 'zioncore.bioacoustic-playback-review-plan',
        version: '1.0.0',
        status: 'ready-for-qualified-human-review',
        exportedAt: new Date().toISOString(),
        study: result.study,
        calculatedSchedule: {
          playbackSecondsPerDay: result.playbackSecondsPerDay,
          scheduledWindowSecondsPerDay: result.scheduledWindowSecondsPerDay,
          note: 'Arithmetic summary only; not a welfare or safety threshold.',
        },
        noPreciseSiteLocationCollected: true,
        limitations: [
          'This is a planning record, not ethical approval, a permit, or authorization to play sound.',
          'The app does not validate the submitted calibration, species-specific level, local legal requirements, or welfare decisions.',
          'No audio was generated, played, transmitted, uploaded, or saved by this planner.',
        ],
      }, null, 2),
      'application/json',
    );
  };

  const checkReadiness = async () => {
    setReadinessChecked(true);
    await form.trigger();
  };

  return <section className="playback-study-section" id="bio-playback-plan" aria-labelledby="playback-study-title">
    <div className="bio-analysis-heading">
      <div><div className="eyebrow">Field-study planning · no playback</div><h2 id="playback-study-title">Prepare a welfare review plan.</h2></div>
      <span className="bio-analysis-local"><ShieldCheck size={14} />Review gate</span>
    </div>
    <p className="bio-analysis-intro">Record the intended level, exposure schedule, habitat and safeguards before proposing an animal playback study. A completed plan is only ready for qualified human review; ZionCore does not approve or initiate animal-directed playback.</p>

    <div className="playback-study-alert" role="note">
      <strong>Browser output is not a calibrated sound-pressure measurement.</strong>
      <span>Enter levels measured or justified for the target at the stated distance using suitable calibrated equipment. No universal “safe” wildlife playback level is assumed here.</span>
    </div>

    <Form {...form}>
      <div className="panel playback-study-panel">
        <div className="playback-study-grid">
          <StudyTextField form={form} name="protocolName" label="Study name" placeholder="Short protocol title" />
          <StudyTextField form={form} name="targetTaxon" label="Target species or taxon" placeholder="Use the most precise justified identification" />
          <FormField control={form.control} name="habitat" render={({ field }) => <FormItem className="playback-study-field">
            <FormLabel>Habitat / setting</FormLabel>
            <FormControl><select {...field} data-testid="select-playback-habitat">
              <option value="">Choose a setting</option>
              <option value="field">Field, unspecified</option>
              <option value="forest">Forest or woodland</option>
              <option value="grassland">Grassland or open land</option>
              <option value="wetland">Wetland</option>
              <option value="freshwater">Freshwater</option>
              <option value="marine">Marine or coastal</option>
              <option value="captive">Captive setting</option>
              <option value="laboratory">Laboratory</option>
              <option value="other">Other</option>
            </select></FormControl>
            <FormMessage />
          </FormItem>} />
          <StudyTextField form={form} name="stimulusDescription" label="Stimulus and provenance" placeholder="Describe signal, source, and intended control" multiline />
          <StudyNumberField form={form} name="playbackLevelDbSPL" label="Planned level at subject" unit="dB SPL" min={0} max={200} step={0.1} description="Study-specific target level; not a safe-level recommendation." />
          <StudyNumberField form={form} name="ambientLevelDbA" label="Ambient baseline level" unit="dB(A)" min={0} max={200} step={0.1} />
          <StudyNumberField form={form} name="measurementDistanceMeters" label="Measurement distance" unit="metres" min={0.01} max={100_000} step={0.01} />
          <StudyTextField form={form} name="calibrationReference" label="Meter / calibration reference" placeholder="Equipment, calibration date, and method" description="Do not use the browser volume slider as an SPL meter." />
          <StudyNumberField form={form} name="trialDurationSeconds" label="Duration per trial" unit="seconds" min={0.1} max={3_600} step={0.1} />
          <StudyNumberField form={form} name="trialsPerSession" label="Trials per session" unit="trials" min={1} max={100} />
          <StudyNumberField form={form} name="sessionsPerDay" label="Sessions per day" unit="sessions" min={1} max={20} />
          <StudyNumberField form={form} name="restIntervalSeconds" label="Rest between trials" unit="seconds" min={0} max={86_400} description="Enter a justified interval; zero requires an explicit rationale." />
          {values.restIntervalSeconds === 0 && <StudyTextField form={form} name="restIntervalRationale" label="Why is there no rest?" placeholder="Give a protocol-specific justification for review" multiline />}
          <StudyTextField form={form} name="baselinePlan" label="Baseline observation" placeholder="How will pre-playback conditions be recorded?" multiline />
          <StudyTextField form={form} name="controlPlan" label="Control condition" placeholder="Describe silent, ambient, or other justified control" multiline />
          <StudyTextField form={form} name="observerPlan" label="Observer and monitoring" placeholder="Who will monitor the animals and stop conditions?" multiline />
          <StudyTextField form={form} name="stopCriteria" label="Immediate stop criteria" placeholder="Species-appropriate signs that halt the trial" multiline description="Define observable response signs with a qualified species expert." />
          <StudyTextField form={form} name="localReviewReference" label="Permit / ethics review reference" placeholder="Approval ID or documented exemption basis" />
        </div>

        <div className="playback-study-checklist" aria-label="Required welfare and permission checks">
          <StudyCheck form={form} name="sourceRightsReviewed" label="I reviewed stimulus ownership, licenses, and permissions." />
          <StudyCheck form={form} name="localRequirementsReviewed" label="I checked applicable animal-ethics and wildlife-permit requirements with the relevant authority." />
          <StudyCheck form={form} name="locationPrivacyReviewed" label="I reviewed site privacy and sensitive-species location handling; this plan contains no precise coordinates." />
        </div>

        <div className={`playback-study-status ${assessment.readyForQualifiedReview ? 'ready' : ''}`} role="status" aria-live="polite" data-testid="status-playback-study">
          <strong>{assessment.readyForQualifiedReview ? 'Ready for qualified human review — not approved.' : readinessChecked ? 'Plan needs more information.' : 'Complete the fields and safeguards to prepare a review record.'}</strong>
          {assessment.readyForQualifiedReview
            ? <span>Planned sound-on time: {assessment.playbackSecondsPerDay?.toFixed(1)} seconds/day. Scheduled window including rests: {assessment.scheduledWindowSecondsPerDay?.toFixed(1)} seconds/day. These are arithmetic totals, not welfare limits.</span>
            : readinessChecked && <ul>{assessment.issues.slice(0, 8).map(issue => <li key={issue}>{issue}</li>)}</ul>}
        </div>

        <div className="playback-study-actions">
          <button className="btn btn-subtle" type="button" onClick={() => void checkReadiness()} data-testid="button-check-playback-plan">Check review readiness</button>
          <button className="btn btn-primary" type="button" onClick={exportReviewPlan} disabled={!assessment.readyForQualifiedReview} data-testid="button-export-playback-plan"><Download size={14} />Export review plan</button>
        </div>
      </div>
    </Form>

    <div className="playback-study-guidance">
      <p>Local rules differ. A checklist completion does not establish ethical approval, legal permission, scientific validity, or safe exposure. Consider non-invasive passive observation first; minimize disturbance and stop immediately if the pre-defined criteria occur.</p>
      <div>
        <a href="https://www.asab.org/ethics" target="_blank" rel="noopener noreferrer" data-testid="link-asab-playback-ethics">ASAB ethics guidance</a>
        <a href="https://www.latrobe.edu.au/research/researcher-support/documents/AEC-Guide-for-Wildlife-Researchers_v1_July-2023.pdf" target="_blank" rel="noopener noreferrer" data-testid="link-latrobe-wildlife-guide">La Trobe wildlife AEC guide (local example)</a>
      </div>
    </div>
  </section>;
}
