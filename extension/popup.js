document.addEventListener('DOMContentLoaded', () => {
    const checkBtn = document.getElementById('checkBtn');
    const exportBtn = document.getElementById('exportBtn');
    const citationInput = document.getElementById('citationInput');
    const loading = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');

    let currentExportData = [];

    function renderResults(jobResults) {
        resultsDiv.innerHTML = '';
        currentExportData = [];

        if (!jobResults || jobResults.length === 0) {
            exportBtn.classList.add('hidden');
            exportBtn.disabled = true;
            return;
        }

        jobResults.forEach((jobItem, index) => {
            if (jobResults.length > 1) {
                const queryHeader = document.createElement('h4');
                queryHeader.textContent = `Ref: ${jobItem.query.length > 40 ? jobItem.query.substring(0, 40) + '...' : jobItem.query}`;
                queryHeader.style.color = '#fff';
                queryHeader.style.marginTop = '15px';
                queryHeader.style.marginBottom = '5px';
                queryHeader.style.fontSize = '0.9rem';
                resultsDiv.appendChild(queryHeader);
            }

            const resultContainer = document.createElement('div');
            
            if (jobItem.error) {
                resultContainer.innerHTML = `<div class="error">Error: ${jobItem.error}</div>`;
            } else if (jobItem.success && jobItem.data) {
                resultContainer.innerHTML = generateResultsHTML(jobItem.data);
                
                if (jobItem.data.length > 0) {
                    const r = jobItem.data[0];
                    currentExportData.push({
                        query: jobItem.query,
                        score: r.score ? r.score.toFixed(2) : '',
                        title: r.title || '',
                        authors: r.authors ? r.authors.map(a => a.join(' ')).join(', ') : '',
                        year: r.year || '',
                        container: r.container || '',
                        doi: r.doi || ''
                    });
                }
            } else {
                resultContainer.innerHTML = `<div class="error">Unknown error occurred.</div>`;
            }
            resultsDiv.appendChild(resultContainer);
        });

        if (currentExportData.length > 0) {
            exportBtn.classList.remove('hidden');
            exportBtn.disabled = false;
        } else {
            exportBtn.classList.add('hidden');
            exportBtn.disabled = true;
        }
    }

    function updateCheckingState(isChecking, checkedCount = 0, totalCount = 0) {
        if (isChecking) {
            loading.classList.remove('hidden');
            checkBtn.disabled = true;
            if (totalCount > 0) {
                loading.textContent = `Checking... (${checkedCount}/${totalCount})`;
            } else {
                loading.textContent = 'Checking...';
            }
            exportBtn.classList.add('hidden');
            exportBtn.disabled = true;
        } else {
            loading.classList.add('hidden');
            checkBtn.disabled = false;
        }
    }

    // 1. Single source of truth is chrome.storage
    chrome.storage.local.get(['savedInput', 'jobResults', 'isChecking', 'checkedCount', 'totalCount'], (data) => {
        if (data.savedInput) {
            citationInput.value = data.savedInput;
        }
        
        if (data.jobResults) {
            renderResults(data.jobResults);
        }
        
        updateCheckingState(data.isChecking, data.checkedCount, data.totalCount);

        // 2. Override if there is new selected text
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if(tabs && tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "getSelectedText"}, function(response) {
                    if (!window.chrome.runtime.lastError && response && response.text) {
                        const newText = response.text.trim();
                        // Only override if we're not currently checking anything
                        if (newText && newText !== data.savedInput && !data.isChecking) {
                            citationInput.value = newText;
                            chrome.storage.local.set({savedInput: newText});
                            chrome.storage.local.remove(['jobResults']); // Clear results since input changed
                            renderResults([]); // clear UI
                        }
                    }
                });
            }
        });
    });

    // Listen to changes from the background script checking process
    chrome.storage.onChanged.addListener(function (changes, namespace) {
        if (namespace === 'local') {
            if (changes.jobResults) {
                renderResults(changes.jobResults.newValue);
            }
            
            // Re-fetch full state for UI updates
            chrome.storage.local.get(['isChecking', 'checkedCount', 'totalCount'], (data) => {
                updateCheckingState(data.isChecking, data.checkedCount, data.totalCount);
                if (!data.isChecking && currentExportData.length > 0) {
                    exportBtn.classList.remove('hidden');
                    exportBtn.disabled = false;
                }
            });
        }
    });

    citationInput.addEventListener('input', () => {
        chrome.storage.local.set({savedInput: citationInput.value});
    });

    checkBtn.addEventListener('click', () => {
        const fullText = citationInput.value.trim();
        if (!fullText) return;

        let chunks = [];
        if (fullText.includes('\n\n')) {
            chunks = fullText.split(/\n\n+/);
        } else {
            chunks = fullText.split(/\n+/);
        }
        chunks = chunks.map(c => c.trim()).filter(c => c.length > 20);
        if (chunks.length === 0) { chunks = [fullText]; }

        // Trigger job entirely in background
        chrome.runtime.sendMessage({action: "startJob", chunks: chunks});
    });

    exportBtn.addEventListener('click', () => {
        if (!currentExportData || currentExportData.length === 0) return;
        
        const headers = ['Original Query', 'Confidence Score', 'Title', 'Authors', 'Year', 'Journal/Container', 'DOI'];
        const rows = [headers];

        currentExportData.forEach(item => {
            rows.push([
                `"${(item.query || '').replace(/"/g, '""')}"`,
                `"${item.score}"`,
                `"${(item.title || '').replace(/"/g, '""')}"`,
                `"${(item.authors || '').replace(/"/g, '""')}"`,
                `"${item.year}"`,
                `"${(item.container || '').replace(/"/g, '""')}"`,
                `"${item.doi}"`
            ]);
        });

        const csvContent = rows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `crossref_citations_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    function generateResultsHTML(results) {
        if (results.length === 0) return '<div class="no-results">No matches found in Crossref.</div>';
        let html = '';
        results.forEach(res => {
            const authorText = res.authors ? res.authors.map(a => a.join(' ')).join(', ') : 'Unknown Authors';
            const yearStr = res.year ? ` (${res.year})` : '';
            const title = res.title || 'Unknown Title';
            const container = res.container ? `<i>${res.container}</i>.` : '';
            const doiLink = res.doi ? `<a href="https://doi.org/${res.doi}" target="_blank">${res.doi}</a>` : 'No DOI';
            html += `
                <div class="result-card">
                    <div class="confidence">Confidence Score: ${res.score ? res.score.toFixed(2) : 'N/A'}</div>
                    <div class="citation"><b>${authorText}</b>${yearStr}. ${title}. ${container}</div>
                    <div class="doi">DOI: ${doiLink}</div>
                </div>
            `;
        });
        return html;
    }
});
