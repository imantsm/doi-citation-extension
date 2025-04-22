document.addEventListener('DOMContentLoaded', () => {
  const resetBtn = document.getElementById('resetDefaults');
  const refreshBtn = document.getElementById('refreshStyles');
  const status = document.getElementById('status');
  const lastUpdatedText = document.getElementById('lastUpdated');

  const STYLES_CACHE_KEY = 'cachedStyles';
  const STYLES_TIMESTAMP_KEY = 'stylesLastUpdated';

  // Show last updated date
  chrome.storage.local.get([STYLES_TIMESTAMP_KEY], (result) => {
    const ts = result[STYLES_TIMESTAMP_KEY];
    if (ts) {
      const date = new Date(ts).toLocaleString();
      lastUpdatedText.textContent = `Last updated: ${date}`;
    } else {
      lastUpdatedText.textContent = 'Last updated: never';
    }
  });

  // Reset to default style
  resetBtn.addEventListener('click', () => {
    chrome.storage.local.set({ preferredStyle: 'american-medical-association' }, () => {
      status.textContent = 'Preferences reset to defaults.';
      status.style.color = 'green';
    });
  });

  // Force refresh styles
  refreshBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('https://citation.doi.org/styles');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const styles = await response.json();
      styles.sort();
      const now = Date.now();

      chrome.storage.local.set({
        [STYLES_CACHE_KEY]: styles,
        [STYLES_TIMESTAMP_KEY]: now
      }, () => {
        const date = new Date(now).toLocaleString();
        lastUpdatedText.textContent = `Last updated: ${date}`;
        status.textContent = 'Style list successfully refreshed.';
        status.style.color = 'green';
      });
    } catch (err) {
      console.error('Style refresh failed:', err);
      status.textContent = 'Failed to refresh style list.';
      status.style.color = 'red';
    }
  });
});
