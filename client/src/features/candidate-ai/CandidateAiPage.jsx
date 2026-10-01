import { useMemo, useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { analyzeCandidate } from '@/features/candidate-ai/api';

const initialCandidate = {
  name: '',
  email: '',
  phone: '',
  currentRole: '',
  experience: '',
  skills: '',
  expectedSalary: '',
  noticePeriod: '',
  location: '',
  notes: ''
};

function fileToResumePayload(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return reject(new Error('Only PDF resume upload is supported right now.'));
    }
    if (file.size > 8 * 1024 * 1024) {
      return reject(new Error('Resume PDF must be 8 MB or smaller.'));
    }
    const reader = new FileReader();
    reader.onload = () => resolve({
      fileName: file.name,
      contentType: file.type || 'application/pdf',
      base64: String(reader.result || '').split(',')[1] || ''
    });
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function ResultList({ title, items = [] }) {
  if (!items.length) return null;
  return (
    <div className="candidate-ai-result-card">
      <h3>{title}</h3>
      <ul>
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}

export function CandidateAiPage() {
  const [jobRequirement, setJobRequirement] = useState('');
  const [candidate, setCandidate] = useState(initialCandidate);
  const [resumeFile, setResumeFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [result, setResult] = useState(null);

  const scoreTone = useMemo(() => {
    const score = Number(result?.score || 0);
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'danger';
  }, [result]);

  const updateCandidate = (field, value) => {
    setCandidate((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      const resume = await fileToResumePayload(resumeFile);
      const response = await analyzeCandidate({ candidate, jobRequirement, resume });
      setResult(response.data);
      setMessage({ tone: 'success', text: `AI analysis complete${response.model ? ` using ${response.model}` : ''}.` });
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message || 'Candidate analysis failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page-card candidate-ai-page">
      <header className="page-card__header">
        <div>
          <span className="eyebrow">HR AI Screening</span>
          <h1>AI Candidate Analyzer</h1>
          <p>Upload resume and candidate details, then compare against your job requirement to shortlist the best fit.</p>
        </div>
      </header>

      {message ? (
        <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
          <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>{message.tone === 'danger' ? 'Issue' : 'Done'}</StatusPill>
          <span>{message.text}</span>
          <button type="button" className="dashboard-banner__close" onClick={() => setMessage(null)}>OK</button>
        </div>
      ) : null}

      <form className="candidate-ai-layout" onSubmit={submit}>
        <article className="migration-panel candidate-ai-form">
          <h2>Candidate Input</h2>
          <label className="dashboard-control candidate-ai-full">
            <span>Job Requirement / JD</span>
            <textarea
              value={jobRequirement}
              onChange={(event) => setJobRequirement(event.target.value)}
              placeholder="Example: SEO Executive, 2+ years, keyword research, Google Search Console, client reporting..."
              required
            />
          </label>

          <label className="dashboard-control">
            <span>Candidate Name</span>
            <input value={candidate.name} onChange={(event) => updateCandidate('name', event.target.value)} placeholder="Candidate name" />
          </label>
          <label className="dashboard-control">
            <span>Email</span>
            <input value={candidate.email} onChange={(event) => updateCandidate('email', event.target.value)} placeholder="candidate@email.com" />
          </label>
          <label className="dashboard-control">
            <span>Phone</span>
            <input value={candidate.phone} onChange={(event) => updateCandidate('phone', event.target.value)} placeholder="Mobile number" />
          </label>
          <label className="dashboard-control">
            <span>Current Role</span>
            <input value={candidate.currentRole} onChange={(event) => updateCandidate('currentRole', event.target.value)} placeholder="Current designation" />
          </label>
          <label className="dashboard-control">
            <span>Experience</span>
            <input value={candidate.experience} onChange={(event) => updateCandidate('experience', event.target.value)} placeholder="Example: 3 years" />
          </label>
          <label className="dashboard-control">
            <span>Expected Salary</span>
            <input value={candidate.expectedSalary} onChange={(event) => updateCandidate('expectedSalary', event.target.value)} placeholder="Expected CTC" />
          </label>
          <label className="dashboard-control">
            <span>Notice Period</span>
            <input value={candidate.noticePeriod} onChange={(event) => updateCandidate('noticePeriod', event.target.value)} placeholder="Immediate / 30 days" />
          </label>
          <label className="dashboard-control">
            <span>Location</span>
            <input value={candidate.location} onChange={(event) => updateCandidate('location', event.target.value)} placeholder="City" />
          </label>
          <label className="dashboard-control candidate-ai-full">
            <span>Skills</span>
            <textarea value={candidate.skills} onChange={(event) => updateCandidate('skills', event.target.value)} placeholder="Comma separated skills" />
          </label>
          <label className="dashboard-control candidate-ai-full">
            <span>Notes</span>
            <textarea value={candidate.notes} onChange={(event) => updateCandidate('notes', event.target.value)} placeholder="Interview notes, source, recruiter comments..." />
          </label>
          <label className="dashboard-control candidate-ai-full">
            <span>Resume PDF</span>
            <input type="file" accept="application/pdf,.pdf" onChange={(event) => setResumeFile(event.target.files?.[0] || null)} />
            <small>PDF up to 8 MB. API key remains on backend only.</small>
          </label>

          <div className="ticket-form-actions candidate-ai-full">
            <button type="submit" className="attendance-cta attendance-cta--purple" disabled={busy}>
              {busy ? 'Analyzing...' : 'Analyze Candidate'}
            </button>
            <button
              type="button"
              className="attendance-cta attendance-cta--gray"
              disabled={busy}
              onClick={() => {
                setCandidate(initialCandidate);
                setJobRequirement('');
                setResumeFile(null);
                setResult(null);
                setMessage(null);
              }}
            >
              Reset
            </button>
          </div>
        </article>

        <aside className="migration-panel candidate-ai-result">
          <h2>AI Result</h2>
          {result ? (
            <>
              <div className="candidate-ai-score">
                <StatusPill tone={scoreTone}>{result.score}/100</StatusPill>
                <strong>{result.recommendation}</strong>
                <p>{result.summary}</p>
              </div>
              <div className="candidate-ai-next">
                <span>Suggested fit</span>
                <strong>{result.suggestedRoleFit || '-'}</strong>
              </div>
              <div className="candidate-ai-next">
                <span>Salary fit</span>
                <strong>{result.salaryFit || '-'}</strong>
              </div>
              <div className="candidate-ai-next">
                <span>Next step</span>
                <strong>{result.nextStep || '-'}</strong>
              </div>
              <ResultList title="Matched Skills" items={result.matchedSkills} />
              <ResultList title="Missing Skills" items={result.missingSkills} />
              <ResultList title="Strengths" items={result.strengths} />
              <ResultList title="Risks / Verify" items={result.risks} />
              <ResultList title="Interview Questions" items={result.interviewQuestions} />
            </>
          ) : (
            <div className="dashboard-table__empty candidate-ai-empty">
              Add job requirement and candidate/resume, then click Analyze Candidate.
            </div>
          )}
        </aside>
      </form>
    </section>
  );
}
