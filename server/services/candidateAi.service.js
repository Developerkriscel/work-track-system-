const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5-mini';
const MAX_RESUME_BYTES = 8 * 1024 * 1024;

const safe = (value) => String(value ?? '').trim();
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message, extra = {}) => ({ success: false, message, ...extra });

function cleanBase64(value = '') {
  return String(value || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
}

function byteLengthFromBase64(value = '') {
  const cleaned = cleanBase64(value);
  if (!cleaned) return 0;
  return Buffer.byteLength(cleaned, 'base64');
}

function outputText(response = {}) {
  if (typeof response.output_text === 'string') return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

function parseJsonObject(text = '') {
  const raw = safe(text);
  if (!raw) throw new Error('AI returned an empty response.');
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI response was not valid JSON.');
    return JSON.parse(match[0]);
  }
}

function normalizeCandidate(candidate = {}) {
  return {
    name: safe(candidate.name || candidate.candidateName || candidate['Candidate Name']),
    email: safe(candidate.email || candidate.Email),
    phone: safe(candidate.phone || candidate.Phone || candidate.Mobile),
    currentRole: safe(candidate.currentRole || candidate['Current Role'] || candidate.designation),
    experience: safe(candidate.experience || candidate.Experience),
    skills: safe(candidate.skills || candidate.Skills),
    expectedSalary: safe(candidate.expectedSalary || candidate['Expected Salary']),
    noticePeriod: safe(candidate.noticePeriod || candidate['Notice Period']),
    location: safe(candidate.location || candidate.Location),
    notes: safe(candidate.notes || candidate.Notes)
  };
}

function normalizeAiResult(result = {}) {
  const score = Math.max(0, Math.min(100, Number(result.score) || 0));
  return {
    score,
    recommendation: safe(result.recommendation || 'Review manually'),
    summary: safe(result.summary),
    matchedSkills: Array.isArray(result.matchedSkills) ? result.matchedSkills.map(safe).filter(Boolean) : [],
    missingSkills: Array.isArray(result.missingSkills) ? result.missingSkills.map(safe).filter(Boolean) : [],
    strengths: Array.isArray(result.strengths) ? result.strengths.map(safe).filter(Boolean) : [],
    risks: Array.isArray(result.risks) ? result.risks.map(safe).filter(Boolean) : [],
    interviewQuestions: Array.isArray(result.interviewQuestions) ? result.interviewQuestions.map(safe).filter(Boolean) : [],
    suggestedRoleFit: safe(result.suggestedRoleFit),
    salaryFit: safe(result.salaryFit),
    nextStep: safe(result.nextStep || 'Manual HR review')
  };
}

export async function analyzeCandidateWithAi({ candidate = {}, jobRequirement = '', resume = null } = {}) {
  const apiKey = safe(process.env.OPENAI_API_KEY);
  const model = safe(process.env.OPENAI_CANDIDATE_MODEL) || DEFAULT_MODEL;
  if (!apiKey) {
    return fail('AI API key is not configured. Set OPENAI_API_KEY in the server environment, then retry.', {
      setupRequired: true
    });
  }

  const normalizedCandidate = normalizeCandidate(candidate);
  const requirement = safe(jobRequirement);
  if (!requirement) return fail('Job requirement is required for candidate matching.');
  if (!normalizedCandidate.name && !normalizedCandidate.email && !resume?.base64) {
    return fail('Add candidate details or upload a resume before analysis.');
  }

  const content = [
    {
      type: 'input_text',
      text: [
        'You are an HR screening assistant. Be fair, job-relevant, concise, and evidence-based.',
        'Analyze this candidate for the given job requirement.',
        'Return only valid JSON with these keys:',
        'score, recommendation, summary, matchedSkills, missingSkills, strengths, risks, interviewQuestions, suggestedRoleFit, salaryFit, nextStep.',
        'Scoring rule: 0-100. 80+ strong shortlist, 60-79 maybe, below 60 weak.',
        'Do not invent facts. If resume or data is missing, mention uncertainty in risks.',
        '',
        `Job requirement:\n${requirement}`,
        '',
        `Candidate data:\n${JSON.stringify(normalizedCandidate, null, 2)}`
      ].join('\n')
    }
  ];

  if (resume?.base64) {
    const fileBytes = byteLengthFromBase64(resume.base64);
    if (fileBytes > MAX_RESUME_BYTES) {
      return fail('Resume file is too large. Please upload a PDF up to 8 MB.');
    }
    content.push({
      type: 'input_file',
      filename: safe(resume.fileName) || 'resume.pdf',
      file_data: `data:application/pdf;base64,${cleanBase64(resume.base64)}`
    });
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content
        }
      ],
      max_output_tokens: 1400
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return fail(payload?.error?.message || 'AI candidate analysis failed.');
  }

  const parsed = parseJsonObject(outputText(payload));
  return ok({
    data: normalizeAiResult(parsed),
    model: payload.model || model,
    provider: 'openai'
  });
}
