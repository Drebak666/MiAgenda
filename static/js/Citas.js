// --- SECTION 1: UPCOMING APPOINTMENTS LOGIC ---
// Handles fetching and rendering of upcoming appointments.
async function fetchUpcomingCitas() {
    const currentMonth = fechaActual.getMonth() + 1;
    const currentYear = fechaActual.getFullYear();
    const today = new Date();
    const todayFormatted = formatFecha(today);

    try {
        const citasResponse = await fetch(`/api/citas/proximas/${currentYear}/${currentMonth}`);
        if (!citasResponse.ok) {
            const errorText = await citasResponse.text();
            throw new Error(`Error al cargar las citas próximas: ${errorText}`);
        }
        let fetchedCitas = await citasResponse.json();

        // Auto-delete logic for completed and past citas
        const citasToKeep = [];
        for (const cita of fetchedCitas) {
            const citaDate = new Date(cita.fecha + 'T23:59:59'); // Set to end of day for comparison
            if (cita.completada && citaDate < today) {
                console.log(`DEBUG: Cita "${cita.nombre}" (ID: ${cita.id}) completada y pasada, se eliminará.`);
                // Asynchronously delete, but don't wait for it to avoid blocking UI
                deleteCita(cita.id); // Call the existing delete function
            } else {
                citasToKeep.push(cita);
            }
        }
        fetchedCitas = citasToKeep; // Update the list to be rendered

        renderUpcomingCitas(fetchedCitas);
        quickCitaCountElem.textContent = fetchedCitas.length;
    } catch (error) {
        console.error('Error al obtener las citas próximas:', error);
        quickCitaCountElem.textContent = '0';
    }
}

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

        showCustomAlert('Estado de cita actualizado con éxito.', 'Actualización Exitosa');
        fetchUpcomingCitas(); // Re-fetch to update all UI for citas
    } catch (error) {
        console.error('Error al actualizar el estado de la cita:', error);
        showCustomAlert(`No se pudo actualizar la cita. Error: ${error.message}`, 'Error de Actualización');
    }
}

async function editCita(citaId, nombre, fecha, hora, requisitos) {
    chooseEntryTypeModalTitle.textContent = 'Editar Cita';
    modalEntryType.value = 'cita';
    modalEntryType.disabled = true; // Cannot change type when editing
    editEntryId.value = citaId;

    modalEntryText.value = nombre;
    modalStartTimeInput.value = hora || '';
    modalEndTimeInput.value = ''; // Citas don't use hora_fin, so clear it
    modalEndTimeDiv.style.display = 'none'; // Hide end time for citas

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
        fetchUpcomingCitas(); // Re-fetch to update all UI for citas
        fetchCombinedAgenda(); // Also update main agenda and counts
    } catch (error) {
        console.error(`Error al eliminar la cita ${citaId}:`, error);
        showCustomAlert(`No se pudo eliminar la cita. Error: ${error.message}`, 'Error de Eliminación');
    }
}

