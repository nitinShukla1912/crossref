const BASE = "https://api.crossref.org";
const USER_AGENT = "crossref-extension/1.0 (mailto:your@email.com)";

function extractCandidate(it) {
  const authors = (it.author || []).map(a => [a.family, a.given]);
  const title = (it.title || [null])[0];
  const subtitle = (it.subtitle || [null])[0];
  
  let year = null;
  for (const k of ["issued", "published-print", "published-online", "published"]) {
    let parts = (it[k] || {})["date-parts"] || [[null]];
    if (parts && parts[0] && parts[0][0]) {
      year = parts[0][0];
      break;
    }
  }

  return {
    score: it.score,
    type: it.type,
    year: year,
    authors: authors,
    title: title,
    subtitle: subtitle,
    container: (it["container-title"] || [null])[0],
    volume: it.volume,
    issue: it.issue,
    page: it.page,
    doi: it.DOI
  };
}

async function checkCitationAPI(query) {
    let q = query;
    if (q.length > 800) q = q.substring(0, 800);
    const params = new URLSearchParams({ query: q, rows: "2" });
    const url = `${BASE}/works?${params.toString()}`;

    const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" }
    });
    
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    const items = data.message?.items || [];
    return items.map(extractCandidate);
}

let isJobRunning = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startJob") {
        if (!isJobRunning) {
            startBackgroundJob(request.chunks);
        }
        sendResponse({ started: true });
        return false;
    }
});

async function startBackgroundJob(chunks) {
    isJobRunning = true;
    let currentResults = [];
    chrome.storage.local.set({ isChecking: true, checkedCount: 0, totalCount: chunks.length, jobResults: [] });

    for (let i = 0; i < chunks.length; i++) {
        const query = chunks[i];
        let resultObj = { query: query };
        
        try {
            const results = await checkCitationAPI(query);
            resultObj.success = true;
            resultObj.data = results;
        } catch (err) {
            resultObj.error = err.message;
        }

        currentResults.push(resultObj);
        
        // Update storage so UI can react in realtime
        chrome.storage.local.set({ 
            checkedCount: i + 1,
            jobResults: currentResults 
        });

        // Delay to prevent getting immediately rate-limited
        if (i < chunks.length - 1) {
            await new Promise(r => setTimeout(r, 600));
        }
    }

    chrome.storage.local.set({ isChecking: false });
    isJobRunning = false;
}
