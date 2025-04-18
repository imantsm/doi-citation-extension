This is a Chrome extension that will look up citations based on DOI or PMID numbers.

The user can input the DOI or PMID number manually and select the style. It currently defaults to american-medical-association.

The extension will also attempt to detect DOI numbers on the given page, and failing that, PMID numbers.

With PMID numbers, it first looks at the PMID metadata to see if there is an associated DOI number. If so, it pulls that, since the DOI API allows 
for formatting the citation according to the selected style. If there is no DOI number, then it uses PMID's citation API to generate a citation. 
It currently defaults to AMA.
