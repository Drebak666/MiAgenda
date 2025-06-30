// --- SECTION 2: ADD ACTIVITY LOGIC ---
// Functions related to the unified form for adding tasks, routines, and appointments.
// Also includes quick action buttons.

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

// Event listener for the quick list button
quickListButton.addEventListener('click', async () => {
    const rawInput = entryTextInput.value.trim();
    if (!rawInput) {
        window.location.href = '/lista'; // If no text, just go to the list
        return;
    }

    // MODIFIED: Use the new smart parsing function that also links ingredients
    const itemsToAdd = parseShoppingListInputAndMatchIngredients(rawInput);

    if (itemsToAdd.length === 0) {
        showCustomAlert('No se pudieron identificar ítems válidos para añadir a la lista.', 'Entrada Inválida');
        return;
    }

    let allItemsAddedSuccessfully = true;
    for (const itemData of itemsToAdd) {
        try {
            const response = await fetch('/api/lista_compra', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item: itemData.item, ingredient_id: itemData.ingredient_id })
            });
            if (!response.ok) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                const contentType = response.headers.get('content-type');
                const responseBody = await response.text();
                if (contentType && contentType.includes('application/json')) {
                    try {
                        const errorData = JSON.parse(responseBody);
                        errorMessage = errorData.error || errorMessage;
                    } catch (jsonParseError) {
                        console.warn("Fallo en el parseo JSON para error de lista_compra, volviendo a texto sin procesar.", jsonParseError);
                        errorMessage = `El servidor respondió con un JSON inválido. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                }
            } else {
                    errorMessage = `El servidor respondió con un error no JSON. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                    console.error("Respuesta de error no JSON del servidor:", responseBody);
                }
                throw new Error(errorMessage);
            }
            console.log(`Item "${itemData.item}" (Ingrediente ID: ${itemData.ingredient_id || 'N/A'}) añadido con éxito a la lista de la compra.`);
        } catch (error) {
            console.error(`Error al añadir el ítem "${itemData.item}" a la lista de la compra:`, error);
            showCustomAlert(`No se pudo añadir "${itemData.item}" a la lista de la compra: ${error.message}`, 'Error de Lista');
            allItemsAddedSuccessfully = false;
        }
    }
    entryTextInput.value = '';
    // No redirect if not all items were successfully added
    if (allItemsAddedSuccessfully) {
         window.location.href = '/lista';
    }
});