// Action function: Save Cita to Important Records
async function saveCitaToRegistro(fecha, nombre, hora, recordatorio) {
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

    const registroDescripcion = modal.querySelector('#registroDescripcion');
    let fullDescription = `Cita: ${nombre}\nFecha: ${fecha}`;
    if (hora) fullDescription += ` Hora: ${hora}`;
    if (recordatorio && recordatorio.length > 0) {
        fullDescription += `\nRequisitos:\n${recordatorio.map(req => `- ${req.text} ${req.checked ? '(Completado)' : ''}`).join('\n')}`;
    }
    registroDescripcion.value = fullDescription;

    const openCameraButton = modal.querySelector('#openCameraButton');
    currentRegistroPhotoPreviewElement = modal.querySelector('#registroPhotoPreview');

    if (capturedImageBase64) {
        currentRegistroPhotoPreviewElement.src = capturedImageBase64;
        currentRegistroPhotoPreviewElement.style.display = 'block';
    } else {
        currentRegistroPhotoPreviewElement.style.display = 'none';
    }

    openCameraButton.addEventListener('click', () => {
        cameraModal.style.display = 'flex';
        videoStream.style.display = 'block';
        photoPreview.style.display = 'none';
        capturePhotoButton.style.display = 'block';
        retakePhotoButton.style.display = 'none';
        confirmPhotoButton.style.display = 'none';

        capturedImageBase64 = null;
        currentFileName = null;
        currentMimeType = null;
        initCamera();
    });

    document.getElementById('guardarRegistroBtn').addEventListener('click', async () => {
        const titulo = document.getElementById('registroTitulo').value.trim();
        const descripcion = document.getElementById('registroDescripcion').value.trim();
        const tipo = document.getElementById('registroTipo').value;

        if (!titulo) {
            showCustomAlert('El título es obligatorio.', 'Campo Obligatorio');
            return;
        }

        try {
            const response = await fetch('/api/registros_importantes/add_from_task', { // Reusing this endpoint for now
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha: fecha,
                    titulo: titulo,
                    descripcion: descripcion,
                    tipo: tipo,
                    imagen_base64: capturedImageBase64,
                    nombre_archivo: currentFileName,
                    mime_type: currentMimeType
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
            currentRegistroPhotoPreviewElement = null;
        } catch (error) {
            console.error('Error al guardar el registro:', error);
            showCustomAlert(`No se pudo guardar el registro: ${error.message}`, 'Error de Guardado');
        }
    });

    document.getElementById('cancelRegistroBtn').addEventListener('click', () => {
        modal.remove();
        capturedImageBase64 = null;
        currentFileName = null;
        currentMimeType = null;
        currentRegistroPhotoPreviewElement = null;
        stopCamera();
    });
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

    citas.sort((a, b) => {
        const dateA = new Date(a.fecha + (a.hora ? `T${a.hora}` : 'T23:59'));
        const dateB = new Date(b.fecha + (b.hora ? `T${b.hora}` : 'T23:59'));
        return dateA - dateB;
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

        let diasRestantesText = '';
        if (cita.dias_restantes === 0) {
            diasRestantesText = 'Hoy';
        } else if (cita.dias_restantes === 1) {
            diasRestantesText = 'Mañana';
        } else if (cita.dias_restantes > 1) {
            diasRestantesText = `En ${cita.dias_restantes} días`;
        } else {
            diasRestantesText = 'Pasada';
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
                        Fecha: ${fechaFormateada} Hora: ${horaInicioFormateada}${horaFinFormateada}
                    </div>
                </div>
                <div class="dias-restantes text-sm text-blue-600 font-semibold sm:ml-4 mt-2 sm:mt-0">${diasRestantesText}</div>
                <div class="cita-actions flex items-center gap-2 mt-2 sm:mt-0 sm:ml-auto"> <!-- Adjusted for better layout -->
                    <button class="btn-completar btn-compact ${cita.completada ? 'bg-green-500 hover:bg-green-700' : 'bg-blue-500 hover:bg-blue-700'} text-white" title="${cita.completada ? 'Descompletar Cita' : 'Completar Cita'}" data-id="${cita.id}">
                        <i class="fas ${cita.completada ? 'fa-undo' : 'fa-check'}"></i>
                    </button>
                    <button class="btn-editar btn-compact bg-gray-400 hover:bg-gray-600 text-white" title="Editar Cita" data-id="${cita.id}" data-nombre="${cita.nombre}" data-fecha="${cita.fecha}" data-hora="${cita.hora || ''}" data-recordatorio='${JSON.stringify(requisitos)}'>
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-guardar-registro-icon btn-compact bg-gray-500 hover:bg-gray-700 text-white" title="Guardar en Registro" data-id="${cita.id}" data-nombre="${cita.nombre}" data-fecha="${cita.fecha}" data-hora="${cita.hora || ''}" data-recordatorio='${JSON.stringify(requisitos)}'>
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
            editCita(dataset.id, dataset.nombre, dataset.fecha, dataset.hora, JSON.parse(dataset.recordatorio));
        });
        li.querySelector('.btn-eliminar').addEventListener('click', (event) => deleteCita(event.currentTarget.dataset.id));
        li.querySelector('.btn-guardar-registro-icon').addEventListener('click', (event) => {
            const dataset = event.currentTarget.dataset;
            saveCitaToRegistro(dataset.fecha, dataset.nombre, dataset.hora, JSON.parse(dataset.recordatorio));
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


            let diasRestantesText = '';
            if (cita.dias_restantes === 0) {
                diasRestantesText = 'Hoy';
            } else if (cita.dias_restantes === 1) {
                diasRestantesText = 'Mañana';
            } else if (cita.dias_restantes > 1) {
                diasRestantesText = `En ${cita.dias_restantes} días`;
            } else {
                diasRestantesText = 'Pasada';
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
                            Fecha: ${fechaFormateada} Hora: ${horaInicioFormateada}${horaFinFormateada}
                        </div>
                    </div>
                    <div class="dias-restantes text-sm text-blue-600 font-semibold sm:ml-4 mt-2 sm:mt-0">${diasRestantesText}</div>
                    <div class="cita-actions flex items-center gap-2 mt-2 sm:mt-0 sm:ml-auto"> <!-- Adjusted for better layout -->
                        <button class="btn-completar btn-compact ${cita.completada ? 'bg-green-500 hover:bg-green-700' : 'bg-blue-500 hover:bg-blue-700'} text-white" title="${cita.completada ? 'Descompletar Cita' : 'Completar Cita'}" data-id="${cita.id}">
                            <i class="fas ${cita.completada ? 'fa-undo' : 'fa-check'}"></i>
                        </button>
                        <button class="btn-editar btn-compact bg-gray-400 hover:bg-gray-600 text-white" title="Editar Cita" data-id="${cita.id}" data-nombre="${cita.nombre}" data-fecha="${cita.fecha}" data-hora="${cita.hora || ''}" data-recordatorio='${JSON.stringify(requisitos)}'>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-guardar-registro-icon btn-compact bg-gray-500 hover:bg-gray-700 text-white" title="Guardar en Registro" data-id="${cita.id}" data-nombre="${cita.nombre}" data-fecha="${cita.fecha}" data-hora="${cita.hora || ''}" data-recordatorio='${JSON.stringify(requisitos)}'>
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
                editCita(dataset.id, dataset.nombre, dataset.fecha, dataset.hora, JSON.parse(dataset.recordatorio));
            });
            li.querySelector('.btn-eliminar').addEventListener('click', (event) => deleteCita(event.currentTarget.dataset.id));
            li.querySelector('.btn-guardar-registro-icon').addEventListener('click', (event) => {
                const dataset = event.currentTarget.dataset;
                saveCitaToRegistro(dataset.fecha, dataset.nombre, dataset.hora, JSON.parse(dataset.recordatorio));
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
        fetchCombinedAgenda(); // Re-fetch to update all UI (including the checkbox state)
    } catch (error) {
            console.error('Error al cambiar estado del requisito:', error);
            showCustomAlert(`No se pudo actualizar el requisito "${requisitoText}". Error: ${error.message}`, 'Error de Actualización');
    }
}
