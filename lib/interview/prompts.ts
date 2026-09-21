import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

export interface QuestionDefinition {
  id: string;
  title: string;
  category: string;
  roundType: 'system_design' | 'advanced_dsa_cpp' | 'behavioral' | 'communication';
  interviewerPrompt: string;
  expectedScale?: Record<string, string>;
  hiddenReference?: Record<string, any>;
}

const QUESTIONS_DIR = path.resolve(process.cwd(), 'docs/interview/pack/questions');
const PROMPTS_DIR = path.resolve(process.cwd(), 'docs/interview/pack/prompts');

/**
 * Loads all interview questions across system-design, dsa-cpp, and behavioral packs.
 */
export function loadAllQuestions(): QuestionDefinition[] {
  const results: QuestionDefinition[] = [];

  const fileMappings: Array<{ file: string; roundType: QuestionDefinition['roundType'] }> = [
    { file: 'system-design.yaml', roundType: 'system_design' },
    { file: 'dsa-cpp.yaml', roundType: 'advanced_dsa_cpp' },
    { file: 'behavioral-and-screens.yaml', roundType: 'behavioral' },
  ];

  for (const { file, roundType } of fileMappings) {
    const fullPath = path.join(QUESTIONS_DIR, file);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const parsed = YAML.parse(content);
      if (parsed && Array.isArray(parsed.questions)) {
        for (const q of parsed.questions) {
          results.push({
            id: q.id,
            title: q.title || q.id,
            category: q.category || 'General',
            roundType: q.round_type || roundType,
            interviewerPrompt: q.interviewer_prompt || q.title,
            expectedScale: q.expected_scale,
            hiddenReference: q.hidden_reference,
          });
        }
      }
    } catch (err) {
      console.warn(`Failed to parse questions file ${file}:`, err);
    }
  }

  return results;
}

/**
 * Finds a single question definition by ID.
 */
export function getQuestionById(questionId: string): QuestionDefinition | undefined {
  const all = loadAllQuestions();
  return all.find((q) => q.id === questionId);
}

/**
 * Compiles the full system prompt for the Gemini Live interviewer.
 */
export function compileInterviewerPrompt(params: {
  companyStyle: 'google' | 'toptal';
  roundType: 'system_design' | 'advanced_dsa_cpp' | 'behavioral' | 'communication';
  questionId: string;
  timeLimitMinutes?: number;
}): { systemPrompt: string; question: QuestionDefinition } {
  const question = getQuestionById(params.questionId);
  if (!question) {
    throw new Error(`Interview question ID not found: ${params.questionId}`);
  }

  const promptTemplatePath = path.join(PROMPTS_DIR, 'interviewer.system.md');
  let rawTemplate = '';
  if (fs.existsSync(promptTemplatePath)) {
    rawTemplate = fs.readFileSync(promptTemplatePath, 'utf8');
    // Strip markdown code block wrapper if present
    rawTemplate = rawTemplate.replace(/^#\s*.*\n+```markdown\n?/i, '').replace(/```\s*$/i, '').trim();
  } else {
    // Fallback template
    rawTemplate = `You are a senior interviewer at {COMPANY_STYLE} conducting a {ROUND_TYPE} interview with Manish Kumar Prajapati.
Ask exactly ONE question at a time. Never praise or volunteer solutions.
State the problem: "{QUESTION}" and probe candidate decisions.
Wrap up at {TIME_LIMIT}.`;
  }

  const companyLabel = params.companyStyle === 'google' ? 'Google' : 'Toptal';
  const roundLabel = params.roundType.replace(/_/g, ' ').toUpperCase();
  const timeLimit = `${params.timeLimitMinutes || 45} minutes`;

  const systemPrompt = rawTemplate
    .replace(/{COMPANY_STYLE}/g, companyLabel)
    .replace(/{ROUND_TYPE}/g, roundLabel)
    .replace(/{QUESTION}/g, question.interviewerPrompt)
    .replace(/{TIME_LIMIT}/g, timeLimit);

  return { systemPrompt, question };
}
