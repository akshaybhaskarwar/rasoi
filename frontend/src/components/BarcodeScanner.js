import { useState, useRef, useEffect, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { createWorker } from 'tesseract.js';
import { Camera, Loader2, CheckCircle, AlertCircle, Calendar, Package, RotateCcw, Scan } from 'lucide-react';
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

  // OCR to read product name
  const readProductName = async () => {
    const canvas = capturePhoto();
    if (!canvas) return;
    
    setIsProcessing(true);
    setOcrProgress(10);
    setError(null);
    
    try {
      // Apply image preprocessing for better OCR
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Convert to grayscale and increase contrast
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Increase contrast
        const contrast = 1.5;
        const adjusted = ((gray - 128) * contrast) + 128;
        const final = Math.max(0, Math.min(255, adjusted));
        data[i] = data[i + 1] = data[i + 2] = final;
      }
      ctx.putImageData(imageData, 0, 0);
      
      setOcrProgress(20);
      
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(20 + Math.round(m.progress * 70));
          }
        }
      });
      
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();
      
      setOcrProgress(100);
      console.log('OCR Text (Product):', text);
      
      // Clean up the text - look for product name patterns
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 2);
      
      // Try to find product name - look for common patterns
      let productName = '';
      
      // Look for ingredient line (common on Indian products)
      const ingredientLine = lines.find(line => 
        /ingredient|contains|product|item/i.test(line)
      );
      if (ingredientLine) {
        const match = ingredientLine.match(/(?:ingredient|contains|product)[:\s]*(.+)/i);
        if (match) productName = match[1].trim();
      }
      
      // If not found, look for lines with common food words
      if (!productName) {
        const foodKeywords = ['seeds', 'powder', 'masala', 'flour', 'rice', 'dal', 'oil', 'salt', 'sugar', 'spice', 'ajwain', 'jeera', 'cumin', 'turmeric', 'chili', 'coriander'];
        const foodLine = lines.find(line => 
          foodKeywords.some(kw => line.toLowerCase().includes(kw))
        );
        if (foodLine) productName = foodLine;
      }
      
      // If still not found, use first meaningful line (skip very short or numeric lines)
      if (!productName) {
        productName = lines.find(line => 
          line.length > 3 && 
          !/^\d+$/.test(line) && 
          !/^[^a-zA-Z]+$/.test(line)
        ) || '';
      }
      
      // Clean up the product name
      productName = productName
        .replace(/[^\w\s\-()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (productName) {
        setProductData(prev => ({ ...prev, name_en: productName }));
        setScanMode('photo_expiry');
      } else {
        setError('Could not read product name clearly. Please enter manually or try again with better lighting.');
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

  // OCR to read expiry date
  const readExpiryDate = async () => {
    const canvas = capturePhoto();
    if (!canvas) return;
    
    setIsProcessing(true);
    setOcrProgress(10);
    setError(null);
    
    try {
      // Apply image preprocessing for better OCR
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Convert to grayscale and increase contrast for date stamps
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Higher contrast for date stamps which are often printed/stamped
        const contrast = 1.8;
        const adjusted = ((gray - 128) * contrast) + 128;
        const final = Math.max(0, Math.min(255, adjusted));
        data[i] = data[i + 1] = data[i + 2] = final;
      }
      ctx.putImageData(imageData, 0, 0);
      
      setOcrProgress(20);
      
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(20 + Math.round(m.progress * 70));
          }
        }
      });
      
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();
      
      setOcrProgress(100);
      console.log('OCR Text (Expiry):', text);
      
      // More comprehensive date patterns
      const datePatterns = [
        // DD-MMM-YY or DD MMM YY (like "12 OCT 26", "12-OCT-26")
        /(\d{1,2})[\s\-\.\/]*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[\s\-\.\/]*(\d{2,4})/gi,
        // MMM-DD-YY or MMM DD YY
        /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[\s\-\.\/]*(\d{1,2})[\s\-\.\/]*(\d{2,4})/gi,
        // MMM-YY or MMM YY (like "OCT 26")
        /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[\s\-\.\/]*(\d{2,4})/gi,
        // Numeric: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
        /(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})/g,
        // Numeric: YYYY/MM/DD
        /(\d{4})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{1,2})/g
      ];
      
      let foundDate = null;
      let allMatches = [];
      
      // Collect all potential dates
      for (const pattern of datePatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          allMatches.push(match[0]);
        }
      }
      
      console.log('Found date matches:', allMatches);
      
      // Try to parse each match until we find a valid one
      for (const dateStr of allMatches) {
        const parsed = parseExpiryDate(dateStr);
        if (parsed) {
          // Prefer dates that look like expiry (in the future)
          const parsedDate = new Date(parsed);
          const now = new Date();
          if (parsedDate > now) {
            foundDate = parsed;
            break;
          } else if (!foundDate) {
            foundDate = parsed; // Keep as fallback
          }
        }
      }
      
      if (foundDate) {
        setExpiryDate(foundDate);
        setError(null);
      } else {
        setError('Could not detect expiry date. Please enter manually. Tip: Focus on the date area with good lighting.');
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

  const parseExpiryDate = (dateStr) => {
    // Handle month names
    const months = {
      'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
      'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    };
    
    // Try month name format (MAR 2025 or 15 MAR 2025)
    const monthMatch = dateStr.match(/([A-Z]{3})\s*(\d{1,2})?[,\s]*(\d{2,4})/i) ||
                       dateStr.match(/(\d{1,2})\s*([A-Z]{3})\s*(\d{2,4})/i);
    
    if (monthMatch) {
      const monthStr = monthMatch[1].toLowerCase();
      const month = months[monthStr] || months[monthMatch[2]?.toLowerCase()];
      if (month) {
        let year = parseInt(monthMatch[3] || monthMatch[2]);
        let day = parseInt(monthMatch[2] || monthMatch[1]) || 1;
        
        if (year < 100) year += 2000;
        if (day > 31) { day = 1; } // If day looks like year, default to 1
        
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    
    // Try numeric formats
    const parts = dateStr.split(/[\/\-\.\s]+/).filter(p => /^\d+$/.test(p));
    if (parts.length < 2) return null;
    
    let year, month, day;
    
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
      day = parseInt(parts[2]) || 1;
    } else if (parts.length >= 3 && parts[2].length === 4) {
      // DD-MM-YYYY
      day = parseInt(parts[0]);
      month = parseInt(parts[1]);
      year = parseInt(parts[2]);
    } else {
      // DD-MM-YY
      day = parseInt(parts[0]);
      month = parseInt(parts[1]);
      year = parseInt(parts[2] || parts[1]) + 2000;
    }
    
    // Swap if month > 12
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    
    // Validate
    if (!year || year < 2020 || year > 2040) return null;
    if (!month || month < 1 || month > 12) return null;
    if (!day) day = 1;
    if (day > 31) day = 1;
    
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
                      <p className="font-bold">📸 Take Photos</p>
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
                <p className="text-sm text-blue-700 font-medium">Step 1 of 2: Product Name</p>
                <p className="text-xs text-blue-600 mt-1">Point camera at the product name on the package</p>
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
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-lg bg-black"
                    style={{ minHeight: '280px' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-20 border-2 border-dashed border-[#FF9933] rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-[#FF9933] opacity-50" />
                    </div>
                  </div>
                  <Button
                    onClick={capturePhoto}
                    className="w-full mt-3 bg-[#FF9933] hover:bg-[#E68A2E] text-white"
                    data-testid="capture-name-photo"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Capture Photo
                  </Button>
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
                <p className="text-sm text-blue-700 font-medium">Step 2 of 2: Expiry Date</p>
                <p className="text-xs text-blue-600 mt-1">Point camera at the expiry/best before date</p>
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
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-lg bg-black"
                    style={{ minHeight: '280px' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-16 border-2 border-dashed border-[#77DD77] rounded-lg flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-[#77DD77] opacity-50" />
                    </div>
                  </div>
                  <Button
                    onClick={capturePhoto}
                    className="w-full mt-3 bg-[#77DD77] hover:bg-[#66CC66] text-gray-900"
                    data-testid="capture-expiry-photo"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Capture Photo
                  </Button>
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
