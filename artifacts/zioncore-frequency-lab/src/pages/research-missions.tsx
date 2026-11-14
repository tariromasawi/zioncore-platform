import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive, Check, CheckCircle2, ChevronRight, Circle, Download, FileJson2,
  FlaskConical, Pause, Play, Plus, Save, ShieldAlert, Trash2,
} from 'lucide-react';
import {
  createResearchMission,
  PERSISTENT_MISSION_DOMAINS,
  readResearchMissions,
  RESEARCH_MISSION_STATUSES,
  researchMissionSchema,
  upsertResearchMission,
  writeResearchMissions,
  type ResearchMission,
  type ResearchMissionStep,
} from '@/lib/research-missions';
import { downloadFile } from '@/lib/observations';

type Props = { scopeRef: string };

const domainNames: Record<(typeof PERSISTENT_MISSION_DOMAINS)[number], string> = {
  'celestial-exploration': 'Celestial exploration',
  'environmental-interaction': 'Environmental interaction',
  'unknown-intelligence': 'Unknown intelligence',
  'bioacoustic-analysis': 'Bioacoustic analysis',
  'astronomical-data-review': 'Astronomical data review',
  'acoustic-protocol-research': 'Acoustic protocol research',
};

const statusNames: Record<(typeof RESEARCH_MISSION_STATUSES)[number], string> = {
  planned: 'Planned',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

const STEP_LIMIT = 12;

function issueText(path: PropertyKey[], message: string) {
  if (path[0] === 'steps' && typeof path[1] === 'number') {
    return `Step ${path[1] + 1}: ${message}`;
  }
  if (path[0] === 'budget') return `Budget: ${message}`;
  if (path[0] === 'consent') return `Planning consent: ${message}`;
  return message;
}

function copyMission(mission: ResearchMission): ResearchMission {
  return {
    ...mission,
    steps: mission.steps.map(step => ({ ...step })),
    budget: { ...mission.budget },
    consent: { ...mission.consent },
  };
}

export default function ResearchMissionsPage({ scopeRef }: Props) {
  const [missions, setMissions] = useState<ResearchMission[]>([]);
  const [draft, setDraft] = useState<ResearchMission | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [storageError, setStorageError] = useState('');
  const [notice, setNotice] = useState('');
  const [savedFingerprint, setSavedFingerprint] = useState('');

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    setDraft(null);
    setSelectedId('');
    try {
      const stored = readResearchMissions(scopeRef);
      setMissions(stored);
      setLoading(false);
    } catch (cause) {
      setMissions([]);
      setLoadError(cause instanceof Error ? cause.message : 'The mission archive could not be read.');
      setLoading(false);
    }
  }, [scopeRef]);

  const currentFingerprint = useMemo(() => draft ? JSON.stringify(draft) : '', [draft]);
  const hasUnsavedChanges = Boolean(draft && currentFingerprint !== savedFingerprint);
  const activeCount = missions.filter(item => item.status !== 'archived').length;

  const startNew = () => {
    if (loading || loadError) return;
    const mission = createResearchMission();
    setDraft(mission);
    setSelectedId(mission.id);
    setSavedFingerprint('');
    setValidationErrors([]);
    setStorageError('');
    setNotice('');
  };

  const selectMission = (mission: ResearchMission) => {
    setDraft(copyMission(mission));
    setSelectedId(mission.id);
    setSavedFingerprint(JSON.stringify(mission));
    setValidationErrors([]);
    setStorageError('');
    setNotice('');
  };

  const updateDraft = (transform: (mission: ResearchMission) => ResearchMission) => {
    setDraft(current => current ? transform(current) : current);
    setValidationErrors([]);
    setStorageError('');
    setNotice('');
  };

  const addStep = () => {
    if (!draft || draft.steps.length >= STEP_LIMIT) return;
    const step: ResearchMissionStep = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      status: 'pending',
    };
    updateDraft(current => ({ ...current, steps: [...current.steps, step] }));
  };

  const updateStep = (stepId: string, updates: Partial<ResearchMissionStep>) => {
    updateDraft(current => ({
      ...current,
      steps: current.steps.map(step => step.id === stepId ? { ...step, ...updates } : step),
    }));
  };

  const moveStep = (stepId: string, direction: -1 | 1) => {
    updateDraft(current => {
      const index = current.steps.findIndex(step => step.id === stepId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.steps.length) return current;
      const steps = [...current.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps };
    });
  };

  const removeStep = (stepId: string) => {
    if (!draft || draft.steps.length <= 1) return;
    updateDraft(current => ({ ...current, steps: current.steps.filter(step => step.id !== stepId) }));
  };

  const saveMission = () => {
    if (!draft || loading || loadError) return;
    const candidate = { ...draft, updatedAt: new Date().toISOString() };
    const validation = researchMissionSchema.safeParse(candidate);
    if (!validation.success) {
      setValidationErrors(validation.error.issues.map(issue => issueText(issue.path, issue.message)));
      setStorageError('');
      setNotice('');
      return;
    }
    try {
      const next = upsertResearchMission(missions, validation.data);
      writeResearchMissions(scopeRef, next);
      setMissions(next);
      setDraft(copyMission(validation.data));
      setSavedFingerprint(JSON.stringify(validation.data));
      setValidationErrors([]);
      setStorageError('');
      setNotice('Mission saved to this browser.');
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : 'The mission could not be saved. Your draft is still here.');
      setNotice('');
    }
  };

  const reloadArchive = () => {
    setLoadError('');
    setStorageError('');
    try {
      const stored = readResearchMissions(scopeRef);
      setMissions(stored);
      if (selectedId) {
        const selected = stored.find(item => item.id === selectedId);
        if (selected) selectMission(selected);
        else {
          setDraft(null);
          setSelectedId('');
          setSavedFingerprint('');
        }
      }
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'The mission archive could not be read.');
    }
  };

  const exportSelected = () => {
    const saved = missions.find(item => item.id === selectedId);
    if (!saved) return;
    downloadFile(`zioncore-mission-${saved.id}.json`, JSON.stringify(saved, null, 2), 'application/json');
    setNotice('Saved mission JSON exported.');
  };

  const exportArchive = () => {
    downloadFile(
      'zioncore-mission-archive.json',
      JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), missions }, null, 2),
      'application/json',
    );
    setNotice('Mission archive JSON exported.');
  };

  const setConsent = (key: 'localProcessing' | 'cloudAiRequests', value: boolean) => {
    updateDraft(current => ({
      ...current,
      consent: { ...current.consent, [key]: value, recordedAt: new Date().toISOString() },
    }));
  };

  return (
    <main className="missions-page" id="main-content" tabIndex={-1}>
      <div className="missions-wrap">
        <header className="missions-heading">
          <div className="missions-kicker"><span className="kicker-rule" />Research planning / 04</div>
          <div className="missions-title-row">
            <div>
              <h1>Questions, made careful.</h1>
              <p className="missions-intro">
                Shape a question into an editable observation plan. This workspace stores plans only;
                measured results and interpretations belong in separate records.
              </p>
            </div>
            <div className="mission-index" aria-label={`${activeCount} unarchived missions`}>
              <span className="index-number">{String(activeCount).padStart(2, '0')}</span>
              <span>in the<br />working set</span>
            </div>
          </div>
        </header>

        <section className="mission-safety" aria-label="Storage and safety information" data-testid="notice-mission-safety">
          <div className="safety-icon"><ShieldAlert size={19} /></div>
          <div>
            <strong>Local does not mean encrypted.</strong>
            <p>Plans are saved unencrypted in this browser, under the provided account or anonymous scope. Do not enter prayer intentions, family details, or other sensitive content. Devotional use belongs in the existing temporary devotional workspace.</p>
          </div>
        </section>

        <div className="missions-layout">
          <aside className="archive-column" aria-label="Mission archive">
            <div className="archive-top">
              <div>
                <div className="section-index">01 / ARCHIVE</div>
                <h2>Research missions</h2>
              </div>
              <button className="mission-icon-button" type="button" onClick={startNew} disabled={loading || Boolean(loadError)} aria-label="Create a new mission" data-testid="button-create-mission">
                <Plus size={18} />
              </button>
            </div>
            <button className="mission-button mission-new-button" type="button" onClick={startNew} disabled={loading || Boolean(loadError)} data-testid="button-new-mission">
              <Plus size={15} /> New mission
            </button>
            <div className="archive-list" data-testid="list-missions">
              {loading ? (
                <div className="archive-skeleton" role="status" aria-label="Loading missions">
                  <span /><span /><span />
                </div>
              ) : loadError ? (
                <div className="archive-error" role="alert" data-testid="status-archive-error">
                  <p>{loadError}</p>
                  <button className="mission-text-button" type="button" onClick={reloadArchive} data-testid="button-retry-archive">Try reading again</button>
                </div>
              ) : missions.length ? missions.map(mission => (
                <button
                  className={`mission-list-item ${selectedId === mission.id ? 'selected' : ''} ${mission.status === 'archived' ? 'archived' : ''}`}
                  type="button"
                  key={mission.id}
                  onClick={() => selectMission(mission)}
                  aria-current={selectedId === mission.id ? 'true' : undefined}
                  data-testid={`button-select-mission-${mission.id}`}
                >
                  <span className="list-item-top">
                    <span className={`status-mark status-${mission.status}`} />
                    <span className="mission-status-label">{statusNames[mission.status]}</span>
                    <ChevronRight size={15} />
                  </span>
                  <strong>{mission.title}</strong>
                  <span className="list-item-domain">{domainNames[mission.domainId]}</span>
                  <span className="list-item-meta">{mission.steps.filter(step => step.status === 'completed').length} / {mission.steps.length} steps complete</span>
                </button>
              )) : (
                <div className="archive-empty" data-testid="empty-mission-archive">
                  <div className="empty-mark"><FlaskConical size={20} /></div>
                  <strong>No plans in the archive.</strong>
                  <p>Start with one specific question. Nothing runs until you separately choose an available action.</p>
                </div>
              )}
            </div>
            <div className="archive-footer">
              <span>{missions.length} / 50 records</span>
              <button className="mission-text-button" type="button" disabled={!missions.length} onClick={exportArchive} data-testid="button-export-archive">
                <Download size={13} /> Export archive
              </button>
            </div>
          </aside>

          <section className="editor-column" aria-label="Mission editor">
            {!draft ? (
              <div className="editor-empty" data-testid="empty-mission-editor">
                <div className="editor-empty-symbol"><span>?</span></div>
                <div className="section-index">PLANNING DESK</div>
                <h2>A plan is not a result.</h2>
                <p>Select a saved mission to revise it, or begin a new plan. Each record keeps its question, intended steps, limits, and planning choices together.</p>
                    <button className="mission-button mission-primary" type="button" onClick={startNew} disabled={loading || Boolean(loadError)} data-testid="button-start-planning">
                  <Plus size={15} /> Start a research plan
                </button>
              </div>
            ) : (
              <>
                <div className="editor-header">
                  <div>
                    <div className="section-index">02 / PLAN DETAILS <span className="header-divider">—</span> {draft.id.slice(0, 8).toUpperCase()}</div>
                    <div className="editor-title-line">
                      <input
                        className="mission-title-input"
                        aria-label="Mission title"
                        value={draft.title}
                        maxLength={120}
                        onChange={event => updateDraft(current => ({ ...current, title: event.target.value }))}
                        data-testid="input-mission-title"
                      />
                      {hasUnsavedChanges && <span className="unsaved-label" data-testid="status-unsaved">Unsaved edits</span>}
                    </div>
                  </div>
                  {missions.some(mission => mission.id === selectedId) && (
                    <button className="mission-icon-button export-one" type="button" onClick={exportSelected} aria-label="Export saved mission as JSON" title="Export saved mission" data-testid="button-export-mission">
                      <FileJson2 size={17} />
                    </button>
                  )}
                </div>

                <div className="editor-content">
                  <div className="field-grid">
                    <label className="mission-field">
                      <span className="field-label">Research domain</span>
                      <select
                        value={draft.domainId}
                        onChange={event => updateDraft(current => ({ ...current, domainId: event.target.value as ResearchMission['domainId'] }))}
                        data-testid="select-mission-domain"
                      >
                        {PERSISTENT_MISSION_DOMAINS.map(domain => <option value={domain} key={domain}>{domainNames[domain]}</option>)}
                      </select>
                    </label>
                    <label className="mission-field">
                      <span className="field-label">Plan status</span>
                      <select
                        value={draft.status}
                        onChange={event => updateDraft(current => ({ ...current, status: event.target.value as ResearchMission['status'] }))}
                        data-testid="select-mission-status"
                      >
                        {RESEARCH_MISSION_STATUSES.map(status => <option value={status} key={status}>{statusNames[status]}</option>)}
                      </select>
                    </label>
                  </div>

                  {draft.status !== 'archived' && (
                    <div className="workflow-actions" aria-label="Mission status shortcuts">
                      {draft.status === 'paused' ? (
                        <button type="button" className="workflow-button" onClick={() => updateDraft(current => ({ ...current, status: 'active' }))} data-testid="button-resume-mission"><Play size={14} /> Resume plan</button>
                      ) : (
                        <button type="button" className="workflow-button" onClick={() => updateDraft(current => ({ ...current, status: 'paused' }))} data-testid="button-pause-mission"><Pause size={14} /> Pause plan</button>
                      )}
                      <button type="button" className="workflow-button workflow-archive" onClick={() => updateDraft(current => ({ ...current, status: 'archived' }))} data-testid="button-archive-mission"><Archive size={14} /> Archive</button>
                    </div>
                  )}

                  <label className="mission-field objective-field">
                    <span className="field-label">Objective <span>What question will this plan help examine?</span></span>
                    <textarea
                      value={draft.objective}
                      maxLength={1200}
                      rows={4}
                      onChange={event => updateDraft(current => ({ ...current, objective: event.target.value }))}
                      placeholder="State the question, the observable evidence, and what would count as a useful comparison."
                      data-testid="input-mission-objective"
                    />
                    <span className="field-counter">{draft.objective.length} / 1,200</span>
                  </label>

                  <section className="steps-section" aria-labelledby="steps-heading">
                    <div className="content-section-head">
                      <div>
                        <div className="section-index">03 / SEQUENCE</div>
                        <h3 id="steps-heading">Planned steps <span className="step-count">{draft.steps.length} / {STEP_LIMIT}</span></h3>
                      </div>
                      <button type="button" className="mission-button mission-add-step" onClick={addStep} disabled={draft.steps.length >= STEP_LIMIT} data-testid="button-add-step">
                        <Plus size={14} /> Add step
                      </button>
                    </div>
                    <ol className="step-list" data-testid="list-mission-steps">
                      {draft.steps.map((step, index) => (
                        <li key={step.id} className={`step-card ${step.status === 'completed' ? 'step-done' : ''}`} data-testid={`step-card-${step.id}`}>
                          <div className="step-number">{String(index + 1).padStart(2, '0')}</div>
                          <div className="step-fields">
                            <label className="sr-only" htmlFor={`step-title-${step.id}`}>Step {index + 1} title</label>
                            <input
                              id={`step-title-${step.id}`}
                              value={step.title}
                              maxLength={120}
                              onChange={event => updateStep(step.id, { title: event.target.value })}
                              placeholder={`Step ${index + 1} title`}
                              data-testid={`input-step-title-${step.id}`}
                            />
                            <label className="sr-only" htmlFor={`step-description-${step.id}`}>Step {index + 1} description</label>
                            <textarea
                              id={`step-description-${step.id}`}
                              value={step.description}
                              maxLength={600}
                              rows={2}
                              onChange={event => updateStep(step.id, { description: event.target.value })}
                              placeholder="Describe what would be done, without recording a result here."
                              data-testid={`input-step-description-${step.id}`}
                            />
                          </div>
                          <div className="step-controls">
                            <button type="button" className={`step-complete ${step.status === 'completed' ? 'is-complete' : ''}`} onClick={() => updateStep(step.id, { status: step.status === 'completed' ? 'pending' : 'completed' })} aria-label={`${step.status === 'completed' ? 'Mark' : 'Mark'} step ${index + 1} ${step.status === 'completed' ? 'pending' : 'complete'}`} title={step.status === 'completed' ? 'Mark pending' : 'Mark complete'} data-testid={`button-toggle-step-${step.id}`}>
                              {step.status === 'completed' ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                            </button>
                            <button type="button" className="step-order" disabled={index === 0} onClick={() => moveStep(step.id, -1)} aria-label={`Move step ${index + 1} earlier`} data-testid={`button-step-up-${step.id}`}>↑</button>
                            <button type="button" className="step-order" disabled={index === draft.steps.length - 1} onClick={() => moveStep(step.id, 1)} aria-label={`Move step ${index + 1} later`} data-testid={`button-step-down-${step.id}`}>↓</button>
                            <button type="button" className="step-remove" disabled={draft.steps.length <= 1} onClick={() => removeStep(step.id)} aria-label={`Remove step ${index + 1}`} data-testid={`button-remove-step-${step.id}`}><Trash2 size={14} /></button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>

                  <section className="budget-section" aria-labelledby="budget-heading">
                    <div className="content-section-head">
                      <div>
                        <div className="section-index">04 / LIMITS</div>
                        <h3 id="budget-heading">Planning budgets</h3>
                      </div>
                      <span className="planning-only">PLANNING METADATA</span>
                    </div>
                    <div className="budget-grid">
                      <label className="mission-field">
                        <span className="field-label">Observation windows <small>maximum 30</small></span>
                        <input type="number" min={1} max={30} step={1} value={draft.budget.maxObservationWindows} onChange={event => updateDraft(current => ({ ...current, budget: { ...current.budget, maxObservationWindows: Number(event.target.value) } }))} data-testid="input-observation-budget" />
                      </label>
                      <label className="mission-field">
                        <span className="field-label">Cloud AI requests <small>maximum 10</small></span>
                        <input type="number" min={0} max={10} step={1} value={draft.budget.maxCloudAiRequests} onChange={event => updateDraft(current => ({ ...current, budget: { ...current.budget, maxCloudAiRequests: Number(event.target.value) } }))} data-testid="input-cloud-request-budget" />
                      </label>
                      <label className="mission-field">
                        <span className="field-label">Planned USD ceiling <small>maximum $1.00</small></span>
                        <div className="currency-input"><span>$</span><input type="number" min={0} max={1} step="0.01" value={draft.budget.plannedCostCeilingUsd} onChange={event => updateDraft(current => ({ ...current, budget: { ...current.budget, plannedCostCeilingUsd: Number(event.target.value) } }))} data-testid="input-planned-cost-ceiling" /></div>
                      </label>
                    </div>
                    <p className="budget-warning">These limits do not enforce or authorize future work. Every future operation requires its own action consent and application gates.</p>
                  </section>

                  <section className="consent-section" aria-labelledby="consent-heading">
                    <div className="content-section-head">
                      <div>
                        <div className="section-index">05 / INTENT</div>
                        <h3 id="consent-heading">Planning choices</h3>
                      </div>
                    </div>
                    <label className="consent-row">
                      <input type="checkbox" checked={draft.consent.localProcessing} onChange={event => setConsent('localProcessing', event.target.checked)} data-testid="checkbox-consent-local" />
                      <span><strong>Plan for local processing</strong><small>This records a planning preference only. It does not start capture, access a device, or authorize an operation.</small></span>
                    </label>
                    <label className="consent-row">
                      <input type="checkbox" checked={draft.consent.cloudAiRequests} onChange={event => setConsent('cloudAiRequests', event.target.checked)} data-testid="checkbox-consent-cloud" />
                      <span><strong>Plan for possible cloud AI requests</strong><small>This is not a request or authorization. The currently available cloud AI path remains separately gated; each use needs its own consent, readiness checks, and action.</small></span>
                    </label>
                  </section>

                  {validationErrors.length > 0 && (
                    <div className="form-alert" role="alert" data-testid="status-validation-errors">
                      <strong>Review these fields before saving.</strong>
                      <ul>{validationErrors.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>
                    </div>
                  )}
                  {storageError && <div className="form-alert" role="alert" data-testid="status-storage-error"><strong>Not saved.</strong><p>{storageError}</p><span>Your edits remain in the form. Check browser storage and retry, or copy the plan text before leaving.</span></div>}
                  {notice && <div className="form-success" role="status" data-testid="status-mission-notice"><Check size={15} />{notice}</div>}

                  <footer className="editor-footer">
                    <div className="footer-meta">
                      <span>Created {new Date(draft.createdAt).toLocaleDateString()}</span>
                      <span>Results are not recorded here</span>
                    </div>
                    <button className="mission-button mission-primary save-button" type="button" onClick={saveMission} disabled={loading || Boolean(loadError)} data-testid="button-save-mission">
                      <Save size={15} /> Save and validate
                    </button>
                  </footer>
                </div>
              </>
            )}
          </section>
        </div>
        <footer className="missions-footnote">
          <span className="footnote-mark">FIELD NOTE</span>
          <p>Persistent missions accept only research domains. Devotional and ancestral domains are intentionally unavailable here. Keep measured observations separate from hypotheses and interpretations; no results or discoveries are implied by a plan.</p>
        </footer>
      </div>
    </main>
  );
}
