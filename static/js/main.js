 // GLOBAL VARIABLES / ELEMENT REFERENCES
        const fechaActualDisplay = document.getElementById('fechaActualDisplay');
        const combinedAgendaList = document.getElementById('combinedAgendaList');
        const upcomingCitasList = document.getElementById('upcomingCitasList');
        const moreCitasContainer = document.getElementById('moreCitasContainer');
        const toggleCitasButton = document.getElementById('toggleCitasButton');

        let fechaActual = new Date();
        let timeLeftUpdateInterval;

        const unifiedEntryForm = document.getElementById('unifiedEntryForm');
        const entryTextInput = document.getElementById('entryTextInput');

        const quickListButton = document.getElementById('quickListButton');
        // NEW: Reference to the new button for automatic shopping list generation
        const generateShoppingListButton = document.getElementById('generateShoppingListButton');
        const quickNotesButton = document.getElementById('quickNotesButton');
        const quickCitaButton = document.getElementById('quickCitaButton');

        // Elements for count badges
        const quickListCountElem = document.getElementById('quickListCount');
        const quickNotesCountElem = document.getElementById('quickNotesCount');
        const quickCitaCountElem = document.getElementById('quickCitaCount');


        // Camera Elements
        const cameraModal = document.getElementById('cameraModal');
        const videoStream = document.getElementById('videoStream');
        const photoCanvas = document.getElementById('photoCanvas');
        const photoPreview = document.getElementById('photoPreview');
        const capturePhotoButton = document.getElementById('capturePhotoButton');
        const retakePhotoButton = document.getElementById('retakePhotoButton');
        const confirmPhotoButton = document.getElementById('confirmPhotoButton');
        const closeCameraModalButton = document.getElementById('closeCameraModalButton');
        const cameraStatus = document.getElementById('cameraStatus');

        let currentStream;
        let capturedImageBase64 = null;
        let currentFileName = null; // Variable to store the file name
        let currentMimeType = null; // Variable to store the MIME type
        let currentRegistroPhotoPreviewElement = null; // Reference to the <img> of the registration modal

        const dayNameToNumber = {
            'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6
        };
        const dayNumberToName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

        let completedRoutineIdsForToday = new Set();

        // Quick appointment modal elements
        const quickCitaModal = document.getElementById('quickCitaModal');
        const quickCitaTextDisplay = document.getElementById('quickCitaTextDisplay');
        const quickCitaFechaInput = document.getElementById('quickCitaFechaInput');
        const quickCitaHoraInput = document.getElementById('quickCitaHoraInput');
        const quickCitaRequisitoInput = document.getElementById('quickCitaRequisitoInput');
        const quickAddRequisitoBtn = document.getElementById('quickAddRequisitoBtn');
        const quickRequisitosListDisplay = document.getElementById('quickRequisitosListDisplay');
        // Removed `let currentQuickCitaRequisitos = [];` as it's now managed by `currentModalRequisitos` in add_activity.js

        const saveQuickCitaBtn = document.getElementById('saveQuickCitaBtn');
        const cancelQuickCitaBtn = document.getElementById('cancelQuickCitaBtn');


        // NEW: Choose Entry Type Modal Elements (now also used for editing)
        const chooseEntryTypeModal = document.getElementById('chooseEntryTypeModal');
        const chooseEntryTypeModalTitle = document.getElementById('chooseEntryTypeModalTitle');
        const activityTextDisplay = document.getElementById('activityTextDisplay'); // This will show original text when editing
        const modalEntryType = document.getElementById('modalEntryType');
        const modalEntryText = document.getElementById('modalEntryText'); // New input for text
        const modalStartTimeInput = document.getElementById('modalStartTimeInput');
        const modalEndTimeInput = document.getElementById('modalEndTimeInput');
        const modalEndTimeDiv = document.getElementById('modalEndTimeDiv');
        const modalRoutineFields = document.getElementById('modalRoutineFields');
        const modalRoutineDayCheckboxes = document.querySelectorAll('input[name="modalRoutineDay"]');
        const modalCitaFields = document.getElementById('modalCitaFields');
        const modalCitaFechaInput = document.getElementById('modalCitaFechaInput');
        const modalCitaRequisitoInput = document.getElementById('modalCitaRequisitoInput');
        const modalAddRequisitoBtn = document.getElementById('modalAddRequisitoBtn');
        const modalRequisitosListDisplay = document.getElementById('modalRequisitosListDisplay');
        const modalTaskDateFields = document.getElementById('modalTaskDateFields'); // New for task editing
        const modalTaskFechaInput = document.getElementById('modalTaskFechaInput'); // New for task editing
        const editEntryId = document.getElementById('editEntryId'); // Hidden input for ID

        // `currentModalRequisitos` is now managed in `add_activity.js` to avoid redeclaration.
        // let currentModalRequisitos = []; 

        const saveModalEntryBtn = document.getElementById('saveModalEntryBtn');
        const cancelModalEntryBtn = document.getElementById('cancelModalEntryBtn');


        // Removed `let allIngredients = [];` from here as it's declared in `add_activity.js`


        // Function to update the currently displayed meal based on currentMealIndex
        function updateDisplayedMeal(todayMenu) {
            // Hide all cards first
            document.getElementById('breakfastCard').style.display = 'none';
            document.getElementById('lunchCard').style.display = 'none';
            document.getElementById('dinnerCard').style.display = 'none';
            document.getElementById('noMealsToday').style.display = 'none';

            const selectedMealType = mealDisplayOrder[currentMealIndex];
            // THIS LINE IS CRUCIAL: it assumes todayMenu[selectedMealType] directly holds the recipe ID.
            const recipeId = todayMenu[selectedMealType]; 
            
            let mealsFound = false;

            // Call displayMeal for the selected meal type
            if (recipeId) { // Check if there's a recipe assigned for this meal type
                displayMeal(selectedMealType, recipeId);
                mealsFound = true;
            } else {
                // Even if no recipe, show the card with "No programado."
                const cardPrefix = selectedMealType === "Desayuno" ? "breakfast" :
                                   selectedMealType === "Almuerzo" ? "lunch" : "dinner";
                const cardElem = document.getElementById(`${cardPrefix}Card`);
                const nameElem = document.getElementById(`${cardPrefix}RecipeName`);
                const infoElem = document.getElementById(`${cardPrefix}RecipeInfo`);
                const toggleButton = cardElem.querySelector('.toggle-meal-completed');

                if (cardElem && nameElem && infoElem) {
                    nameElem.textContent = 'No programado.';
                    infoElem.innerHTML = ''; // Clear info for no recipe
                    cardElem.style.display = 'block';
                    // Update button style based on current completion status
                    if (toggleButton) {
                        const isCompleted = completedMealsToday[selectedMealType];
                        toggleButton.innerHTML = isCompleted ? '<i class="fas fa-undo"></i>' : '<i class="fas fa-check"></i>';
                        toggleButton.classList.toggle('bg-green-500', isCompleted);
                        toggleButton.classList.toggle('hover:bg-green-700', isCompleted);
                        toggleButton.classList.toggle('bg-blue-500', !isCompleted);
                        toggleButton.classList.toggle('hover:bg-blue-700', !isCompleted);
                        toggleButton.title = isCompleted ? 'Marcar como Pendiente' : 'Marcar como Completado';
                    }
                    mealsFound = true; // Still consider it "found" as we are displaying the card
                }
            }

            if (!mealsFound) {
                document.getElementById('noMealsToday').style.display = 'block';
            }
        }

        // Function to display a single meal
        const displayMeal = (mealType, recipeId) => {
            let cardPrefix;
            // Map the mealType from backend (e.g., "Desayuno") to the HTML ID prefix (e.g., "breakfast")
            if (mealType === "Desayuno") {
                cardPrefix = "breakfast";
            } else if (mealType === "Almuerzo") {
                cardPrefix = "lunch";
            } else if (mealType === "Cena") {
                cardPrefix = "dinner";
            } else {
                console.error(`Tipo de comida desconocido: ${mealType}`);
                return; // Exit if mealType is not recognized
            }

            const cardElem = document.getElementById(`${cardPrefix}Card`);
            const nameElem = document.getElementById(`${cardPrefix}RecipeName`);
            const infoElem = document.getElementById(`${cardPrefix}RecipeInfo`);
            const toggleButton = cardElem.querySelector('.toggle-meal-completed'); // Get the button


            // Ensure elements exist before trying to set their content
            if (!cardElem || !nameElem || !infoElem) {
                console.error(`No se encontraron todos los elementos HTML para el tipo de comida: ${mealType}`);
                return;
            }

            if (recipeId) {
                const recipe = getRecipeDetails(recipeId);
                if (recipe) {
                    // Highlight the recipe name (bold), without specifying "Receta"
                    nameElem.innerHTML = `<span class="font-bold text-lg">${recipe.name}</span>`; // Increased text size slightly for emphasis

                    // Show calories, price, and proteins in a single line below the title
                    infoElem.innerHTML = `
                        <p class="text-sm text-gray-600 flex flex-wrap justify-center gap-x-4">
                            Costo: <strong class="text-blue-700">${recipe.total_cost ? recipe.total_cost.toFixed(2) : '0.00'}€</strong>
                            Calorías: <strong class="text-blue-700">${recipe.total_calories ? recipe.total_calories.toFixed(1) : '0.0'} kcal</strong>
                            Proteínas: <strong class="text-blue-700">${recipe.total_proteins ? recipe.total_proteins.toFixed(1) : '0.0'} g</strong>
                        </p>
                    `;
                    cardElem.style.display = 'block';
                }
            } else {
                nameElem.textContent = 'No programado.';
                infoElem.innerHTML = '';
                cardElem.style.display = 'block'; // Still show the card, but indicate no recipe
            }

            // Update button style based on current completion status
            if (toggleButton) {
                const isCompleted = completedMealsToday[mealType];
                toggleButton.innerHTML = isCompleted ? '<i class="fas fa-undo"></i>' : '<i class="fas fa-check"></i>';
                toggleButton.classList.toggle('bg-green-500', isCompleted);
                toggleButton.classList.toggle('hover:bg-green-700', isCompleted);
                toggleButton.classList.toggle('bg-blue-500', !isCompleted);
                toggleButton.classList.toggle('hover:bg-blue-700', !isCompleted);
                toggleButton.title = isCompleted ? 'Marcar como Pendiente' : 'Marcar como Completado';
                // Add/remove class to the card for visual feedback on completion
                cardElem.classList.toggle('opacity-70', isCompleted);
                cardElem.classList.toggle('line-through', isCompleted); // Optional: strikethrough effect
            }
        };

        function showPreviousMeal() {
            const today = new Date();
            const dayName = dayNumberToName[today.getDay()];
            const todayMenu = weeklyMenu[dayName] || {};

            currentMealIndex--;
            if (currentMealIndex < 0) {
                currentMealIndex = mealDisplayOrder.length - 1;
            }
            updateDisplayedMeal(todayMenu);
        }

        function showNextMeal() {
            const today = new Date();
            const dayName = dayNumberToName[today.getDay()];
            const todayMenu = weeklyMenu[dayName] || {};

            currentMealIndex++;
            if (currentMealIndex >= mealDisplayOrder.length) {
                currentMealIndex = 0;
            }
            updateDisplayedMeal(todayMenu);
        }


        // INITIALIZATION
        document.addEventListener('DOMContentLoaded', async () => {
            displayFechaActual();
            // fetchAllIngredients(); // Moved to add_activity.js and called there
            fetchCombinedAgenda(); // This will also trigger fetchUpcomingCitas and fetchCountsForButtons

            // Fetch recipes and weekly menu for the "Comida de Hoy" section
            await fetchRecipes();
            await fetchWeeklyMenu(); // This now also fetches meal completion status

            // Event listeners for meal navigation
            prevMealBtn.addEventListener('click', showPreviousMeal);
            nextMealBtn.addEventListener('click', showNextMeal);

            // Add event listeners for the new meal completion buttons
            document.querySelectorAll('.toggle-meal-completed').forEach(button => {
                button.addEventListener('click', (event) => {
                    const mealType = event.currentTarget.dataset.mealType;
                    toggleMealCompletion(mealType);
                });
            });

            // Event listeners for quick action buttons to handle navigation or form submission
            quickListButton.addEventListener('click', () => {
                const inputText = entryTextInput.value.trim();
                console.log('Quick List Button clicked. Input text:', inputText);
                if (inputText === '') {
                    console.log('Input is empty, navigating to /lista');
                    window.location.href = '/lista'; // Navigate to shopping list page
                } else {
                    console.log('Input has text, calling handleQuickListAdd');
                    if (typeof window.handleQuickListAdd === 'function') {
                        window.handleQuickListAdd(inputText);
                        entryTextInput.value = ''; // Clear input after handling
                    } else {
                        console.error('window.handleQuickListAdd is not defined.');
                    }
                }
            });

            quickNotesButton.addEventListener('click', () => {
                const inputText = entryTextInput.value.trim();
                console.log('Quick Notes Button clicked. Input text:', inputText);
                if (inputText === '') {
                    console.log('Input is empty, navigating to /notas');
                    window.location.href = '/notas'; // Navigate to notes page
                } else {
                    console.log('Input has text, calling handleQuickNoteAdd');
                    if (typeof window.handleQuickNoteAdd === 'function') {
                        window.handleQuickNoteAdd(inputText);
                        entryTextInput.value = ''; // Clear input after handling
                    } else {
                        console.error('window.handleQuickNoteAdd is not defined.');
                    }
                }
            });

            quickCitaButton.addEventListener('click', () => {
                const inputText = entryTextInput.value.trim();
                console.log('Quick Cita Button clicked. Input text:', inputText);
                if (inputText === '') {
                    console.log('Input is empty, navigating to /citas');
                    window.location.href = '/citas'; // Navigate to appointments page
                } else {
                    console.log('Input has text, calling showQuickCitaModalLogic');
                    // Call the function from add_activity.js to show the quick appointment modal
                    if (typeof window.showQuickCitaModalLogic === 'function') {
                        window.showQuickCitaModalLogic(inputText);
                        entryTextInput.value = ''; // Clear input after handling
                    } else {
                        console.error('window.showQuickCitaModalLogic is not defined.');
                    }
                }
            });
        });
