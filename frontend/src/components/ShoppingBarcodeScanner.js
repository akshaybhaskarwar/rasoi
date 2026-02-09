import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Loader2, CheckCircle, AlertCircle, Calendar, Package, RotateCcw, Scan, Sparkles, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = ['grains', 'spices', 'vegetables', 'fruits', 'dairy', 'pulses', 'oils', 'snacks', 'bakery', 'beverages', 'household', 'other'];

// Category to unit type mapping (replicated from ShoppingPage.js)
const CATEGORY_UNITS = {
  // Solid items - weight based
  'grains': { type: 'weight', options: ['100 g', '250 g', '500 g', '1 kg', '2 kg', '5 kg', '10 kg'], default: '1 kg' },
  'pulses': { type: 'weight', options: ['250 g', '500 g', '1 kg', '2 kg', '5 kg'], default: '1 kg' },
  'spices': { type: 'weight', options: ['25 g', '50 g', '100 g', '200 g', '250 g', '500 g'], default: '100 g' },
  'vegetables': { type: 'weight', options: ['250 g', '500 g', '1 kg', '2 kg'], default: '500 g' },
  'fruits': { type: 'weight', options: ['250 g', '500 g', '1 kg', '2 kg'], default: '1 kg' },
  'snacks': { type: 'weight', options: ['100 g', '200 g', '250 g', '500 g', '1 kg'], default: '250 g' },
  'fasting': { type: 'weight', options: ['100 g', '250 g', '500 g', '1 kg'], default: '250 g' },
  // Liquid items - volume based  
  'dairy': { type: 'volume', options: ['250 ml', '500 ml', '1 L', '2 L', '5 L'], default: '1 L' },
  'oils': { type: 'volume', options: ['200 ml', '500 ml', '1 L', '2 L', '5 L'], default: '1 L' },
  'beverages': { type: 'volume', options: ['250 ml', '500 ml', '1 L', '2 L'], default: '1 L' },
  // Count-based items
  'bakery': { type: 'count', options: ['1 pack', '2 packs', '3 packs', '6 packs', '1 dozen'], default: '1 pack' },
  'household': { type: 'count', options: ['1 unit', '2 units', '1 pack', '2 packs', '1 box'], default: '1 unit' },
  'other': { type: 'weight', options: ['100 g', '250 g', '500 g', '1 kg', '2 kg'], default: '500 g' }
};

// Get quantity options based on category
const getQuantityOptions = (category) => {
  const config = CATEGORY_UNITS[category] || CATEGORY_UNITS['other'];
  return config.options;
};

// Get default quantity based on category
const getDefaultQuantity = (category) => {
  const config = CATEGORY_UNITS[category] || CATEGORY_UNITS['other'];
  return config.default;
};

