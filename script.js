const SHEET_CONFIG = {
    spreadsheetId: "1VphuHXyUE0AF8AgCOJcsUOrXu-1Rl8xYkh-0T8ruRgs",
    wordSheetName: "Word_Metadata",
    activitySheetName: "Activity_Template",
};

const state = {
    words: [],
    activities: [],
    filteredWords: [],
    selectedWord: null,
};

const DIFFICULTY_ORDER = {
    easy: 0,
    medium: 1,
    hard: 2,
};

const soundDropdown = document.getElementById("soundDropdown");
const categoryDropdown = document.getElementById("categoryDropdown");
const positionDropdown = document.getElementById("positionDropdown");
const wordForm = document.getElementById("wordForm");
const statusMessage = document.getElementById("statusMessage");
const emptyState = document.getElementById("emptyState");
const wordList = document.getElementById("wordList");
const activityStatus = document.getElementById("activityStatus");
const activityEmptyState = document.getElementById("activityEmptyState");
const selectedWordCard = document.getElementById("selectedWordCard");
const activityList = document.getElementById("activityList");

function setStatus(message) {
    statusMessage.textContent = message;
}

function setDropdownOptions(select, values, label) {
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = `Select ${label}`;
    select.appendChild(placeholder);

    const anyOption = document.createElement("option");
    anyOption.value = "Any";
    anyOption.textContent = "Any";
    select.appendChild(anyOption);

    values.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
}

function extractTable(jsonText) {
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");

    if (start === -1 || end === -1) {
        throw new Error("Unexpected Google Sheets response.");
    }

    return JSON.parse(jsonText.slice(start, end + 1)).table;
}

async function fetchSheet(sheetName) {
    const queryUrl = new URL(
        `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.spreadsheetId}/gviz/tq`,
    );
    queryUrl.searchParams.set("sheet", sheetName);
    queryUrl.searchParams.set("tqx", "out:json");

    const response = await fetch(queryUrl);
    if (!response.ok) {
        throw new Error(`Google Sheets request failed with ${response.status}.`);
    }

    const text = await response.text();
    return extractTable(text);
}

function tableToObjects(table) {
    const headers = table.cols.map((column) => column.label);
    return table.rows.map((row) => {
        const values = row.c || [];
        return headers.reduce((record, header, index) => {
            record[header] = values[index]?.v ?? null;
            return record;
        }, {});
    });
}

function formatValue(value) {
    return String(value ?? "").trim();
}

function isTruthy(value) {
    return value === true || String(value ?? "").trim().toLowerCase() === "true";
}

function uniqueValues(rows, key) {
    return [...new Set(rows.map((row) => formatValue(row[key])).filter((value) => value && value !== "Any"))]
        .sort((a, b) => a.localeCompare(b));
}

function normalizeWordRecord(row) {
    return {
        word: formatValue(row.Word),
        sound: formatValue(row.Sound),
        category: formatValue(row.Category),
        position: formatValue(row.Position) || "Any",
        imageUrl: formatValue(row.ImageUrl),
        active: isTruthy(row.Active),
    };
}

function normalizeActivityRecord(row) {
    return {
        id: formatValue(row.TemplateID),
        activityType: formatValue(row.ActivityType) || "Activity",
        category: formatValue(row.Category) || "Any",
        position: formatValue(row.Position) || "Any",
        difficulty: formatValue(row.Difficulty),
        template: formatValue(row.Template),
        notes: formatValue(row.Notes),
        active: isTruthy(row.Active),
    };
}

function getDifficultyRank(difficulty) {
    const normalizedDifficulty = formatValue(difficulty).toLowerCase();
    return DIFFICULTY_ORDER[normalizedDifficulty] ?? Number.MAX_SAFE_INTEGER;
}

function setActivityStatus(message) {
    activityStatus.textContent = message;
}

function clearActivities(message = "Pick a word from the list above to generate a few guided activities.") {
    state.selectedWord = null;
    selectedWordCard.classList.add("hidden");
    selectedWordCard.innerHTML = "";
    activityList.classList.add("hidden");
    activityList.innerHTML = "";
    activityEmptyState.textContent = message;
    activityEmptyState.classList.remove("hidden");
    setActivityStatus("Choose a word to see practice ideas.");
}

function renderWords(words, sound, category, position) {
    wordList.innerHTML = "";
    state.selectedWord = null;

    if (!words.length) {
        emptyState.textContent = `No words found for ${sound} in ${category} at ${position} position.`;
        emptyState.classList.remove("hidden");
        wordList.classList.add("hidden");
        setStatus("0 words found");
        clearActivities("Pick a different sound or category to find words for practice.");
        return;
    }

    words.forEach((wordRecord) => {
        const listItem = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "word-button";
        button.textContent = wordRecord.word;
        button.addEventListener("click", () => selectWord(wordRecord));

        listItem.appendChild(button);
        wordList.appendChild(listItem);
    });

    emptyState.classList.add("hidden");
    wordList.classList.remove("hidden");
    setStatus(`${words.length} word${words.length === 1 ? "" : "s"} found`);
    clearActivities();
}

