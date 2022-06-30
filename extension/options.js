import { html, render } from './htm.js';

(async () => {
    let options = {};
    let saved = false;

    const getOptions = async () => {
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
    };

    const saveOptions = async () => {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({
                ankiConnectUrl: options.ankiConnectUrl,
                ankiConnectApiKey: options.ankiConnectApiKey,
                deckName: options.deckName,
                modelName: options.modelName,
                kanjiField: options.kanjiField,
                readingField: options.readingField,
                meaningField: options.meaningField,
                exampleSentenceJp: options.exampleSentenceJp,
                exampleSentenceEn: options.exampleSentenceEn,
            }, function(items) {
                saved = true;
                refreshForm();
            });
        });
    }

    const fetchConnect = async (action, params) => {
        try {
            let body = {
                "action": action,
                "version": 6,
                "params": params,
            };

            if(options.ankiConnectApiKey) {
                body.key = options.ankiConnectApiKey;
            }

            const response = await fetch(`http://${options.ankiConnectUrl}`, {
                method: 'POST',
                body: JSON.stringify(body)
            });
            
            const rJson = await response.json();

            return rJson;
        } catch (e) {
            return {
                error: e
            }
        }
    }

    const checkAnkiConnectivity = async () => {
        const response = await fetchConnect("requestPermission")

        if (response.error || response.result.permission == 'denied' || (
            response.result.permission == 'granted' && response.result.requireApiKey && !options.ankiConnectApiKey
        )) {
            return false;
        }

        return true;
    };

    const getDecks = async () => {
        const response = await fetchConnect("deckNames")

        if (response.error) {
            return [];
        }
        
        return response.result;
    };

    const getModels = async () => {
        const response = await fetchConnect("modelNames")

        if (response.error) {
            return [];
        }
        
        return response.result;
    };

    const getModelFields = async (modelName) => {
        const response = await fetchConnect("modelFieldNames", { "modelName": modelName })

        if (response.error) {
            return [];
        }
        
        return response.result;
    };

    const updateOptions = async () => {
        options.ankiConnectUrl = document.getElementById('ankiConnectUrl').value;
        options.ankiConnectApiKey = document.getElementById('ankiConnectApiKey').value;
        options.deckName = document.getElementById('targetDeck').value;
        if (options.deckName === 'None') {
            options.deckName = null;
        }
        options.modelName = document.getElementById('targetModel').value;
        if (options.modelName === 'None') {
            options.modelName = null;
        }

        options.kanjiField = document.getElementById('targetKanji').value;
        options.readingField = document.getElementById('targetReading').value;
        options.meaningField = document.getElementById('targetMeaning').value;
        options.exampleSentenceJp = document.getElementById('targetSentenceJP').value;
        options.exampleSentenceEn = document.getElementById('targetSentenceEn').value;

        refreshForm();
    }

    const renderForm = async (enabled, decks, models, modelFields) => {
        return render(html`
            <div>
                <div class="mb-3">
                    <label for="ankiConnectUrl">Anki Connect Url</label>
                    <input type="text" class="form-control" id="ankiConnectUrl" aria-describedby="ankiConnectUrlHelp"  value=${options.ankiConnectUrl} onChange=${updateOptions} />
                    <div id="ankiConnectUrlHelp" class="form-text">URL of Anki Connect (leave default if not changed in Anki)</div>
                </div>
                <div class="mb-3">
                    <label for="ankiConnectApiKey">Anki Connect Api Key</label>
                    <input type="text" class="form-control" id="ankiConnectApiKey" aria-describedby="ankiConnectApiKeyHelp" value=${options.ankiConnectApiKey} onChange=${updateOptions}/>
                    <div id="ankiConnectApiKeyHelp" class="form-text ">Leave blank unless configured in Anki</div>
                </div>
                <div class="alert alert-danger" role="alert" hidden=${enabled}>
                    Unable to connect to Anki. Make sure that anki is running and that the above fields are correct.
                </div>
                <div class="mb-3">
                    <label for="targetDeck">Target Deck</label>
                    <select class="form-select" id="targetDeck" disabled=${!enabled || decks.length < 1} onChange=${updateOptions}>
                        ${decks.map((deck) => {
                            return html`<option value=${deck} selected=${options.deckName == deck}>${deck}</option>`;
                        })}
                    </select>
                </div>
                <div class="mb-3">
                    <label for="targetModel">Card Type</label>
                    <select class="form-select" id="targetModel" disabled=${!enabled || models.length < 1} onChange=${updateOptions}>
                        ${models.map((model) => {
                            return html`<option value=${model} selected=${options.modelName == model}>${model}</option>`;
                        })}
                    </select>
                </div>
                <div class="mb-3">
                    <label for="targetKanji">Kanji Field</label>
                    <select class="form-select" id="targetKanji" disabled=${!enabled || modelFields.length < 1} onChange=${updateOptions}>
                        ${modelFields.map((field) => {
                            return html`<option value=${field} selected=${options.kanjiField == field}>${field}</option>`;
                        })}
                    </select>
                </div>
                <div class="mb-3">
                    <label for="targetReading">Reading Field</label>
                    <select class="form-select" id="targetReading" disabled=${!enabled || modelFields.length < 1} onChange=${updateOptions}>
                        ${modelFields.map((field) => {
                            return html`<option value=${field} selected=${options.readingField == field}>${field}</option>`;
                        })}
                    </select>
                </div>
                <div class="mb-3">
                    <label for="targetMeaning">Meaning Field</label>
                    <select class="form-select" id="targetMeaning" disabled=${!enabled || modelFields.length < 1} onChange=${updateOptions}>
                        ${modelFields.map((field) => {
                            return html`<option value=${field} selected=${options.meaningField == field}>${field}</option>`;
                        })}
                    </select>
                </div>
                <div class="mb-3">
                    <label for="targetSentenceJP">Example Sentence (JP) Field</label>
                    <select class="form-select" id="targetSentenceJP" disabled=${!enabled || modelFields.length < 1} onChange=${updateOptions}>
                        ${modelFields.map((field) => {
                            return html`<option value=${field} selected=${options.exampleSentenceJp == field}>${field}</option>`;
                        })}
                    </select>
                </div>
                <div class="mb-3">
                    <label for="targetSentenceEn">Example Sentence (EN) Field</label>
                    <select class="form-select" id="targetSentenceEn" disabled=${!enabled || modelFields.length < 1} onChange=${updateOptions}>
                        ${modelFields.map((field) => {
                            return html`<option value=${field} selected=${options.exampleSentenceEn == field}>${field}</option>`;
                        })}
                    </select>
                </div>
                <div class="alert alert-success" role="alert" hidden=${!saved}>
                    Settings Saved.
                </div>
                <button type="submit" class="btn btn-primary" onClick=${saveOptions}>Save</button>
            </div>
        `, document.querySelector('#container'));
    }

    const refreshForm = async () => {
        let enabled = await checkAnkiConnectivity();
        let decks = [];
        let models = [];
        let modelFields = [];

        if (enabled) {
            decks = await getDecks();
            models = await getModels();

            decks.unshift('None');
            models.unshift('None');

            if (options.modelName) {
                modelFields = await getModelFields(options.modelName);
            }
        }

        renderForm(enabled, decks, models, modelFields);
    }

    document.addEventListener('DOMContentLoaded', async () => {
        options = await getOptions();

        refreshForm();
    });
})();

