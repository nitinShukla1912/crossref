chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.action === "getSelectedText") {
      sendResponse({ text: window.getSelection().toString() });
    }
  }
);
