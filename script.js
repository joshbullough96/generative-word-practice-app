const SHEET_CONFIG = {
    spreadsheetId: "1VphuHXyUE0AF8AgCOJcsUOrXu-1Rl8xYkh-0T8ruRgs",
    soundSheetName: "Sheet1",
    categorySheetName: "Sheet2",
};

const state = {
    soundMap: new Map(),
    categoryMap: new Map(),
};

const soundDropdown = document.getElementById("soundDropdown");
const positionDropdown = document.getElementById("positionDropdown");
const wordForm = document.getElementById("wordForm");
const statusMessage = document.getElementById("statusMessage");
const emptyState = document.getElementById("emptyState");
const wordList = document.getElementById("wordList");

function setStatus(message) {
    statusMessage.textContent = message;
}

function setDropdownOptions(select, values, label) {
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = `Select ${label}`;
    select.appendChild(placeholder);

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

function tableToMatrix(table) {
    return table.rows.map((row) => row.c.map((cell) => String(cell?.v ?? "").trim()));
}

function matrixToColumnMap(matrix) {
    if (!matrix.length) {
        return new Map();
    }

    const headers = matrix[0];
    const valuesByHeader = new Map();

    headers.forEach((header, columnIndex) => {
        const cleanHeader = String(header || "").trim();
        if (!cleanHeader) {
            return;
        }

        const values = matrix
            .slice(1)
            .map((row) => String(row[columnIndex] || "").trim())
            .filter(Boolean);

        valuesByHeader.set(cleanHeader, [...new Set(values)]);
    });

    return valuesByHeader;
}

function sortedKeys(map) {
    return [...map.keys()].sort((a, b) => a.localeCompare(b));
}

function renderWords(words, sound, category) {
    wordList.innerHTML = "";

    if (!words.length) {
        emptyState.textContent = `No words found for ${sound} in ${category}.`;
        emptyState.classList.remove("hidden");
        wordList.classList.add("hidden");
        setStatus("0 words found");
        return;
    }

    words.forEach((word) => {
        const listItem = document.createElement("li");
        listItem.textContent = word;
        wordList.appendChild(listItem);
    });

    emptyState.classList.add("hidden");
    wordList.classList.remove("hidden");
    setStatus(`${words.length} word${words.length === 1 ? "" : "s"} found`);
}

function updateResults() {
    const sound = soundDropdown.value;
    const category = positionDropdown.value;

    if (!sound || !category) {
        emptyState.textContent = "Choose both filters before searching.";
        emptyState.classList.remove("hidden");
        wordList.classList.add("hidden");
        setStatus("Waiting for filters");
        return;
    }

    setStatus("Filtering words...");

    try {
        const soundWords = state.soundMap.get(sound) || [];
        const categoryWords = state.categoryMap.get(category) || [];
        const categoryWordSet = new Set(categoryWords.map((word) => word.toLowerCase()));
        const matches = soundWords
            .filter((word) => categoryWordSet.has(word.toLowerCase()))
            .sort((a, b) => a.localeCompare(b));

        renderWords(matches, sound, category);
    } catch (error) {
        console.error(error);
        emptyState.textContent = "Unable to load words from Google Sheets.";
        emptyState.classList.remove("hidden");
        wordList.classList.add("hidden");
        setStatus(error.message);
    }
}

async function initialize() {
    try {
        const [soundTable, categoryTable] = await Promise.all([
            fetchSheet(SHEET_CONFIG.soundSheetName),
            fetchSheet(SHEET_CONFIG.categorySheetName),
        ]);

        state.soundMap = matrixToColumnMap(tableToMatrix(soundTable));
        state.categoryMap = matrixToColumnMap(tableToMatrix(categoryTable));

        setDropdownOptions(soundDropdown, sortedKeys(state.soundMap), "a sound");
        setDropdownOptions(positionDropdown, sortedKeys(state.categoryMap), "a category");
        setStatus("Choose a sound and category");
    } catch (error) {
        console.error(error);
        setStatus(error.message);
        setDropdownOptions(soundDropdown, [], "a sound");
        setDropdownOptions(positionDropdown, [], "a category");
    }
}

wordForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

soundDropdown.addEventListener("change", updateResults);
positionDropdown.addEventListener("change", updateResults);

initialize();
