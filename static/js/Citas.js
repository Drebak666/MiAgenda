// --- SECTION 1: UPCOMING APPOINTMENTS LOGIC ---
// Handles fetching and rendering of upcoming appointments.
// Make fetchUpcomingCitas globally accessible by defining it directly on the window object.
window.fetchUpcomingCitas = async function () {
    const currentMonth = fechaActual.getMonth() + 1;
    const currentYear = fechaActual.getFullYear();
    const now = new Date(); // Use 'now' for precise time comparison

    try {
        const citasResponse = await fetch(`/api/citas/proximas/${currentYear}/${currentMonth}`);
        if (!citasResponse.ok) {
            const errorText = await citasResponse.text();
            throw new Error(`Error al cargar las citas próximas: ${errorText}`);
        }
        let fetchedCitas = await citasResponse.json();

        const citasToKeep = [];
        for (const cita of fetchedCitas) {
            const citaDateTime = new Date(cita.fecha + (cita.hora ? `T${cita.hora}` : 'T00:00:00'));
            const citaEndDateTime = cita.hora_fin
                ? new Date(cita.fecha + `T${cita.hora_fin}`)
                : new Date(cita.fecha + 'T23:59:59'); // Default to end of day if no hora_fin

            // --- NEW AUTO-COMPLETION LOGIC ---
            // If the cita is not completed, but its end time has passed, mark it as completed.
            if (!cita.completada && citaEndDateTime <= now) {
                console.log(`DEBUG: Cita "${cita.nombre}" (ID: ${cita.id}) ha finalizado. Marcando como completada.`);
                // Asynchronously mark as completed, don't wait for it to avoid blocking UI
                // This will trigger a re-fetch, updating the UI.
                toggleCitaCompletada(cita.id);
                // For now, add it to citasToKeep, it will be removed on next fetch if completed and old
                citasToKeep.push(cita);
                continue; // Skip other checks for this cita in this loop iteration
            }

            // --- AUTO-DELETION LOGIC (after 24h completed) ---
            // Check if the cita is completed AND its end time (or end of day) was more than 24 hours ago
            // (24 * 60 * 60 * 1000) is milliseconds in 24 hours
            if (cita.completada && (citaEndDateTime.getTime() + (24 * 60 * 60 * 1000)) < now.getTime()) {
                console.log(`DEBUG: Cita "${cita.nombre}" (ID: ${cita.id}) completada y más de 24h pasada. Preguntando para eliminar.`);
                const confirmDelete = await showCustomConfirm(
                    `La cita "${cita.nombre}" finalizó el ${new Date(cita.fecha).toLocaleDateString('es-ES')} a las ${cita.hora_fin || '23:59'} y está completada. ¿Quieres eliminarla?`,
                    'Eliminar Cita Completada'
                );
                if (confirmDelete) {
                    deleteCita(cita.id); // Call the existing delete function
                } else {
                    citasToKeep.push(cita); // Keep it if user cancels
                }
            } else {
                citasToKeep.push(cita); // Keep if not completed, or not yet 24h past end, or not yet ended for auto-completion
            }
        }
        fetchedCitas = citasToKeep; // Update the list to be rendered

        renderUpcomingCitas(fetchedCitas);
        // Ensure quickCitaCountElem is defined, as it might be in main.js or another script
        if (typeof quickCitaCountElem !== 'undefined') {
            quickCitaCountElem.textContent = fetchedCitas.length;
        }
    } catch (error) {
        console.error('Error al obtener las citas próximas:', error);
        if (typeof quickCitaCountElem !== 'undefined') {
            quickCitaCountElem.textContent = '0';
        }
    }
};


async function toggleCitaCompletada(citaId) {
    try {
        const response = await fetch(`/api/citas/${citaId}/toggle_completada`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
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
                    console.warn("Fallo en el parseo JSON para error de alternancia de cita, volviendo a texto sin procesar.", jsonParseError);
                    errorMessage = `El servidor respondió con un JSON inválido. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                }
            } else {
                errorMessage = `El servidor respondió con un error no JSON. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                console.error("Respuesta de error no JSON del servidor:", responseBody);
            }
            throw new Error(errorMessage);
        }

        // Only show alert if it's a manual toggle, not an auto-completion
        // This check is a simple heuristic, a more robust solution might pass a flag.
        // For now, if the response is OK, we assume it's good.
        // showCustomAlert('Estado de cita actualizado con éxito.', 'Actualización Exitosa'); // Removed to avoid spamming alerts on auto-complete
        window.fetchUpcomingCitas(); // Re-fetch to update all UI for citas
    } catch (error) {
        console.error('Error al actualizar el estado de la cita:', error);
        showCustomAlert(`No se pudo actualizar la cita. Error: ${error.message}`, 'Error de Actualización');
    }
}

