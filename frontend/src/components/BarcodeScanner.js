import { useState, useRef, useEffect, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, Loader2, CheckCircle, AlertCircle, Calendar, Package, RotateCcw, Scan, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = ['grains', 'spices', 'vegetables', 'fruits', 'dairy', 'pulses', 'oils', 'snacks', 'bakery', 'beverages', 'other'];

export const BarcodeScanner = ({ isOpen, onClose, onItemScanned }) => {
  // Scan modes: 'choose' | 'barcode' | 'photo_name' | 'photo_expiry' | 'confirm'
  const [scanMode, setScanMode] = useState('choose');
  const [scanning, setScanning] = useState(false);
  const [productData, setProductData] = useState({
    name_en: '',
    category: 'other',
    barcode: ''
  });
  const [expiryDate, setExpiryDate] = useState('');
  const [error, setError] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);
  const processedRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (codeReaderRef.current) {
      codeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setScanMode('choose');
    setProductData({ name_en: '', category: 'other', barcode: '' });
    setExpiryDate('');
    setError(null);
    setOcrProgress(0);
    setScanning(false);
    setCapturedImage(null);
    setIsProcessing(false);
    processedRef.current = false;
  }, []);

  // Stop camera when dialog closes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen, stopCamera]);
  
  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  // Start camera for photo capture
  const startCamera = async () => {
    setScanning(true);
    setError(null);
    setCapturedImage(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please ensure camera permissions are granted.');
      setScanning(false);
    }
  };

  // Capture photo from video
  const capturePhoto = () => {
    if (!videoRef.current) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    stopCamera();
    setScanning(false);
    
    return canvas;
  };

  // AI-powered OCR to read product name
  const readProductName = async () => {
    const canvas = capturePhoto();
    if (!canvas) return;
    
    setIsProcessing(true);
    setOcrProgress(30);
    setError(null);
    
    try {
      // Get base64 from canvas
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      setOcrProgress(50);
      
      // Call AI OCR endpoint
      const response = await fetch(`${API}/api/ocr/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          ocr_type: 'product_name'
        })
      });
      
      setOcrProgress(80);
      
      const data = await response.json();
      console.log('AI OCR Product Name:', data);
      
      setOcrProgress(100);
      
      if (data.success && data.result) {
        setProductData(prev => ({ ...prev, name_en: data.result }));
        setScanMode('photo_expiry');
      } else {
        setError(data.message || 'Could not read product name. Please enter manually or try again.');
        setScanMode('photo_expiry');
      }
      
    } catch (err) {
      console.error('OCR error:', err);
      setError('Failed to read text. Please enter product name manually.');
      setScanMode('photo_expiry');
    } finally {
      setIsProcessing(false);
    }
  };

  // AI-powered OCR to read expiry date
  const readExpiryDate = async () => {
    const canvas = capturePhoto();
    if (!canvas) return;
    
    setIsProcessing(true);
    setOcrProgress(30);
    setError(null);
    
    try {
      // Get base64 from canvas
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      setOcrProgress(50);
      
      // Call AI OCR endpoint
      const response = await fetch(`${API}/api/ocr/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          ocr_type: 'expiry_date'
        })
      });
      
      setOcrProgress(80);
      
      const data = await response.json();
      console.log('AI OCR Expiry Date:', data);
      
      setOcrProgress(100);
      
      if (data.success && data.result) {
        setExpiryDate(data.result);
        setError(null);
      } else {
        setError(data.message || 'Could not detect expiry date. Please enter manually.');
      }
      
      setScanMode('confirm');
      
    } catch (err) {
      console.error('OCR error:', err);
      setError('Failed to read expiry date. Please enter manually.');
      setScanMode('confirm');
    } finally {
      setIsProcessing(false);
    }
  };

 

  // Barcode scanning mode
  const startBarcodeScanner = async () => {
    setScanning(true);
    setError(null);
    setIsProcessing(false);
    processedRef.current = false;
    
    try {
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      codeReader.decodeFromVideoDevice(undefined, videoRef.current, async (result, err) => {
        if (processedRef.current || isProcessing) return;
        
        if (result) {
          const barcode = result.getText();
          console.log('Barcode detected:', barcode);
          
          processedRef.current = true;
          setIsProcessing(true);
          stopCamera();
          setScanning(false);
          
          await lookupProduct(barcode);
        }
      });
      
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please ensure camera permissions are granted.');
      setScanning(false);
    }
  };

  const lookupProduct = async (barcode) => {
    try {
      setError(null);
      const response = await fetch(`${API}/api/barcode/${barcode}`);
      const data = await response.json();
      
      if (data.found) {
        setProductData({
          barcode: barcode,
          name_en: data.name || `Product ${barcode}`,
          category: mapCategory(data.category)
        });
        setScanMode('photo_expiry');
      } else {
        setProductData({
          barcode: barcode,
          name_en: '',
          category: 'other'
        });
        setScanMode('photo_expiry');
        setError('Product not found in database. Please enter name manually.');
      }
    } catch (err) {
      console.error('Lookup error:', err);
      setProductData({
        barcode: barcode,
        name_en: '',
        category: 'other'
      });
      setScanMode('photo_expiry');
      setError('Could not lookup product. Please enter details manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  const mapCategory = (categoryStr) => {
    const categoryLower = (categoryStr || '').toLowerCase();
    if (categoryLower.includes('grain') || categoryLower.includes('rice') || categoryLower.includes('flour')) return 'grains';
    if (categoryLower.includes('pulse') || categoryLower.includes('dal') || categoryLower.includes('lentil')) return 'pulses';
    if (categoryLower.includes('spice') || categoryLower.includes('masala')) return 'spices';
    if (categoryLower.includes('vegetable')) return 'vegetables';
    if (categoryLower.includes('fruit')) return 'fruits';
    if (categoryLower.includes('dairy') || categoryLower.includes('milk')) return 'dairy';
    if (categoryLower.includes('oil')) return 'oils';
    if (categoryLower.includes('bakery') || categoryLower.includes('bread')) return 'bakery';
    if (categoryLower.includes('snack')) return 'snacks';
    if (categoryLower.includes('beverage') || categoryLower.includes('tea') || categoryLower.includes('coffee')) return 'beverages';
    return 'other';
  };

  const handleConfirm = () => {
    if (!productData.name_en) return;
    
    onItemScanned({
      name_en: productData.name_en,
      category: productData.category,
      stock_level: 'full',
      unit: 'pcs',
      barcode: productData.barcode || null,
      expiry_date: expiryDate || null
    });
    
    onClose();
  };

  const skipToConfirm = () => {
    stopCamera();
    setScanning(false);
    setCapturedImage(null);
    setScanMode('confirm');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="barcode-scanner-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-6 h-6 text-[#FF9933]" />
            {scanMode === 'choose' && 'Scan Item'}
            {scanMode === 'barcode' && 'Scan Barcode'}
            {scanMode === 'photo_name' && 'Photo: Product Name'}
            {scanMode === 'photo_expiry' && 'Photo: Expiry Date'}
            {scanMode === 'confirm' && 'Confirm Details'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">{error}</p>
            </div>
          )}

          {/* Choose Scan Method */}
          {scanMode === 'choose' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-center">How would you like to add this item?</p>
              
              <div className="grid grid-cols-1 gap-3">
                {/* Photo Method - Primary */}
                <Button
                  onClick={() => {
                    setScanMode('photo_name');
                    startCamera();
                  }}
                  className="h-auto py-4 bg-[#FF9933] hover:bg-[#E68A2E] text-white"
                  data-testid="choose-photo-method"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold flex items-center gap-2">
                        📸 Take Photos
                        <span className="text-xs bg-white/30 px-2 py-0.5 rounded-full">AI Powered</span>
                      </p>
                      <p className="text-xs opacity-90">Photo of name + Photo of expiry date</p>
                    </div>
                  </div>
                </Button>
                
                {/* Barcode Method - Secondary */}
                <Button
                  onClick={() => {
                    setScanMode('barcode');
                    startBarcodeScanner();
                  }}
                  variant="outline"
                  className="h-auto py-4"
                  data-testid="choose-barcode-method"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <Scan className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-800">Scan Barcode</p>
                      <p className="text-xs text-gray-500">Lookup product by barcode</p>
                    </div>
                  </div>
                </Button>
                
                {/* Manual Entry */}
                <Button
                  onClick={() => setScanMode('confirm')}
                  variant="ghost"
                  className="text-gray-600"
                  data-testid="choose-manual-method"
                >
                  Enter Manually
                </Button>
              </div>
            </div>
          )}

          {/* Barcode Scanning */}
          {scanMode === 'barcode' && (
            <div className="space-y-4">
              {isProcessing ? (
                <div className="text-center py-8">
                  <Loader2 className="w-16 h-16 text-[#FF9933] mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Looking up product...</p>
                </div>
              ) : scanning ? (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-lg bg-black"
                    style={{ minHeight: '280px' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-32 border-2 border-[#FF9933] rounded-lg relative">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#FF9933]" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#FF9933]" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#FF9933]" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#FF9933]" />
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 animate-pulse" />
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-600 mt-2">Position barcode within frame</p>
                  <Button
                    onClick={() => {
                      stopCamera();
                      setScanMode('choose');
                    }}
                    variant="outline"
                    className="w-full mt-3"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Scan className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <Button onClick={startBarcodeScanner} className="bg-[#FF9933] hover:bg-[#E68A2E] text-white">
                    Start Scanning
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Photo: Product Name */}
          {scanMode === 'photo_name' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700 font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Step 1 of 2: Product Name
                </p>
                <p className="text-xs text-blue-600 mt-1">AI will read the product name from your photo</p>
              </div>
              
              {isProcessing ? (
                <div className="text-center py-8">
                  <Loader2 className="w-16 h-16 text-[#FF9933] mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Reading text... {ocrProgress}%</p>
                  <div className="w-48 h-2 bg-gray-200 rounded-full mx-auto mt-2">
                    <div 
                      className="h-full bg-[#FF9933] rounded-full transition-all"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                </div>
              ) : capturedImage ? (
                <div className="space-y-3">
                  <img src={capturedImage} alt="Captured" className="w-full rounded-lg" />
                  <div className="flex gap-2">
                    <Button onClick={() => { setCapturedImage(null); startCamera(); }} variant="outline" className="flex-1">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Retake
                    </Button>
                    <Button onClick={readProductName} className="flex-1 bg-[#77DD77] hover:bg-[#66CC66] text-gray-900">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Read Text
                    </Button>
                  </div>
                </div>
              ) : scanning ? (
                <div className="relative">
                  {/* Camera View - Full height for mobile */}
                  <div className="relative rounded-xl overflow-hidden bg-black" style={{ height: '50vh', minHeight: '300px' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Overlay guide */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-4/5 h-24 border-2 border-dashed border-[#FF9933] rounded-xl flex items-center justify-center bg-black/10">
                        <Package className="w-10 h-10 text-[#FF9933] opacity-70" />
                      </div>
                    </div>
                    {/* Hint text at top */}
                    <div className="absolute top-3 left-0 right-0 text-center">
                      <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                        Point at the product name
                      </span>
                    </div>
                  </div>
                  
                  {/* Bottom Controls - Fixed at bottom of camera */}
                  <div className="flex gap-3 mt-4">
                    <Button
                      onClick={() => {
                        stopCamera();
                        setScanMode('choose');
                      }}
                      variant="outline"
                      className="flex-1 h-14 text-base"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={capturePhoto}
                      className="flex-[2] h-14 text-base bg-[#FF9933] hover:bg-[#E68A2E] text-white font-bold"
                      data-testid="capture-name-photo"
                    >
                      <Camera className="w-6 h-6 mr-2" />
                      Capture
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <Button onClick={startCamera} className="bg-[#FF9933] hover:bg-[#E68A2E] text-white">
                    Open Camera
                  </Button>
                </div>
              )}
              
              <Button onClick={skipToConfirm} variant="ghost" className="w-full text-gray-500">
                Skip & Enter Manually
              </Button>
            </div>
          )}

          {/* Photo: Expiry Date */}
          {scanMode === 'photo_expiry' && (
            <div className="space-y-4">
              {productData.name_en && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <p className="text-sm text-green-700 font-medium">{productData.name_en}</p>
                  </div>
                </div>
              )}
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700 font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Step 2 of 2: Expiry Date
                </p>
                <p className="text-xs text-blue-600 mt-1">AI will read the expiry/best-before date</p>
              </div>
              
              {isProcessing ? (
                <div className="text-center py-8">
                  <Loader2 className="w-16 h-16 text-[#FF9933] mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Reading date... {ocrProgress}%</p>
                  <div className="w-48 h-2 bg-gray-200 rounded-full mx-auto mt-2">
                    <div 
                      className="h-full bg-[#FF9933] rounded-full transition-all"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                </div>
              ) : capturedImage ? (
                <div className="space-y-3">
                  <img src={capturedImage} alt="Captured" className="w-full rounded-lg" />
                  <div className="flex gap-2">
                    <Button onClick={() => { setCapturedImage(null); startCamera(); }} variant="outline" className="flex-1">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Retake
                    </Button>
                    <Button onClick={readExpiryDate} className="flex-1 bg-[#77DD77] hover:bg-[#66CC66] text-gray-900">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Read Date
                    </Button>
                  </div>
                </div>
              ) : scanning ? (
                <div className="relative">
                  {/* Camera View - Full height for mobile */}
                  <div className="relative rounded-xl overflow-hidden bg-black" style={{ height: '50vh', minHeight: '300px' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Overlay guide */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-4/5 h-20 border-2 border-dashed border-[#77DD77] rounded-xl flex items-center justify-center bg-black/10">
                        <Calendar className="w-10 h-10 text-[#77DD77] opacity-70" />
                      </div>
                    </div>
                    {/* Hint text at top */}
                    <div className="absolute top-3 left-0 right-0 text-center">
                      <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                        Point at the expiry/best-before date
                      </span>
                    </div>
                  </div>
                  
                  {/* Bottom Controls */}
                  <div className="flex gap-3 mt-4">
                    <Button
                      onClick={skipToConfirm}
                      variant="outline"
                      className="flex-1 h-14 text-base"
                    >
                      Skip
                    </Button>
                    <Button
                      onClick={capturePhoto}
                      className="flex-[2] h-14 text-base bg-[#77DD77] hover:bg-[#66CC66] text-gray-900 font-bold"
                      data-testid="capture-expiry-photo"
                    >
                      <Camera className="w-6 h-6 mr-2" />
                      Capture
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <div className="flex gap-3 justify-center">
                    <Button onClick={startCamera} className="bg-[#77DD77] hover:bg-[#66CC66] text-gray-900">
                      <Camera className="w-5 h-5 mr-2" />
                      Scan Expiry Date
                    </Button>
                    <Button onClick={skipToConfirm} variant="outline">
                      Skip
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confirmation */}
          {scanMode === 'confirm' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label>Product Name *</Label>
                  <Input
                    value={productData.name_en}
                    onChange={(e) => setProductData({ ...productData, name_en: e.target.value })}
                    placeholder="Enter product name"
                    data-testid="product-name-input"
                  />
                </div>
                
                <div>
                  <Label>Category</Label>
                  <Select 
                    value={productData.category} 
                    onValueChange={(val) => setProductData({ ...productData, category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Expiry Date</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    data-testid="expiry-date-input"
                  />
                </div>
                
                {productData.barcode && (
                  <div>
                    <Label>Barcode</Label>
                    <Input value={productData.barcode} disabled className="bg-gray-100" />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={resetState} className="flex-1">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Start Over
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!productData.name_en.trim()}
                  className="flex-1 bg-[#77DD77] hover:bg-[#66CC66] text-gray-900"
                  data-testid="confirm-add-item"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Add to Inventory
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
