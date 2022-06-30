const url = chrome.runtime.getURL('jmdict-slim');
const sentenceUrl = chrome.runtime.getURL('sentences');
let jdictJSON = {};
let sentences = [];
let jishoDefinitions = {};
let options = {};

async function loadDictionary() {
  let response = await fetch(url);

  jdictJSON    = await response.json();
}

async function loadSentences() {
  let response = await fetch(sentenceUrl);

  sentences    = await response.json();
}


async function getOptions() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({
        ankiConnectUrl: 'localhost:8765',
        ankiConnectApiKey: null,
        deckName: null,
        modelName: null,
        kanjiField: null,
        readingField: null,
        meaningField: null,
        exampleSentenceJp: null,
        exampleSentenceEn: null,
    }, function(items) {
        resolve(items);
    });
  });
}

const checkAnkiConnectivity = async () => {
  let body = {
      "action": "requestPermission",
      "version": 6,
  };

  if(options.ankiConnectApiKey) {
      body.key = options.ankiConnectApiKey;
  }

  const response = await fetch(`http://${options.ankiConnectUrl}`, {
      method: 'POST',
      body: JSON.stringify(body)
  });

  const rJson = await response.json();

  if (rJson.error || rJson.result.permission == 'denied' || (
    rJson.result.permission == 'granted' && rJson.result.requireApiKey && !options.ankiConnectApiKey
  )) {
      return false;
  }

  return true;
};


function findSentences(words) {
  const foundSentences = [];

  sentences.forEach(pair => {
    words.forEach(word => {
      if (pair[0].indexOf(word) !== -1) {
        foundSentences.push(pair);
      }
    })
  })

  return foundSentences;
}

function generateAddPill(id, entry) {
  var fragment = document.createElement('div');

  fragment.innerHTML = `<div
    style="
        background-color: cyan;
        width: 50px;
        text-align: center;
        border-radius: 10px;
        font-size: 10px;
        position: absolute;
        right: 20px;
        cursor: pointer;
    ">Add</div>`;

  fragment.children[0].onclick = () => {
    const addForm = createAddForm(id, entry);

    entry.prepend(addForm);
  }

  return fragment.children[0];
}

function createAddForm(id, entry) {
  const fragment = document.createElement('div');
  const definition = jishoDefinitions[id];
  const foundSentences = findSentences(jdictJSON[id].kanji.concat(jdictJSON[id].kana));

  const kanji = definition.kanji;
  const kana = definition.kana;
  const senses = definition.senses;

  const kanjiSelectors = kanji.map(kanji => { return `<option value="${kanji}">${kanji}</option>` });
  const kanaSelectors = kana.map(kana => { return `<option value="${kana}">${kana}</option>` });
  const senseSelectors = senses.map(sense => { return `<option value="${sense}">${sense}</option>` });
  const sentenceSelectors = foundSentences.map(sentence => {
    const jp = sentence[0];
    const en = sentence[1];
    return `<option value="${jp + ';:;' + en}">${jp} ${en}</option>`
  });

  fragment.innerHTML = `
  <form>
    <hr/>
    <h2>Add Word</h2>
    <div>
      Kanji:
      <select class="kanji">
        ${kanjiSelectors}
      </select>
    </div>
    <div>
      Reading:
      <select class="kana">
        ${kanaSelectors}
      </select>
    </div>
    <div>
      Meaning:
      <select class="sense">
        ${senseSelectors}
      </select>
    </div>
    <div>
      Example Sentence:
      <select class="sentence">
        ${sentenceSelectors}
      </select>
    </div>

    <input type="submit" value="Add Word" style="width: 100%; height: 30px;" />
    <hr/>
  </form>
  `;

  const form = fragment.children[0];

  form.onsubmit = (e) => {
    e.preventDefault();

    let chosenKanji = form.querySelector('.kanji').value;
    let chosenKana = form.querySelector('.kana').value;
    const chosenSense = form.querySelector('.sense').value;
    const chosenSentence = form.querySelector('.sentence').value;
    const chosenJp = chosenSentence.split(';:;')[0];
    const chosenEn = chosenSentence.split(';:;')[1];

    if(!chosenKanji) {
      chosenKanji = chosenKana;
      chosenKana = '';
    }

    const fields = {};
    if (options.kanjiField) {
      fields[options.kanjiField] = chosenKanji;
    }
    if (options.readingField) {
      fields[options.readingField] = chosenKana;
    }
    if (options.meaningField) {
      fields[options.meaningField] = chosenSense;
    }
    if (options.exampleSentenceJp) {
      fields[options.exampleSentenceJp] = chosenJp;
    }
    if (options.exampleSentenceEn) {
      fields[options.exampleSentenceEn] = chosenEn;
    }

    fields["Notes"] = id;

    fetch(`http://${options.ankiConnectUrl}`, {
      method: 'POST',
      body: JSON.stringify({
        "action": "addNote",
        "version": 6,
        "params": {
            "note": {
                "deckName": options.deckName,
                "modelName": options.modelName,
                "fields": fields,
                "tags": [
                  "jisho2anki"
                ],
                "options": {
                    "allowDuplicate": false
                }
            }
        }
      })
    }).then(() =>{
      const addPill = generateAddedPill();
      entry.append(addPill);
    });

    form.remove();
  };

  return fragment.children[0];
}

