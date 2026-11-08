import { getApprovedFacts, getTerminologyRules, readKnowledgeBase } from './knowledgeBaseStore.js';

const esc = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const textOnly = html => {
  const el = document.createElement('div');
  el.innerHTML = html || '';
  return el.innerText || el.textContent || '';
};
const addIssue = (issues, item) => {
  if (!item.snippet || !item.snippet.trim()) return;
  const duplicate = issues.some(issue => issue.ruleId === item.ruleId && issue.snippet.toLowerCase() === item.snippet.toLowerCase());
  if (!duplicate) issues.push({ id: `ISS-${issues.length + 1}`, status: 'Open', ...item });
};
const locate = (text, phrase) => {
  const index = text.toLowerCase().indexOf(String(phrase).toLowerCase());
  return index < 0 ? null : { start: index, end: index + phrase.length };
};
const sourceForTerm = () => ({ source: 'No approved source found', reference: null, sourceStatus: 'No approved source found' });
const severityPenalty = { Critical: 24, Major: 12, Minor: 5, Informational: 1 };

export function scanBrandContent(html, options = {}) {
  const text = textOnly(html);
  const kb = readKnowledgeBase();
  const facts = kb?.facts || [];
  const activeFacts = getApprovedFacts();
  const terms = getTerminologyRules();
  const issues = [];
  let supportedClaims = 0;
  const addTextIssue = (phrase, data) => {
    const range = locate(text, phrase);
    if (!range) return;
    addIssue(issues, { snippet: phrase, start: range.start, end: range.end, ...data });
  };

  // Banned terminology and preferred/alias vocabulary are read live from Part 2.
  terms.forEach(rule => {
    if (!rule.term) return;
    const re = new RegExp(esc(rule.term), 'ig');
    let match;
    while ((match = re.exec(text))) {
      if (rule.type === 'Banned') {
        addIssue(issues, {
          snippet: match[0], start: match.index, end: match.index + match[0].length,
          category: 'Terminology violations', severity: 'Major', title: `Prohibited term: ${rule.term}`,
          rule: rule.explanation || `Avoid the term “${rule.term}”.`, source: 'Brand Knowledge Base · Terminology',
          reference: rule.id, evidenceStatus: 'Matched Part 2 terminology rule', classification: 'Conflicting',
          explanation: rule.explanation || 'This term is marked as banned in the approved terminology list.',
          risk: 'The content may violate approved brand language.', suggestion: rule.replacement || '',
          suggestionLabel: rule.replacement ? 'Use approved replacement' : 'Remove or rewrite this phrase',
          ruleId: rule.id
        });
      } else if ((rule.type === 'Preferred' || rule.type === 'Alias') && rule.replacement && rule.term.toLowerCase() !== rule.replacement.toLowerCase()) {
        addIssue(issues, {
          snippet: match[0], start: match.index, end: match.index + match[0].length,
          category: 'Terminology violations', severity: 'Minor', title: `Use preferred terminology: ${rule.replacement}`,
          rule: rule.explanation || `Prefer “${rule.replacement}” over “${rule.term}”.`,
          source: 'Brand Knowledge Base · Terminology', reference: rule.id,
          evidenceStatus: 'Matched Part 2 terminology rule', classification: 'Conflicting',
          explanation: `The knowledge base maps “${rule.term}” to “${rule.replacement}”.`,
          risk: 'Inconsistent terminology weakens brand consistency.', suggestion: rule.replacement,
          suggestionLabel: 'Replace with approved term', ruleId: rule.id
        });
      }
      if (match.index === re.lastIndex) re.lastIndex++;
    }
  });

  // Promotional and absolute claims: flag for substantiation, never label them false.
  const promoPatterns = [
    { re: /\b(best in the world|best in the industry|world'?s best)\b/ig, title: 'Unsupported superlative', severity: 'Major', suggestion: 'a leading option for teams with these requirements' },
    { re: /\b(number one|#1|no\.?\s*1)\b/ig, title: 'Number-one claim needs evidence', severity: 'Major', suggestion: 'a recognised option' },
    { re: /\b(guaranteed results?|guarantees? results?)\b/ig, title: 'Absolute performance promise', severity: 'Critical', suggestion: 'designed to support measurable outcomes' },
    { re: /\b(100%\s*risk[- ]free|completely risk[- ]free|zero risk)\b/ig, title: 'Absolute risk-free claim', severity: 'Critical', suggestion: 'designed with risk controls' },
    { re: /\b(revolutionary|unmatched|unparalleled|perfect|always|never fails)\b/ig, title: 'Promotional superlative', severity: 'Minor', suggestion: 'purpose-built' }
  ];
  promoPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.re.exec(text))) {
      const evidence = sourceForTerm(match[0], kb);
      addIssue(issues, {
        snippet: match[0], start: match.index, end: match.index + match[0].length,
        category: 'Unsupported claims', severity: pattern.severity, title: pattern.title,
        rule: 'Promotional and absolute claims require substantiation and appropriate review.',
        source: evidence.source, reference: evidence.reference, evidenceStatus: evidence.sourceStatus, classification: 'Needs human review',
        explanation: 'This wording makes a strong comparative or absolute claim. The scanner cannot establish whether it is true; provide evidence and obtain human review.',
        risk: 'An unsubstantiated claim may create legal, reputational or customer-trust risk.',
        suggestion: pattern.suggestion, suggestionLabel: 'Use a qualified alternative',
        ruleId: `PROMO-${pattern.title}`
      });
    }
  });

  // Numeric/date/performance assertions are checked against facts only when there is a plausible subject match.
  const claimCandidates = [
    { re: /\b(?:founded|established|launched)\s+(?:in\s+)?(?:19|20)\d{2}\b/ig, category: 'Fact inconsistencies' },
    { re: /\b\d+(?:\.\d+)?\s*%\s*(?:increase|reduction|faster|improvement|savings?|growth)\b/ig, category: 'Unsupported claims' },
    { re: /\b(?:available in|operates in|serves)\s+\d+\s+(?:markets|countries|regions)\b/ig, category: 'Fact inconsistencies' }
  ];
  claimCandidates.forEach(candidate => {
    let match;
    while ((match = candidate.re.exec(text))) {
      const lower = match[0].toLowerCase();
      const keywords = lower.includes('founded') || lower.includes('established') ? ['founded','established','year'] :
        lower.includes('market') || lower.includes('countries') || lower.includes('regions') ? ['market','availability','country','region'] :
        ['performance','outcome','reduction','improvement','savings'];
      const related = facts.filter(f => `${f.title} ${f.category} ${f.statement}`.toLowerCase().split(/[^a-z0-9]+/).some(word => word.length > 3 && keywords.includes(word)));
      const exact = related.find(f => f.status === 'Active' && f.statement.toLowerCase().includes(match[0].toLowerCase()));
      if (exact) { supportedClaims++; continue; }
      const expired = related.find(f => f.status === 'Outdated' || (f.until && f.until < new Date().toISOString().slice(0,10)));
      const active = related.find(f => activeFacts.some(a => a.id === f.id));
      const evidence = expired || active || related[0];
      const claimNumbers=(match[0].match(/\d+(?:\.\d+)?/g)||[]);
      const factNumbers=(evidence?.statement?.match(/\d+(?:\.\d+)?/g)||[]);
      const conflicting=!!(evidence&&claimNumbers.length&&factNumbers.length&&claimNumbers.some(n=>!factNumbers.includes(n)));
      const classification=expired?'Outdated':conflicting?'Conflicting':evidence?'Needs human review':'Unsupported';
      addIssue(issues, {
        snippet: match[0], start: match.index, end: match.index + match[0].length,
        category: candidate.category, severity: expired ? 'Major' : 'Major',
        title: expired ? 'Claim may rely on an outdated fact' : conflicting ? 'Claim conflicts with an approved fact' : evidence ? 'Claim needs verification against an approved fact' : 'No approved fact found for claim',
        rule: 'Factual and numerical claims should be checked against current approved facts.',
        source: evidence?.source || 'No approved source found', reference: evidence?.reference || evidence?.id || null,
        evidenceStatus: expired ? 'Outdated' : conflicting ? 'Conflicting with approved fact' : evidence ? 'Needs human review' : 'Unsupported · No approved source found', classification,
        explanation: expired ? `A related knowledge-base fact (“${evidence.title}”) is marked outdated. Do not reuse it without verification.` :
          conflicting ? `The claim contains a numeric value that differs from the related approved fact (“${evidence.title}”). Verify the current value with the source owner.` :
          evidence ? `A related fact exists (“${evidence.title}”), but this exact statement is not confirmed by the approved wording.` :
          'No matching approved fact was found in the current Brand Knowledge Base. Add a verified source or qualify the claim.',
        risk: 'Incorrect or stale factual claims can mislead readers and damage credibility.',
        suggestion: '', suggestionLabel: 'Verify with the source owner', ruleId: evidence?.id || `FACT-MISSING-${candidate.category}`
      });
    }
  });

  // Simple deterministic tone indicators; no unsupported tone guideline is cited.
  const toneWords = ['cheap','crush the competition','insane','crazy','killer feature'];
  toneWords.forEach(word => {
    const re = new RegExp(esc(word), 'ig'); let match;
    while ((match = re.exec(text))) addIssue(issues, {
      snippet: match[0], start: match.index, end: match.index + match[0].length,
      category: 'Tone inconsistencies', severity: 'Minor', title: 'Potentially informal or aggressive wording',
      rule: 'Heuristic tone review; no explicit tone guideline was found in the current knowledge base.',
      source: 'No approved source found', reference: null, evidenceStatus: 'Needs human review · No approved source found', classification: 'Needs human review',
      explanation: 'This wording may feel informal or combative in professional brand communication. Human review is recommended.',
      risk: 'Tone may not suit the intended audience.', suggestion: 'cost-effective', suggestionLabel: 'Use a more neutral phrase',
      ruleId: `TONE-${word}`
    });
  });

  // Accessibility checks use the actual inserted HTML structure.
  const root = document.createElement('div'); root.innerHTML = html || '';
  root.querySelectorAll('img').forEach((img, index) => {
    if (!img.getAttribute('alt')?.trim()) addIssue(issues, {
      snippet: `[Image ${index + 1}]`, start: -1, end: -1, category: 'Accessibility issues', severity: 'Major',
      title: 'Image is missing alternative text', rule: 'Informative images should have meaningful alt text.',
      source: 'Accessibility heuristic', reference: null, evidenceStatus: 'Needs human review · Deterministic HTML check', classification: 'Needs human review',
      explanation: 'This image has no non-empty alt attribute. Add concise text that communicates its relevant information.',
      risk: 'Screen-reader users may not understand the image content.', suggestion: '', suggestionLabel: 'Add alt text',
      ruleId: `ALT-${index}`
    });
  });
  root.querySelectorAll('a').forEach((link, index) => {
    const label = (link.textContent || '').trim();
    if (!label || /^(click here|read more|here|learn more)$/i.test(label)) addIssue(issues, {
      snippet: label || '[Unlabelled link]', start: -1, end: -1, category: 'Accessibility issues', severity: 'Minor',
      title: 'Link text is not descriptive', rule: 'Link text should describe the destination or action.',
      source: 'Accessibility heuristic', reference: null, evidenceStatus: 'Needs human review · Deterministic HTML check', classification: 'Needs human review',
      explanation: 'Generic or empty link labels do not communicate the destination when read out of context.',
      risk: 'People using assistive technology may have difficulty understanding the link purpose.',
      suggestion: 'View the product documentation', suggestionLabel: 'Use descriptive link text',
      ruleId: `LINK-${index}`
    });
  });
  const headings = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => Number(h.tagName.slice(1)));
  if (headings.length && headings.some((level, i) => i > 0 && level > headings[i-1] + 1)) {
    addIssue(issues, {
      snippet: '[Heading hierarchy]', start: -1, end: -1, category: 'Accessibility issues', severity: 'Minor',
      title: 'Heading levels may be skipped', rule: 'Use a logical heading hierarchy without skipping levels.',
      source: 'Accessibility heuristic', reference: null, evidenceStatus: 'Needs human review · Deterministic HTML structure check', classification: 'Needs human review',
      explanation: 'The document contains a heading level that jumps over one or more levels.',
      risk: 'The document outline may be difficult to navigate.', suggestion: '', suggestionLabel: 'Review heading structure',
      ruleId: 'A11Y-HEADING'
    });
  }
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const long = sentences.find(sentence => sentence.split(/\s+/).length > 28);
  if (long) {
    const start = text.indexOf(long);
    addIssue(issues, {
      snippet: long.slice(0, 110), start, end: start + long.length,
      category: 'Accessibility issues', severity: 'Informational', title: 'Long sentence may affect readability',
      rule: 'Readability heuristic: review sentences longer than 28 words.',
      source: 'Readability heuristic', reference: null, evidenceStatus: 'Needs human review · Deterministic readability estimate', classification: 'Needs human review',
      explanation: `This sentence contains approximately ${long.split(/\s+/).length} words. Consider splitting it into shorter statements.`,
      risk: 'Dense sentences can make content harder to understand.', suggestion: '', suggestionLabel: 'Rewrite for clarity',
      ruleId: 'READABILITY-LONG'
    });
  }

  const categoryOrder = ['Unsupported claims','Fact inconsistencies','Terminology violations','Tone inconsistencies','Messaging issues','Accessibility issues','Visual compliance issues'];
  issues.sort((a,b) => (['Critical','Major','Minor','Informational'].indexOf(a.severity)-['Critical','Major','Minor','Informational'].indexOf(b.severity)) || a.start-b.start);
  const score = Math.max(0, Math.min(100, Math.round(100 - issues.reduce((sum, issue) => sum + (severityPenalty[issue.severity] || 0), 0))));
  return {
    score, issues, scannedTextLength: text.length, categoryBreakdown: categoryOrder.map(category => ({ category, count: issues.filter(issue => issue.category === category).length })),
    severityBreakdown: ['Critical','Major','Minor','Informational'].map(severity => ({ severity, count: issues.filter(issue => issue.severity === severity).length })),
    sourceCoverage: issues.length ? Math.round(issues.filter(issue => issue.source && issue.source !== 'No approved source found').length / issues.length * 100) : 100,
    evidenceBreakdown: ['Supported','Conflicting','Outdated','Unsupported','Needs human review'].map(classification=>({classification,count:(classification==='Supported'?supportedClaims:issues.filter(issue=>issue.classification===classification).length)})),
    engine: 'Deterministic frontend simulation', notes: ['Results are generated by local rules and Part 2 knowledge-base data.', 'This is not a real AI model, legal opinion or validated accuracy score.']
  };
}

export function extractPlainText(html) { return textOnly(html); }
