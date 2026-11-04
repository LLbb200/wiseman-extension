// background.js

const MAP = "c3D1RFP9eM[UjINfOZi0Qg+mhkxSJ5p* uX8B}`-rs,LqAH@lnbVT.C{z4YWtGv72^/aw|do_6\\yE~]K";
let lastProcessedUrl = "";

function decrypt(n, t) {
  let i = "";
  for (let o, s, r = 0; r < n.length; r++) {
    o = n.charCodeAt(r);
    s = 32 === o ? 0 : o >= 42 && o <= 57 ? o - 41 : o >= 64 && o <= 126 ? o - 47 : -1;
    if (s >= 0 && s <= 79) {
      s = s + r + t;
      while (s >= 80) s -= 80;
      i += MAP.charAt(s);
    } else {
      i += n.charAt(r);
    }
  }
  return i;
}

function getAttr(str, attr) {
  const match = str.match(new RegExp(`${attr}=["']([^"']*)["']`, 'i'));
  return match ? match[1] : null;
}

function parseEXMLGrouped(xmlString) {
  const seedMatch = xmlString.match(/<course[^>]+seed=["'](\d+)["']/i);
  if (!seedMatch) return null;

  const seed = parseInt(seedMatch[1], 10);
  const result = {
    Easy: [],
    Challenging: [],
    All: []
  };

  // Split XML by <group>
  const groupBlocks = xmlString.split(/<group[\s>]/i).slice(1);

  groupBlocks.forEach(gBlock => {
    const fullGroup = "<group " + gBlock;
    const groupName = (getAttr(fullGroup, 'name') || "Easy").trim();
    const isChallenging = groupName.toLowerCase().includes("challenging");
    const categoryKey = isChallenging ? "Challenging" : "Easy";

    const questionBlocks = gBlock.split(/<question[\s>]/i).slice(1);

    questionBlocks.forEach(qBlock => {
      const fullQ = "<question " + qBlock;
      let qText = getAttr(fullQ, 'text') || "";

      const textMatches = fullQ.match(/<text[^>]+text=["']([^"']*)["']/gi) || [];
      textMatches.forEach(tNode => {
        const txt = getAttr(tNode, 'text');
        if (txt) qText += " " + txt;
      });

      const type = getAttr(fullQ, 'type');
      let answers = [];

      if (type === 'smc') {
        const correctAttr = getAttr(fullQ, 'correct');
        if (correctAttr) {
          const decryptedIndex = parseInt(decrypt(correctAttr, seed), 10);
          const answerMatches = fullQ.match(/<answer[^>]+text=["']([^"']*)["']/gi) || [];
          if (!isNaN(decryptedIndex) && decryptedIndex > 0 && decryptedIndex <= answerMatches.length) {
            answers.push(getAttr(answerMatches[decryptedIndex - 1], 'text'));
          }
        }
      } else if (type === 'mmc') {
        const correctAnswers = fullQ.match(/<answer[^>]+correct=[^>]+>/gi) || [];
        correctAnswers.forEach(ansNode => {
          const txt = getAttr(ansNode, 'text');
          if (txt) answers.push(txt);
        });
      } else {
        const correctNodes = fullQ.match(/<[^>]+correct=["']([^"']*)["']/gi) || [];
        correctNodes.forEach(node => {
          if (!node.toLowerCase().startsWith('<question')) {
            const encryptedStr = getAttr(node, 'correct');
            if (encryptedStr) answers.push(decrypt(encryptedStr, seed));
          }
        });
      }

      if (answers.length > 0) {
        const item = {
          prompt: qText.replace(/\s+/g, ' ').trim(),
          answers: answers,
          group: categoryKey
        };
        result[categoryKey].push(item);
        result.All.push(item);
      }
    });
  });

  return result;
}

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.url.includes(".xml") || details.url.includes("course_pc.exml") || details.url.includes(".exml")) {
      // Prevent non-stop logging for repeated hits on the same file
      if (lastProcessedUrl === details.url) return;
      lastProcessedUrl = details.url;

      console.log("🎯 XML Intercepted:", details.url);

      (async () => {
        try {
          const response = await fetch(details.url);
          const xmlText = await response.text();
          const parsedData = parseEXMLGrouped(xmlText);

          if (parsedData) {
            console.log(`Parsed ${parsedData.Easy.length} Easy and ${parsedData.Challenging.length} Challenging questions.`);
            
            // Save parsed XML questions directly to Chrome local storage for the popup to read
            await chrome.storage.local.set({
              wiseman_db: parsedData,
              last_xml_url: details.url
            });
          }
        } catch (err) {
          console.error("Failed to parse XML:", err);
        }
      })();
    }
  },
  { urls: ["<all_urls>"] }
);