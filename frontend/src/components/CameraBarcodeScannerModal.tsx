import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  autoCloseOnScan?: boolean;
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'مسح الباركود بكاميرا الجهاز',
  autoCloseOnScan = true,
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'camera-barcode-viewfinder';

  // Play audio beep on successful barcode scan
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Hz
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Audio fallback
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannedCode(null);
      setScannerError(null);
      return;
    }

    let isMounted = true;

    const startCamera = async () => {
      setScannerError(null);
      setIsScanning(true);

      try {
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          setScannerError('لم يتم العثور على كاميرا في هذا الجهاز. يرجى التأكد من توصيل الكاميرا وتفعيل الإذن.');
          setIsScanning(false);
          return;
        }

        const cameraList = devices.map((d, idx) => ({
          id: d.id,
          label: d.label || `كاميرا ${idx + 1}`,
        }));
        setCameras(cameraList);

        // Prefer environment / back camera if available
        const backCamera = devices.find((d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear')) || devices[0];
        const camId = selectedCameraId || backCamera.id;
        setSelectedCameraId(camId);

        if (html5QrcodeRef.current) {
          await stopScanner();
        }

        const html5Qrcode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
          verbose: false,
        });
        html5QrcodeRef.current = html5Qrcode;

        await html5Qrcode.start(
          camId,
          {
            fps: 15,
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.333333,
          },
          (decodedText) => {
            if (!decodedText || !isMounted) return;
            const cleanText = decodedText.trim();
            playBeep();
            setScannedCode(cleanText);

            onScan(cleanText);

            if (autoCloseOnScan) {
              setTimeout(() => {
                if (isMounted) onClose();
              }, 400);
            }
          },
          () => {
            // Ignore frame-by-frame decode failure
          }
        );
        setIsScanning(false);
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('Camera barcode scanner error:', err);
        setScannerError(
          err?.message || 'تعذر فتح الكاميرا. يرجى السماح للمتصفح بالوصول إلى الكاميرا (Allow Camera Access).'
        );
        setIsScanning(false);
      }
    };

    // Small delay to ensure modal DOM container is mounted
    const timer = setTimeout(() => {
      startCamera();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, selectedCameraId]);

  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        await html5QrcodeRef.current.clear();
      } catch {
        // Ignore stop error
      } finally {
        html5QrcodeRef.current = null;
      }
    }
  };

  const handleSwitchCamera = async (newCamId: string) => {
    setSelectedCameraId(newCamId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">{title}</h3>
                {isScanning && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    جاري المسح 📷
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300">ضع باركود الدواء أمام الكاميرا للمسح التلقائي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder & Body */}
        <div className="p-4 bg-slate-950 text-white flex flex-col items-center justify-center min-h-[300px] relative">
          {/* Scanning Container */}
          <div
            id={scannerContainerId}
            className="w-full max-w-[360px] h-[240px] bg-black rounded-xl overflow-hidden shadow-inner border border-slate-800 relative"
          />

          {/* Scanned Feedback Toast */}
          {scannedCode && (
            <div className="absolute top-6 z-20 bg-emerald-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 animate-bounce">
              <CheckCircle2 className="w-4 h-4" />
              تم مسح الباركود بنجاح: <span className="font-mono text-emerald-100">{scannedCode}</span>
            </div>
          )}

          {/* Error Message */}
          {scannerError && (
            <div className="mt-4 bg-rose-950/90 border border-rose-700 text-rose-200 p-3 rounded-xl text-xs flex items-center gap-2 max-w-md text-center">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{scannerError}</span>
            </div>
          )}

          {/* Camera Selection Dropdown */}
          {cameras.length > 1 && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCameraId}
                onChange={(e) => handleSwitchCamera(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 outline-hidden"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            يدعم باركود الأدوية الدولي (EAN-13, EAN-8, Code-128, QR)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
