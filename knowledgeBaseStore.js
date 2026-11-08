// Shared LocalStorage contract for Part 2 and later modules.
export const KNOWLEDGE_BASE_KEY = 'bg_knowledge_base_v1';
export const KNOWLEDGE_BASE_VERSION_KEY = 'bg_knowledge_versions_v1';

export function readKnowledgeBase() {
  try { return JSON.parse(localStorage.getItem(KNOWLEDGE_BASE_KEY) || 'null'); }
  catch { return null; }
}

export function readKnowledgeBaseVersions() {
  try { return JSON.parse(localStorage.getItem(KNOWLEDGE_BASE_VERSION_KEY) || '[]'); }
  catch { return []; }
}

export function getApprovedFacts() {
  const data = readKnowledgeBase();
  const today = new Date().toISOString().slice(0, 10);
  return (data?.facts || []).filter(f => f.status === 'Active' && (!f.until || f.until >= today));
}

export function getTerminologyRules() {
  const data = readKnowledgeBase();
  return data?.terminology || [];
}

export function getBrandReferenceData() {
  const data = readKnowledgeBase();
  return data ? {
    documents: data.documents || [],
    assets: (data.assets || []).filter(asset => asset.status === 'Approved'),
    colors: data.colors || [],
    typography: data.typography || {},
    logoGuidelines: data.logoGuidelines || {}
  } : null;
}
