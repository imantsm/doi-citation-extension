// === DOM References ===
const citationContainer = document.getElementById('citation');
const copyButton = document.getElementById('copyButton');
const fetchCitationBtn = document.getElementById('fetchCitation');
const detectedDOIContainer = document.getElementById('autoDetectedDOIs');
const styleSelect = document.getElementById('styleSelect');

// === PubMed API throttling delay ===
const pubmedThrottleDelay = 400; // milliseconds between PubMed requests

// Utility to wait (used to respect rate limits)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Cleans up DOI strings by removing extra punctuation, quotes, or suffixes
function cleanDOI(doi) {
  return doi
    .replace(/["'“”‘’]+/g, '') // Remove quotation marks
    .replace(/\b(Citations|References|Accessed|Published).*$/i, '') // Strip trailing labels
    .replace(/[.,;:)\]}\s]+$/, '') // Trim punctuation at the end
    .trim();
}

// Loads style list (from cache if fresh; otherwise fetches it), then populates dropdown
async function loadStyles() {
  const STYLES_CACHE_KEY = 'cachedStyles';
  const STYLES_TIMESTAMP_KEY = 'stylesLastUpdated';
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  chrome.storage.local.get(['preferredStyle', STYLES_CACHE_KEY, STYLES_TIMESTAMP_KEY], async (result) => {
    const savedStyle = result.preferredStyle || 'american-medical-association';
    const cachedStyles = result[STYLES_CACHE_KEY];
    const lastUpdated = result[STYLES_TIMESTAMP_KEY];

    const now = Date.now();
    const isFresh = cachedStyles && lastUpdated && (now - lastUpdated < MAX_AGE_MS);

    let styles = [];

    if (isFresh) {
      console.log('[Style Loader] Loaded styles from local cache');
      styles = cachedStyles;
    } else {
      console.log('[Style Loader] Fetching styles from https://citation.doi.org/styles');
      try {
        const response = await fetch('https://citation.doi.org/styles');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        styles = await response.json();
        styles.sort();
        chrome.storage.local.set({
          [STYLES_CACHE_KEY]: styles,
          [STYLES_TIMESTAMP_KEY]: now
        });
        console.log('[Style Loader] Fetched and cached styles');
      } catch (err) {
        console.error('[Style Loader] Failed to fetch styles:', err);
        styles = ['american-medical-association']; // fallback
      }
    }

    // Populate the dropdown
    styleSelect.innerHTML = '';
    styles.forEach(style => {
      const option = document.createElement('option');
      option.value = style;
      option.textContent = style;
      styleSelect.appendChild(option);
    });

    // Select previously saved style if available
    styleSelect.value = styles.includes(savedStyle)
      ? savedStyle
      : 'american-medical-association';
  });
}

// Renders clickable list of DOIs
function renderDOIList(dois, label = 'Detected DOIs') {
  if (dois.length === 0) return;

  const title = document.createElement('h4');
  title.textContent = label;
  detectedDOIContainer.appendChild(title);

  dois.forEach((doi) => {
    const doiEl = document.createElement('div');
    doiEl.className = 'found-doi';
    doiEl.textContent = doi;

    // Fetch citation when clicked
    doiEl.addEventListener('click', () => {
      const citationBlock = document.createElement('div');
      citationBlock.className = 'citation-block';
      const outputEl = document.createElement('div');
      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy';
      copyBtn.style.marginTop = '5px';

      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(outputEl.textContent).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
        });
      });

      citationBlock.appendChild(outputEl);
      citationBlock.appendChild(copyBtn);
      doiEl.insertAdjacentElement('afterend', citationBlock);

      fetchAndDisplayCitation(doi, outputEl, copyBtn);
    });

    detectedDOIContainer.appendChild(doiEl);
  });
}

// Fetches a citation for a given DOI using the selected style
async function fetchAndDisplayCitation(doi, targetEl, copyBtn = null) {
  const style = styleSelect.value || 'american-medical-association';

  try {
    const response = await fetch(
      `https://citation.doi.org/format?doi=${encodeURIComponent(doi)}&style=${encodeURIComponent(style)}&lang=en-US`,
      {
        headers: { 'Accept': 'text/x-bibliography' }
      }
    );

    if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

    const citation = await response.text();
    targetEl.textContent = citation;
    if (copyBtn) copyBtn.style.display = 'block';
  } catch (err) {
    targetEl.textContent = `Failed to fetch citation:\n${err.message}`;
    if (copyBtn) copyBtn.style.display = 'none';
  }
}

