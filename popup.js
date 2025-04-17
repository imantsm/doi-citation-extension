const citationContainer = document.getElementById('citation');
const copyButton = document.getElementById('copyButton');
const fetchCitationBtn = document.getElementById('fetchCitation');
const detectedDOIContainer = document.getElementById('autoDetectedDOIs');

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
  try {
    const response = await fetch(
      `https://citation.doi.org/format?doi=${encodeURIComponent(doi)}&style=american-medical-association&lang=en-US`,
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

  // Match links like https://doi.org/10.xxxx
  const linkRegex = /https?:\/\/doi\.org\/(10\.\d{4,9}\/[^\s"'>]+)/gi;
  const linkMatches = content.matchAll(linkRegex);
  for (const match of linkMatches) {
    dois.add(match[1]);
  }

  // Match "DOI: 10.xxxx"
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

// Inject content script to get page text
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabs[0].id },
      func: () => document.body.innerText,
    },
    (results) => {
      const pageText = results[0]?.result || '';
      const dois = extractDOIsFromPageContent(pageText);
      renderDOIList(dois);
    }
  );
});