// NEW: Event listener for the "Generate Shopping List" button
generateShoppingListButton.addEventListener('click', async () => {
    try {
        // Display a loading message
        showCustomAlert('Generando lista de compra basada en el menú de hoy...', 'Generando Lista');

        const response = await fetch('/api/lista_compra/generate', {
            method: 'POST', // This endpoint triggers the generation
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            const contentType = response.headers.get('content-type');
            const responseBody = await response.text();
            if (contentType && contentType.includes('application/json')) {
                try {
                    const errorData = JSON.parse(responseBody);
                    errorMessage = errorData.error || errorMessage;
                } catch (jsonParseError) {
                    console.warn("Fallo en el parseo JSON para error de generación de lista de compra, volviendo a texto sin procesar.", jsonParseError);
                    errorMessage = `El servidor respondió con un JSON inválido. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                }
            } else {
                errorMessage = `El servidor respondió con un error no JSON. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                console.error("Respuesta de error no JSON del servidor:", responseBody);
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('Generación de lista de compra completada:', result.message);
        showCustomAlert('Lista de compra generada exitosamente. Revisa la sección de Lista de Compra.', 'Éxito');
        // Optionally redirect to the shopping list page after a short delay
        setTimeout(() => {
            window.location.href = '/lista';
        }, 1500);

    } catch (error) {
        console.error('Error al generar la lista de compra:', error);
        showCustomAlert(`No se pudo generar la lista de compra: ${error.message}`, 'Error');
    }
});


// Logic for Quick Notes button
quickNotesButton.addEventListener('click', async () => {
    const rawNoteText = entryTextInput.value; // Get raw value from input
    const noteText = rawNoteText.trim(); // Trim leading/trailing whitespace

    if (noteText.length === 0) { // If the text is empty after trimming, redirect to the notes page.
        window.location.href = '/notas';
        return; // Stop function execution here.
    }

    // If we get here, the text is not empty, try to save it.
    try {
        const response = await fetch('/api/notas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texto: noteText })
        });
        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            const contentType = response.headers.get('content-type');
            const responseBody = await response.text();
            if (contentType && contentType.includes('application/json')) {
                try {
                    const errorData = JSON.parse(responseBody);
                    errorMessage = errorData.error || errorMessage;
                } catch (jsonParseError) {
                    console.warn("Fallo en el parseo JSON para error de añadir_nota, volviendo a texto sin procesar.", jsonParseError);
                    errorMessage = `El servidor respondió con un JSON inválido. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                }
            } else {
                errorMessage = `El servidor respondió con un error no JSON. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                console.error("Respuesta de error no JSON del servidor:", responseBody);
            }
            throw new Error(errorMessage);
        }
        showCustomAlert('Nota rápida guardada con éxito.', 'Nota Guardada');
        entryTextInput.value = ''; // Clear the input field after saving
        fetchCombinedAgenda(); // Update counters, including notes.
        window.location.href = '/notas'; // Redirect to the notes page after saving
    } catch (error) {
        console.error('Error al guardar la nota rápida:', error);
        showCustomAlert(`No se pudo guardar la nota rápida. Error: ${error.message}`, 'Error al Guardar Nota');
    }
});

// Logic for Quick Appointments button
quickCitaButton.addEventListener('click', async () => {
    const citaText = entryTextInput.value.trim();

    if (!citaText) {
        window.location.href = '/citas';
        return;
    }

    quickCitaTextDisplay.textContent = `Registrar cita: "${citaText}"`;
    quickCitaFechaInput.value = formatFecha(fechaActual);
    quickCitaFechaInput.min = formatFecha(fechaActual);
    // Quick cita modal doesn't use the entryTimeInput from the main form anymore,
    // as it's been removed. It will default to empty.
    quickCitaHoraInput.value = ''; // Ensure it's empty or set based on user's preference for quick add

    // Reset requirements for quick appointment modal
    currentQuickCitaRequisitos = [];
    renderRequisitosList(currentQuickCitaRequisitos, quickRequisitosListDisplay, true); // Render as editable in modal

    quickCitaModal.style.display = 'flex';
});

// Add requirement for quick appointment modal
quickAddRequisitoBtn.addEventListener('click', () => {
    const reqText = quickCitaRequisitoInput.value.trim();
    if (reqText) {
        currentQuickCitaRequisitos.push({ text: reqText, checked: false });
        quickCitaRequisitoInput.value = '';
        renderRequisitosList(currentQuickCitaRequisitos, quickRequisitosListDisplay, true);
    }
});


saveQuickCitaBtn.addEventListener('click', async () => {
    const citaText = entryTextInput.value.trim(); // Get from the main input, as it's passed here
    const citaFecha = quickCitaFechaInput.value;
    const citaHora = quickCitaHoraInput.value.trim();

    if (!citaFecha) {
        showCustomAlert('La fecha de la cita es obligatoria.', 'Campo Obligatorio');
        return;
    }

    try {
        const response = await fetch('/api/citas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: citaText,
                fecha: citaFecha,
                hora: citaHora || null,
                recordatorio: JSON.stringify(currentQuickCitaRequisitos) // Send requirements as JSON string
            })
        });
        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            const contentType = response.headers.get('content-type');
            const responseBody = await response.text();
            if (contentType && contentType.includes('application/json')) {
                try {
                    const errorData = JSON.parse(responseBody);
                    errorMessage = errorData.error || errorMessage;
                } catch (jsonParseError) {
                    console.warn("Fallo en el parseo JSON para error de añadir_cita (rápida), volviendo a texto sin procesar.", jsonParseError);
                    errorMessage = `El servidor respondió con un JSON inválido. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                }
            } else {
                errorMessage = `El servidor respondió con un error no JSON. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                console.error("Respuesta de error no JSON del servidor:", responseBody);
            }
            throw new Error(errorMessage);
        }
        showCustomAlert('Cita rápida guardada con éxito.', 'Cita Guardada');
        quickCitaModal.style.display = 'none';
        entryTextInput.value = '';
        currentQuickCitaRequisitos = []; // Clear requirements after saving
        renderRequisitosList(currentQuickCitaRequisitos, quickRequisitosListDisplay, true); // Clear display

        fetchCombinedAgenda(); // Re-fetch to update upcoming appointments on main page
    } catch (error) {
        console.error('Error al guardar la cita rápida:', error);
        showCustomAlert(`No se pudo guardar la cita rápida: ${error.message}`, 'Error al Guardar Cita');
    }
});