// Global variable to store the current file (if uploaded)
let currentUploadedFile = null;

async function editCita(citaId, nombre, fecha, hora, hora_fin, requisitos) { // Added hora_fin
    chooseEntryTypeModalTitle.textContent = 'Editar Cita';
    modalEntryType.value = 'cita';
    modalEntryType.disabled = true; // Cannot change type when editing
    editEntryId.value = citaId;

    modalEntryText.value = nombre;
    modalStartTimeInput.value = hora || '';
    modalEndTimeInput.value = hora_fin || ''; // Populate hora_fin
    
    // Ensure modalEndTimeDiv is visible when editing a cita
    const modalEndTimeDiv = document.getElementById('modalEndTimeDiv');
    if (modalEndTimeDiv) {
        modalEndTimeDiv.style.display = 'block'; 
    }

    // Set the date input
    modalCitaFechaInput.value = fecha;
    const today = new Date();
    modalCitaFechaInput.min = formatFecha(today); // Keep min date as today

    currentModalRequisitos = Array.isArray(requisitos) ? JSON.parse(JSON.stringify(requisitos)) : []; // Deep copy
    renderRequisitosList(currentModalRequisitos, modalRequisitosListDisplay, true);

    modalRoutineFields.style.display = 'none';
    modalTaskDateFields.style.display = 'none'; // Hide task date fields
    modalCitaFields.style.display = 'block';

    chooseEntryTypeModal.style.display = 'flex';
}

