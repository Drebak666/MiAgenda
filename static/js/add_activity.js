// add_activity.js

// --- SECTION 2: ADD ACTIVITY LOGIC ---
// Handles the unified form for adding tasks, routines, and appointments.

// Global variable to store all ingredients for shopping list recognition
let allIngredients = [];

// Make currentModalRequisitos a global variable by attaching it to the window object
// This ensures it's accessible across different script files.
window.currentModalRequisitos = []; 

// Fetches all ingredients from the API (for shopping list recognition)
async function fetchAllIngredients() {
    try {
        const response = await fetch('/api/ingredients');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener ingredientes.');
        }
        allIngredients = await response.json();
    } catch (error) {
        console.error('Error al cargar todos los ingredientes:', error);
    }
}

/**
 * Parses the shopping list input string, handling phrases with "de"
 * and prioritizing matches with existing ingredient names.
 * @param {string} inputString The text string from the input.
 * @returns {Array<{item: string, ingredient_id: string|null}>} An array of parsed items.
 */
function parseShoppingListInputAndMatchIngredients(inputString) {
    let identifiedItems = [];
    const words = inputString.split(/\s+/).filter(word => word.length > 0); // Split by one or more spaces

    // Sort ingredients by name length in descending order to prioritize multi-word matches
    const sortedIngredients = [...allIngredients].sort((a, b) => b.name.length - a.name.length);

    let i = 0;
    while (i < words.length) {
        let foundIngredientMatch = null;

        // 1. Try to match the longest possible ingredient name (multi-word first)
        for (const ingredient of sortedIngredients) {
            const ingNameLower = ingredient.name.toLowerCase();
            const ingWords = ingNameLower.split(/\s+/).filter(w => w.length > 0);

            // Build a phrase from the current segment of words to compare with ingredient names
            const currentPhraseAttempt = words.slice(i, i + ingWords.length).join(' ').toLowerCase();

            if (currentPhraseAttempt === ingNameLower) {
                foundIngredientMatch = ingredient;
                break; // A match was found (either multi-word or exact single-word), process it
            }
        }

        if (foundIngredientMatch) {
            // Add the recognized ingredient item
            identifiedItems.push({ item: foundIngredientMatch.name, ingredient_id: foundIngredientMatch.id });
            i += foundIngredientMatch.name.split(/\s+/).length; // Advance the index beyond the words of the recognized ingredient
        } else {
            // No direct ingredient match found for this segment. Handle "de" and other words.
            let currentWord = words[i];
            let itemText = currentWord; // Not directly used in this version, but useful for debugging

            // Special handling for "de", "del", "de la", etc.
            const deConnectors = ['de', 'del', 'de la', 'de los', 'de las'];
            if (deConnectors.includes(currentWord.toLowerCase()) && i > 0 && i + 1 < words.length) {
                // Try to combine with the previously identified item if it was a single word, or a simple phrase
                if (identifiedItems.length > 0 && !identifiedItems[identifiedItems.length - 1].ingredient_id) {
                    let lastItem = identifiedItems[identifiedItems.length - 1];
                    const nextWord = words[i + 1];
                    const combinedPhrase = `${lastItem.item} ${currentWord} ${nextWord}`;

                    // Check if this new combined phrase matches an ingredient
                    const combinedIngredientMatch = allIngredients.find(ing => ing.name.toLowerCase() === combinedPhrase.toLowerCase());
                    if (combinedIngredientMatch) {
                        lastItem.item = combinedIngredientMatch.name;
                        lastItem.ingredient_id = combinedIngredientMatch.id;
                    } else {
                        lastItem.item = combinedPhrase;
                        lastItem.ingredient_id = null; // No ingredient match for the combined phrase
                    }
                    i += 2; // Consume "de" and the next word
                } else {
                     // "de" appears, but there's no previous item to meaningfully combine, or the previous one was already an ingredient.
                     // Treat "de" as a word (it will probably be filtered later if it's alone).
                    identifiedItems.push({ item: currentWord, ingredient_id: null });
                    i++;
                }
            } else {
                // Regular word. Try to match as a single-word ingredient.
                const singleWordIngredient = allIngredients.find(ing => ing.name.toLowerCase() === currentWord.toLowerCase());
                if (singleWordIngredient) {
                    identifiedItems.push({ item: singleWordIngredient.name, ingredient_id: singleWordIngredient.id });
                } else {
                    identifiedItems.push({ item: currentWord, ingredient_id: null });
                }
                i++;
            }
        }
    }

    // Final cleanup: filter empty items and ensure no pure separators ("y", "and", "de" alone) remain
    let finalItems = identifiedItems.filter(itemData => itemData.item.trim().length > 0);

    const separators = ['y', 'and', 'de', 'del', 'de la', 'de los', 'de las'];
    finalItems = finalItems.filter(itemData => !separators.includes(itemData.item.toLowerCase()));

    // Remove duplicates (e.g., if "rice" and "bomba rice" matched, keep the longer/more specific one if analysis resulted in both)
    const uniqueItems = [];
    const seenKeys = new Set();
    for (const item of finalItems) {
        // A unique key based on the item name and the linked ingredient ID (if any)
        const key = `${item.item.toLowerCase()}-${item.ingredient_id || 'null'}`;
        if (!seenKeys.has(key)) {
            uniqueItems.push(item);
            seenKeys.add(key);
        }
    }
    return uniqueItems;
}