cancelQuickCitaBtn.addEventListener('click', () => {
    quickCitaModal.style.display = 'none';
    currentQuickCitaRequisitos = []; // Clear requirements on cancel
    renderRequisitosList(currentQuickCitaRequisitos, quickRequisitosListDisplay, true); // Clear display
});


// NEW: Show Choose Entry Type Modal (or Edit Modal)
unifiedEntryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const activityDescription = entryTextInput.value.trim();

    if (!activityDescription) {
        showCustomAlert('La descripción de la actividad no puede estar vacía.', 'Campo Obligatorio');
        return;
    }

    // Set for new entry
    chooseEntryTypeModalTitle.textContent = 'Elegir Tipo de Actividad';
    editEntryId.value = ''; // Clear ID for new entry
    modalEntryType.disabled = false; // Enable type selection for new entry

    modalEntryText.value = activityDescription;
    activityTextDisplay.textContent = `Registrar: "${activityDescription}"`; // Still show in paragraph below title

    modalStartTimeInput.value = ''; // Clear previous values
    modalEndTimeInput.value = '';
    modalEntryType.value = 'tarea'; // Default to Tarea
    
    // Hide all specific fields and show end time by default
    modalRoutineFields.style.display = 'none';
    modalCitaFields.style.display = 'none';
    modalTaskDateFields.style.display = 'block'; // Show task date field for new tasks
    modalEndTimeDiv.style.display = 'block';

    // Set default task date to today
    const today = new Date();
    const todayFormatted = formatFecha(today);
    modalTaskFechaInput.value = todayFormatted;
    modalTaskFechaInput.min = todayFormatted;

    currentModalRequisitos = []; // Reset requirements for this modal
    renderRequisitosList(currentModalRequisitos, modalRequisitosListDisplay, true); // Clear display

    chooseEntryTypeModal.style.display = 'flex';
});

// NEW: Event listener for type change within the new modal
modalEntryType.addEventListener('change', () => {
    const selectedType = modalEntryType.value;
    // Hide all specific fields first
    modalRoutineFields.style.display = 'none';
    modalCitaFields.style.display = 'none';
    modalTaskDateFields.style.display = 'none';
    modalEndTimeDiv.style.display = 'block'; // Always show end time in this modal by default

    if (selectedType === 'rutina') {
        modalRoutineFields.style.display = 'block';
        modalRoutineDayCheckboxes.forEach(checkbox => checkbox.checked = false); // Clear checkboxes
    } else if (selectedType === 'cita') {
        modalCitaFields.style.display = 'block';
        modalEndTimeDiv.style.display = 'none'; // Citas don't use hora_fin
        // Reset cita requirements when type changes
        currentModalRequisitos = [];
        renderRequisitosList(currentModalRequisitos, modalRequisitosListDisplay, true);
        // Set min date for citaFechaInput
        const today = new Date();
        const todayFormatted = formatFecha(today);
        modalCitaFechaInput.min = todayFormatted;
        modalCitaFechaInput.value = todayFormatted;
    } else if (selectedType === 'tarea') {
        modalTaskDateFields.style.display = 'block';
        const today = new Date();
        const todayFormatted = formatFecha(today);
        modalTaskFechaInput.min = todayFormatted;
        modalTaskFechaInput.value = todayFormatted;
    }
});

// NEW: Add requirement for the main activity modal
modalAddRequisitoBtn.addEventListener('click', () => {
    const reqText = modalCitaRequisitoInput.value.trim();
    if (reqText) {
        currentModalRequisitos.push({ text: reqText, checked: false });
        modalCitaRequisitoInput.value = '';
        renderRequisitosList(currentModalRequisitos, modalRequisitosListDisplay, true);
    }
});

