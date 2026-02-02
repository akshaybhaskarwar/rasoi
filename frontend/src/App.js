import "@/App.css";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { DualContextHeader } from "@/components/DualContextHeader";
import { BottomNavigation } from "@/components/BottomNavigation";
import { GapAnalysisSidebar } from "@/components/GapAnalysisSidebar";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import OnboardingFlow from "@/components/OnboardingFlow";
import HomePage from "@/pages/HomePage";
import InventoryPage from "@/pages/InventoryPage";
import ShoppingPage from "@/pages/ShoppingPage";
import PlannerPage from "@/pages/PlannerPage";
import CommunityPage from "@/pages/CommunityPage";
import AuthPage from "@/pages/AuthPage";

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, households } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  useEffect(() => {
    // Show onboarding if user is authenticated but hasn't completed onboarding
    // and doesn't have any households yet
    if (isAuthenticated && !loading) {
      const onboardingCompleted = localStorage.getItem('onboarding_completed');
      if (!onboardingCompleted && households.length === 0) {
        setShowOnboarding(true);
      }
    }
  }, [isAuthenticated, loading, households]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return (
    <>
      {showOnboarding && (
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      )}
      {children}
    </>
  );
}

// Inner component that uses language context
function AppContent() {
  const { changeLanguage } = useLanguage();
  const { isAuthenticated, loading } = useAuth();

  return (
    <div className="App bg-gray-50 min-h-screen overflow-x-hidden">
      <BrowserRouter>
        <Routes>
          {/* Auth page - accessible without login */}
          <Route path="/auth" element={
            isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />
          } />
          
          {/* Protected routes */}
          <Route path="/*" element={
            <ProtectedRoute>
              <>
                <DualContextHeader onLanguageChange={changeLanguage} />
                
                <div className="flex w-full max-w-full">
                  {/* Main Content - with bottom padding for mobile nav */}
                  <main className="flex-1 pb-20 md:pb-0 min-w-0">
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/inventory" element={<InventoryPage />} />
                      <Route path="/shopping" element={<ShoppingPage />} />
                      <Route path="/planner" element={<PlannerPage />} />
                      <Route path="/community" element={<CommunityPage />} />
                    </Routes>
                  </main>

                  {/* Gap Analysis Sidebar (Desktop Only) */}
                  <aside className="hidden xl:block w-80 flex-shrink-0 p-4 sticky top-24 h-screen overflow-y-auto">
                    <GapAnalysisSidebar />
                  </aside>
                </div>

                <BottomNavigation />
              </>
            </ProtectedRoute>
          } />
        </Routes>
        <Toaster position="top-center" className="md:bottom-4" />
      </BrowserRouter>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
