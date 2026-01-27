import { useState, useRef, useEffect, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { createWorker } from 'tesseract.js';
import { Camera, Loader2, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API = process.env.REACT_APP_BACKEND_URL;

export const BarcodeScanner = ({ isOpen, onClose, onItemScanned }) => {
  const [scanMode, setScanMode] = useState('barcode'); // 'barcode' | 'expiry' | 'confirm'
  const [scanning, setScanning] = useState(false);
  const [productData, setProductData] = useState(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [error, setError] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false); // Prevent multiple lookups
  
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);
  const processedRef = useRef(false); // Track if barcode was already processed

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
    setScanMode('barcode');
    setProductData(null);
    setExpiryDate('');
    setError(null);
    setOcrProgress(0);
    setScanning(false);
  }, []);

  // Stop camera when dialog closes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  
  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setScanMode('barcode');
      setProductData(null);
      setExpiryDate('');
      setError(null);
      setOcrProgress(0);
      setScanning(false);
      setIsProcessing(false);
      processedRef.current = false;
    }
  }, [isOpen]);

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
      
      // Start decoding from video
      codeReader.decodeFromVideoDevice(undefined, videoRef.current, async (result, err) => {
        // Skip if already processing or processed
        if (processedRef.current || isProcessing) {
          return;
        }
        
        if (result) {
          const barcode = result.getText();
          console.log('Barcode detected:', barcode);
          
          // Mark as processed immediately to prevent loop
          processedRef.current = true;
          setIsProcessing(true);
          
          // Stop camera first
          stopCamera();
          setScanning(false);
          
          // Then lookup product
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
      const response = await fetch(`${API}/barcode/${barcode}`);
      const data = await response.json();
      
      if (data.found) {
        setProductData({
          barcode: barcode,
          name_en: data.name || `Product ${barcode}`,
          brand: data.brand,
          category: mapCategory(data.category),
          quantity: data.quantity,
          image_url: data.image_url
        });
        setScanMode('expiry');
      } else {
        // Product not found - allow manual entry
        setProductData({
          barcode: barcode,
          name_en: '',
          brand: '',
          category: 'other',
          quantity: ''
        });
        setScanMode('expiry');
        setError('Product not found in Open Food Facts database. Please enter details manually.');
      }
    } catch (err) {
      console.error('Lookup error:', err);
      // Even on error, allow manual entry with the barcode
      setProductData({
        barcode: barcode,
        name_en: '',
        brand: '',
        category: 'other',
        quantity: ''
      });
      setScanMode('expiry');
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

  const startExpiryOCR = async () => {
    setScanning(true);
    setError(null);
    setOcrProgress(0);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera for OCR.');
      setScanning(false);
    }
  };

  const captureAndReadExpiry = async () => {
    if (!videoRef.current) return;
    
    setOcrProgress(10);
    
    try {
      // Create canvas and capture frame
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);
      
      // Stop camera
      stopCamera();
      
      setOcrProgress(30);
      
      // Initialize Tesseract worker
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(30 + Math.round(m.progress * 60));
          }
        }
      });
      
      // Recognize text
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();
      
      setOcrProgress(100);
      
      // Try to find date pattern in text
      const datePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})|(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/g;
      const matches = text.match(datePattern);
      
      if (matches && matches.length > 0) {
        // Parse the first matched date
        const dateStr = matches[0];
        const parsedDate = parseExpiryDate(dateStr);
        if (parsedDate) {
          setExpiryDate(parsedDate);
          setError(null);
        } else {
          setError(`Found date "${dateStr}" but could not parse it. Please enter manually.`);
        }
      } else {
        setError('Could not detect expiry date. Please enter manually.');
      }
      
      setScanning(false);
      setScanMode('confirm');
      
    } catch (err) {
      console.error('OCR error:', err);
      setError('OCR failed. Please enter expiry date manually.');
      setScanning(false);
      setScanMode('confirm');
    }
  };

  const parseExpiryDate = (dateStr) => {
    // Try different date formats
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length !== 3) return null;
    
    let year, month, day;
    
    // Check if first part is year (YYYY-MM-DD)
    if (parts[0].length === 4) {
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
      day = parseInt(parts[2]);
    } 
    // DD-MM-YYYY or MM-DD-YYYY
    else if (parts[2].length === 4) {
      year = parseInt(parts[2]);
      // Assume DD-MM-YYYY (common in India)
      day = parseInt(parts[0]);
      month = parseInt(parts[1]);
    }
    // DD-MM-YY
    else {
      day = parseInt(parts[0]);
      month = parseInt(parts[1]);
      year = parseInt(parts[2]) + 2000;
    }
    
    // Validate
    if (month > 12) {
      // Swap day and month
      [day, month] = [month, day];
    }
    
    if (year < 2020 || year > 2040 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const skipExpiryScan = () => {
    stopCamera();
    setScanning(false);
    setScanMode('confirm');
  };

  const handleConfirm = () => {
    if (!productData) return;
    
    onItemScanned({
      name_en: productData.name_en,
      category: productData.category,
      stock_level: 'full',
      unit: 'pcs',
      barcode: productData.barcode,
      expiry_date: expiryDate || null
    });
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="barcode-scanner-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-6 h-6 text-[#FF9933]" />
            {scanMode === 'barcode' && 'Scan Product Barcode'}
            {scanMode === 'expiry' && 'Scan Expiry Date'}
            {scanMode === 'confirm' && 'Confirm Item Details'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Barcode Scanning Mode */}
          {scanMode === 'barcode' && (
            <div className="space-y-4">
              {isProcessing ? (
                <div className="text-center py-8">
                  <Loader2 className="w-16 h-16 text-[#FF9933] mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Looking up product...</p>
                </div>
              ) : !scanning ? (
                <div className="text-center py-8">
                  <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Click below to start scanning the product barcode</p>
                  <Button
                    onClick={startBarcodeScanner}
                    className="bg-[#FF9933] hover:bg-[#E68A2E] text-white"
                    data-testid="start-barcode-scan"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Start Barcode Scanner
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-lg bg-black"
                    style={{ minHeight: '300px' }}
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
                  <p className="text-center text-sm text-gray-600 mt-2">
                    Position barcode within the frame
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Expiry Date Scanning Mode */}
          {scanMode === 'expiry' && (
            <div className="space-y-4">
              {productData && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-800">
                        {productData.name_en ? 'Product Found!' : 'Barcode Scanned!'}
                      </p>
                      <p className="text-green-700">
                        {productData.name_en || 'Enter product name below'}
                      </p>
                      {productData.brand && (
                        <p className="text-sm text-green-600">Brand: {productData.brand}</p>
                      )}
                      <p className="text-xs text-green-600 mt-1">Barcode: {productData.barcode}</p>
                    </div>
                  </div>
                </div>
              )}

              {!scanning ? (
                <div className="text-center py-6">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">Now scan the expiry date on the package</p>
                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={startExpiryOCR}
                      className="bg-[#FF9933] hover:bg-[#E68A2E] text-white"
                      data-testid="start-expiry-scan"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Scan Expiry Date
                    </Button>
                    <Button
                      onClick={skipExpiryScan}
                      variant="outline"
                      data-testid="skip-expiry-scan"
                    >
                      Skip / Enter Manually
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-lg bg-black"
                    style={{ minHeight: '250px' }}
                  />
                  {ocrProgress > 0 && ocrProgress < 100 && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                      <Loader2 className="w-10 h-10 text-white animate-spin mb-2" />
                      <p className="text-white">Reading text... {ocrProgress}%</p>
                    </div>
                  )}
                  <p className="text-center text-sm text-gray-600 mt-2">
                    Point camera at the expiry date
                  </p>
                  <Button
                    onClick={captureAndReadExpiry}
                    className="w-full mt-3 bg-[#77DD77] hover:bg-[#66CC66] text-gray-900"
                    data-testid="capture-expiry"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Capture & Read Expiry
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Confirmation Mode */}
          {scanMode === 'confirm' && productData && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label>Product Name</Label>
                  <Input
                    value={productData.name_en}
                    onChange={(e) => setProductData({ ...productData, name_en: e.target.value })}
                    placeholder="Enter product name"
                    data-testid="product-name-input"
                  />
                </div>
                
                <div>
                  <Label>Barcode</Label>
                  <Input
                    value={productData.barcode}
                    disabled
                    className="bg-gray-100"
                  />
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
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetState();
                  }}
                  className="flex-1"
                >
                  Scan Another
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!productData.name_en}
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
