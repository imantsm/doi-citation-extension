document.addEventListener('DOMContentLoaded', () => {
  const resetBtn = document.getElementById('resetDefaults');
  const status = document.getElementById('status');

  resetBtn.addEventListener('click', () => {
    chrome.storage.local.set({ preferredStyle: 'american-medical-association' }, () => {
      if (chrome.runtime.lastError) {
        status.textContent = 'Error resetting preferences.';
        status.style.color = 'red';
        console.error(chrome.runtime.lastError);
      } else {
        status.textContent = 'Preferences reset to defaults.';
        status.style.color = 'green';
      }
    });
  });
});