export const ShoppingBarcodeScanner = ({ isOpen, onClose, onItemScanned }) => {
  // Scan modes: 'choose' | 'barcode' | 'photo_name' | 'photo_expiry' | 'confirm'
  const [scanMode, setScanMode] = useState('choose');
  const [scanning, setScanning] = useState(false);
  const [productData, setProductData] = useState({
    name_en: '',
    category: 'other',
    barcode: '',
    monthly_quantity: '500 g'
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
    setProductData({ name_en: '', category: 'other', barcode: '', monthly_quantity: '500 g' });
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
    if (!capturedImage) {
      setError('No image captured. Please take a photo first.');
      return;
    }
    
    setIsProcessing(true);
    setOcrProgress(30);
    setError(null);
    
    try {
      const imageBase64 = capturedImage.split(',')[1];
      
      setOcrProgress(50);
      
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
        const suggestedCat = data.suggested_category || productData.category;
        setProductData(prev => ({ 
          ...prev, 
          name_en: data.result,
          category: suggestedCat,
          monthly_quantity: getDefaultQuantity(suggestedCat)
        }));
        setCapturedImage(null);
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
    if (!capturedImage) {
      setError('No image captured. Please take a photo first.');
      return;
    }
    
    setIsProcessing(true);
    setOcrProgress(30);
    setError(null);
    
    try {
      const imageBase64 = capturedImage.split(',')[1];
      
      setOcrProgress(50);
      
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
      
      setCapturedImage(null);
      setScanMode('confirm');
      
    } catch (err) {
      console.error('OCR error:', err);
      setError('Failed to read expiry date. Please enter manually.');
      setScanMode('confirm');
    } finally {
      setIsProcessing(false);
    }
  };

  // Barcode scanning mode - lazy load @zxing/browser
  const startBarcodeScanner = async () => {
    setScanning(true);
    setError(null);
    setIsProcessing(false);
    processedRef.current = false;
    
    try {
      // Dynamic import - only loads when user clicks "Scan Barcode"
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
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
        const cat = mapCategory(data.category);
        setProductData({
          barcode: barcode,
          name_en: data.name || `Product ${barcode}`,
          category: cat,
          monthly_quantity: getDefaultQuantity(cat)
        });
        setScanMode('photo_expiry');
      } else {
        setProductData({
          barcode: barcode,
          name_en: '',
          category: 'other',
          monthly_quantity: getDefaultQuantity('other')
        });
        setScanMode('photo_expiry');
        setError('Product not found in database. Please enter name manually.');
      }
    } catch (err) {
      console.error('Lookup error:', err);
      setProductData({
        barcode: barcode,
        name_en: '',
        category: 'other',
        monthly_quantity: getDefaultQuantity('other')
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
      barcode: productData.barcode || null,
      expiry_date: expiryDate || null,
      monthly_quantity: productData.monthly_quantity || getDefaultQuantity(productData.category)
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
      <DialogContent 
        className="max-w-lg sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6" 
        data-testid="shopping-scanner-dialog"
      >
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="w-5 h-5 text-orange-500" />
            {scanMode === 'choose' && 'Scan Item for Shopping List'}
            {scanMode === 'barcode' && 'Scan Barcode'}
            {scanMode === 'photo_name' && 'Step 1: Product Name'}
            {scanMode === 'photo_expiry' && 'Step 2: Expiry Date (Optional)'}
            {scanMode === 'confirm' && 'Confirm Details'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
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
              <p className="text-gray-600 text-center">How would you like to scan this item?</p>
              
              <div className="grid grid-cols-1 gap-3">
                {/* Photo Method - Primary */}
                <Button
                  onClick={() => {
                    setScanMode('photo_name');
                    startCamera();
                  }}
                  className="h-auto py-4 bg-orange-500 hover:bg-orange-600 text-white"
                  data-testid="choose-photo-method"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold flex items-center gap-2 w-full">
                        Take Photos
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
                  <div className="flex items-center gap-3 w-full">
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
                  variant="outline"
                  className="h-auto py-4"
                  data-testid="choose-manual-method"
                >
                  <div className="flex items-center gap-3 w-full">
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <PenLine className="w-6 h-6 text-gray-600" />
                          </div>
                          <div className="text-left flex-1">
                            <p className="font-bold text-gray-800">Enter Manually</p>
                            <p className="text-xs text-gray-500">Type item name and select category</p>
                          </div>
                    </div>
                </Button>
              </div>
            </div>
          )}

          {/* Barcode Scanning */}
          {scanMode === 'barcode' && (
            <div className="space-y-4">
              {isProcessing ? (
                <div className="text-center py-8">
                  <Loader2 className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Looking up product...</p>
                </div>
              ) : scanning ? (
                <div className="relative">
                  <div className="relative rounded-xl overflow-hidden bg-black" style={{ height: '40vh', minHeight: '250px', maxHeight: '350px' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-72 h-36 border-2 border-orange-500 rounded-xl relative bg-black/10">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-orange-500 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-orange-500 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-orange-500 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-orange-500 rounded-br-lg" />
                        <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500 animate-pulse" />
                      </div>
                    </div>
                    <div className="absolute top-3 left-0 right-0 text-center">
                      <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                        Position barcode within frame
                      </span>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => {
                      stopCamera();
                      setScanMode('choose');
                    }}
                    variant="outline"
                    className="w-full h-12 text-base mt-4"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Scan className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <Button onClick={startBarcodeScanner} className="bg-orange-500 hover:bg-orange-600 text-white h-12 px-8">
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
                  <Loader2 className="w-16 h-6 text-orange-500 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Reading text... {ocrProgress}%</p>
                  <div className="w-48 h-2 bg-gray-200 rounded-full mx-auto mt-2">
                    <div 
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                </div>
              ) : capturedImage ? (
                <div className="space-y-3">
                  <img src={capturedImage} alt="Captured" className="w-full max-h-[40vh] object-cover rounded-lg" />
                  <div className="flex gap-2">
                    <Button onClick={() => { setCapturedImage(null); startCamera(); }} variant="outline" className="flex-1">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Retake
                    </Button>
                    <Button onClick={readProductName} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Read Text
                    </Button>
                  </div>
                </div>
              ) : scanning ? (
                <div className="relative">
                  <div className="relative rounded-xl overflow-hidden bg-black" style={{ height: '40vh', minHeight: '250px', maxHeight: '350px' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-4/5 h-24 border-2 border-dashed border-orange-500 rounded-xl flex items-center justify-center bg-black/10">
                        <Package className="w-10 h-10 text-orange-500 opacity-70" />
                      </div>
                    </div>
                    <div className="absolute top-3 left-0 right-0 text-center">
                      <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                        Point at the product name
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-4">
                    <Button
                      onClick={() => {
                        stopCamera();
                        setScanMode('choose');
                      }}
                      variant="outline"
                      className="flex-1 h-12 text-base"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={capturePhoto}
                      className="flex-[2] h-12 text-base bg-orange-500 hover:bg-orange-600 text-white font-bold"
                      data-testid="capture-name-photo"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Capture
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Camera className="w-10 h-10 text-orange-500" />
                  </div>
                  <p className="text-gray-600 text-sm mb-4">Take a photo of the product name on the package</p>
                  <Button onClick={startCamera} className="w-full h-8 bg-orange-500 hover:bg-orange-600 text-white text-base font-bold">
                    <Camera className="w-6 h-6 mr-2" />
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
                  Step 2 of 2: Expiry Date (Optional)
                </p>
                <p className="text-xs text-blue-600 mt-1">AI will read the expiry/best-before date</p>
              </div>
              
              {isProcessing ? (
                <div className="text-center py-8">
                  <Loader2 className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Reading date... {ocrProgress}%</p>
                  <div className="w-48 h-2 bg-gray-200 rounded-full mx-auto mt-2">
                    <div 
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                </div>
              ) : capturedImage ? (
                <div className="space-y-3">
                  <img src={capturedImage} alt="Captured" className="w-full max-h-[40vh] object-cover rounded-lg" />
                  <div className="flex gap-2">
                    <Button onClick={() => { setCapturedImage(null); startCamera(); }} variant="outline" className="flex-1">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Retake
                    </Button>
                    <Button onClick={readExpiryDate} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Read Date
                    </Button>
                  </div>
                </div>
              ) : scanning ? (
                <div className="relative">
                  <div className="relative rounded-xl overflow-hidden bg-black" style={{ height: '40vh', minHeight: '250px', maxHeight: '350px' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-4/5 h-20 border-2 border-dashed border-green-500 rounded-xl flex items-center justify-center bg-black/10">
                        <Calendar className="w-10 h-10 text-green-500 opacity-70" />
                      </div>
                    </div>
                    <div className="absolute top-3 left-0 right-0 text-center">
                      <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                        Point at the expiry/best-before date
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-4">
                    <Button
                      onClick={skipToConfirm}
                      variant="outline"
                      className="flex-1 h-12 text-base"
                    >
                      Skip
                    </Button>
                    <Button
                      onClick={capturePhoto}
                      className="flex-[2] h-12 text-base bg-green-600 hover:bg-green-700 text-white font-bold"
                      data-testid="capture-expiry-photo"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Capture
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-10 h-10 text-green-600" />
                  </div>
                  <p className="text-gray-600 text-sm mb-4">Take a photo of the expiry/best-before date</p>
                  <div className="flex gap-3">
                    <Button onClick={skipToConfirm} variant="outline" className="flex-1 h-14 text-base">
                      Skip
                    </Button>
                    <Button onClick={startCamera} className="flex-[2] h-14 bg-green-600 hover:bg-green-700 text-white text-base font-bold">
                      <Camera className="w-6 h-6 mr-2" />
                      Open Camera
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
                    onValueChange={(val) => setProductData({ 
                      ...productData, 
                      category: val,
                      monthly_quantity: getDefaultQuantity(val)
                    })}
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
                
                {/* Quantity Options - Category-wise */}
                <div>
                  <Label>Quantity</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {getQuantityOptions(productData.category).map(qty => (
                      <Button
                        key={qty}
                        type="button"
                        variant={productData.monthly_quantity === qty ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setProductData({ ...productData, monthly_quantity: qty })}
                        className="text-xs"
                      >
                        {qty}
                      </Button>
                    ))}
                  </div>
                  <Input
                    value={productData.monthly_quantity}
                    onChange={(e) => setProductData({ ...productData, monthly_quantity: e.target.value })}
                    placeholder="Or type custom quantity"
                    className="mt-2"
                    data-testid="quantity-input"
                  />
                </div>
                
                <div>
                  <Label>Expiry Date (Optional)</Label>
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
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  data-testid="confirm-add-item"
                >
                  <ShoppingBag className="w-5 h-5 mr-2" />
                  Add to Shopping List
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
