export interface Recipe {
  recipeName: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  imageUrl?: string | null;
}

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  ingredients: string[];
  recipes: Recipe[];
}