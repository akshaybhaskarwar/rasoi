import { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const useInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get auth headers for API calls
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchInventory = async (category = null) => {
    setLoading(true);
    setError(null);
    try {
      // Use household-scoped endpoint only - no fallback to public
      const url = category 
        ? `${API}/inventory/household?category=${category}` 
        : `${API}/inventory/household`;
      const response = await axios.get(url, { headers: getAuthHeaders() });
      setInventory(response.data);
      return response.data;
    } catch (err) {
      console.error('Failed to fetch inventory:', err.response?.data || err.message);
      // Return empty array for new users without household
      setInventory([]);
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (itemData) => {
    try {
      // Use household-scoped endpoint with auth - no fallback
      console.log('Adding item to household inventory:', itemData);
      const headers = getAuthHeaders();
      const response = await axios.post(`${API}/inventory/household`, itemData, {
        headers: headers
      });
      console.log('Item added successfully:', response.data);
      setInventory(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      console.error('Failed to add item:', err.response?.data || err.message);
      setError(err.response?.data?.detail || err.message);
      throw err;
    }
  };

  const updateItem = async (itemId, updates) => {
    try {
      await axios.put(`${API}/inventory/${itemId}`, updates, {
        headers: getAuthHeaders()
      });
      setInventory(prev => prev.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteItem = async (itemId) => {
    try {
      const response = await axios.delete(`${API}/inventory/${itemId}`, {
        headers: getAuthHeaders()
      });
      console.log('Delete API response:', response.data);
      
      // Immediately update local state
      setInventory(prev => {
        const updated = prev.filter(item => item.id !== itemId);
        console.log(`Deleted item ${itemId}. Remaining items:`, updated.length);
        return updated;
      });
      
      // Also refresh from server to ensure consistency
      await fetchInventory();
      
      return response.data;
    } catch (err) {
      console.error('Delete error:', err.response?.data || err.message);
      
      // If item not found, refresh inventory to sync state
      if (err.response?.status === 404) {
        console.log('Item not found in DB, refreshing inventory...');
        await fetchInventory();
      }
      
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchInventory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { inventory, loading, error, fetchInventory, addItem, updateItem, deleteItem };
};

// Receipt-to-inventory pipeline (PRD-01).
// Two-step flow:
//   1. parseReceipt(imageBase64) -> { receipt_id, items[], total_extracted, vendor }
//   2. user reviews on confirm screen and edits rows
//   3. saveConfirmedItems(receipt_id, items) writes to inventory
export const useReceiptIngestion = () => {
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('rasoi_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  /**
   * Run a base64-encoded JPEG/PNG image through Google OCR + Claude catalog.
   * Returns the parsed receipt with structured items ready for confirmation.
   */
  const parseReceipt = async (imageBase64) => {
    setParsing(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API}/inventory/from-receipt`,
        { image_base64: imageBase64 },
        { headers: getAuthHeaders(), timeout: 60_000 }
      );
      return response.data;
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Receipt processing failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setParsing(false);
    }
  };

  /**
   * Apply the user-confirmed rows to inventory. Each item carries an `action`
   * of "add" or "skip". Server-side this is bulk; returns {added_count,...}.
   */
  const saveConfirmedItems = async (receiptId, items) => {
    setSaving(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API}/inventory/bulk-update`,
        { receipt_id: receiptId, items },
        { headers: getAuthHeaders(), timeout: 30_000 }
      );
      return response.data;
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Inventory update failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  };

  return { parseReceipt, saveConfirmedItems, parsing, saving, error };
};

export const useShoppingList = () => {
  const [shoppingList, setShoppingList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get auth headers for API calls
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchShoppingList = async (storeType = null) => {
    setLoading(true);
    setError(null);
    try {
      const url = storeType ? `${API}/shopping?store_type=${storeType}` : `${API}/shopping`;
      const response = await axios.get(url, { headers: getAuthHeaders() });
      setShoppingList(response.data);
    } catch (err) {
      console.error('Failed to fetch shopping list:', err.response?.data || err.message);
      setShoppingList([]);
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (itemData) => {
    try {
      const response = await axios.post(`${API}/shopping`, itemData, { headers: getAuthHeaders() });
      setShoppingList(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      console.error('Failed to add shopping item:', err.response?.data || err.message);
      setError(err.response?.data?.detail || err.message);
      throw err;
    }
  };

  const updateItem = async (itemId, updates) => {
    try {
      await axios.put(`${API}/shopping/${itemId}`, updates, { headers: getAuthHeaders() });
      setShoppingList(prev => prev.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteItem = async (itemId) => {
    try {
      const response = await axios.delete(`${API}/shopping/${itemId}`, { headers: getAuthHeaders() });
      console.log('Delete shopping item API response:', response.data);
      
      // Immediately update local state
      setShoppingList(prev => {
        const updated = prev.filter(item => item.id !== itemId);
        console.log(`Deleted shopping item ${itemId}. Remaining items:`, updated.length);
        return updated;
      });
      
      // Also refresh from server to ensure consistency
      await fetchShoppingList();
      
      return response.data;
    } catch (err) {
      console.error('Delete shopping item error:', err.response?.data || err.message);
      
      // If item not found, refresh shopping list to sync state
      if (err.response?.status === 404) {
        console.log('Shopping item not found in DB, refreshing list...');
        await fetchShoppingList();
      }
      
      setError(err.message);
      throw err;
    }
  };

  const clearList = async () => {
    try {
      await axios.delete(`${API}/shopping`);
      setShoppingList([]);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchShoppingList();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { shoppingList, loading, error, fetchShoppingList, addItem, updateItem, deleteItem, clearList };
};

export const useMealPlanner = () => {
  const [mealPlans, setMealPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  // Get auth headers for API calls
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchMealPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API}/meal-plans`, { headers: getAuthHeaders() });
      setMealPlans(response.data);
    } catch (err) {
      console.error('Failed to fetch meal plans:', err.response?.data || err.message);
      setMealPlans([]);
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const response = await axios.get(`${API}/meal-plans/suggestions`, { headers: getAuthHeaders() });
      setSuggestions(response.data.suggestions || []);
      return response.data.suggestions || [];
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
      return [];
    }
  };

  const addMealPlan = async (planData) => {
    try {
      const response = await axios.post(`${API}/meal-plans`, planData, { headers: getAuthHeaders() });
      setMealPlans(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      console.error('Failed to add meal plan:', err.response?.data || err.message);
      setError(err.response?.data?.detail || err.message);
      throw err;
    }
  };

  const deleteMealPlan = async (planId) => {
    try {
      const response = await axios.delete(`${API}/meal-plans/${planId}`, { headers: getAuthHeaders() });
      setMealPlans(prev => prev.filter(plan => plan.id !== planId));
      return response.data; // Returns { message, released_ingredients, plan_name }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchMealPlans();
    fetchSuggestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { mealPlans, loading, error, suggestions, fetchMealPlans, fetchSuggestions, addMealPlan, deleteMealPlan };
};

export const useRecipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRecipes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API}/recipes`);
      setRecipes(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addRecipe = async (recipeData) => {
    try {
      const response = await axios.post(`${API}/recipes`, recipeData);
      setRecipes(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const searchYouTube = async (query, maxResults = 10, favoriteChannels = []) => {
    try {
      const channelNames = favoriteChannels.map(ch => ch.name).join(',');
      const response = await axios.get(`${API}/youtube/search`, {
        params: { 
          query, 
          max_results: maxResults,
          favorite_channels: channelNames
        }
      });
      return response.data.results;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // New: Search local recipe database by ingredients or text
  const searchLocalRecipes = async (ingredients = [], videosOnly = false, favoriteChannels = [], maxResults = 20, textQuery = '') => {
    try {
      const ingredientNames = ingredients.join(',');
      const channelNames = favoriteChannels.map(ch => ch.name).join(',');
      const response = await axios.get(`${API}/recipes/search`, {
        params: {
          ingredients: ingredientNames,
          videos_only: videosOnly,
          favorite_channels: channelNames,
          max_results: maxResults,
          query: textQuery // Add text query parameter
        }
      });
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  return { recipes, loading, error, fetchRecipes, addRecipe, searchYouTube, searchLocalRecipes };
};

export const useFestivalAlert = () => {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAlert = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/festival-alert`);
      setAlert(response.data);
    } catch (err) {
      console.error('Festival alert error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlert();
  }, []);

  return { alert, loading, fetchAlert };
};

export const useGapAnalysis = () => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/gap-analysis`);
      setAnalysis(response.data);
    } catch (err) {
      console.error('Gap analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, []);

  return { analysis, loading, fetchAnalysis };
};

export const useTranslation = () => {
  const [loading, setLoading] = useState(false);

  const translate = async (text, targetLanguages = ['gu', 'mr'], sourceLanguage = 'en') => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/translate`, {
        text,
        source_language: sourceLanguage,
        target_languages: targetLanguages
      });
      return response.data;
    } catch (err) {
      console.error('Translation error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { translate, loading };
};

// useFavoriteChannels has moved to FavoriteChannelsContext so every consumer
// (PlannerPage, PersonalizedRecipeStream, etc.) shares a single state and
// stays in sync after add/remove. Re-exported here so existing imports of
// useFavoriteChannels from this file keep working without any call-site edits.
export { useFavoriteChannels } from '@/contexts/FavoriteChannelsContext';


// Browse Menu (Phase 1) — fetches the EVERYDAY_MENU catalog merged with
// this household's custom dishes, and exposes add / edit / delete for the
// custom layer.
export const useMenu = () => {
  const [catalog, setCatalog] = useState({});
  const [custom, setCustom] = useState({});
  const [composed, setComposed] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/menu`, { headers: getAuthHeaders() });
      setCatalog(res.data.catalog || {});
      setCustom(res.data.custom || {});
      setComposed(res.data.composed || {});
    } catch (err) {
      console.error('Menu fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addCustom = async ({ category, name_en, name_mr, vegetable_tag }) => {
    const res = await axios.post(`${API}/menu/custom`, {
      category, name_en, name_mr, vegetable_tag,
    }, { headers: getAuthHeaders() });
    await refresh();
    return res.data;
  };

  const editCustom = async (id, patch) => {
    const res = await axios.put(`${API}/menu/custom/${id}`, patch, { headers: getAuthHeaders() });
    await refresh();
    return res.data;
  };

  const deleteCustom = async (id) => {
    await axios.delete(`${API}/menu/custom/${id}`, { headers: getAuthHeaders() });
    await refresh();
  };

  useEffect(() => { refresh(); }, []);

  return { catalog, custom, composed, loading, error, refresh, addCustom, editCustom, deleteCustom };
};
