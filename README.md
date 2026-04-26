# Crossref Citation Checker Extension

A fully standalone modern Chrome Extension that allows you to easily verify citations against the [Crossref REST API](https://api.crossref.org/) in bulk, straight from your browser.

## Features
* **Select & Check**: Highlight a citation on any webpage, click the extension, and it automatically captures your selection.
* **Smart Bulk Processing**: Paste a massive list of references. The extension auto-splits them, filtering out noise, and queries them sequentially to prevent heavy API rate-limiting!
* **Background Processing & Memory**: Checking occurs safely via a background service worker. If you close the popup to look at another tab, it doesn't interrupt the process! Your completed results are saved to local storage so they are waiting for you when you return.
* **Export to CSV**: One-click download of all validated top matches into a neat CSV spreadsheet for easy organizing.

## Installation & Usage
1. Clone or download this repository to your local machine.
2. Open Google Chrome and type `chrome://extensions/` in your URL bar.
3. Toggle on **Developer mode** in the top right corner.
4. Unzip the **crossref-main.zip** file.
5. Click **Load unpacked** and select the `/extension` directory inside this repository.
5. Pin the **Crossref Citation Checker** extension to your toolbar.
6. **To check citations:** Simply highlight or just select the entire citations on any web page and launch the extension, or open the extension and paste them manually, then click "Check Citation"!
