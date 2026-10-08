/**
 * core-logic.js
 * ----------------------------------------------------------------------------
 * READABLE REFERENCE of the scientific logic embedded in `index.html`.
 *
 * This module is provided so reviewers and researchers can read the
 * cultural-profiling, fatigue-detection, and question-generation logic without
 * parsing the bundled single-file application. It mirrors the behavior of the
 * deployed system; `index.html` remains the source of truth used for data
 * collection. If you change the logic, change it there and mirror it here.
 *
 * No external services, API calls, or API keys are used. Item generation is
 * rule-based over curated item banks.
 * ----------------------------------------------------------------------------
 */

/* ===========================================================================
 * 1. CULTURAL-PROFILING COMPONENT
 * Infers a Hofstede-style cultural profile (VSM 2013-inspired) from a small set
 * of initial questions and derives a master orientation used by every later item.
 * ===========================================================================
 */

// Initial questions asked before the adaptive loop begins.
const culturalQuestions = [
  { id: 'username',          text: 'please enter your username:',                       type: 'username',      dimension: 'participant' },
  { id: 'requestedQuestions',text: 'How many questions would you like to answer? (15-25)', type: 'questionCount', dimension: 'setup' },
  { id: 'country',           text: 'What is your country of origin?',                    type: 'text',          dimension: 'demographic' },
  { id: 'age',               text: 'What is your age?',                                  type: 'number',        dimension: 'demographic' },
  { id: 'pdi_1',             text: 'How frequently, in your experience, are subordinates afraid to express disagreement with their superiors?',
    type: 'scale', options: ['Very frequently','Frequently','Sometimes','Seldom','Very seldom'], dimension: 'power_distance' },
  { id: 'idv_1',             text: 'How important is it to you to have sufficient time for your personal or family life?',
    type: 'scale', options: ['Of utmost importance','Very important','Of moderate importance','Of little importance','Of very little or no importance'], dimension: 'individualism' },
  { id: 'idv_2',             text: 'How important is it to you to have good physical working conditions?',
    type: 'scale', options: ['Of utmost importance','Very important','Of moderate importance','Of little importance','Of very little or no importance'], dimension: 'individualism' },
  { id: 'uai_1',             text: 'How often do you feel nervous or tense at work/school?',
    type: 'scale', options: ['Always','Usually','Sometimes','Seldom','Never'], dimension: 'uncertainty_avoidance' },
];

/**
 * Compute the cultural profile from the collected initial answers.
 * Scale answers are 1-based indices (1 = first option).
 * The master `orientation` drives all subsequent item selection.
 */
function calculateCulturalProfile(answers) {
  const scores = { power_distance: 0, individualism: 0, uncertainty_avoidance: 0 };

  // Power distance: reverse-scored so a higher value means higher power distance.
  if (answers.pdi_1) scores.power_distance = 6 - answers.pdi_1;

  // Individualism: combine the two IDV items (one reverse-scored). Higher = more individualist.
  const idv1 = answers.idv_1 || 3;
  const idv2 = answers.idv_2 || 3;
  scores.individualism = idv1 + (6 - idv2);

  // Uncertainty avoidance: higher = higher uncertainty avoidance.
  if (answers.uai_1) scores.uncertainty_avoidance = answers.uai_1;

  return {
    username:           answers.username || 'Unknown',
    requestedQuestions: Math.min(25, Math.max(15, parseInt(answers.requestedQuestions, 10) || 20)),
    country:            answers.country || 'Unknown',
    age:                answers.age || 'Not specified',
    power_distance_score:        scores.power_distance,
    individualism_score:         scores.individualism,
    uncertainty_avoidance_score: scores.uncertainty_avoidance,
    power_distance:       scores.power_distance >= 3 ? 'high' : 'low',
    individualism:        scores.individualism >= 6 ? 'high' : 'low',
    uncertainty_avoidance:scores.uncertainty_avoidance >= 3 ? 'high' : 'low',
    // Master orientation: the single switch that adapts every generated item.
    orientation:          scores.individualism >= 6 ? 'individualist' : 'collectivist',
  };
}

/* ===========================================================================
 * 2. FATIGUE-DETECTION COMPONENT
 * Monitors response-time behavior; supports a graded soft stop and a hard stop.
 * ===========================================================================
 */

/**
 * Update and return the graded fatigue score (capped at 10) after a response.
 * `state.responseTimes` is the running array of per-item response times (ms).
 */