function generateAddedPill() {
  var fragment = document.createElement('div');

  fragment.innerHTML = `<div style="
        background-color: lightgreen;
        width: 50px;
        text-align: center;
        border-radius: 10px;
        font-size: 10px;
        position: absolute;
        right: 20px;
    ">Added</div>`;

  return fragment.children[0];
}

function generateLoadingPill() {
  var fragment = document.createElement('div');

  fragment.innerHTML = `<div style="
        background-color: yellow;
        width: 50px;
        text-align: center;
        border-radius: 10px;
        font-size: 10px;
        position: absolute;
        right: 20px;
    ">Loading</div>`;

  return fragment.children[0];
}

// TODO: Have a different way to check if card already exists
// TODO: Dont have static deck name
async function checkForCard(id) {
  let params = {
    "action": "findCards",
    "version": 6,
    "params": {
        "query": `"deck:${options.deckName}" notes:` + id
    }
  };

  if (options.ankiConnectApiKey) {
    params.key = options.ankiConnectApiKey;
  }

  let response = await fetch(`http://${options.ankiConnectUrl}`, {
                              method: 'POST',
                              body: JSON.stringify(params)
                            });
  let json = await response.json();

  if (json.error || json.result.length === 0) {
    return false;
  }

  return true;
}

async function loadJishoDefinitions() {
  const entries = document.querySelectorAll('#primary .concept_light');

  for (entry of entries) {
    const maybeJMDict = entry.querySelector('ul.f-dropdown > li:last-child');

    const loadingPill = generateLoadingPill();


    if (!maybeJMDict || maybeJMDict.innerText != 'Edit in JMdict') {
      continue;
    }

    const jmdictLink = maybeJMDict.querySelector('a').href;
    const id = jmdictLink.match(/&q=(\d+)/)[1];

    if (!id) {
      continue;
    }

    const definition = jdictJSON[id];

    if (!definition) {
      continue;
    }

    jishoDefinitions[id] = jdictJSON[id];

    entry.append(loadingPill);

    const alreadyAdded = await checkForCard(id);

    loadingPill.remove();

    if (alreadyAdded) {
      const pill = generateAddedPill();

      entry.append(pill);
    } else {
      const pill = generateAddPill(id, entry);

      entry.append(pill);
    }
  }
}

((async () => {
  options = await getOptions();
  // Not configured get out of here
  const hasOneField = !!options.kanjiField || !!options.readingField || !!options.meaningField || !!options.exampleSentenceEn || !!options.exampleSentenceJp;
  if(!options.ankiConnectUrl || !options.deckName || !options.modelName || !hasOneField) {
    return;
  }

  let active = await checkAnkiConnectivity();
  if (!active) {
    return;
  }

  await loadDictionary();
  await loadSentences();
  await loadJishoDefinitions();
})());
