import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Upload, Calendar, Trash2, Edit, Plus, FileSpreadsheet,
  AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp,
  Download, RefreshCw, Sparkles, Copy, Check,
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
  // Ref for the hidden CSV file input. The button-inside-label pattern
  // that used to be here silently swallowed the click on shadcn's
  // Button (which renders a real <button>, breaking the label→input
  // forward). Explicit ref.click() sidesteps that entirely.
  const csvFileInputRef = useRef(null);
  // AI-prompt generator state — used by the "Generate CSV with AI" card.
  // Admin fills in year + community + optional notes, we render a copy-
  // ready prompt they paste into any LLM; the LLM's CSV output is then
  // dropped into the existing upload flow below. Keeps this app zero-
  // dependency on any specific LLM provider.
  const currentYear = new Date().getFullYear();
  const [promptYear, setPromptYear] = useState(String(currentYear + 1));
  const [promptCommunity, setPromptCommunity] = useState('Maharashtrian (Deshastha Brahmin)');
  const [promptNotes, setPromptNotes] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);

  // Fetch festivals on mount
  useEffect(() => {
    fetchFestivals();
  }, []);

  // Community presets — surfaced as a datalist so the admin can either
  // pick a common one or type a custom tradition (e.g. "Konkani GSB",
  // "Chettinad Tamil"). Kept short and skewed toward Indian communities
  // that observe distinct festival sets; extend as we onboard families
  // from other regions.
  const COMMUNITY_PRESETS = [
    'Maharashtrian (Deshastha Brahmin)',
    'Maharashtrian (CKP)',
    'Maharashtrian (Konkanastha / Chitpavan)',
    'Gujarati',
    'Punjabi (Sikh)',
    'Punjabi (Hindu)',
    'Bengali',
    'Tamil (Iyer)',
    'Tamil (Iyengar)',
    'Kannadiga (Madhwa)',
    'Malayali',
    'Telugu',
    'Marwari',
    'Kashmiri Pandit',
    'North Indian (generic)',
    'South Indian (generic)',
  ];

  // Builds the CSV-generation prompt. Keep the format section VERY
  // strict — the moment the LLM introduces a stray column or wraps its
  // output in ```csv fences, the upload endpoint chokes. The prompt
  // explicitly requires: no markdown, no fences, no commentary, exact
  // header row, ISO dates, quoted comma-containing fields.
  const generatedPrompt = useMemo(() => {
    const year = (promptYear || '').trim() || String(currentYear + 1);
    const community = (promptCommunity || '').trim() || 'Maharashtrian';
    const extra = (promptNotes || '').trim();

    const extraBlock = extra
      ? `\nADDITIONAL FAMILY-SPECIFIC ASKS\n${extra}\n`
      : '';

    return `You are helping build a Marathi-first Indian kitchen management app called Rasoi-Sync. Generate a CSV of festivals and traditional dishes for ${year}, tailored to a ${community} household. The CSV must be uploadable directly to the app — every rule below is strict.

REQUIREMENTS
1. Include every festival this community observes in ${year}. Cover:
   - Major religious festivals (Diwali, Holi, Ganesh Chaturthi, Navratri, etc.)
   - Regional / community-specific festivals unique to a ${community} household
   - Monthly observances if applicable (Sankashti Chaturthi, Ekadashi, Pradosh, etc.)
   - Fasting days (upvas / vrat)
2. Dates MUST be actual ${year} calendar dates, computed from the lunar (Panchang) calendar. Verify against a public panchang before answering. Do not guess.
3. Output ONLY a valid CSV. No prose, no markdown, no code fences, no leading blank line.

FORMAT — header row (exact columns, exact order, exact spelling):
Festival Name,Name (Marathi),Name (Hindi),Date,Significance,Key Ingredients,Recipes,Tips,Is Fasting Day,Region

RULES FOR EACH FIELD
- Festival Name: English in Roman script. Example: Ganesh Chaturthi
- Name (Marathi): Devanagari. Example: गणेश चतुर्थी
- Name (Hindi): Devanagari. Example: गणेश चतुर्थी
- Date: ISO ${year}-MM-DD. Example: ${year}-08-27
- Significance: One line, plain text. NEVER a comma — use "; " instead.
- Key Ingredients: Comma-separated ingredients in English, wrapped in DOUBLE QUOTES. Example: "Rice flour, Coconut, Jaggery, Cardamom, Ghee"
- Recipes: Pipe-separated (|) recipe names in English. Example: Ukdiche Modak|Fried Modak|Modak Payasam
- Tips: One sentence of practical, grandmother-style advice. NEVER a comma.
- Is Fasting Day: exactly "Yes" or "No"
- Region: "${community}"

QUALITY BAR
- Recipe names must be dishes a ${community} family ACTUALLY cooks for that festival, not generic Indian dishes.
- Ingredients must be things a household would buy or stock (skip water, salt, oil unless the festival needs a specific type).
- Tips must be practical (soaking, resting, prep-ahead, shortcut) — not generic wisdom.

Sort festivals by date ascending. Start with the header row, then one festival per row, no blank rows between.${extraBlock}`;
  }, [promptYear, promptCommunity, promptNotes, currentYear]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setPromptCopied(true);
      toast.success('Prompt copied — paste it into ChatGPT / Claude / Gemini');
      setTimeout(() => setPromptCopied(false), 2500);
    } catch (err) {
      // Older Safari / non-HTTPS contexts drop clipboard access —
      // manual copy still works from the textarea below.
      toast.error('Copy failed — select the text and copy manually');
    }
  };

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
Ganesh Chaturthi,गणेश चतुर्थी,गणेश चतुर्थी,Sept 14,The Big One,"Modak Peeth (Rice Flour), Fresh Coconut, Gul, Cardamom",Ukdiche Modak|Fried Modak,Steam modaks for 15 mins on medium heat,No,Maharashtra
Gauri Pujan,गौरी पूजन,गौरी पूजन,Sept 16,Arrival of Goddess Gauri; specialized feast,"Mixed Veg, Ambemohar Rice, Dal	Gaurichi Bhaji, Puran Poli",Use 5 types of seasonal vegetables,No,Maharashtra
Dussehra,दसरा,दशहरा,Oct 21,Victory of good over evil; Aapta leaves,"Besan, Sugar, Ghee, Jalebi, Fafda, Basundi",Buy Apta leaves early as they sell out fast,No,Maharashtra
Diwali,दिवाळी,दिवाली,Nov 8,Festival of lights; Faral (snacks),"Besan, Poha, Rava, Maida, Ghee	Chivda, Chakli, Ladoo, Karanji",Make sweets that last longer first,No,Maharashtra
`;

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

        {/* AI Prompt Generator — the recommended path for building next
            year's calendar. Admin fills year + community + optional
            notes, we render a strict prompt, they paste it into any
            LLM, save the output as .csv, and drop it into the Upload
            Section below. Zero LLM-vendor lock-in for the app. */}
        <Card className="mb-6 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-sm flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-800">
                  Generate CSV with AI
                  <Badge className="ml-2 bg-purple-100 text-purple-700 border-purple-200 text-[10px] align-middle">
                    Recommended
                  </Badge>
                </h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  Fill in year + community, copy the prompt, paste it into ChatGPT / Claude / Gemini,
                  save the output as <code className="bg-gray-100 px-1 rounded text-xs">festivals.csv</code>,
                  then drop it into the upload section below.
                </p>
              </div>
            </div>

            {/* Inputs — kept in a single row on desktop, stacked on mobile. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Year</label>
                <Input
                  type="number"
                  min={currentYear}
                  max={currentYear + 5}
                  value={promptYear}
                  onChange={(e) => setPromptYear(e.target.value)}
                  placeholder={String(currentYear + 1)}
                  data-testid="prompt-year"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Community / tradition
                </label>
                <Input
                  list="community-presets"
                  value={promptCommunity}
                  onChange={(e) => setPromptCommunity(e.target.value)}
                  placeholder="e.g. Maharashtrian (Deshastha Brahmin)"
                  data-testid="prompt-community"
                />
                <datalist id="community-presets">
                  {COMMUNITY_PRESETS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Family-specific asks (optional)
              </label>
              <textarea
                value={promptNotes}
                onChange={(e) => setPromptNotes(e.target.value)}
                placeholder="e.g. Emphasize Ashadhi Ekadashi. Skip Karva Chauth. Add a Sunday-brunch column for our monthly get-togethers."
                rows={2}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                data-testid="prompt-notes"
              />
            </div>

            {/* Prompt preview + copy. The textarea is editable so an
                admin who wants to hand-tweak (e.g. change a bullet)
                can do it in-place before copying — no export flow
                needed. */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
                <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  Prompt preview
                </span>
                <Button
                  onClick={handleCopyPrompt}
                  size="sm"
                  className={`h-8 text-xs gap-1.5 ${
                    promptCopied
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                  data-testid="copy-prompt-btn"
                >
                  {promptCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy prompt
                    </>
                  )}
                </Button>
              </div>
              <textarea
                value={generatedPrompt}
                onChange={(e) => {
                  // Editing the preview breaks the round-trip from the
                  // form inputs, so we mirror the edit into the notes
                  // field would be too clever. Instead, treat manual
                  // edits as ephemeral — user copies whatever's here
                  // and the next form-field change regenerates.
                  // This lets a power user tweak a line without
                  // re-typing the whole prompt.
                }}
                readOnly
                rows={10}
                className="w-full px-3 py-2 text-[11px] font-mono text-gray-800 bg-white resize-none focus:outline-none leading-relaxed"
                data-testid="prompt-preview"
              />
            </div>

            <p className="mt-3 text-xs text-gray-500 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>
                LLMs occasionally miss a lunar-date shift. Skim the CSV before uploading — especially
                Diwali, Ganesh Chaturthi, and any regional New Year — and cross-check against a
                published panchang.
              </span>
            </p>
          </CardContent>
        </Card>

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
                  {/* Hidden file input triggered explicitly via ref.
                      The previous <label><Button as="span">Upload</Button></label>
                      pattern was broken: shadcn's Button always renders
                      a real <button>, which consumes clicks and blocks
                      the label→input forward, so nothing ever happened.
                      as="span" is Chakra syntax and gets silently dropped
                      by shadcn — no runtime warning, just a dead button. */}
                  <input
                    ref={csvFileInputRef}
                    type="file"
                    accept=".csv,.CSV,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                    data-testid="csv-upload-input"
                  />
                  <Button
                    type="button"
                    onClick={() => csvFileInputRef.current?.click()}
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