function buildActivityText(template, wordRecord) {
    return template
        .replaceAll("{word}", wordRecord.word)
        .replaceAll("{sound}", wordRecord.sound)
        .replaceAll("{category}", wordRecord.category)
        .replaceAll("{position}", wordRecord.position);
}

function renderActivities(wordRecord, activities) {
    selectedWordCard.innerHTML = `
        <strong>${wordRecord.word}</strong><br>
        Sound: ${wordRecord.sound} | Category: ${wordRecord.category} | Position: ${wordRecord.position}
    `;
    selectedWordCard.classList.remove("hidden");

    activityList.innerHTML = "";

    if (!activities.length) {
        activityEmptyState.textContent = `No active practice ideas matched ${wordRecord.word} yet.`;
        activityEmptyState.classList.remove("hidden");
        activityList.classList.add("hidden");
        setActivityStatus("0 activities found");
        return;
    }

    activities.forEach((activity) => {
        const listItem = document.createElement("li");
        listItem.className = "activity-item";
        listItem.innerHTML = `
            <p class="activity-type">${activity.activityType}${activity.difficulty ? ` | ${activity.difficulty}` : ""}</p>
            <p class="activity-text">${buildActivityText(activity.template, wordRecord)}</p>
        `;
        activityList.appendChild(listItem);
    });

    activityEmptyState.classList.add("hidden");
    activityList.classList.remove("hidden");
    setActivityStatus(`${activities.length} practice idea${activities.length === 1 ? "" : "s"} found`);
}

function filterActivities(wordRecord) {
    return state.activities
        .filter((activity) => activity.active)
        .filter((activity) => activity.category === "Any" || activity.category === wordRecord.category)
        .filter((activity) => activity.position === "Any" || activity.position === wordRecord.position)
        .sort((a, b) => {
            const difficultyRankDifference = getDifficultyRank(a.difficulty) - getDifficultyRank(b.difficulty);
            if (difficultyRankDifference !== 0) {
                return difficultyRankDifference;
            }

            return a.activityType.localeCompare(b.activityType);
        });
}

function selectWord(wordRecord) {
    state.selectedWord = wordRecord;
    document.querySelectorAll(".word-button").forEach((button) => {
        button.classList.toggle("is-selected", button.textContent === wordRecord.word);
    });

    const activities = filterActivities(wordRecord);
    renderActivities(wordRecord, activities);
}

function updateResults() {
    const sound = soundDropdown.value;
    const category = categoryDropdown.value;
    const position = positionDropdown.value;

    if (!sound || !category || !position) {
        emptyState.textContent = "Choose all three filters before searching.";
        emptyState.classList.remove("hidden");
        wordList.classList.add("hidden");
        setStatus("Waiting for filters");
        clearActivities();
        return;
    }

    if (sound === "Any" && category === "Any" && position === "Any") {
        emptyState.textContent = "Choose at least one specific filter before searching.";
        emptyState.classList.remove("hidden");
        wordList.classList.add("hidden");
        setStatus("Waiting for filters");
        clearActivities();
        return;
    }

    setStatus("Filtering words...");

    try {
        const matches = state.words
            .filter((row) => row.active)
            .filter((row) => sound === "Any" || row.sound === sound)
            .filter((row) => category === "Any" || row.category === category)
            .filter((row) => position === "Any" || row.position === position)
            .sort((a, b) => a.word.localeCompare(b.word));

        state.filteredWords = matches;
        renderWords(matches, sound, category, position);
    } catch (error) {
        console.error(error);
        emptyState.textContent = "Unable to load practice words.";
        emptyState.classList.remove("hidden");
        wordList.classList.add("hidden");
        setStatus(error.message);
        clearActivities("Unable to load practice ideas.");
    }
}

async function initialize() {
    try {
        const [wordTable, activityTable] = await Promise.all([
            fetchSheet(SHEET_CONFIG.wordSheetName),
            fetchSheet(SHEET_CONFIG.activitySheetName),
        ]);

        state.words = tableToObjects(wordTable)
            .map(normalizeWordRecord)
            .filter((row) => row.word && row.sound && row.category);
        state.activities = tableToObjects(activityTable)
            .map(normalizeActivityRecord)
            .filter((row) => row.template);

        setDropdownOptions(soundDropdown, uniqueValues(state.words.filter((row) => row.active), "sound"), "a sound");
        setDropdownOptions(categoryDropdown, uniqueValues(state.words.filter((row) => row.active), "category"), "a category");
        setDropdownOptions(positionDropdown, uniqueValues(state.words.filter((row) => row.active), "position"), "a position");
        setStatus("Choose a sound, category, and position");
        clearActivities();
    } catch (error) {
        console.error(error);
        setStatus(error.message);
        setDropdownOptions(soundDropdown, [], "a sound");
        setDropdownOptions(categoryDropdown, [], "a category");
        setDropdownOptions(positionDropdown, [], "a position");
        clearActivities("Unable to load practice ideas.");
    }
}

wordForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

soundDropdown.addEventListener("change", updateResults);
categoryDropdown.addEventListener("change", updateResults);
positionDropdown.addEventListener("change", updateResults);

initialize();
