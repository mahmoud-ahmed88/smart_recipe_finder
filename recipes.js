// Smart Recipe Finder - Enhanced JavaScript

// Global variables
let allRecipes = [];
let localRecipes = [];
let currentRecipes = [];
let isLoading = false; // Centralized loading state

// Load local recipes from JSON file
async function loadLocalRecipes() {
    try {
        const response = await fetch("./recipes.json");
        localRecipes = await response.json();
        console.log("Local recipes loaded:", localRecipes.length);
    } catch (error) {
        console.error("Error loading local recipes:", error);
        localRecipes = [];
    }
}

// Search TheMealDB API
async function searchMealDBAPI(query) {
    const results = [];
    try {
        const nameResponse = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`);
        const nameData = await nameResponse.json();
        if (nameData.meals) {
            results.push(...nameData.meals);
        }
        const ingredientResponse = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(query)}`);
        const ingredientData = await ingredientResponse.json();
        if (ingredientData.meals) {
            for (const meal of ingredientData.meals.slice(0, 20)) {
                try {
                    const detailResponse = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`);
                    const detailData = await detailResponse.json();
                    if (detailData.meals && detailData.meals[0]) {
                        results.push(detailData.meals[0]);
                    }
                } catch (error) {
                    console.error("Error fetching meal details:", error);
                }
            }
        }

        // Remove duplicates based on meal ID
        const uniqueResults = results.filter((meal, index, self) =>
            index === self.findIndex(m => m.idMeal === meal.idMeal)
        );

        return uniqueResults.map(meal => ({
            id: meal.idMeal,
            name: meal.strMeal,
            country: meal.strArea || "Unknown",
            type: meal.strCategory || "Unknown",
            image: meal.strMealThumb,
            ingredients: extractIngredients(meal),
            instructions: meal.strInstructions,
            youtube: meal.strYoutube || "",
            cookingTime: 45, // Default time
            ingredientCount: extractIngredients(meal).length
        }));
    } catch (error) {
        console.error("Error searching MealDB API:", error);
        return [];
    }
}

// Search by category (vegetarian, dessert, etc.)
async function searchByCategory(category) {
    const results = [];
    try {
        const response = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`);
        const data = await response.json();

        if (data.meals) {
            // Get full details for each meal (limit to 15 for performance)
            for (const meal of data.meals.slice(0, 15)) {
                try {
                    const detailResponse = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`);
                    const detailData = await detailResponse.json();
                    if (detailData.meals && detailData.meals[0]) {
                        const fullMeal = detailData.meals[0];
                        results.push({
                            id: fullMeal.idMeal,
                            name: fullMeal.strMeal,
                            country: fullMeal.strArea || "Unknown",
                            type: fullMeal.strCategory || "Unknown",
                            image: fullMeal.strMealThumb,
                            ingredients: extractIngredients(fullMeal),
                            instructions: fullMeal.strInstructions,
                            youtube: fullMeal.strYoutube || "",
                            cookingTime: 45,
                            ingredientCount: extractIngredients(fullMeal).length
                        });
                    }
                } catch (error) {
                    console.error("Error fetching meal details:", error);
                }
            }
            return results;
        }
        return [];
    } catch (error) {
        console.error("Error searching by category:", error);
        return [];
    }
}

// Extract ingredients from MealDB response
function extractIngredients(meal) {
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
        const ingredient = meal[`strIngredient${i}`];
        const measure = meal[`strMeasure${i}`];
        if (ingredient && ingredient.trim()) {
            ingredients.push(measure ? `${measure.trim()} ${ingredient.trim()}` : ingredient.trim());
        }
    }
    return ingredients;
}

// Get random recipes from MealDB API
async function getRandomRecipes(count = 12) {
    const randomRecipes = [];
    try {
        for (let i = 0; i < count; i++) {
            const response = await fetch("https://www.themealdb.com/api/json/v1/1/random.php");
            const data = await response.json();
            if (data.meals && data.meals[0]) {
                const meal = data.meals[0];
                randomRecipes.push({
                    id: meal.idMeal,
                    name: meal.strMeal,
                    country: meal.strArea || "Unknown",
                    type: meal.strCategory || "Unknown",
                    image: meal.strMealThumb,
                    ingredients: extractIngredients(meal),
                    instructions: meal.strInstructions,
                    youtube: meal.strYoutube || "",
                    cookingTime: 45,
                    ingredientCount: extractIngredients(meal).length
                });
            }
        }
    } catch (error) {
        console.error("Error getting random recipes:", error);
    }
    return randomRecipes;
}

// Smart search function with case-insensitive partial matching
function smartSearch(query) {
    if (!query || query.trim() === "") {
        return [];
    }

    const searchTerm = query.toLowerCase().trim();
    const results = [];

    // Search in local recipes
    localRecipes.forEach(recipe => {
        const nameMatch = recipe.name.toLowerCase().includes(searchTerm);
        const ingredientMatch = recipe.ingredients.some(ingredient =>
            ingredient.toLowerCase().includes(searchTerm)
        );

        if (nameMatch || ingredientMatch) {
            results.push({
                ...recipe,
                id: `local_${recipe.name.replace(/\s+/g, "_")}`,
                country: "Local",
                type: "Homemade",
                youtube: "",
                cookingTime: 30,
                ingredientCount: recipe.ingredients.length
            });
        }
    });

    // Search in current API results
    allRecipes.forEach(recipe => {
        const nameMatch = recipe.name.toLowerCase().includes(searchTerm);
        const ingredientMatch = recipe.ingredients.some(ingredient =>
            ingredient.toLowerCase().includes(searchTerm)
        );

        if (nameMatch || ingredientMatch) {
            results.push(recipe);
        }
    });

    return results;
}

// Perform search with API integration
async function performSearch(query) {
    if (isLoading) return;
    isLoading = true;
    showLoading(true);

    try {
        let combinedResults = [];
        const localResults = smartSearch(query);

        if (localResults.length > 0) {
            combinedResults.push(...localResults);
        }

        if (query && query.trim() !== "") {
            const apiResults = await searchMealDBAPI(query);
            allRecipes = [...allRecipes, ...apiResults];

            apiResults.forEach(apiRecipe => {
                const isDuplicate = combinedResults.some(existing =>
                    existing.name.toLowerCase() === apiRecipe.name.toLowerCase()
                );
                if (!isDuplicate) {
                    combinedResults.push(apiRecipe);
                }
            });
        }

        if (combinedResults.length > 0) {
            displayRecipes(combinedResults);
        } else {
            displayRecipes([], "لم يتم العثور على وصفات."); // Show no results message
        }

    } catch (error) {
        console.error("Error in performSearch:", error);
        displayRecipes([], "حدث خطأ أثناء البحث."); // Show error message
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

// Search vegetarian recipes
async function searchVegetarian() {
    if (isLoading) return;
    isLoading = true;
    showLoading(true);

    try {
        const vegetarianRecipes = await searchByCategory("Vegetarian");
        if (vegetarianRecipes.length > 0) {
            displayRecipes(vegetarianRecipes, "الوصفات النباتية");
        } else {
            displayRecipes([], "لم يتم العثور على وصفات نباتية.");
        }
    } catch (error) {
        console.error("Error searching vegetarian recipes:", error);
        displayRecipes([], "حدث خطأ أثناء البحث عن وصفات نباتية.");
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

// Search dessert recipes
async function searchDesserts() {
    if (isLoading) return;
    isLoading = true;
    showLoading(true);

    try {
        const dessertRecipes = await searchByCategory("Dessert");
        if (dessertRecipes.length > 0) {
            displayRecipes(dessertRecipes, "الحلويات");
        } else {
            displayRecipes([], "لم يتم العثور على حلويات.");
        }
    } catch (error) {
        console.error("Error searching dessert recipes:", error);
        displayRecipes([], "حدث خطأ أثناء البحث عن حلويات.");
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

// Show random recipes
async function showRandomRecipes() {
    if (isLoading) return;
    isLoading = true;
    showLoading(true);

    try {
        const randomRecipes = await getRandomRecipes(12);
        if (randomRecipes.length > 0) {
            displayRecipes(randomRecipes, "إليك بعض الوصفات المقترحة:");
        } else {
            displayRecipes(localRecipes.slice(0, 8), "إليك بعض الوصفات المحلية:");
        }
    } catch (error) {
        console.error("Error showing random recipes:", error);
        displayRecipes(localRecipes.slice(0, 8), "حدث خطأ أثناء جلب الوصفات العشوائية.");
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

// Show/hide loading indicator
function showLoading(show) {
    const loadingIndicator = document.getElementById("loading-indicator");
    const recipesContainer = document.getElementById("recipes-container");
    const searchResults = document.getElementById("search-results");

    if (loadingIndicator) {
        loadingIndicator.style.display = show ? "flex" : "none";
    }

    // Clear previous results and messages when loading starts
    if (show) {
        if (recipesContainer) recipesContainer.innerHTML = "";
        if (searchResults) searchResults.innerHTML = "";
    }
}

// Display recipes in the UI
function displayRecipes(recipes, title = "") {
    currentRecipes = recipes;
    const recipesContainer = document.getElementById("recipes-container");
    const searchResults = document.getElementById("search-results");

    if (!recipesContainer) return;

    if (title) {
        searchResults.innerHTML = `<h3 class="suggestion-title">${title}</h3>`;
    } else {
        searchResults.innerHTML = "";
    }

    if (recipes.length === 0) {
        recipesContainer.innerHTML = `<p class="no-results">${title || "لم يتم العثور على وصفات."}</p>`;
        return;
    }

    recipesContainer.innerHTML = recipes.map(recipe => `
        <div class="recipe-card" onclick="showRecipeDetails('${recipe.id}')">
            <div class="recipe-image">
                <img src="${recipe.image || 'https://via.placeholder.com/300x200?text=No+Image'}" 
                     alt="${recipe.name}" 
                     onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
            </div>
            <div class="recipe-info">
                <h3 class="recipe-title">${recipe.name}</h3>
                <div class="recipe-meta">
                    <span class="recipe-country">${recipe.country}</span>
                    <span class="recipe-type">${recipe.type}</span>
                </div>
                <div class="recipe-stats">
                    <span class="ingredient-count">${recipe.ingredientCount} مكونات</span>
                    <span class="cooking-time">${recipe.cookingTime} دقيقة</span>
                </div>
                <button class="details-btn">عرض التفاصيل</button>
            </div>
        </div>
    `).join('');

    // Add animation
    const cards = recipesContainer.querySelectorAll('.recipe-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('fade-in');
    });
}

// Show recipe details
function showRecipeDetails(recipeId) {
    const recipe = currentRecipes.find(r => r.id === recipeId);
    if (!recipe) return;

    // Store recipe in localStorage for details page
    localStorage.setItem('selectedRecipe', JSON.stringify(recipe));
    
    // Navigate to details page
    window.location.href = 'recipe-details.html';
}

// Initialize search functionality
function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    if (searchInput) {
        let searchTimeout;
        
        // Debounced search as user types
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length >= 2) {
                searchTimeout = setTimeout(() => {
                    performSearch(query);
                }, 500); // Wait 500ms after user stops typing
            } else if (query.length === 0) {
                clearTimeout(searchTimeout);
                showRandomRecipes();
            }
        });

        // Search on Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                performSearch(e.target.value);
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = searchInput ? searchInput.value : '';
            performSearch(query);
        });
    }
}

// Initialize the application
async function initializeApp() {
    await loadLocalRecipes();
    initializeSearch();
    
    // Show random recipes on initial load
    await showRandomRecipes();
}

// Load recipe details on details page
function loadRecipeDetails() {
    const recipe = JSON.parse(localStorage.getItem('selectedRecipe'));
    if (!recipe) {
        window.location.href = 'index.html';
        return;
    }

    // Update page title
    document.title = `${recipe.name} - Smart Recipe Finder`;

    // Fill in recipe details
    const elements = {
        'recipe-image': (el) => {
            el.src = recipe.image || 'https://via.placeholder.com/400x300?text=No+Image';
            el.alt = recipe.name;
            el.onerror = () => el.src = 'https://via.placeholder.com/400x300?text=No+Image';
        },
        'recipe-title': (el) => el.textContent = recipe.name,
        'recipe-country': (el) => el.textContent = recipe.country,
        'recipe-type': (el) => el.textContent = recipe.type,
        'cooking-time': (el) => el.textContent = `${recipe.cookingTime} دقيقة`,
        'ingredient-count': (el) => el.textContent = `${recipe.ingredientCount} مكونات`,
        'ingredients-list': (el) => {
            el.innerHTML = recipe.ingredients.map(ingredient => 
                `<li>${ingredient}</li>`
            ).join('');
        },
        'instructions': (el) => el.textContent = recipe.instructions || 'تعليمات الطبخ غير متوفرة.',
        'youtube-link': (el) => {
            if (recipe.youtube) {
                el.href = recipe.youtube;
                el.style.display = 'inline-block';
            } else {
                el.style.display = 'none';
            }
        }
    };

    Object.entries(elements).forEach(([id, updateFn]) => {
        const element = document.getElementById(id);
        if (element) updateFn(element);
    });
}

// Initialize based on current page
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('recipe-details.html')) {
        loadRecipeDetails();
    } else {
        initializeApp();
    }
});

// Export functions for global access
window.showRecipeDetails = showRecipeDetails;
window.performSearch = performSearch;
window.searchVegetarian = searchVegetarian;
window.searchDesserts = searchDesserts;
window.showRandomRecipes = showRandomRecipes;


