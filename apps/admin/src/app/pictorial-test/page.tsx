"use client";

import React, { useState, useRef, useEffect } from 'react';

const PictorialTest: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#22c55e');
  const [brushSize, setBrushSize] = useState(30);
  const [isEraser, setIsEraser] = useState(false);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [floorPlanImage, setFloorPlanImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const colors = [
    { color: '#22c55e', label: 'Complete' },
    { color: '#eab308', label: 'In Progress' },
    { color: '#f97316', label: 'Partial' },
    { color: '#ef4444', label: 'Issue' },
    { color: '#3b82f6', label: 'Inspected' }
  ];

  useEffect(() => {
    if (!floorPlanImage) {
      // Draw default test floor plan
      drawDefaultFloorPlan();
    } else {
      // Setup canvas with uploaded image
      setupCanvasWithImage();
    }
  }, [floorPlanImage]);

  const drawDefaultFloorPlan = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = 800;
    canvas.height = 600;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw a simple test floor plan
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw some rooms
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 50, 200, 150);
    ctx.strokeRect(300, 50, 200, 150);
    ctx.strokeRect(50, 250, 200, 150);
    ctx.strokeRect(300, 250, 200, 150);
    ctx.strokeRect(550, 50, 200, 350);
    
    // Add room labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '14px sans-serif';
    ctx.fillText('Room 1', 130, 130);
    ctx.fillText('Room 2', 380, 130);
    ctx.fillText('Room 3', 130, 330);
    ctx.fillText('Room 4', 380, 330);
    ctx.fillText('Room 5', 620, 230);
  };

  const setupCanvasWithImage = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !floorPlanImage) return;

    image.onload = () => {
      // Set canvas dimensions to match image
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      
      // Limit maximum dimensions for performance
      const maxWidth = 1200;
      const maxHeight = 800;
      
      if (canvas.width > maxWidth || canvas.height > maxHeight) {
        const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
        canvas.width = canvas.width * scale;
        canvas.height = canvas.height * scale;
      }
      
      // Draw the image on canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };

    image.src = floorPlanImage;
  };

  const pushUndo = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    setUndoStack(prev => [...prev.slice(-14), imageData]);
  };

  const undo = () => {
    if (!canvasRef.current || undoStack.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const newStack = [...undoStack];
    const imageData = newStack.pop();
    if (imageData) {
      ctx.putImageData(imageData, 0, 0);
      setUndoStack(newStack);
    }
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDrawing(true);
    pushUndo();
    draw(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const pos = getMousePos(e);
    
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2);
    
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      // Use transparent overlay mode
      ctx.globalCompositeOperation = 'source-over';
      
      // Convert hex to RGB and create transparent gradient
      const r = parseInt(currentColor.slice(1, 3), 16);
      const g = parseInt(currentColor.slice(3, 5), 16);
      const b = parseInt(currentColor.slice(5, 7), 16);
      
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, brushSize);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.4)`);
      gradient.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, 0.2)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      
      ctx.fillStyle = gradient;
    }
    
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isDrawing) {
      setIsDrawing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFloorPlanImage(result);
      setUploading(false);
    };
    
    reader.onerror = () => {
      alert('Failed to read file');
      setUploading(false);
    };
    
    reader.readAsDataURL(file);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    pushUndo();
    
    if (floorPlanImage) {
      // Redraw the uploaded image
      const image = imageRef.current;
      if (image) {
        ctx.drawImage(image, 0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    } else {
      // Redraw the default floor plan
      drawDefaultFloorPlan();
    }
  };

  const resetToDefault = () => {
    setFloorPlanImage(null);
    setUndoStack([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Pictorial Test Page
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          {/* Toolbar */}
          <div className="border-b border-gray-200 dark:border-gray-700 p-4 mb-4">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Upload Button */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload Floor Plan'}
                </button>
                {floorPlanImage && (
                  <button
                    onClick={resetToDefault}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Reset to Default
                  </button>
                )}
              </div>

              {/* Color Palette */}
              <div className="flex items-center gap-2">
                {colors.map(({ color, label }) => (
                  <button
                    key={color}
                    onClick={() => {
                      setCurrentColor(color);
                      setIsEraser(false);
                    }}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      currentColor === color && !isEraser
                        ? 'border-gray-900 dark:border-white scale-110'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                    title={label}
                  />
                ))}
              </div>

              {/* Brush Size */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Size:</label>
                <input
                  type="range"
                  min="10"
                  max="70"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">{brushSize}</span>
              </div>

              {/* Tools */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEraser(!isEraser)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    isEraser
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Eraser
                </button>
                <button
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Undo
                </button>
                <button
                  onClick={clearCanvas}
                  className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-sm hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <div className="relative inline-block">
              {/* Hidden image element for uploaded floor plan */}
              {floorPlanImage && (
                <img
                  ref={imageRef}
                  src={floorPlanImage}
                  alt="Floor Plan"
                  className="hidden"
                />
              )}
              
              {/* Canvas for drawing */}
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="border-2 border-gray-300 dark:border-gray-600 cursor-crosshair bg-white"
                style={{ 
                  touchAction: 'none',
                  maxWidth: '100%',
                  height: 'auto'
                }}
              />
            </div>
            
            {/* Upload status */}
            {floorPlanImage && (
              <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                ✓ Floor plan loaded successfully
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Test Instructions:
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Click "Upload Floor Plan" to load your own floor plan image</li>
              <li>• Supports JPG, PNG, GIF formats (max 10MB)</li>
              <li>• Select a color from the palette to mark progress</li>
              <li>• Adjust brush size with the slider for finer control</li>
              <li>• Click and drag on the canvas to paint on your floor plan</li>
              <li>• Use eraser to remove painted areas</li>
              <li>• Click Undo to reverse recent actions</li>
              <li>• Click Clear to remove all paintings (keeps floor plan)</li>
              <li>• Click "Reset to Default" to go back to test floor plan</li>
            </ul>
            
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Color Meanings:
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span> Complete
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span> In Progress
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-orange-500"></span> Partial
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span> Issue
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span> Inspected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PictorialTest;
