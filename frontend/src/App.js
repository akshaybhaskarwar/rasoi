import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { DualContextHeader } from "@/components/DualContextHeader";
import { BottomNavigation } from "@/components/BottomNavigation";
import { GapAnalysisSidebar } from "@/components/GapAnalysisSidebar";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import HomePage from "@/pages/HomePage";
import InventoryPage from "@/pages/InventoryPage";
import ShoppingPage from "@/pages/ShoppingPage";
import PlannerPage from "@/pages/PlannerPage";
import CommunityPage from "@/pages/CommunityPage";

// Inner component that uses language context
function AppContent() {
  const { changeLanguage } = useLanguage();

  return (
    <div className="App bg-gray-50 min-h-screen overflow-x-hidden">
      <BrowserRouter>
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
        <Toaster position="top-center" className="md:bottom-4" />
      </BrowserRouter>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
