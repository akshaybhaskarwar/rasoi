import { useState, useEffect } from 'react';
import { 
  Upload, Calendar, Trash2, Edit, Plus, FileSpreadsheet, 
  AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp,
  Download, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminFestivalManager = () => {
  const [festivals, setFestivals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [editingFestival, setEditingFestival] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newFestival, setNewFestival] = useState({
    name: '',
    name_mr: '',
    name_hi: '',
    date: '',
    significance: '',
    key_ingredients: [],
    is_fasting_day: false,
    region: 'Maharashtra'
  });
  const [expandedFestival, setExpandedFestival] = useState(null);

  // Fetch festivals on mount
  useEffect(() => {
    fetchFestivals();
  }, []);

  const fetchFestivals = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API}/dadi/festivals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFestivals(response.data.festivals || []);
    } catch (error) {
      console.error('Error fetching festivals:', error);
      toast.error('Failed to load festivals');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFestival = async () => {
    if (!newFestival.name || !newFestival.date) {
      toast.error('Festival name and date are required');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(`${API}/dadi/festivals`, newFestival, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Festival added successfully!');
      setIsAddDialogOpen(false);
      setNewFestival({
        name: '',
        name_mr: '',
        name_hi: '',
        date: '',
        significance: '',
        key_ingredients: [],
        is_fasting_day: false,
        region: 'Maharashtra'
      });
      fetchFestivals();
    } catch (error) {
      console.error('Error adding festival:', error);
      toast.error('Failed to add festival');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/dadi/festivals/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadResult(response.data);
      toast.success(`Successfully processed ${response.data.inserted + response.data.updated} festivals!`);
      fetchFestivals();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload file');
      setUploadResult({ success: false, errors: [error.message] });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (festivalId) => {
    if (!window.confirm('Are you sure you want to delete this festival?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      await axios.delete(`${API}/dadi/festivals/${festivalId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Festival deleted');
      fetchFestivals();
    } catch (error) {
      toast.error('Failed to delete festival');
    }
  };

  const handleEdit = (festival) => {
    setEditingFestival({ ...festival });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingFestival) return;

    try {
      const token = localStorage.getItem('auth_token');
      await axios.put(`${API}/dadi/festivals/${editingFestival.id}`, editingFestival, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Festival updated');
      setIsEditDialogOpen(false);
      setEditingFestival(null);
      fetchFestivals();
    } catch (error) {
      toast.error('Failed to update festival');
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = `Festival Name,Name (Marathi),Name (Hindi),Date,Significance,Key Ingredients,Recipes,Tips,Is Fasting Day,Region
Makar Sankranti,मकर संक्रांती,मकर संक्रांति,Jan 14,Til-Gul interchange,"Til (Sesame), Gul (Jaggery), Peanuts, Bajra, Sugarcane",Tilgul Ladoo|Puran Poli,Make tilgul ladoos a day before for best taste,No,Maharashtra
Mahashivratri,महाशिवरात्री,महाशिवरात्रि,Feb 15,Major Fasting day,"Sabudana, Peanuts, Potatoes, Varai (Bhagar), Milk",Sabudana Khichdi|Sabudana Vada,Soak sabudana overnight for fluffy texture,Yes,Maharashtra
Holi (Shimga),होळी,होली,March 4,Puran Poli / Sweets,"Chana Dal, Gul (Jaggery), Maida, Nutmeg (Jaiphal)",Puran Poli|Thandai,Start puran poli prep a day early,No,Maharashtra
Gudi Padwa,गुढीपाडवा,गुड़ी पड़वा,March 19,Marathi New Year,"Shrikhand, Neem Leaves, Jaggery, Saffron, Ghee",Shrikhand|Puran Poli|Shreekhand Puri,Hang curd overnight for thick shrikhand,No,Maharashtra
Ganesh Chaturthi,गणेश चतुर्थी,गणेश चतुर्थी,Sept 14,The Big One,"Modak Peeth (Rice Flour), Fresh Coconut, Gul, Cardamom",Ukdiche Modak|Fried Modak,Steam modaks for 15 mins on medium heat,No,Maharashtra`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'festival_calendar_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6" data-testid="admin-festival-page">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">👵</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Digital Dadi</h1>
              <p className="text-gray-600">Festival Calendar Management</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              data-testid="add-festival-btn"
            >
              <Plus className="w-4 h-4" />
              Add Festival
            </Button>
            <Button
              onClick={fetchFestivals}
              variant="outline"
              className="gap-2"
              data-testid="refresh-festivals-btn"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Upload Section */}
        <Card className="mb-8 border-2 border-dashed border-orange-300 bg-orange-50/50">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-orange-500" />
                  Upload Festival Calendar (CSV)
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Upload a CSV file with columns: Festival Name, Date, Significance, Key Ingredients
                </p>
                <div className="flex gap-3">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                      data-testid="csv-upload-input"
                    />
                    <Button
                      as="span"
                      disabled={isUploading}
                      className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                      data-testid="upload-csv-btn"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {isUploading ? 'Uploading...' : 'Upload CSV'}
                    </Button>
                  </label>
                  <Button
                    variant="outline"
                    onClick={downloadSampleCSV}
                    className="gap-2"
                    data-testid="download-sample-btn"
                  >
                    <Download className="w-4 h-4" />
                    Download Sample
                  </Button>
                </div>
              </div>

              {/* Upload Result */}
              {uploadResult && (
                <div className={`p-4 rounded-lg ${uploadResult.success ? 'bg-green-100' : 'bg-red-100'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {uploadResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-medium ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {uploadResult.success ? 'Upload Successful!' : 'Upload Failed'}
                    </span>
                  </div>
                  {uploadResult.success && (
                    <div className="text-sm text-green-700">
                      <p>✓ {uploadResult.inserted} new festivals added</p>
                      <p>✓ {uploadResult.updated} festivals updated</p>
                    </div>
                  )}
                  {uploadResult.errors?.length > 0 && (
                    <div className="text-sm text-red-700 mt-2">
                      {uploadResult.errors.slice(0, 3).map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Festival List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                Festival Calendar ({festivals.length} festivals)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
            ) : festivals.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No festivals uploaded yet</p>
                <p className="text-sm text-gray-400">Upload a CSV file to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {festivals.map((festival) => (
                  <div
                    key={festival.id}
                    className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                    data-testid={`festival-card-${festival.id}`}
                  >
                    {/* Festival Header */}
                    <div
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 cursor-pointer"
                      onClick={() => setExpandedFestival(expandedFestival === festival.id ? null : festival.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <span className="text-2xl">🎉</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{festival.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-3 h-3" />
                            <span>{festival.date}</span>
                            {festival.is_fasting_day && (
                              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                                Fasting Day
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(festival);
                          }}
                          data-testid={`edit-festival-${festival.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(festival.id);
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          data-testid={`delete-festival-${festival.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {expandedFestival === festival.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedFestival === festival.id && (
                      <div className="p-4 border-t bg-white">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Significance</p>
                            <p className="text-gray-700">{festival.significance || '-'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Region</p>
                            <p className="text-gray-700">{festival.region || 'Maharashtra'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm font-medium text-gray-500 mb-2">Key Ingredients</p>
                            <div className="flex flex-wrap gap-2">
                              {(festival.key_ingredients || []).map((ing, idx) => (
                                <Badge key={idx} variant="secondary" className="bg-amber-100 text-amber-800">
                                  {ing}
                                </Badge>
                              ))}
                              {(!festival.key_ingredients || festival.key_ingredients.length === 0) && (
                                <span className="text-gray-400 text-sm">No ingredients specified</span>
                              )}
                            </div>
                          </div>
                          {festival.tips?.length > 0 && (
                            <div className="md:col-span-2">
                              <p className="text-sm font-medium text-gray-500 mb-2">Dadi&apos;s Tips</p>
                              <ul className="text-sm text-gray-700 space-y-1">
                                {festival.tips.map((tip, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-orange-500">💡</span>
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Festival</DialogTitle>
          </DialogHeader>
          {editingFestival && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Festival Name</label>
                <Input
                  value={editingFestival.name || ''}
                  onChange={(e) => setEditingFestival({ ...editingFestival, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Date</label>
                <Input
                  value={editingFestival.date || ''}
                  onChange={(e) => setEditingFestival({ ...editingFestival, date: e.target.value })}
                  placeholder="e.g., Jan 14 or 2026-01-14"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Significance</label>
                <Input
                  value={editingFestival.significance || ''}
                  onChange={(e) => setEditingFestival({ ...editingFestival, significance: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Key Ingredients (comma-separated)</label>
                <Input
                  value={(editingFestival.key_ingredients || []).join(', ')}
                  onChange={(e) => setEditingFestival({ 
                    ...editingFestival, 
                    key_ingredients: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_fasting"
                  checked={editingFestival.is_fasting_day || false}
                  onChange={(e) => setEditingFestival({ ...editingFestival, is_fasting_day: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="is_fasting" className="text-sm text-gray-700">Is Fasting Day</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} className="bg-orange-500 hover:bg-orange-600">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Festival Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-orange-500" />
              Add New Festival
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Festival Name (English) *</label>
              <Input
                value={newFestival.name}
                onChange={(e) => setNewFestival({ ...newFestival, name: e.target.value })}
                placeholder="e.g., Ganesh Chaturthi"
                data-testid="add-festival-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Name (Marathi)</label>
                <Input
                  value={newFestival.name_mr}
                  onChange={(e) => setNewFestival({ ...newFestival, name_mr: e.target.value })}
                  placeholder="e.g., गणेश चतुर्थी"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Name (Hindi)</label>
                <Input
                  value={newFestival.name_hi}
                  onChange={(e) => setNewFestival({ ...newFestival, name_hi: e.target.value })}
                  placeholder="e.g., गणेश चतुर्थी"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Date *</label>
              <Input
                value={newFestival.date}
                onChange={(e) => setNewFestival({ ...newFestival, date: e.target.value })}
                placeholder="e.g., Sept 14 or 2026-09-14"
                data-testid="add-festival-date"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Significance</label>
              <Input
                value={newFestival.significance}
                onChange={(e) => setNewFestival({ ...newFestival, significance: e.target.value })}
                placeholder="e.g., Lord Ganesha's birthday"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Key Ingredients (comma-separated)</label>
              <Input
                value={newFestival.key_ingredients.join(', ')}
                onChange={(e) => setNewFestival({ 
                  ...newFestival, 
                  key_ingredients: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                })}
                placeholder="e.g., Rice Flour, Coconut, Jaggery"
                data-testid="add-festival-ingredients"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="add_is_fasting"
                checked={newFestival.is_fasting_day}
                onChange={(e) => setNewFestival({ ...newFestival, is_fasting_day: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="add_is_fasting" className="text-sm text-gray-700">Is Fasting Day</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAddFestival} 
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="save-new-festival-btn"
            >
              Add Festival
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFestivalManager;