async function deleteCita(citaId) {
    const confirmAction = await showCustomConfirm('¿Estás seguro de que quieres eliminar esta cita?', 'Confirmar Eliminación');
    if (!confirmAction) {
        return; // User cancelled the deletion
    }
    try {
        const response = await fetch(`/api/citas/${citaId}`, {
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
                    console.warn("Fallo en el parseo JSON para error de eliminación de cita, volviendo a texto sin procesar.", jsonParseError);
                    errorMessage = `El servidor respondió con un JSON inválido. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                }
            } else {
                errorMessage = `El servidor respondió con un error no JSON. Código: ${response.status}. Mensaje: ${responseBody.substring(0, 100)}...`;
                console.error("Respuesta de error no JSON del servidor:", responseBody);
            }
            throw new Error(errorMessage);
        }
        console.log(`Cita con ID ${citaId} eliminada exitosamente.`);
        showCustomAlert('Cita eliminada con éxito.', 'Eliminación Exitosa');
        window.fetchUpcomingCitas(); // Re-fetch to update all UI for citas
        // Ensure fetchCombinedAgenda is defined globally before calling it
        if (typeof fetchCombinedAgenda === 'function') {
            fetchCombinedAgenda(); // Also update main agenda and counts
        }
    } catch (error) {
        console.error(`Error al eliminar la cita ${citaId}:`, error);
        showCustomAlert(`No se pudo eliminar la cita. Error: ${error.message}`, 'Error de Eliminación');
    }
}

// Action function: Save Cita to Important Records
async function saveCitaToRegistro(fecha, nombre, hora, hora_fin, recordatorio) { // Added hora_fin
    const formContent = document.createElement('div');
    formContent.innerHTML = `
        <h3 class="text-xl font-bold mb-4 text-center">Guardar Cita en Registro</h3>
        <div class="mb-4">
            <label for="registroTitulo" class="block text-gray-700 text-sm font-bold mb-2">Título:</label>
            <input type="text" id="registroTitulo" value="${nombre}" required class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
        </div>

        <div class="mb-4">
            <label for="registroDescripcion" class="block text-gray-700 text-sm font-bold mb-2">Descripción:</label>
            <textarea id="registroDescripcion" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24"></textarea>
        </div>

        <div class="mb-4">
            <label for="registroTipo" class="block text-gray-700 text-sm font-bold mb-2">Tipo:</label>
            <select id="registroTipo" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                <option value="Cita" selected>Cita</option>
            </select>
        </div>

        <div class="mb-4 text-center">
            <p class="text-gray-700 text-sm font-bold mb-2">Opcional: Adjuntar una foto o archivo</p>
            <div class="flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <button type="button" id="openCameraButton" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full flex items-center justify-center space-x-2">
                    <i class="fas fa-camera"></i> <span>Tomar Foto</span>
                </button>
                <label for="fileAttachmentInput" class="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full cursor-pointer flex items-center justify-center space-x-2">
                    <i class="fas fa-paperclip"></i> <span>Adjuntar Archivo</span>
                    <input type="file" id="fileAttachmentInput" class="hidden">
                </label>
            </div>
            <img id="registroPhotoPreview" class="photo-preview mt-4 mx-auto" style="display:none;">
            <p id="registroFileNameDisplay" class="text-sm text-gray-600 mt-2" style="display:none;"></p>
        </div>

        <div class="flex justify-center space-x-4">
            <button id="guardarRegistroBtn" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full">Guardar</button>
            <button id="cancelRegistroBtn" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full">Cancelar</button>
        </div>
    `;

    const modal = createModal(formContent);
    document.body.appendChild(modal);

    const registroDescripcion = modal.querySelector('#registroDescripcion');
    let fullDescription = `Cita: ${nombre}\nFecha: ${fecha}`;
    if (hora) fullDescription += ` Hora Inicio: ${hora}`;
    if (hora_fin) fullDescription += ` Hora Fin: ${hora_fin}`; // Added hora_fin
    if (recordatorio && recordatorio.length > 0) {
        fullDescription += `\nRequisitos:\n${recordatorio.map(req => `- ${req.text} ${req.checked ? '(Completado)' : ''}`).join('\n')}`;
    }
    registroDescripcion.value = fullDescription;

    const openCameraButton = modal.querySelector('#openCameraButton');
    const fileAttachmentInput = modal.querySelector('#fileAttachmentInput');
    const registroFileNameDisplay = modal.querySelector('#registroFileNameDisplay');
    currentRegistroPhotoPreviewElement = modal.querySelector('#registroPhotoPreview');

    if (capturedImageBase64) {
        currentRegistroPhotoPreviewElement.src = capturedImageBase64;
        currentRegistroPhotoPreviewElement.style.display = 'block';
        registroFileNameDisplay.style.display = 'none'; // Hide file name if photo is present
    } else if (currentUploadedFile) {
        // If a file was previously uploaded, display its name
        registroFileNameDisplay.textContent = `Archivo adjunto: ${currentUploadedFile.name}`;
        registroFileNameDisplay.style.display = 'block';
        currentRegistroPhotoPreviewElement.style.display = 'none';
    } else {
        currentRegistroPhotoPreviewElement.style.display = 'none';
        registroFileNameDisplay.style.display = 'none';
    }

    openCameraButton.addEventListener('click', () => {
        cameraModal.style.display = 'flex';
        videoStream.style.display = 'block';
        photoPreview.style.display = 'none';
        capturePhotoButton.style.display = 'block';
        retakePhotoButton.style.display = 'none';
        confirmPhotoButton.style.display = 'none';

        capturedImageBase664 = null;
        currentFileName = null;
        currentMimeType = null;
        currentUploadedFile = null; // Clear uploaded file if camera is used
        registroFileNameDisplay.style.display = 'none';
        initCamera();
    });

    fileAttachmentInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            currentUploadedFile = file;
            capturedImageBase64 = null; // Clear camera image if file is uploaded
            currentRegistroPhotoPreviewElement.style.display = 'none';
            registroFileNameDisplay.textContent = `Archivo adjunto: ${file.name}`;
            registroFileNameDisplay.style.display = 'block';
            stopCamera(); // Stop camera if active
        } else {
            currentUploadedFile = null;
            registroFileNameDisplay.style.display = 'none';
        }
    });

    document.getElementById('guardarRegistroBtn').addEventListener('click', async () => {
        const titulo = document.getElementById('registroTitulo').value.trim();
        const descripcion = document.getElementById('registroDescripcion').value.trim();
        const tipo = document.getElementById('registroTipo').value;

        if (!titulo) {
            showCustomAlert('El título es obligatorio.', 'Campo Obligatorio');
            return;
        }

        let fileBase64 = null;
        let fileName = null;
        let mimeType = null;

        if (capturedImageBase64) {
            fileBase64 = capturedImageBase64;
            fileName = currentFileName;
            mimeType = currentMimeType;
        } else if (currentUploadedFile) {
            // Read the uploaded file as Base64
            const reader = new FileReader();
            reader.readAsDataURL(currentUploadedFile);
            reader.onload = async () => {
                fileBase64 = reader.result;
                fileName = currentUploadedFile.name;
                mimeType = currentUploadedFile.type;
                await sendRegistroData(titulo, descripcion, tipo, fileBase64, fileName, mimeType, modal);
            };
            reader.onerror = (error) => {
                console.error('Error reading file:', error);
                showCustomAlert('Error al leer el archivo adjunto.', 'Error de Archivo');
            };
            return; // Exit here, as the actual send will happen in reader.onload
        }

        await sendRegistroData(titulo, descripcion, tipo, fileBase64, fileName, mimeType, modal);
    });

    document.getElementById('cancelRegistroBtn').addEventListener('click', () => {
        modal.remove();
        capturedImageBase64 = null;
        currentFileName = null;
        currentMimeType = null;
        currentUploadedFile = null; // Clear on cancel
        currentRegistroPhotoPreviewElement = null;
        stopCamera();
    });
}

async function sendRegistroData(titulo, descripcion, tipo, imagen_base64, nombre_archivo, mime_type, modal) {
    try {
        const response = await fetch('/api/registros_importantes/add_from_task', { // Reusing this endpoint for now
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fecha: new Date().toISOString().split('T')[0], // Use current date for record
                titulo: titulo,
                descripcion: descripcion,
                tipo: tipo,
                imagen_base64: imagen_base64,
                nombre_archivo: nombre_archivo,
                mime_type: mime_type
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error desconocido al guardar el registro.');
        }
        showCustomAlert('Registro guardado con éxito.', 'Guardado Exitoso');
        modal.remove();
        capturedImageBase64 = null;
        currentFileName = null;
        currentMimeType = null;
        currentUploadedFile = null;
        currentRegistroPhotoPreviewElement = null;
    } catch (error) {
        console.error('Error al guardar el registro:', error);
        showCustomAlert(`No se pudo guardar el registro: ${error.message}`, 'Error de Guardado');
    }
}


function renderUpcomingCitas(citas) {
    upcomingCitasList.innerHTML = '';
    moreCitasContainer.innerHTML = '';
    toggleCitasButton.style.display = 'none';
    moreCitasContainer.style.display = 'none';

    if (citas.length === 0) {
        upcomingCitasList.innerHTML = '<li class="text-gray-500 italic">No hay citas pendientes para el mes actual.</li>';
        return;
    }

    // Sort: Incomplete first, then by date/time, then completed at the end
    citas.sort((a, b) => {
        // Incomplete items come before completed items
        if (a.completada && !b.completada) return 1;
        if (!a.completada && b.completada) return -1;

        // For items with the same completion status, sort by date and then by time
        const dateA = new Date(a.fecha + (a.hora ? `T${a.hora}` : 'T00:00'));
        const dateB = new Date(b.fecha + (b.hora ? `T${b.hora}` : 'T00:00'));

        if (dateA - dateB !== 0) {
            return dateA - dateB;
        }

        // If dates and start times are the same, sort by end time
        const timeA = a.hora_fin ? a.hora_fin : '23:59';
        const timeB = b.hora_fin ? b.hora_fin : '23:59';
        return timeA.localeCompare(timeB);
    });

    // Show only the closest appointment (or first few, as preferred)
    const citasToShowInitially = citas.slice(0, 1); // Show only the first one

    citasToShowInitially.forEach(cita => {
        const li = document.createElement('li');
        li.classList.add('cita-item');
        if (cita.completada) {
            li.classList.add('completada');
        }

        const fechaFormateada = new Date(cita.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        const horaInicioFormateada = cita.hora ? cita.hora.substring(0, 5) : 'N/A';
        const horaFinFormateada = cita.hora_fin ? ` - ${cita.hora_fin.substring(0, 5)}` : ''; // Display hora_fin if exists

        let duracionText = '';
        if (cita.hora && cita.hora_fin) {
            try {
                const [startHour, startMinute] = cita.hora.split(':').map(Number);
                const [endHour, endMinute] = cita.hora_fin.split(':').map(Number);

                    let diffMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);

                if (diffMinutes < 0) { // Handle cases where end time is on the next day
                    diffMinutes += 24 * 60; // Add 24 hours in minutes
                }

                const hours = Math.floor(diffMinutes / 60);
                const minutes = diffMinutes % 60;

                if (hours > 0 && minutes > 0) {
                    duracionText = ` (${hours}h ${minutes}m)`;
                } else if (hours > 0) {
                    duracionText = ` (${hours}h)`;
                } else if (minutes > 0) {
                    duracionText = ` (${minutes}m)`;
                }
            } catch (e) {
                console.error("Error calculando duración de cita:", e);
            }
        }


        let tiempoRestanteText = '';
        const now = new Date();
        const citaDateTime = new Date(cita.fecha + (cita.hora ? `T${cita.hora}` : 'T00:00:00'));
        const citaEndDateTime = cita.hora_fin ? new Date(cita.fecha + `T${cita.hora_fin}`) : null;

        // For calendar day comparison, normalize to start of day
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfCitaDay = new Date(citaDateTime.getFullYear(), citaDateTime.getMonth(), citaDateTime.getDate());

        if (cita.completada) {
            tiempoRestanteText = 'Completada';
        } else if (citaEndDateTime && citaEndDateTime <= now) {
            // La cita ha finalizado completamente (y tiene una hora de fin)
            tiempoRestanteText = 'Pasada';
        } else if (citaDateTime <= now && citaEndDateTime && citaEndDateTime > now) {
            // La cita ya ha comenzado y su hora de fin aún no ha pasado (está en curso)
            const diffTimeRemaining = citaEndDateTime - now;
            const diffHoursRemaining = Math.floor(diffTimeRemaining / (1000 * 60 * 60));
            const diffMinutesRemaining = Math.floor((diffTimeRemaining % (1000 * 60 * 60)) / (1000 * 60));
            if (diffHoursRemaining > 0) {
                tiempoRestanteText = `Termina en ${diffHoursRemaining}h ${diffMinutesRemaining}m`;
            } else if (diffMinutesRemaining > 0) {
                tiempoRestanteText = `Termina en ${diffMinutesRemaining}m`;
            } else {
                tiempoRestanteText = 'Termina pronto';
            }
        } else if (startOfCitaDay.getTime() === startOfToday.getTime() && citaDateTime > now) {
            // Es hoy, pero la cita aún no ha comenzado
            const diffTime = citaDateTime - now;
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
            if (diffHours > 0) {
                tiempoRestanteText = `Hoy, en ${diffHours}h ${diffMinutes}m`;
            } else if (diffMinutes > 0) {
                tiempoRestanteText = `Hoy, en ${diffMinutes}m`;
            } else {
                tiempoRestanteText = 'Hoy, ¡ahora!';
            }
        } else { // La cita es en el futuro (diferente día)
            const diffDaysCalendar = Math.floor((startOfCitaDay - startOfToday) / (1000 * 60 * 60 * 24));
            if (diffDaysCalendar === 1) {
                tiempoRestanteText = 'Mañana';
            } else {
                tiempoRestanteText = `En ${diffDaysCalendar} días`;
            }
        }


        let requisitos = [];
        let hasRequirements = false;
        if (cita.recordatorio) {
            try {
                requisitos = JSON.parse(cita.recordatorio);
                hasRequirements = requisitos.length > 0;
            } catch (e) {
                console.error('Error al parsear el JSON de recordatorio para la cita:', e, 'Raw data:', cita.recordatorio);
                requisitos = [];
            }
        }

        // Updated HTML for cita-actions to include save to registro and correct button order/spacing
        li.innerHTML = `
            <div class="flex-grow flex flex-col sm:flex-row sm:items-center justify-between w-full">
                <div>
                    <span class="entry-text">${cita.nombre}</span>
                    <div class="cita-info">
                        Fecha: ${fechaFormateada} Hora: ${horaInicioFormateada}${horaFinFormateada}${duracionText}
                    </div>
                </div>
                <div class="dias-restantes text-sm text-blue-600 font-semibold sm:ml-4 mt-2 sm:mt-0">${tiempoRestanteText}</div>
                <div class="cita-actions flex items-center gap-2 mt-2 sm:mt-0 sm:ml-auto"> <!-- Adjusted for better layout -->
                    <button class="btn-completar btn-compact ${cita.completada ? 'bg-green-500 hover:bg-green-700' : 'bg-blue-500 hover:bg-blue-700'} text-white" title="${cita.completada ? 'Descompletar Cita' : 'Completar Cita'}" data-id="${cita.id}">
                        <i class="fas ${cita.completada ? 'fa-undo' : 'fa-check'}"></i>
                    </button>
                    <button class="btn-editar btn-compact bg-gray-400 hover:bg-gray-600 text-white" title="Editar Cita" data-id="${cita.id}" data-nombre="${cita.nombre}" data-fecha="${cita.fecha}" data-hora="${cita.hora || ''}" data-hora-fin="${cita.hora_fin || ''}" data-recordatorio='${JSON.stringify(requisitos)}'>
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-guardar-registro-icon btn-compact bg-gray-500 hover:bg-gray-700 text-white" title="Guardar en Registro" data-id="${cita.id}" data-nombre="${cita.nombre}" data-fecha="${cita.fecha}" data-hora="${cita.hora || ''}" data-hora-fin="${cita.hora_fin || ''}" data-recordatorio='${JSON.stringify(requisitos)}'>
                        <i class="fas fa-save"></i>
                    </button>
                    <button class="btn-eliminar btn-compact bg-red-500 hover:bg-red-700 text-white" title="Eliminar Cita" data-id="${cita.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    ${hasRequirements ? `
                        <button class="requisitos-toggle-btn" data-id="${cita.id}" aria-expanded="false" title="Ver Requisitos">
                            <i class="fas fa-paperclip"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div id="requisitos-${cita.id}" class="requisitos-container hidden">
                <!-- Requirements will be rendered here by JS -->
            </div>
        `;
        upcomingCitasList.appendChild(li);

        // Add event listeners for the new buttons
        li.querySelector('.btn-completar').addEventListener('click', (event) => toggleCitaCompletada(event.currentTarget.dataset.id));
        li.querySelector('.btn-editar').addEventListener('click', (event) => {
            const dataset = event.currentTarget.dataset;
            editCita(dataset.id, dataset.nombre, dataset.fecha, dataset.hora, dataset.horaFin, JSON.parse(dataset.recordatorio)); // Pass horaFin
        });
        li.querySelector('.btn-eliminar').addEventListener('click', (event) => deleteCita(event.currentTarget.dataset.id));
        li.querySelector('.btn-guardar-registro-icon').addEventListener('click', (event) => {
            const dataset = event.currentTarget.dataset;
            saveCitaToRegistro(dataset.fecha, dataset.nombre, dataset.hora, dataset.horaFin, JSON.parse(dataset.recordatorio)); // Pass horaFin
        });


        if (hasRequirements) {
            const toggleBtn = li.querySelector('.requisitos-toggle-btn');
            const requisitosContainer = li.querySelector(`#requisitos-${cita.id}`);
            toggleBtn.addEventListener('click', () => {
                const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
                toggleBtn.setAttribute('aria-expanded', !isExpanded);
                requisitosContainer.classList.toggle('hidden', isExpanded);
                if (!isExpanded) {
                    renderRequisitosList(requisitos, requisitosContainer, true, cita.id); // Render with interactivity
                } else {
                    requisitosContainer.innerHTML = ''; // Clear on collapse
                }
            });
        }
    });


    // If there are more appointments, prepare the rest and the button
    if (citas.length > 1) {
        toggleCitasButton.style.display = 'block';
        toggleCitasButton.textContent = `Ver ${citas.length - citasToShowInitially.length} cita${citas.length - citasToShowInitially.length > 1 ? 's' : ''} más`;

        const remainingCitas = citas.slice(citasToShowInitially.length);
        remainingCitas.forEach(cita => {
            const li = document.createElement('li');
            li.classList.add('cita-item');
            if (cita.completada) {
                li.classList.add('completada');
            }

            const fechaFormateada = new Date(cita.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
            const horaInicioFormateada = cita.hora ? cita.hora.substring(0, 5) : 'N/A';
            const horaFinFormateada = cita.hora_fin ? ` - ${cita.hora_fin.substring(0, 5)}` : ''; // Display hora_fin if exists

            let duracionText = '';
            if (cita.hora && cita.hora_fin) {
                try {
                    const [startHour, startMinute] = cita.hora.split(':').map(Number);
                    const [endHour, endMinute] = cita.hora_fin.split(':').map(Number);

                    let diffMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);

                    if (diffMinutes < 0) { // Handle cases where end time is on the next day
                        diffMinutes += 24 * 60; // Add 24 hours in minutes
                    }

                    const hours = Math.floor(diffMinutes / 60);
                    const minutes = diffMinutes % 60;

                    if (hours > 0 && minutes > 0) {
                        duracionText = ` (${hours}h ${minutes}m)`;
                    } else if (hours > 0) {
                        duracionText = ` (${hours}h)`;
                    } else if (minutes > 0) {
                        duracionText = ` (${minutes}m)`;
                    }
                } catch (e) {
                    console.error("Error calculando duración de cita:", e);
                }
            }

            let tiempoRestanteText = '';
            const now = new Date();
            const citaDateTime = new Date(cita.fecha + (cita.hora ? `T${cita.hora}` : 'T00:00:00'));
            const citaEndDateTime = cita.hora_fin ? new Date(cita.fecha + `T${cita.hora_fin}`) : null;

            // For calendar day comparison, normalize to start of day
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfCitaDay = new Date(citaDateTime.getFullYear(), citaDateTime.getMonth(), citaDateTime.getDate());

            if (cita.completada) {
                tiempoRestanteText = 'Completada';
            } else if (citaEndDateTime && citaEndDateTime <= now) {
                // La cita ha finalizado completamente (y tiene una hora de fin)
                tiempoRestanteText = 'Pasada';
            } else if (citaDateTime <= now && citaEndDateTime && citaEndDateTime > now) {
                // La cita ya ha comenzado y su hora de fin aún no ha pasado (está en curso)
                const diffTimeRemaining = citaEndDateTime - now;
                const diffHoursRemaining = Math.floor(diffTimeRemaining / (1000 * 60 * 60));
                const diffMinutesRemaining = Math.floor((diffTimeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                if (diffHoursRemaining > 0) {
                    tiempoRestanteText = `Termina en ${diffHoursRemaining}h ${diffMinutesRemaining}m`;
                } else if (diffMinutesRemaining > 0) {
                    tiempoRestanteText = `Termina en ${diffMinutesRemaining}m`;
                } else {
                    tiempoRestanteText = 'Termina pronto';
                }
            } else if (startOfCitaDay.getTime() === startOfToday.getTime() && citaDateTime > now) {
                // Es hoy, pero la cita aún no ha comenzado
                const diffTime = citaDateTime - now;
                const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
                const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
                if (diffHours > 0) {
                    tiempoRestanteText = `Hoy, en ${diffHours}h ${diffMinutes}m`;
                } else if (diffMinutes > 0) {
                    tiempoRestanteText = `Hoy, en ${diffMinutes}m`;
                } else {
                    tiempoRestanteText = 'Hoy, ¡ahora!';
                }
            } else { // La cita es en el futuro (diferente día)
                const diffDaysCalendar = Math.floor((startOfCitaDay - startOfToday) / (1000 * 60 * 60 * 24));
                if (diffDaysCalendar === 1) {
                    tiempoRestanteText = 'Mañana';
                } else {
                    tiempoRestanteText = `En ${diffDaysCalendar} días`;
                }
            }
            let requisitos = [];
            let hasRequirements = false;
            if (cita.recordatorio) {
                try {
                    requisitos = JSON.parse(cita.recordatorio);
                    hasRequirements = requisitos.length > 0;
                } catch (e) {
                    console.error('Error al parsear el JSON de recordatorio para la cita:', e, 'Raw data:', cita.recordatorio);
                    requisitos = [];
                }
            }

            // Updated HTML for cita-actions to include save to registro and correct button order/spacing
            li.innerHTML = `
                <div class="flex-grow flex flex-col sm:flex-row sm:items-center justify-between w-full">
                    <div>
                        <span class="entry-text">${cita.nombre}</span>
                        <div class="cita-info">
                            Fecha: ${fechaFormateada} Hora: ${horaInicioFormateada}${horaFinFormateada}${duracionText}
                        </div>
                    </div>
                    <div class="dias-restantes text-sm text-blue-600 font-semibold sm:ml-4 mt-2 sm:mt-0">${tiempoRestanteText}</div>
                    <div class="cita-actions flex items-center gap-2 mt-2 sm:mt-0 sm:ml-auto"> <!-- Adjusted for better layout -->
                        <button class="btn-completar btn-compact ${cita.completada ? 'bg-green-500 hover:bg-green-700' : 'bg-blue-500 hover:bg-blue-700'} text-white" title="${cita.completada ? 'Descompletar Cita' : 'Completar Cita'}" data-id="${cita.id}">
                            <i class="fas ${cita.completada ? 'fa-undo' : 'fa-check'}"></i>
                        </button>
                        <button class="btn-editar btn-compact bg-gray-400 hover:bg-gray-600 text-white" title="Editar Cita" data-id="${cita.id}" data-nombre="${cita.nombre}" data-fecha="${cita.fecha}" data-hora="${cita.hora || ''}" data-hora-fin="${cita.hora_fin || ''}" data-recordatorio='${JSON.stringify(requisitos)}'>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-guardar-registro-icon btn-compact bg-gray-500 hover:bg-gray-700 text-white" title="Guardar en Registro" data-id="${cita.id}" data-nombre="${cita.nombre}" data-fecha="${cita.fecha}" data-hora="${cita.hora || ''}" data-hora-fin="${cita.hora_fin || ''}" data-recordatorio='${JSON.stringify(requisitos)}'>
                            <i class="fas fa-save"></i>
                        </button>
                        <button class="btn-eliminar btn-compact bg-red-500 hover:bg-red-700 text-white" title="Eliminar Cita" data-id="${cita.id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        ${hasRequirements ? `
                            <button class="requisitos-toggle-btn" data-id="${cita.id}" aria-expanded="false" title="Ver Requisitos">
                                <i class="fas fa-paperclip"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div id="requisitos-${cita.id}" class="requisitos-container hidden">
                    <!-- Requirements will be rendered here by JS -->
                </div>
            `;
            moreCitasContainer.appendChild(li);

            // Add event listeners for the new buttons on remaining citas
            li.querySelector('.btn-completar').addEventListener('click', (event) => toggleCitaCompletada(event.currentTarget.dataset.id));
            li.querySelector('.btn-editar').addEventListener('click', (event) => {
                const dataset = event.currentTarget.dataset;
                editCita(dataset.id, dataset.nombre, dataset.fecha, dataset.hora, dataset.horaFin, JSON.parse(dataset.recordatorio)); // Pass horaFin
            });
            li.querySelector('.btn-eliminar').addEventListener('click', (event) => deleteCita(event.currentTarget.dataset.id));
            li.querySelector('.btn-guardar-registro-icon').addEventListener('click', (event) => {
                const dataset = event.currentTarget.dataset;
                saveCitaToRegistro(dataset.fecha, dataset.nombre, dataset.hora, dataset.horaFin, JSON.parse(dataset.recordatorio)); // Pass horaFin
            });


            if (hasRequirements) {
                const toggleBtn = li.querySelector('.requisitos-toggle-btn');
                const requisitosContainer = li.querySelector(`#requisitos-${cita.id}`);
                toggleBtn.addEventListener('click', () => {
                    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
                    toggleBtn.setAttribute('aria-expanded', !isExpanded);
                    requisitosContainer.classList.toggle('hidden', isExpanded);
                    if (!isExpanded) {
                        renderRequisitosList(requisitos, requisitosContainer, true, cita.id); // Render with interactivity
                    } else {
                        requisitosContainer.innerHTML = ''; // Clear on collapse
                    }
                });
            }
        });
    }
    toggleCitasButton.onclick = () => {
        if (moreCitasContainer.style.display === 'none') {
            moreCitasContainer.style.display = 'block';
            toggleCitasButton.textContent = 'Ver menos citas';
        } else {
            moreCitasContainer.style.display = 'none';
            toggleCitasButton.textContent = `Ver ${citas.length - citasToShowInitially.length} cita${citas.length - citasToShowInitially.length > 1 ? 's' : ''} más`;
        }
    };
}

// NEW: Function to toggle individual requirement checkbox (copied from citas.html)
async function toggleRequisitoCompletado(citaId, requisitoIndex, requisitoText) {
    try {
        const response = await fetch(`/api/citas/${citaId}/toggle_requisito_completado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: requisitoIndex })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error desconocido al actualizar el requisito.');
        }
        // Ensure fetchCombinedAgenda is defined globally before calling it
        if (typeof fetchCombinedAgenda === 'function') {
            fetchCombinedAgenda(); // Re-fetch to update all UI (including the checkbox state)
        }
        window.fetchUpcomingCitas(); // Also re-fetch upcoming citas to ensure consistency
    } catch (error) {
            console.error('Error al cambiar estado del requisito:', error);
            showCustomAlert(`No se pudo actualizar el requisito "${requisitoText}". Error: ${error.message}`, 'Error de Actualización');
    }
}

// Event listener for saving quick cita from the Quick Cita modal
document.addEventListener('DOMContentLoaded', () => { // Keep this DOMContentLoaded for quickCitaBtn only
    const saveQuickCitaBtn = document.getElementById('saveQuickCitaBtn');
    if (saveQuickCitaBtn) {
        saveQuickCitaBtn.addEventListener('click', async () => {
            // Read citaNombre directly from the hidden input
            const citaNombre = document.getElementById('quickCitaHiddenName').value.trim(); // READ FROM HIDDEN INPUT

            const citaFecha = document.getElementById('quickCitaFechaInput').value;
            const citaHora = document.getElementById('quickCitaHoraInput').value;
            const citaHoraFin = document.getElementById('quickCitaHoraFinInput').value; // Get quick cita end time
            // Use currentModalRequisitos from add_activity.js as it's the shared state
            const requisitos = currentModalRequisitos; // Use the global variable

            if (!citaNombre || !citaFecha) {
                showCustomAlert('El nombre y la fecha de la cita son obligatorios.', 'Campos Obligatorios');
                return;
            }

            try {
                const response = await fetch('/api/citas', { // Corrected URL from /api/citas/add to /api/citas
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nombre: citaNombre,
                        fecha: citaFecha,
                        hora: citaHora || null,
                        hora_fin: citaHoraFin || null, // Include hora_fin
                        recordatorio: requisitos
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error desconocido al guardar la cita rápida.');
                }

                showCustomAlert('Cita rápida guardada con éxito.', 'Guardado Exitoso');
                document.getElementById('quickCitaModal').style.display = 'none';
                if (typeof window.fetchUpcomingCitas === 'function') {
                    window.fetchUpcomingCitas(); // Refresh upcoming citas
                }
                // Ensure fetchCombinedAgenda is defined globally before calling it
                if (typeof fetchCombinedAgenda === 'function') {
                    fetchCombinedAgenda(); // Refresh combined agenda
                }
            } catch (error) {
                console.error('Error al guardar la cita rápida:', error);
                showCustomAlert(`No se pudo guardar la cita rápida. Error: ${error.message}`, 'Error de Guardado');
            }
        });
    }
});
