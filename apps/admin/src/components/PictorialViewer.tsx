"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../app/lib/supabase';
import { useRouter } from 'next/navigation';

interface PictorialPage {
  id: string;
  name: string;
  floor_plan_url?: string;
  canvas_data?: string;
  project_id: string;
  zone_id?: string;
  status: string;
  created_at: string;
}

interface PictorialAnnotation {
  id: string;
  annotation_type: 'area' | 'note' | 'issue' | 'photo';
  coordinates: { x: number; y: number; width?: number; height?: number };
  data: any;
  created_at: string;
}

interface PictorialProgress {
  progress_data: string;
  progress_percentage: number;
  last_updated: string;
}

const PictorialViewer: React.FC<{
  projectId: string;
  zoneId?: string;
}> = ({ projectId, zoneId }) => {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [pages, setPages] = useState<PictorialPage[]>([]);
  const [activePage, setActivePage] = useState<PictorialPage | null>(null);
  const [annotations, setAnnotations] = useState<PictorialAnnotation[]>([]);
  const [progress, setProgress] = useState<PictorialProgress | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#22c55e');
  const [brushSize, setBrushSize] = useState(30);
  const [isEraser, setIsEraser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddPageModal, setShowAddPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [user, setUser] = useState<any>(null);

  // Color palette
  const colors = [
    { color: '#22c55e', label: 'Complete' },
    { color: '#eab308', label: 'In Progress' },
    { color: '#f97316', label: 'Partial' },
    { color: '#ef4444', label: 'Issue' },
    { color: '#3b82f6', label: 'Inspected' }
  ];

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }
      setUser(user);
    };
    checkAuth();
  }, [router]);

  // Fetch pages
  const fetchPages = useCallback(async () => {
    if (!projectId) return;
    
    try {
      let query = supabase
        .from('pictorial_pages')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (zoneId) {
        query = query.eq('zone_id', zoneId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setPages(data || []);
      if (data && data.length > 0 && !activePage) {
        setActivePage(data[0]);
      }
    } catch (err) {
      console.error('Error fetching pages:', err);
      setError('Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [projectId, zoneId, activePage]);

  // Fetch annotations for active page
  const fetchAnnotations = useCallback(async () => {
    if (!activePage) return;
    
    try {
      const { data, error } = await supabase
        .from('pictorial_annotations')
        .select('*')
        .eq('page_id', activePage.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAnnotations(data || []);
    } catch (err) {
      console.error('Error fetching annotations:', err);
    }
  }, [activePage]);

  // Fetch progress for active page
  const fetchProgress = useCallback(async () => {
    if (!activePage || !user) return;
    
    try {
      const { data, error } = await supabase
        .from('pictorial_progress')
        .select('*')
        .eq('page_id', activePage.id)
        .eq('user_id', user.id)
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setProgress(data);
    } catch (err) {
      console.error('Error fetching progress:', err);
    }
  }, [activePage, user]);

  // Initialize data
  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    if (activePage) {
      fetchAnnotations();
      fetchProgress();
    }
  }, [activePage, fetchAnnotations, fetchProgress]);

  // Setup canvas when page changes
  useEffect(() => {
    if (activePage && canvasRef.current && imageRef.current && imageRef.current.complete) {
      setupCanvas();
    }
  }, [activePage, progress]);

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    // Wait for image to be loaded
    if (!image.complete) return;

    const rect = image.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Restore saved progress if exists
    if (progress?.progress_data) {
      try {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = progress.progress_data;
      } catch (err) {
        console.error('Error restoring progress:', err);
      }
    }
  };

  const handleImageLoad = () => {
    setTimeout(() => setupCanvas(), 100);
  };

  const saveProgress = async () => {
    if (!canvasRef.current || !activePage || !user) return;

    try {
      const canvas = canvasRef.current;
      const dataURL = canvas.toDataURL();
      
      // Calculate progress percentage (simplified)
      const ctx = canvas.getContext('2d');
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      let paintedPixels = 0;
      if (imageData) {
        for (let i = 3; i < imageData.data.length; i += 4) {
          if (imageData.data[i] > 0) paintedPixels++;
        }
        const progressPercentage = Math.round((paintedPixels / (canvas.width * canvas.height)) * 100);
        
        const { error } = await supabase
          .from('pictorial_progress')
          .upsert({
            page_id: activePage.id,
            user_id: user.id,
            progress_data: dataURL,
            progress_percentage: Math.min(progressPercentage, 100),
            last_updated: new Date().toISOString()
          });

        if (error) throw error;
      }
    } catch (err) {
      console.error('Error saving progress:', err);
    }
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
      saveProgress();
    }
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvasRef.current?.dispatchEvent(mouseEvent);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvasRef.current?.dispatchEvent(mouseEvent);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    canvasRef.current?.dispatchEvent(mouseEvent);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('floor-plans')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('floor-plans')
        .getPublicUrl(fileName);

      // Create new page
      const { error: pageError } = await supabase
        .from('pictorial_pages')
        .insert({
          project_id: projectId,
          zone_id: zoneId,
          name: newPageName || `Section ${pages.length + 1}`,
          floor_plan_url: publicUrl,
          created_by: user.id
        });

      if (pageError) throw pageError;

      setShowAddPageModal(false);
      setNewPageName('');
      fetchPages();
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload floor plan');
    } finally {
      setUploading(false);
    }
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    pushUndo();
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    saveProgress();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="pictorial-viewer bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Pictorial Progress
          </h3>
          <button
            onClick={() => setShowAddPageModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Section
          </button>
        </div>
      </div>

      {/* Page Selector */}
      {pages.length > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap gap-2">
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => setActivePage(page)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  activePage?.id === page.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {page.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      {activePage && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-4 flex-wrap">
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
      )}

      {/* Canvas Area */}
      <div className="p-4">
        {activePage?.floor_plan_url ? (
          <div className="relative inline-block">
            <img
              ref={imageRef}
              src={activePage.floor_plan_url}
              alt={activePage.name}
              onLoad={handleImageLoad}
              className="max-w-full h-auto"
            />
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="absolute top-0 left-0 cursor-crosshair border-2 border-transparent hover:border-blue-400"
              style={{ 
                pointerEvents: 'auto',
                touchAction: 'none',
                zIndex: 10
              }}
            />
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              {pages.length === 0 ? 'No sections created yet' : 'No floor plan uploaded'}
            </div>
            {pages.length === 0 && (
              <button
                onClick={() => setShowAddPageModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create First Section
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Page Modal */}
      {showAddPageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h4 className="text-lg font-semibold mb-4">Add New Section</h4>
            <input
              type="text"
              placeholder="Section name"
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
            />
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Floor Plan Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowAddPageModal(false);
                  setNewPageName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Create Section'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
};

export default PictorialViewer;
