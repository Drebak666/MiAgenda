 // --- Global variables for Food Module ---
        let allRecipes = [];
        let weeklyMenu = {}; // Esto se llenará con el objeto de menú
        const mealTypes = ["Desayuno", "Almuerzo", "Cena"]; // Used for backend keys
        const mealDisplayOrder = ["Desayuno", "Almuerzo", "Cena"]; // Order of display
        let currentMealIndex = 0; // Index for mealDisplayOrder
        // Store meal completion status locally
        let completedMealsToday = {
            "Desayuno": false,
            "Almuerzo": false,
            "Cena": false
        };

        // New elements for navigation
        const prevMealBtn = document.getElementById('prevMealBtn');
        const nextMealBtn = document.getElementById('nextMealBtn');


        // Helper function to format date
        function formatFecha(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // Helper function to display current date
        function displayFechaActual() {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            fechaActualDisplay.textContent = fechaActual.toLocaleDateString('es-ES', options);
        }

        // Helper to get the Date object of a specific moment for sorting
        const getMoment = (dateStr, timeStr) => {
            if (!timeStr) return null;
            const [h, m] = timeStr.split(':').map(Number);
            const [y, M, d] = dateStr.split('-').map(Number);
            return new Date(y, M - 1, d, h, m, 0);
        };

        // Function to render requirements list (for add form and display)
        function renderRequisitosList(requisitosArray, displayElement, isEditable = true, citaId = null) {
            displayElement.innerHTML = '';
            if (requisitosArray && requisitosArray.length > 0) {
                requisitosArray.forEach((req, index) => {
                    const li = document.createElement('li');
                    li.classList.add('requisitos-item');
                    if (req.checked) {
                        li.classList.add('checked');
                    }

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = req.checked;
                    checkbox.disabled = !isEditable; // Disable checkbox if not editable

                    if (isEditable && citaId) { // Only add listener if editable and citaId exists (for main list)
                        checkbox.addEventListener('change', () => toggleRequisitoCompletado(citaId, index, req.text));
                    } else if (isEditable && (displayElement === quickRequisitosListDisplay || displayElement === modalRequisitosListDisplay)) { // For the add/edit modals before saving to DB
                         checkbox.addEventListener('change', () => {
                            req.checked = checkbox.checked;
                            li.classList.toggle('checked', req.checked);
                        });
                    }

                    const span = document.createElement('span');
                    span.textContent = req.text;

                    li.appendChild(checkbox);
                    li.appendChild(span);

                    if (isEditable && (displayElement === quickRequisitosListDisplay || displayElement === modalRequisitosListDisplay)) { // Add remove button only for add/edit forms
                        const removeBtn = document.createElement('button');
                        removeBtn.innerHTML = '<i class="fas fa-times text-red-500 hover:text-red-700 ml-2"></i>';
                        removeBtn.classList.add('ml-auto', 'text-sm');
                        removeBtn.onclick = () => {
                            if (displayElement === quickRequisitosListDisplay) {
                                currentQuickCitaRequisitos.splice(index, 1);
                                renderRequisitosList(currentQuickCitaRequisitos, displayElement, isEditable, citaId);
                            } else if (displayElement === modalRequisitosListDisplay) {
                                currentModalRequisitos.splice(index, 1);
                                renderRequisitosList(currentModalRequisitos, displayElement, isEditable, citaId);
                            }
                        };
                        li.appendChild(removeBtn);
                    }
                    displayElement.appendChild(li);
                });
            } else {
                displayElement.innerHTML = '<li class="text-gray-500 italic">No hay requisitos.</li>';
            }
        }

        // Custom Alert/Confirm Modals (reused from registros_importantes.html for consistency)
        function showCustomModal(message, title = 'Mensaje', type = 'alert') {
            return new Promise((resolve) => {
                const modalOverlay = document.getElementById('customModalOverlay');
                const modalTitle = document.getElementById('customModalTitle');
                const modalMessage = document.getElementById('customModalMessage');
                const modalActions = document.getElementById('customModalActions');

                modalTitle.textContent = title;
                modalMessage.textContent = message;
                modalActions.innerHTML = '';

                if (type === 'alert') {
                    const okButton = document.createElement('button');
                    okButton.classList.add('bg-blue-500', 'hover:bg-blue-700', 'text-white', 'font-bold', 'py-2', 'px-4', 'rounded-full');
                    okButton.textContent = 'Aceptar';
                    okButton.addEventListener('click', () => {
                        modalOverlay.style.display = 'none';
                        resolve(true);
                    });
                    modalActions.appendChild(okButton);
                }
                else if (type === 'alert-immediate') {
                    const okButton = document.createElement('button');
                    okButton.classList.add('bg-blue-500', 'hover:bg-blue-700', 'text-white', 'font-bold', 'py-2', 'px-4', 'rounded-full');
                    okButton.textContent = 'Aceptar';
                    okButton.addEventListener('click', () => {
                        modalOverlay.style.display = 'none';
                    });
                    modalActions.appendChild(okButton);
                    modalOverlay.style.display = 'flex';
                    resolve(true);
                    return;
                }
                else if (type === 'confirm') {
                    const yesButton = document.createElement('button');
                    yesButton.classList.add('bg-green-500', 'hover:bg-green-700', 'text-white', 'font-bold', 'py-2', 'px-4', 'rounded-full');
                    yesButton.textContent = 'Sí';
                    yesButton.addEventListener('click', () => {
                        modalOverlay.style.display = 'none';
                        resolve(true);
                    });
                    const noButton = document.createElement('button');
                    noButton.classList.add('bg-gray-500', 'hover:bg-gray-700', 'text-white', 'font-bold', 'py-2', 'px-4', 'rounded-full');
                    noButton.textContent = 'No';
                    noButton.addEventListener('click', () => {
                        modalOverlay.style.display = 'none';
                        resolve(false);
                    });
                    modalActions.appendChild(yesButton);
                    modalActions.appendChild(noButton);
                }

                modalOverlay.style.display = 'flex';
            });
        }

        function showCustomAlert(message, title = 'Mensaje') {
            return showCustomModal(message, title, 'alert-immediate');
        }

        async function showCustomConfirm(message, title = 'Confirmación') {
            return await showCustomModal(message, title, 'confirm');
        }

        // Function to create generic modals with z-index (now only used by postpone & saveRegistro)
        function createModal(content) {
            const modalOverlay = document.createElement('div');
            // Z-index for dynamically generated modals (e.g., postpone, save registration)
            modalOverlay.classList.add('fixed', 'inset-0', 'bg-black', 'bg-opacity-50', 'flex', 'items-center', 'justify-center', 'z-[9998]');

            const modalContent = document.createElement('div');
            modalContent.classList.add('bg-white', 'p-6', 'rounded-lg', 'shadow-xl', 'max-w-md', 'mx-4', 'w-full', 'scrollable-modal-content');
            modalContent.appendChild(content);

            modalOverlay.appendChild(modalContent); // Append modalContent to modalOverlay

            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    modalOverlay.remove();
                }
            });
            return modalOverlay;
        }

        // --- CAMERA LOGIC ---
        // Functions related to camera capture and display
        async function initCamera() {
            cameraStatus.textContent = 'Iniciando cámara...';
            videoStream.style.display = 'block';
            photoPreview.style.display = 'none';
            capturePhotoButton.style.display = 'block';
            retakePhotoButton.style.display = 'none';
            confirmPhotoButton.style.display = 'none';
            console.log("DEBUG: Intentando iniciar cámara...");

            if (currentStream) {
                stopCamera();
            }

            try {
                currentStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { exact: 'environment' }
                    }
                });
                videoStream.srcObject = currentStream;
                videoStream.play();
                cameraStatus.textContent = 'Cámara trasera activa. Haz clic en "Tomar Foto".';
                console.log("DEBUG: Cámara trasera iniciada con éxito.");
            } catch (err) {
                console.warn("ADVERTENCIA: No se pudo acceder a la cámara trasera, intentando la frontal:", err);
                cameraStatus.textContent = 'Cámara trasera no disponible, intentando la frontal.';
                try {
                    currentStream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: 'user'
                        }
                    });
                    videoStream.srcObject = currentStream;
                    videoStream.play();
                    cameraStatus.textContent = 'Cámara frontal activa. Haz clic en "Tomar Foto".';
                    console.log("DEBUG: Cámara frontal iniciada con éxito.");
                } catch (errFront) {
                    console.error("ERROR: No se pudo acceder a ninguna cámara: ", errFront);
                    showCustomAlert('No se pudo acceder a la cámara. Asegúrate de haber dado permiso y de que no esté en uso por otra aplicación.', 'Error de Cámara');
                    cameraModal.style.display = 'none';
                    cameraStatus.textContent = 'No se pudo acceder a ninguna cámara. Verifica permisos.';
                    return;
                }
            }
        }

        function stopCamera() {
            if (currentStream) {
                console.log("DEBUG: Deteniendo stream de cámara.");
                currentStream.getTracks().forEach(track => track.stop());
                videoStream.srcObject = null;
            }
        }

        capturePhotoButton.addEventListener('click', () => {
            console.log("DEBUG: 'Tomar Foto' button (from camera) clicked.");
            if (videoStream.readyState === videoStream.HAVE_ENOUGH_DATA) {
                console.log("DEBUG: Video stream has enough data. Proceeding to capture.");
                photoCanvas.width = videoStream.videoWidth;
                photoCanvas.height = videoStream.videoHeight;
                const context = photoCanvas.getContext('2d');
                context.drawImage(videoStream, 0, 0, photoCanvas.width, photoCanvas.height);

                capturedImageBase64 = photoCanvas.toDataURL('image/png');
                currentFileName = `foto_registro_${Date.now()}.png`; // Generic file name
                currentMimeType = 'image/png'; // Fixed MIME type for PNG

                photoPreview.src = capturedImageBase64;

                videoStream.style.display = 'none';
                photoPreview.style.display = 'block';
                capturePhotoButton.style.display = 'none';
                retakePhotoButton.style.display = 'block';
                confirmPhotoButton.style.display = 'block'; // Ensure confirm button is shown
                cameraStatus.textContent = 'Foto capturada. Confirma o repite.';
                stopCamera();
                console.log("DEBUG: Button and stream status updated after capturing.");
            } else {
                cameraStatus.textContent = 'Esperando stream de video para capturar...';
                console.log("DEBUG: Video stream still does not have enough data (readyState: " + videoStream.readyState + ").");
            }
        });

        retakePhotoButton.addEventListener('click', () => {
            console.log("DEBUG: 'Repetir' button clicked. Restarting camera.");
            capturedImageBase64 = null;
            currentFileName = null;
            currentMimeType = null;
            photoPreview.style.display = 'none';
            capturePhotoButton.style.display = 'block';
            retakePhotoButton.style.display = 'none';
            confirmPhotoButton.style.display = 'none';
            initCamera();
        });

        confirmPhotoButton.addEventListener('click', () => {
            console.log("DEBUG: 'Confirmar' button clicked. Closing camera modal.");
            cameraModal.style.display = 'none';
            stopCamera();
            if (currentRegistroPhotoPreviewElement && capturedImageBase64) {
                currentRegistroPhotoPreviewElement.src = capturedImageBase64;
                currentRegistroPhotoPreviewElement.style.display = 'block';
            }
            cameraStatus.textContent = '';
            capturePhotoButton.style.display = 'block';
            retakePhotoButton.style.display = 'none';
            confirmPhotoButton.style.display = 'none';
        });

        closeCameraModalButton.addEventListener('click', () => {
            console.log("DEBUG: 'Cerrar' camera modal button clicked.");
            cameraModal.style.display = 'none';
            stopCamera();
            capturedImageBase64 = null;
            currentFileName = null; // Clear file name
            currentMimeType = null;  // Clear MIME type
            if (currentRegistroPhotoPreviewElement) {
                currentRegistroPhotoPreviewElement.src = '';
                currentRegistroPhotoPreviewElement.style.display = 'none';
            }
            currentRegistroPhotoPreviewElement = null;
            cameraStatus.textContent = '';
            capturePhotoButton.style.display = 'block';
            retakePhotoButton.style.display = 'none';
            confirmPhotoButton.style.display = 'none';
        });




       

        // --- FOOD MODULE LOGIC ---

        // Function to fetch recipes
        async function fetchRecipes() {
            try {
                const response = await fetch('/api/recipes');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                allRecipes = await response.json();
                console.log('Recetas cargadas para el menú:', allRecipes);
            } catch (error) {
                console.error('Error fetching recipes:', error);
                showCustomAlert('No se pudieron cargar las recetas del menú.', 'Error');
            }
        }

        // Function to fetch weekly menu
        async function fetchWeeklyMenu() {
            try {
                const response = await fetch('/api/weekly_menu');
                if (!response.ok) {
                    if (response.status === 404) {
                        weeklyMenu = {}; // No menu saved, treat as empty
                        console.log('No se encontró un menú semanal guardado.');
                        renderTodayMenu(); // Render with empty menu
                        return;
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const menu = await response.json();
                // CORRECCIÓN AQUÍ: Accede a 'menu.menu' en lugar de 'menu.menu_data'
                weeklyMenu = menu.menu || {}; // Usa 'menu' ya que el backend lo renombra, fallback a objeto vacío
                console.log('Menú semanal cargado:', weeklyMenu);
                
                // Fetch meal completion status for today
                await fetchMealCompletionStatus();

                renderTodayMenu();
            } catch (error) {
                console.error('Error fetching weekly menu:', error);
                showCustomAlert(`No se pudo cargar el menú semanal: ${error.message}.`, 'Error de Carga');
                weeklyMenu = {}; // Ensure it's empty in case of error
                renderTodayMenu(); // Render with empty menu
            }
        }

        // New function to fetch meal completion status for today
        async function fetchMealCompletionStatus() {
            const todayDate = formatFecha(fechaActual);
            try {
                const response = await fetch(`/api/meals/completion/${todayDate}`);
                if (!response.ok) {
                    if (response.status === 404) {
                        console.log('No hay estado de completado de comidas para hoy. Inicializando como no completado.');
                        completedMealsToday = {
                            "Desayuno": false,
                            "Almuerzo": false,
                            "Cena": false
                        };
                        return;
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const status = await response.json();
                completedMealsToday = {
                    "Desayuno": status.Desayuno || false,
                    "Almuerzo": status.Almuerzo || false,
                    "Cena": status.Cena || false
                };
                console.log('Estado de completado de comidas cargado:', completedMealsToday);
            } catch (error) {
                console.error('Error fetching meal completion status:', error);
                showCustomAlert(`No se pudo cargar el estado de completado de comidas: ${error.message}.`, 'Error');
                completedMealsToday = { // Reset on error
                    "Desayuno": false,
                    "Almuerzo": false,
                    "Cena": false
                };
            }
        }

        // New function to toggle meal completion status
        async function toggleMealCompletion(mealType) {
            const todayDate = formatFecha(fechaActual);
            const currentStatus = completedMealsToday[mealType];
            const newStatus = !currentStatus;

            try {
                const response = await fetch(`/api/meals/completion/${todayDate}`, {
                    method: 'POST', // or PATCH/PUT depending on backend design
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ meal_type: mealType, completed: newStatus })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                completedMealsToday[mealType] = newStatus; // Update local state immediately
                updateDisplayedMeal(weeklyMenu[dayNumberToName[fechaActual.getDay()]] || {}); // Re-render to update button style
                showCustomAlert(`Comida de ${mealType} marcada como ${newStatus ? 'completada' : 'pendiente'}.`, 'Actualización Exitosa');
            } catch (error) {
                console.error(`Error al actualizar el estado de completado de ${mealType}:`, error);
                showCustomAlert(`No se pudo actualizar el estado de completado para ${mealType}: ${error.message}.`, 'Error');
            }
        }

        // Helper function to get recipe details by ID
        function getRecipeDetails(recipeId) {
            return allRecipes.find(recipe => recipe.id === recipeId);
        }

        // Function to render today's menu
        function renderTodayMenu() {
            const today = new Date();
            const currentHour = today.getHours();
            const dayName = dayNumberToName[today.getDay()]; // Get day name based on current date
            const todayMenu = weeklyMenu[dayName] || {}; // Get today's meals

            // Determine initial meal index based on current time
            if (currentHour >= 0 && currentHour <= 11) { // 00:00 to 11:00 (Desayuno)
                currentMealIndex = 0;
            } else if (currentHour > 11 && currentHour <= 17) { // 11:01 to 17:00 (Almuerzo)
                currentMealIndex = 1;
            } else if (currentHour > 17 && currentHour <= 23) { // 17:01 to 23:59 (Cena)
                currentMealIndex = 2;
            } else {
                currentMealIndex = 0; // Default to breakfast if outside defined hours
            }

            updateDisplayedMeal(todayMenu);
        }