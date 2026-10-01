import assert from 'node:assert/strict';

const { analyzeCandidateWithAi } = await import('../services/candidateAi.service.js');
const previousKey = process.env.OPENAI_API_KEY;
const previousModel = process.env.OPENAI_CANDIDATE_MODEL;
const previousFetch = globalThis.fetch;

try {
  process.env.OPENAI_API_KEY = '';
  let missing = await analyzeCandidateWithAi({
    jobRequirement: 'SEO Executive',
    candidate: { name: 'Test Candidate' }
  });
  assert.equal(missing.success, false);
  assert.equal(missing.setupRequired, true);

  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_CANDIDATE_MODEL = 'test-model';
  let requestedBody = null;
  globalThis.fetch = async (_url, options) => {
    requestedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        model: 'test-model',
        output_text: JSON.stringify({
          score: 82,
          recommendation: 'Strong shortlist',
          summary: 'Candidate matches the role.',
          matchedSkills: ['SEO'],
          missingSkills: ['GA4'],
          strengths: ['Relevant experience'],
          risks: ['Verify tools depth'],
          interviewQuestions: ['Explain your keyword research process.'],
          suggestedRoleFit: 'SEO Executive',
          salaryFit: 'Within range',
          nextStep: 'Schedule interview'
        })
      })
    };
  };

  const result = await analyzeCandidateWithAi({
    jobRequirement: 'SEO Executive with Google Search Console experience',
    candidate: { name: 'Test Candidate', skills: 'SEO, GSC' },
    resume: {
      fileName: 'resume.pdf',
      base64: Buffer.from('%PDF test').toString('base64')
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.data.score, 82);
  const fileInput = requestedBody.input[0].content.find((item) => item.type === 'input_file');
  assert.ok(fileInput.file_data.startsWith('data:application/pdf;base64,'));
  assert.equal(requestedBody.model, 'test-model');
  console.log('PASS: Candidate AI setup, request formatting, and response parsing verified.');
} finally {
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
  if (previousModel === undefined) delete process.env.OPENAI_CANDIDATE_MODEL;
  else process.env.OPENAI_CANDIDATE_MODEL = previousModel;
  globalThis.fetch = previousFetch;
}