document.addEventListener('DOMContentLoaded', () => {
    // Call fetchAllIngredients immediately when the DOM is loaded
    fetchAllIngredients();

    const unifiedEntryForm = document.getElementById('unifiedEntryForm');
    const entryTextInput = document.getElementById('entryTextInput');
    const chooseEntryTypeModal = document.getElementById('chooseEntryTypeModal');
    const chooseEntryTypeModalTitle = document.getElementById('chooseEntryTypeModalTitle');
    const activityTextDisplay = document.getElementById('activityTextDisplay');
    const modalEntryType = document.getElementById('modalEntryType');
    const modalEntryText = document.getElementById('modalEntryText');
    const modalStartTimeInput = document.getElementById('modalStartTimeInput');
    const modalEndTimeInput = document.getElementById('modalEndTimeInput'); // New
    const modalEndTimeDiv = document.getElementById('modalEndTimeDiv'); // New
    const modalRoutineFields = document.getElementById('modalRoutineFields');
    const modalTaskDateFields = document.getElementById('modalTaskDateFields');
    const modalCitaFields = document.getElementById('modalCitaFields');
    const modalTaskFechaInput = document.getElementById('modalTaskFechaInput');
    const modalCitaFechaInput = document.getElementById('modalCitaFechaInput');
    const saveModalEntryBtn = document.getElementById('saveModalEntryBtn');
    const cancelModalEntryBtn = document.getElementById('cancelModalEntryBtn');
    const editEntryId = document.getElementById('editEntryId'); // Hidden input for editing

    // Quick Cita Modal elements
    const quickCitaModal = document.getElementById('quickCitaModal');
    const quickCitaTextDisplay = document.getElementById('quickCitaTextDisplay');
    const quickCitaFechaInput = document.getElementById('quickCitaFechaInput');
    const quickCitaHoraInput = document.getElementById('quickCitaHoraInput');
    const quickCitaHoraFinInput = document.getElementById('quickCitaHoraFinInput'); // New
    const quickCitaRequisitoInput = document.getElementById('quickCitaRequisitoInput');
    const quickAddRequisitoBtn = document.getElementById('quickAddRequisitoBtn');
    const quickRequisitosListDisplay = document.getElementById('quickRequisitosListDisplay');
    const saveQuickCitaBtn = document.getElementById('saveQuickCitaBtn');
    const cancelQuickCitaBtn = document.getElementById('cancelQuickCitaBtn');
    const quickCitaHiddenName = document.getElementById('quickCitaHiddenName'); // NEW REFERENCE TO HIDDEN INPUT

    // Quick Action Buttons (references, listeners will be in main.js)
    // const quickCitaButton = document.getElementById('quickCitaButton');
    // const quickListButton = document.getElementById('quickListButton');
    // const quickNotesButton = document.getElementById('quickNotesButton');
    const generateShoppingListButton = document.getElementById('generateShoppingListButton');

    // Counters for quick action buttons (references, updated by fetchCountsForButtons)
    // const quickListCountElem = document.getElementById('quickListCount');
    // const quickNotesCountElem = document.getElementById('quickNotesCount');
    // const quickCitaCountElem = document.getElementById('quickCitaCount');

    // let currentModalRequisitos = []; // MOVED THIS DECLARATION TO GLOBAL SCOPE (window.currentModalRequisitos)

    // Day mapping for routines
    const dayNameToNumber = {
        'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3,
        'Jueves': 4, 'Viernes': 5, 'Sábado': 6
    };
    const modalRoutineDayCheckboxes = document.querySelectorAll('input[name="modalRoutineDay"]');

    // Function to format date toYYYY-MM-DD
    function formatFecha(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Set min date for date inputs
    const today = new Date();
    const todayFormatted = formatFecha(today);
    modalTaskFechaInput.min = todayFormatted;
    modalCitaFechaInput.min = todayFormatted;
    quickCitaFechaInput.min = todayFormatted;

    // --- Unified Entry Form Submission ---
    unifiedEntryForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const entryText = entryTextInput.value.trim();
        if (!entryText) {
            showCustomAlert('La descripción de la actividad no puede estar vacía.', 'Campo Obligatorio');
            return;
        }

        // Reset modal state
        editEntryId.value = ''; // Clear any existing edit ID
        chooseEntryTypeModalTitle.textContent = 'Elegir Tipo de Actividad';
        modalEntryType.value = 'tarea'; // Default to task
        modalEntryType.disabled = false; // Enable type selection
        modalEntryText.value = entryText; // Prefill with unified input text
        activityTextDisplay.textContent = `Registrar: "${entryText}"`;
        modalStartTimeInput.value = '';
        modalEndTimeInput.value = ''; // Clear end time
        window.currentModalRequisitos = []; // Clear requirements list (using global reference)
        renderRequisitosList(window.currentModalRequisitos, document.getElementById('modalRequisitosListDisplay'), true);

        // Show/hide fields based on default type 'tarea'
        handleEntryTypeChange();

        chooseEntryTypeModal.style.display = 'flex';
    });

    // --- Modal Entry Type Change Listener ---
    modalEntryType.addEventListener('change', handleEntryTypeChange);

    function handleEntryTypeChange() {
        const selectedType = modalEntryType.value;

        // Hide all specific fields first
        modalRoutineFields.style.display = 'none';
        modalTaskDateFields.style.display = 'none';
        modalCitaFields.style.display = 'none';
        modalEndTimeDiv.style.display = 'none'; // Hide end time by default

        // Reset inputs relevant to hidden fields
        modalTaskFechaInput.value = '';
        modalCitaFechaInput.value = '';
        modalRoutineDayCheckboxes.forEach(cb => cb.checked = false);
        window.currentModalRequisitos = []; // Clear requirements list (using global reference)
        renderRequisitosList(window.currentModalRequisitos, document.getElementById('modalRequisitosListDisplay'), true);

        // Show fields based on selected type
        if (selectedType === 'tarea') {
            modalTaskDateFields.style.display = 'block';
            modalEndTimeDiv.style.display = 'block'; // Tasks can also have end times if desired, or keep hidden if not
            modalTaskFechaInput.value = formatFecha(today); // Default to today
            console.log('DEBUG (handleEntryTypeChange): modalTaskFechaInput.value set to:', modalTaskFechaInput.value); // NEW LOG
        } else if (selectedType === 'rutina') {
            modalRoutineFields.style.display = 'block';
            modalEndTimeDiv.style.display = 'block'; // Routines always have start/end times
        } else if (selectedType === 'cita') {
            modalCitaFields.style.display = 'block';
            modalEndTimeDiv.style.display = 'block'; // Citas always have start/end times
            modalCitaFechaInput.value = formatFecha(today); // Default to today
        }
    }

    // --- Save Modal Entry Button ---
    saveModalEntryBtn.addEventListener('click', async () => {
        const type = modalEntryType.value;
        const text = modalEntryText.value.trim();
        const hora = modalStartTimeInput.value;
        const horaFin = modalEndTimeInput.value; // Get hora_fin
        const id = editEntryId.value; // Get ID if editing

        if (!text) {
            showCustomAlert('La descripción es obligatoria.', 'Campo Obligatorio');
            return;
        }

        let payload = {}; // Initialize empty payload

        let url = '';
        let method = 'POST';

        if (id) { // If editing
            method = 'PUT';
            payload.id = id; // Add ID to payload for PUT
        }

        if (type === 'tarea') {
            const fecha = modalTaskFechaInput.value;
            if (!fecha) {
                showCustomAlert('La fecha de la tarea es obligatoria.', 'Campo Obligatorio');
                return;
            }
            // Corrected payload for 'tarea' to use 'texto' instead of 'nombre'
            payload = { texto: text, fecha: fecha, hora: hora || null, hora_fin: horaFin || null };
            url = `/api/tareas${id ? '/' + id : ''}`;
        } else if (type === 'rutina') {
            const selectedDays = Array.from(modalRoutineDayCheckboxes)
                                    .filter(cb => cb.checked)
                                    .map(cb => dayNameToNumber[cb.value]);
            if (selectedDays.length === 0) {
                showCustomAlert('Debe seleccionar al menos un día para la rutina.', 'Campo Obligatorio');
                return;
            }
            payload = { nombre: text, dias: selectedDays, hora: hora || null, hora_fin: horaFin || null };
            url = `/api/rutinas${id ? '/' + id : ''}`;
        } else if (type === 'cita') {
            const fecha = modalCitaFechaInput.value;
            if (!fecha) {
                showCustomAlert('La fecha de la cita es obligatoria.', 'Campo Obligatorio');
                return;
            }
            payload = { nombre: text, fecha: fecha, hora: hora || null, hora_fin: horaFin || null, recordatorio: JSON.stringify(window.currentModalRequisitos) };
            url = `/api/citas${id ? '/' + id : ''}`;
        }

        console.log('DEBUG (add_activity.js): Tipo de actividad:', type); // ADDED LOG
        console.log('DEBUG (add_activity.js): Payload completo antes de enviar:', JSON.stringify(payload, null, 2)); // ADDED LOG

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error desconocido al guardar la actividad.');
            }

            showCustomAlert('Actividad guardada con éxito.', 'Guardado Exitoso');
            chooseEntryTypeModal.style.display = 'none';
            entryTextInput.value = ''; // Clear main input
            // Ensure these functions are defined and accessible (e.g., in agenda_today.js)
            if (typeof fetchCombinedAgenda === 'function') {
                fetchCombinedAgenda(); // Refresh agenda
            }
            if (typeof fetchUpcomingCitas === 'function') {
                fetchUpcomingCitas(); // Refresh upcoming citas
            }
            if (typeof fetchCountsForButtons === 'function') {
                fetchCountsForButtons(); // Update counts
            }
        } catch (error) {
            console.error('Error al guardar la actividad:', error);
            showCustomAlert(`No se pudo guardar la actividad. Error: ${error.message}`, 'Error de Guardado');
        }
    });

    // --- Cancel Modal Entry Button ---
    cancelModalEntryBtn.addEventListener('click', () => {
        chooseEntryTypeModal.style.display = 'none';
    });

    // --- Quick Cita Modal Logic (exposed globally) ---
    window.showQuickCitaModalLogic = (entryText) => {
        quickCitaTextDisplay.textContent = `Registrar Cita: "${entryText}"`;
        quickCitaHiddenName.value = entryText; // Set the hidden input value here
        quickCitaFechaInput.value = formatFecha(today);
        quickCitaFechaInput.min = formatFecha(today);
        quickCitaHoraInput.value = '';
        quickCitaHoraFinInput.value = ''; // Clear hora_fin
        window.currentModalRequisitos = []; // Clear requirements for quick cita (using global reference)
        renderRequisitosList(window.currentModalRequisitos, quickRequisitosListDisplay, true); // Clear display

        quickCitaModal.style.display = 'flex';
    };

    // --- Quick Cita Add Requisito Button ---
    quickAddRequisitoBtn.addEventListener('click', () => {
        const requisitoText = quickCitaRequisitoInput.value.trim();
        if (requisitoText) {
            window.currentModalRequisitos.push({ text: requisitoText, checked: false }); // Using global reference
            renderRequisitosList(window.currentModalRequisitos, quickRequisitosListDisplay); // Using global reference
            quickCitaRequisitoInput.value = '';
        }
    });

    // --- Render Requisitos List Function ---
    function renderRequisitosList(requisitosArray, displayElement, clearOnly = false) {
        displayElement.innerHTML = ''; // Clear current list
        if (clearOnly) return;

        if (requisitosArray.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No hay requisitos.';
            li.classList.add('text-gray-500', 'italic', 'text-sm');
            displayElement.appendChild(li);
            return;
        }

        requisitosArray.forEach((req, index) => {
            const li = document.createElement('li');
            li.classList.add('flex', 'items-center', 'justify-between', 'py-1');
            li.innerHTML = `
                <label class="flex items-center space-x-2 flex-grow cursor-pointer">
                    <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600" ${req.checked ? 'checked' : ''} data-index="${index}">
                    <span class="${req.checked ? 'line-through text-gray-500' : 'text-gray-800'}">${req.text}</span>
                </label>
                <button type="button" class="text-red-500 hover:text-red-700 ml-2" data-action="delete" data-index="${index}">
                    <i class="fas fa-times-circle"></i>
                </button>
            `;
            displayElement.appendChild(li);

            // Add event listener for checkbox toggle
            li.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
                const itemIndex = parseInt(e.target.dataset.index);
                requisitosArray[itemIndex].checked = e.target.checked;
                renderRequisitosList(requisitosArray, displayElement); // Re-render to update styles
            });

            // Add event listener for delete button
            li.querySelector('button[data-action="delete"]').addEventListener('click', (e) => {
                const itemIndex = parseInt(e.target.dataset.index);
                requisitosArray.splice(itemIndex, 1); // Remove item from array
                renderRequisitosList(requisitosArray, displayElement); // Re-render the list
            });
        });
    }

    // --- Save Quick Cita Button ---
    saveQuickCitaBtn.addEventListener('click', async () => {
        const nombre = quickCitaHiddenName.value.trim(); // READ FROM HIDDEN INPUT
        const fecha = quickCitaFechaInput.value;
        const hora = quickCitaHoraInput.value;
        const horaFin = quickCitaHoraFinInput.value; // Get hora_fin
        const recordatorio = JSON.stringify(window.currentModalRequisitos); // Using global reference

        if (!nombre || !fecha) {
            showCustomAlert('El nombre y la fecha de la cita son obligatorios.', 'Campo Obligatorio');
            return;
        }

        try {
            const response = await fetch('/api/citas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, fecha, hora: hora || null, hora_fin: horaFin || null, recordatorio }) // Include hora_fin
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error desconocido al guardar la cita rápida.');
            }

            showCustomAlert('Cita rápida guardada con éxito.', 'Guardado Exitoso');
            quickCitaModal.style.display = 'none';
            entryTextInput.value = ''; // Clear main input
            if (typeof fetchUpcomingCitas === 'function') {
                fetchUpcomingCitas(); // Refresh upcoming citas
            }
            if (typeof fetchCountsForButtons === 'function') {
                fetchCountsForButtons(); // Update counts
            }
        } catch (error) {
            console.error('Error al guardar la cita rápida:', error);
            showCustomAlert(`No se pudo guardar la cita rápida. Error: ${error.message}`, 'Error al Guardar');
        }
    });

    // --- Cancel Quick Cita Button ---
    cancelQuickCitaBtn.addEventListener('click', () => {
        quickCitaModal.style.display = 'none';
    });

    // --- Modal Cita Add Requisito Button (for main modal) ---
    document.getElementById('modalAddRequisitoBtn').addEventListener('click', () => {
        const requisitoText = document.getElementById('modalCitaRequisitoInput').value.trim();
        if (requisitoText) {
            window.currentModalRequisitos.push({ text: requisitoText, checked: false }); // Using global reference
            renderRequisitosList(window.currentModalRequisitos, document.getElementById('modalRequisitosListDisplay')); // Using global reference
            document.getElementById('modalCitaRequisitoInput').value = '';
        }
    });

    // --- Function to edit a Cita (called from agenda_today.js or citas.js) ---
    window.editCita = async (citaId, nombre, fecha, hora, hora_fin, recordatorio) => {
        chooseEntryTypeModalTitle.textContent = 'Editar Cita';
        modalEntryType.value = 'cita';
        modalEntryType.disabled = true; // Cannot change type when editing
        editEntryId.value = citaId;

        modalEntryText.value = nombre;
        activityTextDisplay.textContent = `Editar Cita: "${nombre}"`;
        modalStartTimeInput.value = hora || '';
        modalEndTimeInput.value = hora_fin || ''; // Set hora_fin for editing

        modalCitaFechaInput.value = fecha;

        // Set requirements
        window.currentModalRequisitos = []; // Clear current global requirements
        if (recordatorio) {
            try {
                const parsedRecordatorio = JSON.parse(recordatorio);
                if (Array.isArray(parsedRecordatorio)) {
                    window.currentModalRequisitos = parsedRecordatorio; // Set global requirements
                }
            } catch (e) {
                console.error("Error parsing recordatorio JSON:", e);
            }
        }
        renderRequisitosList(window.currentModalRequisitos, document.getElementById('modalRequisitosListDisplay')); // Using global reference

        // Show/hide fields for 'cita' type
        modalRoutineFields.style.display = 'none';
        modalTaskDateFields.style.display = 'none';
        modalCitaFields.style.display = 'block';
        modalEndTimeDiv.style.display = 'block'; // Ensure end time is visible for citas

        chooseEntryTypeModal.style.display = 'flex';
    };

    // --- Quick List Button Logic (exposed globally) ---
    window.handleQuickListAdd = async (itemText) => {
        const parsedItems = parseShoppingListInputAndMatchIngredients(itemText); // Use the parsing function
        if (parsedItems.length === 0) {
            showCustomAlert('No se identificaron ítems válidos para añadir a la lista de compra.', 'Advertencia');
            return;
        }

        let successCount = 0;
        let errorMessages = [];

        for (const itemData of parsedItems) {
            try {
                const response = await fetch('/api/lista_compra', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ item: itemData.item, ingredient_id: itemData.ingredient_id }) // Send parsed item and ID
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Error al añadir "${itemData.item}".`);
                }
                successCount++;
            } catch (error) {
                console.error(`Error al añadir "${itemData.item}" a la lista de compra:`, error);
                errorMessages.push(`"${itemData.item}": ${error.message}`);
            }
        }

        if (successCount > 0) {
            showCustomAlert(`Se añadieron ${successCount} ítem(s) a la lista de compra.`, 'Éxito');
        }
        if (errorMessages.length > 0) {
            showCustomAlert(`Errores al añadir algunos ítems:\n${errorMessages.join('\n')}`, 'Errores al Añadir');
        }

        if (typeof fetchCountsForButtons === 'function') {
            fetchCountsForButtons();
        }
    };

    // --- Quick Notes Button Logic (exposed globally) ---
    window.handleQuickNoteAdd = async (noteText) => {
        try {
            const response = await fetch('/api/notas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto: noteText })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error desconocido al añadir a notas rápidas.');
            }
            showCustomAlert('Nota guardada.', 'Éxito');
            // entryTextInput.value = ''; // Clear input handled by main.js
            if (typeof fetchCountsForButtons === 'function') {
                fetchCountsForButtons();
            }
        } catch (error) {
            console.error('Error al añadir a notas rápidas:', error);
            showCustomAlert(`No se pudo añadir a notas rápidas. Error: ${error.message}`, 'Error');
        }
    };

    // --- Generate Shopping List Button Logic ---
    generateShoppingListButton.addEventListener('click', async () => {
        const confirmAction = await showCustomConfirm('¿Estás seguro de que quieres generar la lista de la compra basada en el menú semanal? Esto actualizará los ítems existentes y añadirá los nuevos.');
        if (!confirmAction) {
            return;
        }

        showCustomAlert('Generando lista de la compra...', 'Procesando', false); // Show processing alert

        try {
            const response = await fetch('/api/lista_compra/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error desconocido al generar la lista de compra.');
            }
            const result = await response.json();
            showCustomAlert(result.details.message || 'Lista de compra generada con éxito.', 'Generación Completa');
            if (typeof fetchCountsForButtons === 'function') {
                fetchCountsForButtons(); // Update counts after generation
            }
        } catch (error) {
            console.error('Error al generar la lista de compra:', error);
            showCustomAlert(`No se pudo generar la lista de compra. Error: ${error.message}`, 'Error');
        }
    });

    // Initial fetch for counts when the page loads
    if (typeof fetchCountsForButtons === 'function') {
        fetchCountsForButtons();
    }
});
