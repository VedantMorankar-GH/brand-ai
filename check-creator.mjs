import assert from 'node:assert/strict';
import { scanBrandContent } from '../src/data/brandScanner.js';
import {
  createCreatorDocument, saveCreatorDocument, getCreatorDocument,
  duplicateCreatorDocument, deleteCreatorDocument, readCreatorDocuments,
  submitCreatorDocument, readCreatorSubmissions
} from '../src/data/creatorStore.js';

const memory = new Map();
globalThis.localStorage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); }
};
function plain(html) {
  return String(html || '').replace(/<br\s*\/?>/gi,' ')
    .replace(/<\/(p|h[1-6]|li|div)>/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ')
    .replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
}
globalThis.document = {
  createElement() {
    let html = '';
    return {
      set innerHTML(value) { html = value || ''; },
      get innerHTML() { return html; },
      get textContent() { return plain(html); },
      get innerText() { return plain(html); },
      querySelectorAll(selector) {
        if (selector === 'img') return [...html.matchAll(/<img\b([^>]*)>/gi)].map(match => ({
          getAttribute(name) {
            const attr = match[1].match(new RegExp(name + '="([^"]*)"', 'i'));
            return attr?.[1] ?? null;
          }
        }));
        if (selector === 'a') return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(match => ({ textContent: plain(match[2]) }));
        return [];
      }
    };
  }
};
localStorage.setItem('bg_knowledge_base_v1', JSON.stringify({
  documents: [{id:'DOC-1',name:'Brand Standards.pdf',processing:'Indexed',approval:'Approved'}],
  facts: [
    {id:'FACT-1',title:'Founded year',statement:'Northstar was founded in 2018.',category:'Company',source:'Corporate profile.pdf',reference:'Page 2',until:'',status:'Active'},
    {id:'FACT-2',title:'Customer outcome claim',statement:'Customers may reduce manual review time by up to 30% in qualifying workflows.',category:'Performance',source:'Approved claims register.pdf',reference:'Page 8',until:'2026-10-01',status:'Outdated'}
  ],
  terminology: [
    {id:'TERM-1',term:'Customer',type:'Preferred',replacement:'Client',explanation:'Use Client.',category:'Audience'},
    {id:'TERM-2',term:'Guaranteed results',type:'Banned',replacement:'',explanation:'Do not guarantee outcomes.',category:'Claims'}
  ],
  colors: [{name:'Primary blue',hex:'#3978E8'}]
}));

const scan = scanBrandContent('<h1>Launch announcement</h1><p>Northstar was founded in 2018. Northstar was founded in 2019 and guarantees results. Every customer gets the best in the world solution.</p><p>Customers may achieve 40% growth in six months. The service is available in 22 countries.</p><p><a href="https://example.com">click here</a></p><img src="x">');
assert.equal(scan.engine, 'Deterministic frontend simulation');
assert.ok(scan.score >= 0 && scan.score <= 100);
assert.ok(scan.issues.some(issue => issue.classification === 'Conflicting' && issue.source === 'Corporate profile.pdf'));
assert.ok(scan.issues.some(issue => issue.classification === 'Outdated'));
assert.ok(scan.issues.some(issue => issue.classification === 'Unsupported'));
assert.ok(scan.issues.some(issue => issue.classification === 'Needs human review'));
assert.ok(scan.issues.some(issue => issue.ruleId === 'TERM-1'));
assert.ok(scan.issues.some(issue => issue.title === 'Image is missing alternative text'));
assert.ok(scan.issues.some(issue => issue.title === 'Link text is not descriptive'));
assert.ok(scan.evidenceBreakdown.some(item => item.classification === 'Supported'));

const user = {name:'Alex Morgan',email:'creator@brandguard.ai',role:'Creator'};
const draft = saveCreatorDocument(createCreatorDocument(user,'Test draft','<p>Test body</p>'));
assert.equal(getCreatorDocument(draft.id).title,'Test draft');
const checkpointed = saveCreatorDocument({...draft,content:'<p>Edited body</p>'},readCreatorDocuments(),{newVersion:true});
assert.equal(checkpointed.version,2);
assert.equal(checkpointed.versions[0].content,'<p>Test body</p>');
const copy = duplicateCreatorDocument(draft,user);
assert.equal(copy.content,draft.content);
const submission = submitCreatorDocument(draft,user,scan);
assert.equal(submission.status,'In Review');
assert.equal(readCreatorSubmissions().length,1);
deleteCreatorDocument(copy.id);
assert.equal(readCreatorDocuments().some(item=>item.id===copy.id),false);

console.log(`PASS: deterministic scan (${scan.issues.length} issues, score ${scan.score}), evidence classifications, Part 2 references, accessibility rules, Creator document CRUD and submission persistence.`);
