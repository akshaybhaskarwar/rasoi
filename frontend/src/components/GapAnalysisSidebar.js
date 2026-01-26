import { useGapAnalysis } from '@/hooks/useRasoiSync';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export const GapAnalysisSidebar = () => {
  const { analysis, loading } = useGapAnalysis();

  if (loading || !analysis || analysis.missing_ingredients.length === 0) {
    return null;
  }

  return (
    <Card 
      className="bg-white border-l-4 border-[#FF9933] shadow-lg"
      data-testid="gap-analysis-sidebar"
    >
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-[#FF9933]" />
          <h3 className="font-bold text-lg text-gray-800">Missing Ingredients</h3>
        </div>

        <div className="space-y-3">
          {analysis.missing_ingredients.map((item, index) => (
            <div 
              key={index}
              className="p-3 bg-[#FFFBF0] rounded-lg border border-[#FFCC00]/30"
              data-testid={`missing-item-${index}`}
            >
              <p className="font-medium text-gray-800 text-sm mb-1">{item.ingredient}</p>
              <p className="text-xs text-gray-600">
                For: <span className="font-medium">{item.meal}</span>
              </p>
              <p className="text-xs text-gray-500">
                On: {new Date(item.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
