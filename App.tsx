import React, { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import IngredientInput from './components/IngredientInput';
import RecipeCard from './components/RecipeCard';
import Loader from './components/Loader';
import { generateRecipes, identifyIngredientsFromImage, generateImageForRecipe } from './services/geminiService';
import type { Recipe, HistoryEntry } from './types';

// --- History Modal Component ---
interface HistoryModalProps {
  isVisible: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onSelectHistory: (entry: HistoryEntry) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isVisible, onClose, history, onSelectHistory }) => {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-surface rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-2xl font-bold text-text-primary">Recipe History</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200" aria-label="Close history">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {history.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4">No history yet.</p>
              <p>Generate some recipes to see them here!</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {history.map((entry) => (
                <li key={entry.id}>
                  <button
                    onClick={() => onSelectHistory(entry)}
                    className="w-full text-left p-4 bg-background hover:bg-gray-200 rounded-lg transition"
                  >
                    <p className="font-semibold text-primary">
                      {entry.timestamp.toLocaleDateString()} - {entry.timestamp.toLocaleTimeString()}
                    </p>
                    <p className="text-sm text-text-secondary truncate">
                      Ingredients: {entry.ingredients.join(', ')}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });

const App: React.FC = () => {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isHistoryVisible, setIsHistoryVisible] = useState<boolean>(false);

  const handleAddIngredient = (ingredient: string) => {
    if (!ingredients.find(i => i.toLowerCase() === ingredient.toLowerCase())) {
        setIngredients(prev => [...prev, ingredient]);
    }
  };

  const handleRemoveIngredient = (indexToRemove: number) => {
    setIngredients(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleGenerateRecipes = async () => {
    if (ingredients.length === 0) return;
    setIsLoading(true);
    setLoadingMessage('Generating delicious ideas...');
    setError(null);
    setRecipes([]);

    try {
      const generatedRecipes = await generateRecipes(ingredients);
      
      setLoadingMessage('Creating beautiful dish photos...');

      const imagePromises = generatedRecipes.map(recipe => generateImageForRecipe(recipe));
      const imageResults = await Promise.allSettled(imagePromises);

      const recipesWithImages = generatedRecipes.map((recipe, index) => {
        const result = imageResults[index];
        if (result.status === 'fulfilled') {
          return { ...recipe, imageUrl: result.value };
        }
        return recipe; // Keep original recipe if image gen fails
      });
      
      setRecipes(recipesWithImages);
      
      const newHistoryEntry: HistoryEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        ingredients: [...ingredients],
        recipes: recipesWithImages,
      };
      setHistory(prev => [newHistoryEntry, ...prev]);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleImageUpload = async (file: File) => {
    setIsLoading(true);
    setLoadingMessage('Identifying ingredients...');
    setError(null);
    setRecipes([]);

    try {
      const base64Image = await fileToBase64(file);
      const identified = await identifyIngredientsFromImage(base64Image, file.type);
      
      setIngredients(prev => {
          const newIngredients = new Set(prev.map(i => i.toLowerCase()));
          identified.forEach(newItem => {
            newIngredients.add(newItem.toLowerCase());
          });
          // Capitalize first letter for display
          return Array.from(newIngredients).map(item => item.charAt(0).toUpperCase() + item.slice(1));
      });

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred while processing the image.");
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleShowHistory = () => setIsHistoryVisible(true);
  const handleCloseHistory = () => setIsHistoryVisible(false);
  const handleSelectHistory = (entry: HistoryEntry) => {
    setIngredients(entry.ingredients);
    setRecipes(entry.recipes);
    setIsHistoryVisible(false);
    setError(null);
  };


  return (
    <div className="min-h-screen flex flex-col font-sans text-text-primary">
      <Header onShowHistory={handleShowHistory} />
      <HistoryModal
        isVisible={isHistoryVisible}
        onClose={handleCloseHistory}
        history={history}
        onSelectHistory={handleSelectHistory}
      />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <IngredientInput
          ingredients={ingredients}
          onAddIngredient={handleAddIngredient}
          onRemoveIngredient={handleRemoveIngredient}
          onGenerate={handleGenerateRecipes}
          onImageUpload={handleImageUpload}
          isLoading={isLoading}
        />

        <div className="mt-12">
          {isLoading && <Loader message={loadingMessage} />}
          {error && (
            <div className="text-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md max-w-2xl mx-auto">
              <strong className="font-bold">Oops! </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {!isLoading && recipes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {recipes.map((recipe, index) => (
                <RecipeCard key={index} recipe={recipe} />
              ))}
            </div>
          )}

          {!isLoading && recipes.length === 0 && !error && (
             <div className="text-center text-text-secondary mt-16">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.293 2.293a1 1 0 01-1.414 1.414L12 6.414l-2.293 2.293a1 1 0 01-1.414-1.414L12 3.586zM12 21l-2.293-2.293a1 1 0 011.414-1.414L12 17.586l2.293-2.293a1 1 0 011.414 1.414L12 21zM3 12l2.293-2.293a1 1 0 011.414 1.414L5.414 12l2.293 2.293a1 1 0 01-1.414 1.414L3 13.414zM21 12l-2.293 2.293a1 1 0 01-1.414-1.414L18.586 12l-2.293-2.293a1 1 0 011.414-1.414L21 10.586z" />
              </svg>
              <p className="text-xl mt-4 font-light">Your culinary adventure awaits!</p>
              <p className="font-light">Add some ingredients and let's get cooking.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default App;