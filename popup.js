const citationContainer = document.getElementById('citation');
const copyButton = document.getElementById('copyButton');
const fetchCitationBtn = document.getElementById('fetchCitation');
const detectedDOIContainer = document.getElementById('autoDetectedDOIs');
const styleSelect = document.getElementById('styleSelect');

// Load citation styles on popup open
async function loadStyles() {
  try {
    const response = await fetch('https://citation.doi.org/styles');
    const styles = await response.json();
    styles.sort();

    styleSelect.innerHTML = ''; // Clear placeholder
    styles.forEach((style) => {
      const option = document.createElement('option');
      option.value = style;
      option.textContent = style;
      if (style === 'american-medical-association') {
        option.selected = true;
      }
      styleSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load styles:', error);
    styleSelect.innerHTML = '<option value="american-medical-association">american-medical-association</option>';
  }
}

loadStyles();

fetchCitationBtn.addEventListener('click', async () => {
  const doiValue = document.getElementById('doiInput').value.trim();
  citationContainer.textContent = 'Fetching citation...';
  copyButton.style.display = 'none';

  if (!doiValue) {
    citationContainer.textContent = 'Please enter a DOI.';
    return;
  }

  await fetchAndDisplayCitation(doiValue, citationContainer, copyButton);
});

copyButton.addEventListener('click', () => {
  const text = citationContainer.textContent;
  navigator.clipboard.writeText(text).then(() => {
    copyButton.textContent = 'Copied!';
    setTimeout(() => { copyButton.textContent = 'Copy'; }, 1500);
  });
});

async function fetchAndDisplayCitation(doi, targetEl, copyBtn = null) {
  const style = styleSelect.value || 'american-medical-association';

  try {
    const response = await fetch(
      `https://citation.doi.org/format?doi=${encodeURIComponent(doi)}&style=${encodeURIComponent(style)}&lang=en-US`,
      {
        headers: {
          'Accept': 'text/x-bibliography'
        }
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

function extractDOIsFromPageContent(content) {
  const dois = new Set();

  const linkRegex = /https?:\/\/doi\.org\/(10\.\d{4,9}\/[^\s"'>]+)/gi;
  const linkMatches = content.matchAll(linkRegex);
  for (const match of linkMatches) {
    dois.add(match[1]);
  }

  const textRegex = /DOI[:\s]*?(10\.\d{4,9}\/[^\s"'>]+)/gi;
  const textMatches = content.matchAll(textRegex);
  for (const match of textMatches) {
    dois.add(match[1]);
  }

  return [...dois];
}

function renderDOIList(dois) {
  if (dois.length === 0) {
    detectedDOIContainer.innerHTML = '<p>No DOIs detected on this page.</p>';
    return;
  }

  const title = document.createElement('h4');
  title.textContent = 'Detected DOIs:';
  detectedDOIContainer.appendChild(title);

  dois.forEach((doi) => {
    const doiEl = document.createElement('div');
    doiEl.className = 'found-doi';
    doiEl.textContent = doi;

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

// Extract page content and parse DOIs
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
