import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);
  const [households, setHouseholds] = useState([]);
  const [activeHousehold, setActiveHousehold] = useState(null);

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Fetch user on mount if token exists
  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${API}/auth/me`);
        setUser(response.data);
        
        // Fetch households
        await fetchHouseholds();
      } catch (error) {
        console.error('Failed to fetch user:', error);
        // Token might be invalid
        logout();
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchHouseholds = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/households/my-households`);
      setHouseholds(response.data.households || []);
      
      if (response.data.active_household) {
        const active = response.data.households?.find(h => h.id === response.data.active_household);
        setActiveHousehold(active || null);
      }
    } catch (error) {
      console.error('Failed to fetch households:', error);
    }
  }, []);

  const signup = async (email, password, name, homeLanguage = 'en', city = 'Pune') => {
    try {
      const response = await axios.post(`${API}/auth/signup`, {
        email,
        password,
        name,
        home_language: homeLanguage,
        city
      });

      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('auth_token', access_token);
      setToken(access_token);
      setUser(userData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Signup failed'
      };
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, {
        email,
        password
      });

      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('auth_token', access_token);
      setToken(access_token);
      setUser(userData);

      // Fetch households after login
      await fetchHouseholds();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setHouseholds([]);
    setActiveHousehold(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const forgotPassword = async (email) => {
    try {
      const response = await axios.post(`${API}/auth/forgot-password`, { email });
      return { success: true, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to send reset email'
      };
    }
  };

  const resetPassword = async (token, newPassword) => {
    try {
      await axios.post(`${API}/auth/reset-password`, {
        token,
        new_password: newPassword
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Password reset failed'
      };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to change password'
      };
    }
  };

  const updateProfile = async (updates) => {
    try {
      const response = await axios.put(`${API}/auth/profile`, updates);
      setUser(response.data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to update profile'
      };
    }
  };

  // Household functions
  const createHousehold = async (name) => {
    try {
      const response = await axios.post(`${API}/households/create`, { name });
      await fetchHouseholds();
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to create household'
      };
    }
  };

  const joinHousehold = async (kitchenCode) => {
    try {
      const response = await axios.post(`${API}/households/join`, {
        kitchen_code: kitchenCode
      });
      await fetchHouseholds();
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to join household'
      };
    }
  };

  const switchHousehold = async (householdId) => {
    try {
      await axios.post(`${API}/households/${householdId}/switch`);
      const household = households.find(h => h.id === householdId);
      setActiveHousehold(household);
      
      // Update user's active_household
      setUser(prev => ({ ...prev, active_household: householdId }));
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to switch household'
      };
    }
  };

  const leaveHousehold = async (householdId) => {
    try {
      await axios.post(`${API}/households/${householdId}/leave`);
      await fetchHouseholds();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to leave household'
      };
    }
  };

  const removeMember = async (householdId, memberUserId) => {
    try {
      const response = await axios.delete(`${API}/households/${householdId}/member/${memberUserId}`);
      await fetchHouseholds();
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to remove member'
      };
    }
  };

  const deleteHousehold = async (householdId) => {
    try {
      const response = await axios.delete(`${API}/households/${householdId}`);
      await fetchHouseholds();
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to delete kitchen'
      };
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    households,
    activeHousehold,
    signup,
    login,
    logout,
    forgotPassword,
    resetPassword,
    changePassword,
    updateProfile,
    createHousehold,
    joinHousehold,
    switchHousehold,
    leaveHousehold,
    removeMember,
    deleteHousehold,
    fetchHouseholds
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