// NEW: Save button for the new "Choose Activity Type" modal (handles Add and Edit)
saveModalEntryBtn.addEventListener('click', async () => {
    const type = modalEntryType.value;
    const id = editEntryId.value; // Will be empty for new entries
    const text = modalEntryText.value.trim(); // Get from the modal's text input
    const startTime = modalStartTimeInput.value.trim();
    const endTime = modalEndTimeInput.value.trim();

    if (!text) {
        showCustomAlert('La descripción no puede estar vacía.', 'Campo Obligatorio');
        return;
    }

    let url = '';
    let method = '';
    let payload = {};

    if (id) { // Editing existing entry
        method = 'PUT';
        if (type === 'tarea') {
            url = `/api/tareas/${id}`;
            payload = { fecha: modalTaskFechaInput.value, texto: text, hora: startTime || null };
        } else if (type === 'rutina') {
            url = `/api/rutinas/${id}`;
            const diasSeleccionados = Array.from(modalRoutineDayCheckboxes)
                                        .filter(checkbox => checkbox.checked)
                                        .map(checkbox => dayNameToNumber[checkbox.value]);
            if (!startTime || diasSeleccionados.length === 0) {
                showCustomAlert('Para una rutina, la hora de inicio y al menos un día son obligatorios.', 'Campos Obligatorios');
                return;
            }
            payload = { nombre: text, hora: startTime, hora_fin: endTime || null, dias: diasSeleccionados };
        } else if (type === 'cita') {
            url = `/api/citas/${id}`;
            const citaFecha = modalCitaFechaInput.value;
            if (!citaFecha) {
                showCustomAlert('La fecha de la cita es obligatoria.', 'Campo Obligatorio');
                return;
            }
            payload = { nombre: text, fecha: citaFecha, hora: startTime || null, recordatorio: JSON.stringify(currentModalRequisitos) };
        }
    } else { // Adding new entry
        method = 'POST';
        if (type === 'tarea') {
            url = '/api/tareas';
            const fecha = modalTaskFechaInput.value;
             if (!fecha) {
                showCustomAlert('La fecha de la tarea es obligatoria.', 'Campo Obligatorio');
                return;
            }
            payload = { fecha, texto: text, hora: startTime || null };
        } else if (type === 'rutina') {
            url = '/api/rutinas';
            const diasSeleccionados = Array.from(modalRoutineDayCheckboxes)
                                        .filter(checkbox => checkbox.checked)
                                        .map(checkbox => dayNameToNumber[checkbox.value]);
            if (!startTime || diasSeleccionados.length === 0) {
                showCustomAlert('Para una rutina, la hora de inicio y al menos un día son obligatorios.', 'Campos Obligatorios');
                return;
            }
            payload = { nombre: text, hora: startTime, hora_fin: endTime || null, dias: diasSeleccionados };
        } else if (type === 'cita') {
            url = '/api/citas';
            const citaFecha = modalCitaFechaInput.value;
            if (!citaFecha) {
                showCustomAlert('La fecha de la cita es obligatoria.', 'Campo Obligatorio');
                return;
            }
            payload = { nombre: text, fecha: citaFecha, hora: startTime || null, recordatorio: JSON.stringify(currentModalRequisitos) };
        }
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            const contentType = response.headers.get('content-type');
            const responseBody = await response.text();
            if (contentType && contentType.includes('application/json')) {
                try {
                    const errorData = JSON.parse(responseBody);
                    errorMessage = errorData.error || errorMessage;
                } catch (jsonParseError) {
                    console.warn("Fallo en el parseo JSON para error de guardado/edición, volviendo a texto sin procesar.", jsonParseError);
                    errorMessage = `El servidor respondió con un JSON inválido. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                }
            } else {
                errorMessage = `El servidor respondió con un error no JSON. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                console.error("Respuesta de error no JSON del servidor:", responseBody);
            }
            throw new Error(errorMessage);
        }

        showCustomAlert(`${type === 'tarea' ? 'Tarea' : type === 'rutina' ? 'Rutina' : 'Cita'} ${id ? 'actualizada' : 'guardada'} con éxito.`, 'Éxito');
        chooseEntryTypeModal.style.display = 'none';
        entryTextInput.value = ''; // Clear main input field
        fetchCombinedAgenda();
    } catch (error) {
        console.error(`Error al guardar/actualizar la actividad:`, error);
        showCustomAlert(`No se pudo ${id ? 'actualizar' : 'guardar'} la actividad. Error: ${error.message}`, 'Error');
    }
});


// NEW: Cancel button for the new "Choose Activity Type" modal
cancelModalEntryBtn.addEventListener('click', () => {
    chooseEntryTypeModal.style.display = 'none';
    currentModalRequisitos = []; // Clear requirements on cancel
    renderRequisitosList(currentModalRequisitos, modalRequisitosListDisplay, true); // Clear display
    modalEntryType.disabled = false; // Re-enable type selection for next time
});

