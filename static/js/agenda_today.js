 // --- SECTION 3: TODAY'S AGENDA LOGIC ---
        // Handles fetching and rendering of today's tasks and routines, and their actions.
        async function fetchCombinedAgenda() {
            const todayDate = formatFecha(fechaActual);
            const currentDate = new Date(); // Definition of currentDate
            const todayDayOfWeek = currentDate.getDay();

            let allEntries = [];
            // Fetch Tasks
            try {
                const tasksResponse = await fetch(`/api/tareas/${todayDate}`);
                const tasks = await tasksResponse.json();
                tasks.forEach(task => {
                    allEntries.push({
                        ...task,
                        type: 'tarea',
                        displayTime: task.hora,
                        displayText: task.texto
                    });
                });
            } catch (error) {
                console.error('Error al cargar las tareas:', error);
            }

            // Fetch Routines
            try {
                const routinesResponse = await fetch('/api/rutinas');
                const routines = await routinesResponse.json();
                routines.forEach(routine => {
                    if (routine.dias && Array.isArray(routine.dias) && routine.dias.includes(todayDayOfWeek)) {
                        allEntries.push({
                            id: routine.id,
                            type: 'rutina',
                            displayTime: routine.hora, // This is the start time of the routine
                            displayText: routine.nombre,
                            dias: routine.dias,
                            hora_fin: routine.hora_fin // This is the end time of the routine
                        });
                    }
                });
            } catch (error) {
                console.error('Error al cargar las rutinas:', error);
            }

            // Fetch completed routines for today
            try {
                const completedRoutinesResponse = await fetch(`/api/rutinas/completadas_por_dia/${todayDate}`);
                if (!completedRoutinesResponse.ok) {
                    const errorText = await completedRoutinesResponse.text();
                    throw new Error(`Error al cargar las rutinas completadas: ${errorText}`);
                }
                const completedRoutineIds = await completedRoutinesResponse.json();
                completedRoutineIdsForToday = new Set(completedRoutineIds);
            } catch (error) {
                console.error('Error al obtener las rutinas completadas para hoy:', error);
                completedRoutineIdsForToday = new Set();
            }

            // --- START: Auto-completion logic for routines ---
            let itemsToMarkCompleted = []; // Unified for tasks and routines
            const now = new Date();
            const todayDateString = formatFecha(now);

            allEntries.forEach(entry => {
                // Routines: Auto-completion for routines (if their hora_fin has passed and they are not already completed)
                if (entry.type === 'rutina' && !completedRoutineIdsForToday.has(entry.id) && entry.hora_fin) {
                    const [hour, minute] = entry.hora_fin.split(':').map(Number);
                    const routineEndDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);

                    if (routineEndDateTime < now) {
                        itemsToMarkCompleted.push({ type: 'rutina', id: entry.id, currentStatus: completedRoutineIdsForToday.has(entry.id) });
                        completedRoutineIdsForToday.add(entry.id); // Update local status for immediate rendering
                        console.log(`DEBUG: Rutina '${entry.displayText}' (ID: ${entry.id}) identificada para auto-completado.`);
                    }
                }
            });

            // Send updates to the backend asynchronously
            if (itemsToMarkCompleted.length > 0) {
                console.log("DEBUG: Elementos identificados para auto-completado:", itemsToMarkCompleted);
                itemsToMarkCompleted.forEach(async (item) => {
                    try {
                        let response;
                        // Only send the request to the backend for routines
                        if (item.type === 'rutina') {
                            response = await fetch(`/api/rutinas/${item.id}/toggle_completada_dia`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fecha: todayDateString })
                            });
                        }

                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error(`Error auto-completando ${item.type} ${item.id} en el backend:`, errorText);
                        } else {
                            console.log(`${item.type} ${item.id} auto-completado en el backend.`);
                        }
                    } catch (error) {
                        console.error(`Error de red auto-completando ${item.type} ${item.id}:`, error);
                    }
                });
            }
            // --- END: Auto-completion logic for tasks and routines ---

            // Fetch counts for quick access buttons and navigation
            await fetchCountsForButtons();

            renderCombinedAgenda(allEntries);
            fetchUpcomingCitas(); // Call fetchUpcomingCitas separately
        }

        async function fetchCountsForButtons() {
             // Fetch for shopping list item count
            try {
                const listCountResponse = await fetch('/api/lista_compra');
                if (listCountResponse.ok) {
                    const items = await listCountResponse.json();
                    const uncompletedCount = items.filter(item => !item.comprada).length; // Corrected 'comprado' to 'comprada'
                    quickListCountElem.textContent = uncompletedCount;
                } else {
                    console.warn('No se pudo obtener el recuento de la lista de la compra.');
                    quickListCountElem.textContent = '0';
                }

            } catch (error) {
                console.error('Error al obtener el recuento de la lista:', error);
                quickListCountElem.textContent = '0';
            }

            // Fetch for quick notes count
            try {
                const notesCountResponse = await fetch('/api/notas');
                if (notesCountResponse.ok) {
                    const notes = await notesCountResponse.json(); // Corrected to use notesCountResponse
                    quickNotesCountElem.textContent = notes.length;
                } else {
                    console.warn('No se pudo obtener el recuento de notas.');
                    quickNotesCountElem.textContent = '0';
                }
            } catch (error) {
                console.error('Error al obtener el recuento de notas:', error);
                quickNotesCountElem.textContent = '0';
            }
        }

        function renderCombinedAgenda(entries) {
            combinedAgendaList.innerHTML = '';

            const todayDateString = formatFecha(fechaActual);
            const now = new Date();

            entries.sort((a, b) => {
                const isACompleted = (a.type === 'tarea' && a.completada) || (a.type === 'rutina' && completedRoutineIdsForToday.has(a.id));
                const isBCompleted = (b.type === 'tarea' && b.completada) || (b.type === 'rutina' && completedRoutineIdsForToday.has(b.id));

                // Get start and end moments for A
                const aStartTime = a.displayTime;
                const aEndTime = a.type === 'rutina' ? a.hora_fin : a.displayTime; // For tasks, end time is its own time
                const aMomentStart = getMoment(todayDateString, aStartTime);
                const aMomentEnd = getMoment(todayDateString, aEndTime);

                // Get start and end moments for B
                const bStartTime = b.displayTime;
                const bEndTime = b.type === 'rutina' ? b.hora_fin : b.displayTime; // For tasks, end time is its own time
                const bMomentStart = getMoment(todayDateString, bStartTime);
                const bMomentEnd = getMoment(todayDateString, bEndTime);


                let priorityA, priorityB;

                if (isACompleted) {
                    priorityA = 3; // Completed items last
                } else if (a.type === 'tarea' && aMomentStart && aMomentStart < now) {
                    priorityA = 2; // Overdue task
                } else if (a.type === 'rutina' && aMomentEnd && aMomentEnd < now) {
                    priorityA = 2; // Overdue routine (based on end time)
                } else {
                    priorityA = 1; // Pending
                }

                if (priorityB === 'completed') {
                    priorityB = 3;
                } else if (b.type === 'tarea' && bMomentStart && bMomentStart < now) {
                    priorityB = 2; // Overdue task
                } else if (b.type === 'rutina' && bMomentEnd && bMomentEnd < now) {
                    priorityB = 2; // Overdue routine (based on end time)
                } else {
                    priorityB = 1; // Pending
                }

                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }

                // If they have the same priority, sort by time
                // Use the start time for primary sorting
                const timeA = a.displayTime || '24:00';
                const timeB = b.displayTime || '24:00';
                return timeA.localeCompare(timeB);
            });


            if (entries.length === 0) {
                combinedAgendaList.innerHTML = '<li class="text-gray-500 italic">No hay tareas ni rutinas programadas para hoy.</li>';
                if (timeLeftUpdateInterval) {
                    clearInterval(timeLeftUpdateInterval);
                    timeLeftUpdateInterval = null;
                }
                return;
            }

            entries.forEach(entry => {
                const li = document.createElement('li');
                li.dataset.id = entry.id;
                li.classList.add('entry-item', 'bg-white', 'p-3', 'rounded-lg', 'shadow-sm', 'flex', 'flex-col', 'md:flex-row', 'md:items-center', 'justify-between', 'space-y-2', 'md:space-y-0');

                const contentDiv = document.createElement('div');
                contentDiv.classList.add('flex-grow');

                const textSpan = document.createElement('span');
                textSpan.classList.add('entry-text', 'font-semibold', 'text-gray-800');

                const actionsDiv = document.createElement('div');
                actionsDiv.classList.add('entry-actions', 'flex', 'flex-wrap', 'gap-2', 'mt-2', 'md:mt-0', 'md:ml-4', 'justify-end');

                if (entry.type === 'tarea') {
                    li.classList.add('task-item');
                    li.dataset.fecha = entry.fecha;
                    li.dataset.textoOriginal = entry.displayText;
                    li.dataset.horaOriginal = entry.displayTime || '';

                    const formattedTime = entry.displayTime ? entry.displayTime.substring(0, 5) : '';
                    const horaPrefix = formattedTime ? `<span class="entry-time text-gray-500 text-sm">${formattedTime}</span> - ` : '';
                    textSpan.innerHTML = `${horaPrefix}${entry.displayText}`;
                    if (entry.completada) {
                        li.classList.add('completed-item');
                        textSpan.classList.add('completada');
                    }

                    const timeLeftSpan = document.createElement('span');
                    timeLeftSpan.classList.add('time-left', 'ml-2', 'text-sm');
                    timeLeftSpan.dataset.itemId = entry.id;
                    timeLeftSpan.dataset.itemDate = entry.fecha;
                    timeLeftSpan.dataset.itemTime = entry.displayTime || '';
                    timeLeftSpan.dataset.itemType = 'tarea';
                    contentDiv.appendChild(textSpan);
                    contentDiv.appendChild(timeLeftSpan);

                    const completeButton = document.createElement('button');
                    completeButton.classList.add('btn-completar', 'btn-compact', 'bg-blue-500', 'hover:bg-blue-700', 'text-white');
                    completeButton.dataset.id = entry.id;
                    completeButton.title = entry.completada ? 'Descompletar' : 'Completar';
                    completeButton.innerHTML = entry.completada ? '<i class="fas fa-undo"></i>' : '<i class="fas fa-check"></i>';
                    if (entry.completada) completeButton.classList.add('completada', 'bg-green-500', 'hover:bg-green-700'); // Style for uncomplete
                    actionsDiv.appendChild(completeButton);
                    completeButton.addEventListener('click', toggleTaskCompletada);


                    const editButton = document.createElement('button');
                    editButton.classList.add('btn-editar', 'btn-compact', 'bg-gray-400', 'hover:bg-gray-600', 'text-white');
                    editButton.dataset.id = entry.id;
                    editButton.title = 'Editar Tarea';
                    editButton.innerHTML = '<i class="fas fa-edit"></i>';
                    editButton.addEventListener('click', () => editTask(entry.id, entry.displayText, entry.fecha, entry.displayTime));
                    actionsDiv.appendChild(editButton);

                    const postponeButton = document.createElement('button');
                    postponeButton.classList.add('boton', 'btn-compact', 'bg-yellow-500', 'hover:bg-yellow-700', 'text-white');
                    postponeButton.title = 'Aplazar Tarea';
                    postponeButton.innerHTML = '<i class="fas fa-calendar-alt"></i>';
                    postponeButton.addEventListener('click', (event) => postponeTask(entry.id, entry.fecha, entry.hora, entry.displayText));
                    actionsDiv.appendChild(postponeButton);

                    const saveRegistroButton = document.createElement('button');
                    saveRegistroButton.classList.add('btn-guardar-registro-icon', 'btn-compact', 'bg-gray-500', 'hover:bg-gray-700', 'text-white');
                    saveRegistroButton.dataset.id = entry.id;
                    saveRegistroButton.title = 'Guardar en Registro';
                    saveRegistroButton.innerHTML = '<i class="fas fa-save"></i>';
                    saveRegistroButton.addEventListener('click', (event) => saveTaskToRegistro(entry.fecha, entry.displayText)); // Pass relevant task data directly
                    actionsDiv.appendChild(saveRegistroButton);

                    const deleteButton = document.createElement('button');
                    deleteButton.classList.add('btn-eliminar', 'btn-compact', 'bg-red-500', 'hover:bg-red-700', 'text-white');
                    deleteButton.dataset.id = entry.id;
                    deleteButton.title = 'Eliminar Tarea';
                    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
                    deleteButton.addEventListener('click', deleteTask);
                    actionsDiv.appendChild(deleteButton);


                } else if (entry.type === 'rutina') {
                    li.classList.add('routine-item');
                    const formattedStartTime = entry.displayTime ? entry.displayTime.substring(0, 5) : '';
                    const formattedEndTime = entry.hora_fin ? entry.hora_fin.substring(0, 5) : ''; // Display end time

                    let timeDisplay = '';
                    if (formattedStartTime && formattedEndTime) {
                        timeDisplay = `${formattedStartTime}-${formattedEndTime}`;
                    } else if (formattedStartTime) {
                        timeDisplay = formattedStartTime;
                    }

                    // Display routine name with time prefix
                    textSpan.innerHTML = timeDisplay ? `<span class="entry-time text-gray-500 text-sm">${timeDisplay}</span> - ${entry.displayText}` : entry.displayText;
                    contentDiv.appendChild(textSpan);

                    const timeLeftSpan = document.createElement('span');
                    timeLeftSpan.classList.add('time-left', 'ml-2', 'text-sm');
                    timeLeftSpan.dataset.itemId = `routine-${entry.id}`;
                    timeLeftSpan.dataset.itemDate = todayDateString;
                    timeLeftSpan.dataset.itemTime = entry.displayTime;
                    timeLeftSpan.dataset.itemEndTime = entry.hora_fin;
                    timeLeftSpan.dataset.itemType = 'rutina';
                    contentDiv.appendChild(timeLeftSpan);

                    // Add status badge for routines
                    const statusBadge = document.createElement('span');
                    statusBadge.classList.add('ml-2', 'px-2', 'py-1', 'rounded-full', 'text-xs', 'font-semibold');
                    contentDiv.appendChild(statusBadge);

                    if (completedRoutineIdsForToday.has(entry.id)) {
                        li.classList.add('completed-item');
                        textSpan.classList.add('completada');
                    }

                    const completeRoutineButton = document.createElement('button');
                    completeRoutineButton.classList.add('btn-completar', 'btn-compact', 'bg-blue-500', 'hover:bg-blue-700', 'text-white');
                    completeRoutineButton.dataset.id = entry.id;
                    completeRoutineButton.title = completedRoutineIdsForToday.has(entry.id) ? 'Descompletar Rutina' : 'Completar Rutina';
                    completeRoutineButton.innerHTML = completedRoutineIdsForToday.has(entry.id) ? '<i class="fas fa-undo"></i>' : '<i class="fas fa-check"></i>';
                    if (completedRoutineIdsForToday.has(entry.id)) {
                        completeRoutineButton.classList.add('completada', 'bg-green-500', 'hover:bg-green-700');
                    } else {
                        completeRoutineButton.classList.remove('completada');
                    }

                    completeRoutineButton.addEventListener('click', async (event) => {
                        const routineId = event.currentTarget.dataset.id;
                        try {
                            const response = await fetch(`/api/rutinas/${routineId}/toggle_completada_dia`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fecha: todayDateString })
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
                                        console.warn("Fallo en el parseo JSON para error de alternancia de rutina, volviendo a texto sin procesar.", jsonParseError);
                                        errorMessage = `El servidor respondió con un JSON inválido. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                                    }
                                } else {
                                    errorMessage = `El servidor respondió con un error no JSON. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                                    console.error("Respuesta de error no JSON del servidor:", responseBody);
                                }
                                throw new Error(errorMessage);
                            }
                            showCustomAlert('Estado de rutina actualizado.', 'Actualización Exitosa');
                            fetchCombinedAgenda();
                        } catch (error) {
                            console.error('Error al cambiar estado de rutina:', error);
                            showCustomAlert(`No se pudo actualizar la rutina. Error: ${error.message}`, 'Error de Actualización');
                        }
                    });
                    actionsDiv.appendChild(completeRoutineButton);

                    const editButton = document.createElement('button');
                    editButton.classList.add('btn-editar', 'btn-compact', 'bg-gray-400', 'hover:bg-gray-600', 'text-white');
                    editButton.dataset.id = entry.id;
                    editButton.title = 'Editar Rutina';
                    editButton.innerHTML = '<i class="fas fa-edit"></i>';
                    editButton.addEventListener('click', () => editRoutine(entry.id, entry.displayText, entry.displayTime, entry.hora_fin, entry.dias));
                    actionsDiv.appendChild(editButton);

                    const deleteButton = document.createElement('button');
                    deleteButton.classList.add('btn-eliminar', 'btn-compact', 'bg-red-500', 'hover:bg-red-700', 'text-white');
                    deleteButton.dataset.id = entry.id;
                    deleteButton.title = 'Eliminar Rutina';
                    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
                    deleteButton.addEventListener('click', deleteRoutine);
                    actionsDiv.appendChild(deleteButton);
                }

                li.appendChild(contentDiv);
                li.appendChild(actionsDiv);
                combinedAgendaList.appendChild(li);
            });

            // Clear previous interval to avoid multiple intervals running
            if (timeLeftUpdateInterval) {
                clearInterval(timeLeftUpdateInterval);
                timeLeftUpdateInterval = null;
            }
            // Update every minute
            timeLeftUpdateInterval = setInterval(updateAllTimeLeftCounters, 60 * 1000);
            // Initial update
            updateAllTimeLeftCounters();
        }

        async function toggleTaskCompletada(event) {
            const taskId = event.currentTarget.dataset.id;
            try {
                const response = await fetch(`/api/tareas/${taskId}/toggle_completada`, {
                    method: 'PATCH',
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
                            console.warn("Fallo en el parseo JSON para error de alternancia de tarea, volviendo a texto sin procesar.", jsonParseError);
                            errorMessage = `El servidor respondió con un JSON inválido. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                        }
                    } else {
                        errorMessage = `El servidor respondió con un error no JSON. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                        console.error("Respuesta de error no JSON del servidor:", responseBody);
                    }
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                console.log('Tarea actualizada:', data);
                showCustomAlert('Estado de tarea actualizado con éxito.', 'Actualización Exitosa');
                fetchCombinedAgenda();
            } catch (error) {
                console.error('Error al actualizar el estado de la tarea:', error);
                showCustomAlert(`No se pudo actualizar la tarea. Error: ${error.message}`, 'Error de Actualización');
            }
        }

        // NEW: Function to edit a Task
        async function editTask(taskId, text, fecha, hora) {
            chooseEntryTypeModalTitle.textContent = 'Editar Tarea';
            modalEntryType.value = 'tarea';
            modalEntryType.disabled = true; // Cannot change type when editing
            editEntryId.value = taskId;

            modalEntryText.value = text;
            modalStartTimeInput.value = hora || '';
            modalEndTimeInput.value = ''; // Tasks don't use hora_fin
            modalEndTimeDiv.style.display = 'block'; // Ensure it's visible for tasks (even if empty)

            modalTaskFechaInput.value = fecha;
            const today = new Date();
            modalTaskFechaInput.min = formatFecha(today); // Keep min date as today

            modalRoutineFields.style.display = 'none';
            modalCitaFields.style.display = 'none';
            modalTaskDateFields.style.display = 'block';

            currentModalRequisitos = []; // Tasks don't have requirements, so clear this
            renderRequisitosList(currentModalRequisitos, modalRequisitosListDisplay, true); // Clear display

            chooseEntryTypeModal.style.display = 'flex';
        }


        async function deleteTask(event) {
            const taskId = event.currentTarget.dataset.id;
            const confirmAction = await showCustomConfirm('¿Estás seguro de que quieres eliminar esta tarea?');
            if (confirmAction) {
                try {
                    const response = await fetch(`/api/tareas/${taskId}`, {
                        method: 'DELETE'
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
                                console.warn("Fallo en el parseo JSON para error de eliminación de tarea, volviendo a texto sin procesar.", jsonParseError);
                                errorMessage = `El servidor respondió con un JSON inválido. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                        }
                    } else {
                            errorMessage = `El servidor respondió con un error no JSON. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                            console.error("Respuesta de error no JSON del servidor:", responseBody);
                        }
                        throw new Error(errorMessage);
                    }
                    showCustomAlert('Tarea eliminada exitosamente.', 'Eliminación Exitosa');
                    fetchCombinedAgenda();
                } catch (error) {
                    console.error('Error al eliminar la tarea:', error);
                    showCustomAlert(`No se pudo eliminar la tarea: ${error.message}`, 'Error de Eliminación');
                }
            }
        }

        // NEW: Function to edit a Routine
        async function editRoutine(routineId, nombre, hora, hora_fin, dias) {
            chooseEntryTypeModalTitle.textContent = 'Editar Rutina';
            modalEntryType.value = 'rutina';
            modalEntryType.disabled = true; // Cannot change type when editing
            editEntryId.value = routineId;

            modalEntryText.value = nombre;
            modalStartTimeInput.value = hora || '';
            modalEndTimeInput.value = hora_fin || '';
            modalEndTimeDiv.style.display = 'block';

            // Set routine days checkboxes
            modalRoutineDayCheckboxes.forEach(checkbox => {
                const dayNumber = dayNameToNumber[checkbox.value];
                checkbox.checked = dias.includes(dayNumber);
            });

            modalRoutineFields.style.display = 'block';
            modalCitaFields.style.display = 'none';
            modalTaskDateFields.style.display = 'none'; // Hide task date fields

            currentModalRequisitos = []; // Routines don't have requirements, so clear this
            renderRequisitosList(currentModalRequisitos, modalRequisitosListDisplay, true); // Clear display

            chooseEntryTypeModal.style.display = 'flex';
        }

        async function deleteRoutine(event) {
            const routineId = event.currentTarget.dataset.id;
            const confirmAction = await showCustomConfirm('¿Estás seguro de que quieres eliminar esta rutina?');
            if (confirmAction) {
                try {
                    const response = await fetch(`/api/rutinas/${routineId}`, {
                        method: 'DELETE'
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
                                console.warn("Fallo en el parseo JSON para error de eliminación de rutina, volviendo a texto sin procesar.", jsonParseError);
                                errorMessage = `El servidor respondió con un JSON inválido. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                            }
                        } else {
                            errorMessage = `El servidor respondió con un error no JSON. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                            console.error("Respuesta de error no JSON del servidor:", responseBody);
                        }
                        throw new Error(errorMessage);
                    }
                    showCustomAlert('Rutina eliminada con éxito.', 'Eliminación Exitosa');
                    fetchCombinedAgenda();
                }
                catch (error) {
                    console.error('Error al eliminar la rutina:', error);
                    showCustomAlert(`No se pudo eliminar la rutina: ${error.message}`, 'Error de Eliminación');
                }
            }
        }

        /**
         * Updates the time left counter for a specific item (task or routine).
         * It calculates time remaining or time elapsed and updates the UI.
         * For routines, it also updates a status badge.
         * @param {string} itemId - The ID of the item (task or routine).
         * @param {string} itemDate - The date of the item inYYYY-MM-DD format.
         * @param {string} itemTime - The start time of the item in HH:MM format.
         * @param {string} [itemEndTime] - The end time of the routine in HH:MM format (optional, only for routines).
         * @param {string} itemType - The type of the item ('tarea' or 'rutina').
         */
        function updateTimeLeft(itemId, itemDate, itemTime, itemEndTime, itemType) {
            const targetElement = document.querySelector(`[data-item-id="${itemId}"]`);
            if (!targetElement) {
                return;
            }

            const parentItem = targetElement.closest('.entry-item'); // Get the main list item
            const now = new Date();
            const todayDateString = formatFecha(now);
            const isRoutineItem = itemType === 'rutina';

            // Check if the item is completed (either a completed task or a routine completed today)
            const isCompleted = (parentItem && parentItem.classList.contains('task-item') && parentItem.classList.contains('completed-item')) ||
                                (isRoutineItem && completedRoutineIdsForToday.has(itemId.replace('routine-', '')));

            if (isCompleted) {
                targetElement.textContent = ''; // Clear time left
                targetElement.classList.remove('vencida', 'pasada');
                if (parentItem) {
                    // Ensure completed style applies to text and remove any overdue styling
                    const textSpan = parentItem.querySelector('.entry-text');
                    if (textSpan) {
                        textSpan.classList.add('completada'); // Add strikethrough/gray color
                        textSpan.classList.remove('vencida'); // Remove red color
                    }
                    // Update status badge for completed routines
                    const statusBadge = parentItem.querySelector('.px-2.py-1.rounded-full');
                    if (statusBadge) {
                        statusBadge.textContent = 'Completada';
                        statusBadge.classList.remove('bg-blue-200', 'text-blue-800', 'bg-yellow-200', 'text-yellow-800', 'bg-red-200', 'text-red-800');
                        statusBadge.classList.add('bg-green-200', 'text-green-800');
                    }
                }
                return;
            }

            const [year, month, day] = itemDate.split('-').map(Number);

            let startHours, startMinutes;
            let formattedItemTime = typeof itemTime === 'string' && itemTime.length >= 5 ? itemTime.substring(0, 5) : '00:00';
            const timeParts = formattedItemTime.split(':');
            startHours = parseInt(timeParts[0]);
            startMinutes = parseInt(timeParts[1]);

            const itemMomentStart = new Date(year, month - 1, day, startHours, startMinutes, 0);

            let timeForCalculation = itemMomentStart; // Default for tasks and pending routines
            let displayStatus = '';
            let statusClasses = [];

            const textSpan = parentItem ? parentItem.querySelector('.entry-text') : null;
            const statusBadge = parentItem ? parentItem.querySelector('.px-2.py-1.rounded-full') : null;

            if (isRoutineItem) {
                let endHours, endMinutes;
                if (itemEndTime && typeof itemEndTime === 'string' && itemEndTime.length >= 5) {
                    const endTimeParts = itemEndTime.substring(0, 5).split(':');
                    endHours = parseInt(endTimeParts[0]);
                    endMinutes = parseInt(endTimeParts[1]);
                } else {
                    // If no end time, assume routine ends 1 minute after start for calculation purposes
                    endHours = startHours;
                    endMinutes = startMinutes + 1;
                }
                const itemMomentEnd = new Date(year, month - 1, day, endHours, endMinutes, 0);

                if (now < itemMomentStart) { // Routine is pending (in the future)
                    timeForCalculation = itemMomentStart;
                    displayStatus = 'Pendiente';
                    statusClasses = ['bg-yellow-200', 'text-yellow-800'];
                    targetElement.classList.remove('pasada', 'vencida');
                    if (textSpan) textSpan.classList.remove('vencida', 'completada');
                } else if (now >= itemMomentStart && now < itemMomentEnd) { // Routine is currently in progress
                    timeForCalculation = itemMomentEnd; // Calculate time until end
                    displayStatus = 'En curso';
                    statusClasses = ['bg-blue-200', 'text-blue-800'];
                    targetElement.classList.remove('pasada', 'vencida');
                    if (textSpan) textSpan.classList.remove('vencida', 'completada');
                } else { // Routine has passed its end time
                    timeForCalculation = itemMomentEnd; // Calculate elapsed time from end
                    displayStatus = 'Vencida';
                    statusClasses = ['bg-red-200', 'text-red-800'];
                    targetElement.classList.add('vencida'); // Apply red style
                    if (textSpan) textSpan.classList.add('vencida');
                }
            } else { // It's a task
                if (now < itemMomentStart) { // Task is pending
                    timeForCalculation = itemMomentStart;
                    displayStatus = 'Pendiente'; // Conceptually, not displayed as badge
                    targetElement.classList.remove('pasada', 'vencida');
                    if (textSpan) textSpan.classList.remove('vencida', 'completada');
                } else { // Task is overdue
                    timeForCalculation = itemMomentStart; // Calculate elapsed time from start
                    displayStatus = 'Vencida'; // Conceptually, not displayed as badge
                    targetElement.classList.add('vencida'); // Apply red style
                    if (textSpan) textSpan.classList.add('vencida');
                }
            }

            // Update status badge for routines
            if (isRoutineItem && statusBadge) {
                statusBadge.textContent = displayStatus;
                statusBadge.className = 'ml-2 px-2 py-1 rounded-full text-xs font-semibold'; // Reset classes
                statusClasses.forEach(cls => statusBadge.classList.add(cls)); // Add new status classes
            }

            // Calculate and display time difference
            if (timeForCalculation < now) {
                const diffMs = now - timeForCalculation;
                const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const hoursPassed = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutesPassed = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                let elapsedTimeText = '';
                if (daysPassed > 0) {
                    elapsedTimeText = `(Hace ${daysPassed} día${daysPassed !== 1 ? 's' : ''})`;
                } else if (hoursPassed > 0) {
                    elapsedTimeText = `(Hace ${hoursPassed}h ${minutesPassed}m)`;
                } else if (minutesPassed > 0) {
                    elapsedTimeText = `(Hace ${minutesPassed}m)`;
                } else {
                    elapsedTimeText = '(Hace menos de 1m)';
                }
                targetElement.textContent = elapsedTimeText;
                targetElement.style.color = '#888'; // Gray for elapsed time
                targetElement.classList.add('pasada'); // Mark as "passed"
            } else {
                const diffMs = timeForCalculation - now;
                const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const hoursLeft = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutesLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                let timeLeftText = '';
                if (days > 0) {
                    timeLeftText = `(En ${days} día${days !== 1 ? 's' : ''})`;
                } else if (hoursLeft > 0) {
                    timeLeftText = `(En ${hoursLeft}h ${minutesLeft}m)`;
                } else if (minutesLeft > 0) {
                    timeLeftText = `(En ${minutesLeft}m)`;
                } else {
                    timeLeftText = '(En menos de 1m)';
                }

                targetElement.textContent = timeLeftText;
                targetElement.style.color = '#007bff'; // Blue for time remaining
                targetElement.classList.remove('pasada', 'vencida');
            }
        }

        // Iterates through all time-left counters and updates them
        function updateAllTimeLeftCounters() {
            const activeItemsTimeSpans = document.querySelectorAll('.time-left');
            activeItemsTimeSpans.forEach(span => {
                const itemId = span.dataset.itemId;
                const itemDate = span.dataset.itemDate;
                const itemTime = span.dataset.itemTime;
                const itemEndTime = span.dataset.itemEndTime;
                const itemType = span.dataset.itemType;

                updateTimeLeft(itemId, itemDate, itemTime, itemEndTime, itemType);
            });
        }

        // Action function: Save Task to Important Records
        async function saveTaskToRegistro(fecha, textoOriginal) {
            const formContent = document.createElement('div');
            formContent.innerHTML = `
                <h3 class="text-xl font-bold mb-4 text-center">Guardar en Registro Importante</h3>
                <div class="mb-4">
                    <label for="registroTitulo" class="block text-gray-700 text-sm font-bold mb-2">Título:</label>
                    <input type="text" id="registroTitulo" value="${textoOriginal}" required class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                </div>

                <div class="mb-4">
                    <label for="registroDescripcion" class="block text-gray-700 text-sm font-bold mb-2">Descripción:</label>
                    <textarea id="registroDescripcion" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24">${textoOriginal}</textarea>
                </div>

                <div class="mb-4">
                    <label for="registroTipo" class="block text-gray-700 text-sm font-bold mb-2">Tipo:</label>
                    <select id="registroTipo" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                        <option value="General" selected>General</option>
                    </select>
                </div>

                <div class="mb-4 text-center">
                    <p class="text-gray-700 text-sm font-bold mb-2">Opcional: Adjuntar una foto</p>
                    <button type="button" id="openCameraButton" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full flex items-center justify-center mx-auto space-x-2">
                        <i class="fas fa-camera"></i> <span>Tomar Foto</span>
                    </button>
                    <img id="registroPhotoPreview" class="photo-preview mt-4 mx-auto" style="display:none;">
                </div>

                <div class="flex justify-center space-x-4">
                    <button id="guardarRegistroBtn" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full">Guardar</button>
                    <button id="cancelRegistroBtn" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full">Cancelar</button>
                </div>
            `;

            const modal = createModal(formContent);
            document.body.appendChild(modal);

            const openCameraButton = modal.querySelector('#openCameraButton');
            currentRegistroPhotoPreviewElement = modal.querySelector('#registroPhotoPreview');

            // Show captured image if it already exists
            if (capturedImageBase64) {
                currentRegistroPhotoPreviewElement.src = capturedImageBase64;
                currentRegistroPhotoPreviewElement.style.display = 'block';
            } else {
                currentRegistroPhotoPreviewElement.style.display = 'none';
            }

            openCameraButton.addEventListener('click', () => {
                console.log("DEBUG: El botón 'Tomar Foto' en el modal de registro fue clickeado. Abriendo modal de cámara.");
                cameraModal.style.display = 'flex';
                // Reset camera preview states
                videoStream.style.display = 'block';
                photoPreview.style.display = 'none';
                capturePhotoButton.style.display = 'block';
                retakePhotoButton.style.display = 'none';
                confirmPhotoButton.style.display = 'none';

                capturedImageBase64 = null; // Clear previous capture when opening camera
                currentFileName = null;
                currentMimeType = null;
                initCamera();
            });

            document.getElementById('guardarRegistroBtn').addEventListener('click', async () => {
                const titulo = document.getElementById('registroTitulo').value.trim();
                const descripcion = document.getElementById('registroDescripcion').value.trim();
                const tipo = document.getElementById('registroTipo').value; // Always "General"

                if (!titulo) {
                    showCustomAlert('El título es obligatorio.', 'Campo Obligatorio');
                    return;
                }

                try {
                    const response = await fetch('/api/registros_importantes/add_from_task', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            fecha: fecha,
                            titulo: titulo,
                            descripcion: descripcion,
                            tipo: tipo,
                            imagen_base64: capturedImageBase64, // Send image if it exists
                            nombre_archivo: currentFileName,     // Send file name if it exists
                            mime_type: currentMimeType         // Send MIME type if it exists
                        })
                    });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Error desconocido al guardar el registro.');
                    }
                    showCustomAlert('Registro guardado con éxito.', 'Guardado Exitoso');
                    modal.remove();
                    // Clear global camera variables after successful save
                    capturedImageBase64 = null;
                    currentFileName = null;
                    currentMimeType = null;
                    currentRegistroPhotoPreviewElement = null;
                    console.log("DEBUG: Registro guardado, imagen Base64 y referencia limpiadas.");
                } catch (error) {
                    console.error('Error al guardar el registro:', error);
                    showCustomAlert(`No se pudo guardar el registro: ${error.message}`, 'Error de Guardado');
                }
            });

            document.getElementById('cancelRegistroBtn').addEventListener('click', () => {
                modal.remove();
                // Clear global camera variables if registration is canceled
                capturedImageBase64 = null;
                currentFileName = null;
                currentMimeType = null;
                currentRegistroPhotoPreviewElement = null;
                stopCamera(); // Ensure camera is stopped if still active
                console.log("DEBUG: Modal de registro cancelado, imagen y cámara detenidas.");
            });
        }

        // Action function: Postpone Task
        async function postponeTask(taskId, currentFecha, currentHora, currentTexto) {
            const confirmAction = await showCustomConfirm(`¿Estás seguro de que quieres aplazar la tarea "${currentTexto}"?`);
            if (!confirmAction) {
                return;
            }

            const formContent = document.createElement('div');
            formContent.innerHTML = `
                <h3 class="text-xl font-bold mb-4 text-center">Aplazar Tarea</h3>
                <p class="mb-4 text-gray-700 text-center">Tarea: <strong class="font-semibold">${currentTexto}</strong></p>
                <div class="mb-4">
                    <label for="newFecha" class="block text-gray-700 text-sm font-bold mb-2">Nueva Fecha:</label>
                    <input type="date" id="newFecha" value="${currentFecha}" required class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                </div>
                <div class="mb-6">
                    <label for="newHora" class="block text-gray-700 text-sm font-bold mb-2">Nueva Hora (opcional):</label>
                    <input type="time" id="newHora" value="${currentHora ? currentHora.substring(0, 5) : ''}" class="shadow appearance-none border rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                </div>
                <div class="flex justify-center space-x-4">
                    <button id="aplazarBtn" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Aplazar</button>
                    <button id="cancelAplazarBtn" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full">Cancelar</button>
                </div>
            `;

            const modal = createModal(formContent);
            document.body.appendChild(modal);

            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            document.getElementById('newFecha').min = `${year}-${month}-${day}`;


            document.getElementById('aplazarBtn').addEventListener('click', async () => {
                const newFecha = document.getElementById('newFecha').value;
                const newHora = document.getElementById('newHora').value;

                if (!newFecha) {
                    showCustomAlert('Por favor, selecciona una nueva fecha.', 'Campo Obligatorio');
                    return;
                }

                try {
                    const response = await fetch(`/api/tareas/${taskId}/aplazar`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ new_fecha: newFecha, new_hora: newHora || null })
                    });

                    if (!response.ok) {
                        let errorMessage = 'Error desconocido al aplazar la tarea.';
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                            const errorData = await response.json();
                            errorMessage = errorData.error || errorMessage;
                        } else {
                            const errorText = await response.text();
                            errorMessage = `El servidor respondió con un error no JSON. Código: ${response.status}. Mensaje: ${errorText.substring(0, 100)}...`;
                            console.error("Respuesta de error no JSON del servidor:", errorText);
                        }
                        throw new Error(errorMessage);
                    }
                    showCustomAlert('Tarea aplazada con éxito.', 'Aplazamiento Exitoso');
                    modal.remove();
                    fetchCombinedAgenda();
                } catch (error) {
                    console.error('Error al aplazar la tarea:', error);
                    showCustomAlert(`No se pudo aplazar la tarea. Error: ${error.message}`, 'Error al Aplazar');
                }
            });

            document.getElementById('cancelAplazarBtn').addEventListener('click', () => {
                modal.remove();
            });
        }