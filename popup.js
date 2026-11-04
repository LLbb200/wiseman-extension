// popup.js

let selectedMode = "Easy";
let currentDB = null;

document.addEventListener('DOMContentLoaded', async () => {
  const dbStatus = document.getElementById('db-status');
  const questionList = document.getElementById('question-list');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const resetBtn = document.getElementById('reset-btn');

  async function loadData() {
    const storage = await chrome.storage.local.get(['wiseman_db']);
    if (storage.wiseman_db) {
      currentDB = storage.wiseman_db;
      dbStatus.textContent = "XML Ready";
      dbStatus.classList.add('active');
      renderQuestions();
    } else {
      dbStatus.textContent = "Waiting for XML...";
      dbStatus.classList.remove('active');
      questionList.innerHTML = '<div style="font-size: 11px; color: #666; padding: 10px; text-align: center;">Open or refresh the course page to capture XML data.</div>';
    }
  }

  // Initial load
  loadData();

  // Reset / Rescan button
  resetBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove(['wiseman_db']);
    currentDB = null;
    loadData();
  });

  // Mode Selection
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMode = btn.getAttribute('data-mode');
      renderQuestions();
    });
  });

  function renderQuestions() {
    if (!currentDB) return;
    const pool = selectedMode === "Challenging" ? currentDB.Challenging : currentDB.Easy;

    if (!pool || pool.length === 0) {
      questionList.innerHTML = `<div style="font-size: 11px; color: #666; padding: 10px; text-align: center;">No questions found in [${selectedMode}].</div>`;
      return;
    }

    questionList.innerHTML = pool.map((q, idx) => `
      <div class="q-item" data-index="${idx}">
        <div class="q-prompt">Q${idx + 1}: ${escapeHtml(q.prompt)}</div>
        <div class="q-ans">Answer: ${escapeHtml(q.answers.join(' | '))}</div>
      </div>
    `).join('');

    // Click to autofill sequential inputs on screen
    document.querySelectorAll('.q-item').forEach(item => {
      item.addEventListener('click', async () => {
        const qIndex = item.getAttribute('data-index');
        const questionData = pool[qIndex];

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: fillSequentialInputsOnScreen,
          args: [questionData]
        });
      });
    });
  }
});

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Scans for all inputs/textareas and populates them sequentially in order with the answer array
function fillSequentialInputsOnScreen(targetQuestion) {
  let filled = false;

  function scanDoc(doc) {
    if (filled) return;

    // Search for question text snippet on screen to locate the container block
    const allElements = doc.querySelectorAll('*');
    for (const el of allElements) {
      if (el.children.length === 0 && el.textContent.trim().length > 5) {
        const text = el.textContent.trim().toLowerCase();
        const snippet = targetQuestion.prompt.substring(0, 15).toLowerCase();

        if (text.includes(snippet)) {
          let container = el.closest('form, fieldset, li, div[class*="question"], div[id*="question"], article') || el.parentElement?.parentElement;

          if (container) {
            // Find all text inputs / textareas within this specific question container
            const textInputs = container.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
            if (textInputs.length > 0) {
              textInputs.forEach((input, i) => {
                const valToFill = targetQuestion.answers[i] || targetQuestion.answers[0] || "";
                if (input.contentEditable === "true") {
                  input.textContent = valToFill;
                } else {
                  input.value = valToFill;
                }
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
              });
              filled = true;
              return;
            }
          }
        }
      }
    }

    // Fallback: If no container match, find all inputs on the active page and fill them sequentially
    if (!filled) {
      const globalInputs = doc.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
      if (globalInputs.length > 0 && targetQuestion.answers.length > 0) {
        globalInputs.forEach((input, i) => {
          const valToFill = targetQuestion.answers[i] || targetQuestion.answers[0] || "";
          if (input.contentEditable === "true") {
            input.textContent = valToFill;
          } else {
            input.value = valToFill;
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        filled = true;
        return;
      }
    }

    // Check accessible iframes recursively
    doc.querySelectorAll('iframe').forEach(iframe => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc) scanDoc(iframeDoc);
      } catch (e) {}
    });
  }

  scanDoc(document);
}