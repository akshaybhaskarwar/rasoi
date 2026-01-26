import { useState } from 'react';
import { useRecipes } from '@/hooks/useRasoiSync';
import { Plus, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CommunityPage = () => {
  const { recipes, addRecipe } = useRecipes();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRecipe, setNewRecipe] = useState({
    title: '',
    youtube_url: '',
    ingredients: [],
    author: ''
  });

  const handleAddRecipe = async () => {
    try {
      await addRecipe(newRecipe);
      setIsAddDialogOpen(false);
      setNewRecipe({ title: '', youtube_url: '', ingredients: [], author: '' });
    } catch (error) {
      console.error('Error adding recipe:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 pb-24 md:pb-6 space-y-6" data-testid="community-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Community Kitchen</h1>
          <p className="text-gray-600 mt-1">Share your secret recipes</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full"
              data-testid="post-recipe-btn"
            >
              <Plus className="w-5 h-5 mr-2" />
              Post Recipe
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="post-recipe-dialog">
            <DialogHeader>
              <DialogTitle>Share Your Secret Recipe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Recipe Title</Label>
                <Input
                  value={newRecipe.title}
                  onChange={(e) => setNewRecipe({ ...newRecipe, title: e.target.value })}
                  placeholder="e.g., Mummy's Special Dal"
                  data-testid="recipe-title-input"
                />
              </div>
              <div>
                <Label>YouTube URL</Label>
                <Input
                  value={newRecipe.youtube_url}
                  onChange={(e) => setNewRecipe({ ...newRecipe, youtube_url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=..."
                  data-testid="recipe-url-input"
                />
              </div>
              <div>
                <Label>Ingredients (comma separated)</Label>
                <Input
                  value={newRecipe.ingredients.join(', ')}
                  onChange={(e) => setNewRecipe({ 
                    ...newRecipe, 
                    ingredients: e.target.value.split(',').map(i => i.trim()).filter(Boolean)
                  })}
                  placeholder="e.g., Tuvar Dal, Tomatoes, Cumin"
                  data-testid="recipe-ingredients-input"
                />
              </div>
              <div>
                <Label>Your Name (Optional)</Label>
                <Input
                  value={newRecipe.author}
                  onChange={(e) => setNewRecipe({ ...newRecipe, author: e.target.value })}
                  placeholder="Anonymous"
                  data-testid="recipe-author-input"
                />
              </div>
              <Button 
                onClick={handleAddRecipe}
                disabled={!newRecipe.title || !newRecipe.youtube_url}
                className="w-full bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full"
                data-testid="submit-recipe"
              >
                Share Recipe
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recipe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recipes.map((recipe) => (
          <Card 
            key={recipe.id}
            className="hover-lift overflow-hidden"
            data-testid={`recipe-${recipe.id}`}
          >
            {recipe.youtube_thumbnail && (
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={recipe.youtube_thumbnail}
                  alt={recipe.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-2">{recipe.title}</h3>
              
              {recipe.ingredients.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-600 font-medium mb-1">Ingredients:</p>
                  <div className="flex flex-wrap gap-1">
                    {recipe.ingredients.slice(0, 5).map((ing, idx) => (
                      <span 
                        key={idx}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {ing}
                      </span>
                    ))}
                    {recipe.ingredients.length > 5 && (
                      <span className="px-2 py-1 text-gray-500 text-xs">
                        +{recipe.ingredients.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">By {recipe.author}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(recipe.youtube_url, '_blank')}
                  className="text-[#FF9933] hover:text-[#E68A2E]"
                  data-testid={`watch-recipe-${recipe.id}`}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Watch
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {recipes.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-6xl mb-4">👨‍🍳</div>
          <p className="text-gray-600 mb-2">No recipes yet</p>
          <p className="text-sm text-gray-500">Be the first to share your secret recipe!</p>
        </Card>
      )}
    </div>
  );
};

export default CommunityPage;