// Renders clickable PMIDs and fetches citation only after click
function renderPMIDList(pmids) {
  if (pmids.length === 0) return;

  const title = document.createElement('h4');
  title.textContent = 'Detected PMIDs:';
  detectedDOIContainer.appendChild(title);

  pmids.forEach((pmid) => {
    const pmidEl = document.createElement('div');
    pmidEl.className = 'found-doi';
    pmidEl.textContent = `PMID: ${pmid}`;

    // On click, fetch citation (XML first, then fallback)
    pmidEl.addEventListener('click', async () => {
      const citationBlock = document.createElement('div');
      citationBlock.className = 'citation-block';
      const outputEl = document.createElement('div');
      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy';
      copyBtn.style.marginTop = '5px';

      citationBlock.appendChild(outputEl);
      citationBlock.appendChild(copyBtn);
      pmidEl.insertAdjacentElement('afterend', citationBlock);

      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(outputEl.textContent).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
        });
      });

      try {
        // Step 1: Try to fetch DOI via esummary XML
        const xmlRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}`);
        const xmlText = await xmlRes.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const doiNode = xmlDoc.querySelector('Item[Name="doi"]');

        if (doiNode?.textContent) {
          const doi = cleanDOI(doiNode.textContent);
          await fetchAndDisplayCitation(doi, outputEl, copyBtn);
        } else {
          // Step 2: Fall back to /citations/ JSON if no DOI
          await sleep(pubmedThrottleDelay);
          const fallbackRes = await fetch(`https://pubmed.ncbi.nlm.nih.gov/${pmid}/citations/`);
          const citationData = await fallbackRes.json();

          if (citationData?.ama?.orig) {
            outputEl.textContent = citationData.ama.orig;
            copyBtn.style.display = 'block';
          } else {
            outputEl.textContent = `PMID ${pmid} found, but no citation info was available.`;
            copyBtn.style.display = 'none';
          }
        }
      } catch (err) {
        outputEl.textContent = `Error fetching citation for PMID ${pmid}.`;
        console.error('PMID fetch error:', err);
      }
    });

    detectedDOIContainer.appendChild(pmidEl);
  });
}

// Scans page content for DOIs and PMIDs using regular expressions
function extractDOIsAndPMIDs(content) {
  const doiRegex = /10\.\d{4,9}\/[\w.()\-;/:]+/gi;
  const pmidRegex = /\bPMID[:\s]*([0-9]{5,10})\b|https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/([0-9]{5,10})/gi;

  const rawDOIs = [...content.matchAll(doiRegex)].map(m => cleanDOI(m[0]));
  const uniqueDOIs = [...new Set(rawDOIs)];

  const rawPMIDs = [];
  for (const match of content.matchAll(pmidRegex)) {
    const id = match[1] || match[2];
    if (id) rawPMIDs.push(id);
  }
  const uniquePMIDs = [...new Set(rawPMIDs)];

  return { dois: uniqueDOIs, pmids: uniquePMIDs };
}

// === Main Extension Logic ===
document.addEventListener('DOMContentLoaded', () => {
  loadStyles(); // Populate dropdown with styles from cache or network

  // Save selected style to local storage
  styleSelect.addEventListener('change', () => {
    chrome.storage.local.set({ preferredStyle: styleSelect.value });
  });

  // Manual input handler (DOI or PMID)
  fetchCitationBtn.addEventListener('click', async () => {
    const input = document.getElementById('doiInput').value.trim();
    citationContainer.textContent = 'Fetching citation...';
    copyButton.style.display = 'none';

    if (!input) {
      citationContainer.textContent = 'Please enter a DOI or PMID.';
      return;
    }

    const doiFromURL = input.match(/10\.\d{4,9}\/[^"]+/);
    const isPMID = /^[0-9]{5,10}$/.test(input);
    const isDOI = /^10\.\d{4,9}\/[^"]+$/.test(input);

    if (isPMID) {
      renderPMIDList([input]);
    } else if (isDOI) {
      await fetchAndDisplayCitation(cleanDOI(input), citationContainer, copyButton);
    } else if (doiFromURL) {
      await fetchAndDisplayCitation(cleanDOI(doiFromURL[0]), citationContainer, copyButton);
    } else {
      citationContainer.textContent = 'Invalid input. Please enter a valid DOI or PMID.';
    }
  });

  // Manual copy button for results container
  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(citationContainer.textContent).then(() => {
      copyButton.textContent = 'Copied!';
      setTimeout(() => { copyButton.textContent = 'Copy'; }, 1500);
    });
  });

  // Auto-detect DOIs/PMIDs from current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        func: () => document.body.innerText
      },
      async (results) => {
        const text = results[0]?.result || '';
        const { dois, pmids } = extractDOIsAndPMIDs(text);
        if (dois.length) renderDOIList(dois);
        if (pmids.length) renderPMIDList(pmids);
      }
    );
  });
});
