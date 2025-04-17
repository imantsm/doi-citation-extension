document.getElementById('fetchCitation').addEventListener('click', async () => {
  const doiValue = document.getElementById('doiInput').value.trim();
  const output = document.getElementById('citation');
  const copyButton = document.getElementById('copyButton');
  
  output.textContent = 'Fetching citation...';
  copyButton.style.display = 'none';

  if (!doiValue) {
    output.textContent = 'Please enter a DOI.';
    return;
  }

  try {
    const response = await fetch(
      `https://citation.doi.org/format?doi=${encodeURIComponent(doiValue)}&style=american-medical-association&lang=en-US`,
      {
        headers: {
          'Accept': 'text/x-bibliography'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const citation = await response.text();
    output.textContent = citation;
    copyButton.style.display = 'block';
  } catch (err) {
    output.textContent = `Failed to fetch citation:\n${err.message}`;
  }
});

document.getElementById('copyButton').addEventListener('click', () => {
  const text = document.getElementById('citation').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyButton');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
});
