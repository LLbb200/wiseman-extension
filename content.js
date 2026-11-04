// THIS LISTENS for messages sent from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "NDC") {
    console.log("Received data from background script:", message.payload);

    
    const container = document.querySelector("#target-element");
    if (container) {
      container.innerText = "Captured content ready!";
      console.log("fsafd")
    }
  }
});