function detectFatigue(responseTime, questionCount, fatigueScore, state) {
  state.responseTimes.push(responseTime);

  const all = state.responseTimes;
  const avgResponseTime = all.reduce((a, b) => a + b, 0) / all.length;
  const recent = all.slice(-3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / Math.min(3, all.length);

  let newFatigueScore = fatigueScore;
  if (recentAvg > avgResponseTime * 1.5) newFatigueScore += 1;   // slowing down
  if (responseTime < 2000)               newFatigueScore += 0.5; // implausibly fast
  if (questionCount > 10)                newFatigueScore += 0.3; // length effect

  return Math.min(10, newFatigueScore);
}

/**
 * Hard stop: returns a reason string if the last four responses are all extreme,
 * otherwise null. Guards against clearly invalid response patterns.
 */
function shouldTerminateForExtremePace(state) {
  const lastFour = state.responseTimes.slice(-4);
  if (lastFour.length < 4) return null;
  if (lastFour.every(t => t < 1000))  return 'Stopped because four consecutive responses were completed in under 1 second each.';
  if (lastFour.every(t => t > 20000)) return 'Stopped because four consecutive responses took more than 20 seconds each.';
  return null;
}

/* ===========================================================================
 * 3. QUESTION-GENERATION COMPONENT
 * Builds orientation-specific item banks (stress: PSS/DASS-21; support: MSPSS)
 * and serves non-repeating, alternating items adapted to the respondent.
 * ===========================================================================
 */

class InternationalStudentQuestionGenerator {
  constructor(culturalProfile) {
    this.culturalProfile = culturalProfile;
    this.askedQuestions = new Set();
    this.questionHistory = [];
    this.stressQuestions = this.buildStressQuestions();
    this.supportQuestions = this.buildSupportQuestions();
  }

  // Stress items, adapted from the PSS and the DASS-21 stress subscale,
  // split by cultural orientation.
  buildStressQuestions() {
    return {
      collectivist: [
        { text: "In the last month, how often have you felt that family expectations about your studies were difficult to handle?",
          options: ["Never","Almost never","Sometimes","Fairly often","Very often"], scale: "PSS-adapted", category: "stress" },
        { text: "How often do you feel that your academic responsibilities conflict with your obligations to your family or community?",
          options: ["Never","Rarely","Sometimes","Often","Always"], scale: "DASS-21-adapted", category: "stress" },
        { text: "When facing exam stress, how important is it for you to maintain harmony with your study group or classmates?",
          options: ["Not important at all","Slightly important","Moderately important","Very important","Extremely important"], scale: "Cultural-adapted", category: "stress" },
        { text: "How often do you feel pressure to succeed academically because of your family's or community's expectations?",
          options: ["Never","Rarely","Sometimes","Often","Always"], scale: "PSS-adapted", category: "stress" },
        { text: "In the last week, how often have you felt nervous or stressed when thinking about disappointing your family with your academic performance?",
          options: ["Not at all","A little","Moderately","Quite a bit","Extremely"], scale: "DASS-21-adapted", category: "stress" },
      ],
      individualist: [
        { text: "In the last month, how often have you felt confident about your ability to handle your personal academic problems?",
          options: ["Never","Almost never","Sometimes","Fairly often","Very often"], scale: "PSS-adapted", category: "stress" },
        { text: "How often do you feel that you are on top of your academic responsibilities?",
          options: ["Never","Rarely","Sometimes","Often","Always"], scale: "PSS-adapted", category: "stress" },
        { text: "In the last week, I found it hard to wind down after studying or attending classes",
          options: ["Did not apply to me at all","Applied to me to some degree","Applied to me a considerable degree","Applied to me very much"], scale: "DASS-21-stress", category: "stress" },
        { text: "How often have you felt that you were unable to control the important things in your academic life?",
          options: ["Never","Almost never","Sometimes","Fairly often","Very often"], scale: "PSS", category: "stress" },
        { text: "In the last week, I found it difficult to relax",
          options: ["Did not apply to me at all","Applied to me to some degree","Applied to me a considerable degree","Applied to me very much"], scale: "DASS-21-stress", category: "stress" },
      ],
    };
  }

  // Social-support items, adapted from the MSPSS, split by cultural orientation.
  buildSupportQuestions() {
    const AGREE7 = ["Very strongly disagree","Strongly disagree","Mildly disagree","Neutral","Mildly agree","Strongly agree","Very strongly agree"];
    return {
      collectivist: [
        { text: "There is a special person in my family who is around when I am in need", options: AGREE7, scale: "MSPSS-family", category: "support" },
        { text: "My family really tries to help me with my academic challenges",         options: AGREE7, scale: "MSPSS-family", category: "support" },
        { text: "I can talk about my academic problems with my family",                  options: AGREE7, scale: "MSPSS-family", category: "support" },
        { text: "My friends from my home country or cultural community really try to help me", options: AGREE7, scale: "MSPSS-friends", category: "support" },
        { text: "I have a special person from my cultural community who is a real source of comfort to me", options: AGREE7, scale: "MSPSS-significant-other", category: "support" },
      ],
      individualist: [
        { text: "There is a special person who is around when I am in need",            options: AGREE7, scale: "MSPSS-significant-other", category: "support" },
        { text: "I can count on my friends when things go wrong",                       options: AGREE7, scale: "MSPSS-friends", category: "support" },
        { text: "I have friends with whom I can share my joys and sorrows",             options: AGREE7, scale: "MSPSS-friends", category: "support" },
        { text: "There is a special person in my life who cares about my feelings",     options: AGREE7, scale: "MSPSS-significant-other", category: "support" },
        { text: "I can talk about my problems with my friends",                         options: AGREE7, scale: "MSPSS-friends", category: "support" },
      ],
    };
  }

  /**
   * Produce the next item: alternate stress/support by question parity, draw from
   * the bank matching the orientation, avoid repeats, and — if exhausted — return a
   * reframed variation so administration can continue without literal repetition.
   */
  generateQuestion(responseHistory) {
    const questionNum = responseHistory.length + 1;
    const orientation = this.culturalProfile.orientation;
    const questionType = questionNum % 2 === 1 ? 'stress' : 'support';
    const pool = questionType === 'stress'
      ? this.stressQuestions[orientation]
      : this.supportQuestions[orientation];

    const available = pool.filter(q => !this.askedQuestions.has(q.text));
    if (available.length === 0) {
      const baseQ = pool[Math.floor(Math.random() * pool.length)];
      return this.formatQuestion({ ...baseQ, text: "Thinking about the past month: " + baseQ.text.toLowerCase() });
    }
    const selected = available[Math.floor(Math.random() * available.length)];
    this.askedQuestions.add(selected.text);
    return this.formatQuestion(selected);
  }

  formatQuestion(q) {
    return {
      text: q.text,
      options: q.options,
      category: q.category,
      scale: q.scale,
      culturalAdaptation: `Based on ${q.scale} - adapted for ${this.culturalProfile.orientation} cultural context`,
      qualityScore: 10,
      expectedInsight: `Assess ${q.category} levels using validated ${q.scale} framework`,
    };
  }
}

/* ===========================================================================
 * 4. ORCHESTRATION COMPONENT
 * The administration loop: after each answer, evaluate stop conditions in order
 * (hard stop → fatigue soft stop → requested count), else request the next item.
 * ===========================================================================
 */

/**
 * Handle one answer in the dynamic stage. Returns an object describing whether to
 * stop (with a reason) or the next question to present. `state` carries mutable
 * run state: { responseTimes, responses }.
 */
function handleDynamicResponse(answer, currentQuestion, questionCount, maxQuestions,
                               fatigueScore, questionGenerator, state, questionStartTime) {
  const responseTime = Date.now() - questionStartTime;
  const newFatigue = detectFatigue(responseTime, questionCount, fatigueScore, state);

  state.responses.push({
    question: currentQuestion.text,
    answer,
    answerIndex: currentQuestion.options ? currentQuestion.options.indexOf(answer) : 0,
    responseTime,
    category: currentQuestion.category,
    scale: currentQuestion.scale,
    timestamp: new Date().toISOString(),
  });

  // (a) Hard stop: extreme, clearly invalid pacing.
  const extremePaceReason = shouldTerminateForExtremePace(state);
  if (extremePaceReason) return { stop: true, reason: extremePaceReason, fatigueScore: newFatigue };

  // (b) Soft stop: high accumulated fatigue after a reasonable number of items.
  if (newFatigue > 7 && questionCount >= 10)
    return { stop: true, reason: 'Stopped early because high fatigue was detected.', fatigueScore: newFatigue };

  // (c) Requested item count reached.
  if (questionCount >= maxQuestions)
    return { stop: true, reason: 'Completed the selected number of questions.', fatigueScore: newFatigue };

  // Otherwise, continue with the next generated item.
  const nextQuestion = questionGenerator.generateQuestion(state.responses);
  return { stop: false, nextQuestion, fatigueScore: newFatigue };
}

/**
 * Compute final average stress/support scores from recorded answer indices.
 */
function calculateScores(responses) {
  let stressScore = 0, supportScore = 0, stressCount = 0, supportCount = 0;
  responses.forEach(r => {
    const idx = typeof r.answerIndex === 'number' ? r.answerIndex : 0;
    if (r.category === 'stress')  { stressScore += idx; stressCount++; }
    if (r.category === 'support') { supportScore += idx; supportCount++; }
  });
  const avgStress  = stressCount  > 0 ? stressScore  / stressCount  : 0;
  const avgSupport = supportCount > 0 ? supportScore / supportCount : 0;
  return {
    stressLevel:  avgStress  > 2.5 ? 'High' : 'Low',
    supportLevel: avgSupport > 2.5 ? 'High' : 'Low',
    stressScore:  avgStress.toFixed(2),
    supportScore: avgSupport.toFixed(2),
  };
}

export {
  culturalQuestions,
  calculateCulturalProfile,
  detectFatigue,
  shouldTerminateForExtremePace,
  InternationalStudentQuestionGenerator,
  handleDynamicResponse,
  calculateScores,
};
