This is a Chrome extension that will look up citations based on DOI or PMID numbers.

The user can input the DOI or PMID number manually and select the style. It currently defaults to american-medical-association.

The extension will also attempt to detect DOI and PMID numbers on the given page.

With PMID numbers, it first looks at the PMID metadata to see if there is an associated DOI number. If so, it pulls that, since the DOI API allows 
for formatting the citation according to the selected style. If there is no DOI number, then it uses PMID's citation API to generate a citation. 
It currently defaults to AMA.


How to install your own instance in a Chromium-based browser (such as Chrome, Brave, and Edge):
* Download the files from this repo into a folder or directory of your choosing.
* In your browser menu, click on 'Extensions' -> 'Manage Extensions'
* There is a 'Developer Mode' switch or setting. Turn it on.
* Click 'Load Unpacked'
* Choose the folder or directory where you downloaded the files from this repo.
