const citationContainer = document.getElementById('citation');
const copyButton = document.getElementById('copyButton');
const fetchCitationBtn = document.getElementById('fetchCitation');
const detectedDOIContainer = document.getElementById('autoDetectedDOIs');
const styleSelect = document.getElementById('styleSelect');

async function loadStyles() {
  try {
    const response = await fetch('https://citation.doi.org/styles');
    const styles = await response.json();
    styles.sort();

    styleSelect.innerHTML = '';
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
  const userInput = document.getElementById('doiInput').value.trim();
  citationContainer.textContent = 'Fetching citation...';
  copyButton.style.display = 'none';

  if (!userInput) {
    citationContainer.textContent = 'Please enter a DOI or PMID.';
    return;
  }

  const doiFromURL = userInput.match(/10\.\d{4,9}\/[^"]+/);
  const isPMID = /^[0-9]+$/.test(userInput);
  const isDOI = /^10\.\d{4,9}\/[^"]+$/.test(userInput);

  if (isPMID) {
    await fallbackCheckForPMID(`PMID: ${userInput}`);
  } else if (isDOI) {
    await fetchAndDisplayCitation(cleanDOI(userInput), citationContainer, copyButton);
  } else if (doiFromURL) {
    await fetchAndDisplayCitation(cleanDOI(doiFromURL[0]), citationContainer, copyButton);
  } else {
    citationContainer.textContent = 'Invalid input. Please enter a valid DOI or PMID.';
  }
});

copyButton.addEventListener('click', () => {
  const text = citationContainer.textContent;
  navigator.clipboard.writeText(text).then(() => {
    copyButton.textContent = 'Copied!';
    setTimeout(() => { copyButton.textContent = 'Copy'; }, 1500);
  });
});

function cleanDOI(doi) {
  return doi
    .replace(/["'“”‘’]+/g, '')
    .replace(/\b(Citations|References|Accessed|Published).*$/i, '')
    .replace(/[.,;:)\]}\s]+$/, '')
    .trim();
}

function renderDOIList(dois, label = 'Detected DOIs') {
  if (dois.length === 0) return;

  const title = document.createElement('h4');
  title.textContent = label;
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

async function fallbackCheckForPMID(content) {
  const pmidMatch = content.match(/PMID[:\s]*([0-9]+)/i) ||
                    content.match(/https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/([0-9]+)/i);

  if (!pmidMatch) return;

  const pmid = pmidMatch[1];

  try {
    const summaryResponse = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}`);
    const xmlText = await summaryResponse.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const doiNode = xmlDoc.querySelector('Item[Name="doi"]');

    if (doiNode && doiNode.textContent) {
      renderDOIList([cleanDOI(doiNode.textContent)], `Detected DOI from PMID: ${pmid}`);
    } else {
      const citationResp = await fetch(`https://pubmed.ncbi.nlm.nih.gov/${pmid}/citations/`);
      const citationJSON = await citationResp.json();
      const citationData = citationJSON;

      if (citationData?.ama?.orig) {
        const block = document.createElement('div');
        block.className = 'citation-block';

        const label = document.createElement('h4');
        label.textContent = `Citation (from PMID ${pmid}, DOI not found):`;

        const outputEl = document.createElement('div');
        outputEl.textContent = citationData.ama.orig;

        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        copyBtn.style.marginTop = '5px';

        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(outputEl.textContent).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
          });
        });

        block.appendChild(label);
        block.appendChild(outputEl);
        block.appendChild(copyBtn);
        detectedDOIContainer.appendChild(block);
      } else {
        const msg = document.createElement('div');
        msg.textContent = `PMID ${pmid} found, but no DOI or citation info was available.`;
        msg.style.fontStyle = 'italic';
        detectedDOIContainer.appendChild(msg);
      }
    }
  } catch (err) {
    console.error('Failed to fetch or parse PubMed info or citation:', err);
    const msg = document.createElement('div');
    msg.textContent = `Error fetching citation info for PMID ${pmid}.`;
    msg.style.fontStyle = 'italic';
    detectedDOIContainer.appendChild(msg);
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabs[0].id },
      func: () => {
        const text = document.body.innerText;
        const links = [...document.querySelectorAll('a[href*="doi.org/"]')];
        const hrefs = links.map(l => l.href);
        return JSON.stringify({ text, hrefs });
      }
    },
    async (results) => {
      const result = results[0]?.result;
      if (!result) return;

      const { text, hrefs } = JSON.parse(result);

      const rawDOIs = [];
      const strictDOIRegex = /10\.\d{4,9}\/[\w.()\-;/:]+/gi;

      hrefs.forEach(href => {
        const match = href.match(strictDOIRegex);
        if (match) rawDOIs.push(...match);
      });

      for (const match of text.matchAll(strictDOIRegex)) {
        rawDOIs.push(match[0]);
      }

      const cleaned = rawDOIs.map(cleanDOI).filter(doi => doi.length >= 10);
      const uniqueDOIs = [...new Set(cleaned)];

      const validatedDOIs = [];
      for (let i = 0; i < uniqueDOIs.length; i++) {
        const doi = uniqueDOIs[i];
        const hasShorterMatch = uniqueDOIs.some(other =>
          other !== doi && doi.includes(other)
        );

        if (!hasShorterMatch) {
          validatedDOIs.push(doi);
        } else {
          try {
            const res = await fetch(
              `https://citation.doi.org/format?doi=${encodeURIComponent(doi)}&style=american-medical-association&lang=en-US`,
              { headers: { 'Accept': 'text/x-bibliography' } }
            );
            if (res.ok) validatedDOIs.push(doi);
          } catch (err) {
            console.warn(`Rejected likely invalid DOI: ${doi}`);
          }
        }
      }

      if (validatedDOIs.length > 0) {
        renderDOIList(validatedDOIs);
      } else {
        fallbackCheckForPMID(text);
      }
    }
  );
});