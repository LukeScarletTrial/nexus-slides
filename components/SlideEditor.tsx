import React, { useRef, useState, useEffect } from 'react';
import { Slide, SlideElement, Position, Size } from '../types';
import { motion } from 'framer-motion';

interface SlideEditorProps {
  slide: Slide;
  selectedElementId: string | null;
  onElementUpdate: (element: SlideElement) => void;
  onElementSelect: (id: string | null) => void;
  scale: number;
  id?: string;
  mode?: 'edit' | 'view'; // Added mode prop
  onNavigate?: (link: string) => void; // Added navigation callback
}

export const SlideEditor: React.FC<SlideEditorProps> = ({ 
  slide, 
  selectedElementId, 
  onElementUpdate, 
  onElementSelect,
  scale,
  id,
  mode = 'edit',
  onNavigate
}) => {
  return (
    <div 
      id={id}
      className={`relative shadow-lg overflow-hidden transition-all duration-200 ${mode === 'view' ? 'pointer-events-auto' : ''}`}
      style={{
        width: 960 * scale,
        height: 540 * scale,
        backgroundColor: slide.backgroundColor,
        backgroundImage: slide.backgroundImage ? `url(${slide.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transformOrigin: 'top left',
        touchAction: 'none',
        // In view mode, we don't want the background to capture clicks that prevent button interaction
        pointerEvents: mode === 'view' ? 'auto' : undefined 
      }}
      onPointerDown={() => mode === 'edit' && onElementSelect(null)}
    >
      {slide.elements.map(element => (
        <RendereableElement
          key={element.id}
          element={element}
          isSelected={mode === 'edit' && selectedElementId === element.id}
          onElementUpdate={onElementUpdate}
          onElementSelect={onElementSelect}
          scale={scale}
          mode={mode}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
};

// --- Resize Handles ---
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSORS: Record<string, string> = {
  nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
  e: 'e-resize', se: 'se-resize', s: 's-resize',
  sw: 'sw-resize', w: 'w-resize'
};

const RendereableElement: React.FC<{
  element: SlideElement;
  isSelected: boolean;
  onElementUpdate: (element: SlideElement) => void;
  onElementSelect: (id: string) => void;
  scale: number;
  mode: 'edit' | 'view';
  onNavigate?: (link: string) => void;
}> = ({ element, isSelected, onElementUpdate, onElementSelect, scale, mode, onNavigate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Interaction State
  const [interaction, setInteraction] = useState<{
    type: 'idle' | 'drag' | 'resize';
    startPos: { x: number; y: number };
    startEl: { x: number; y: number; w: number; h: number };
    handle?: string;
  }>({ 
    type: 'idle', 
    startPos: { x: 0, y: 0 }, 
    startEl: { x: 0, y: 0, w: 0, h: 0 } 
  });

  // Current temp state for smooth visual updates without thrashing app state
  const [tempState, setTempState] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    if (!isSelected) {
      setIsEditing(false);
      setInteraction({ type: 'idle', startPos: { x: 0, y: 0 }, startEl: { x: 0, y: 0, w: 0, h: 0 } });
      setTempState(null);
    }
  }, [isSelected]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // --- Click/Drag Handler ---
  const handlePointerDown = (e: React.PointerEvent) => {
    // If in VIEW mode, check if we should navigate
    if (mode === 'view') {
        if (element.type === 'button' && element.link && onNavigate) {
            e.stopPropagation(); // Prevent bubbling
            onNavigate(element.link);
        }
        return; 
    }

    // EDIT Mode logic below
    if (isEditing || interaction.type !== 'idle') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    onElementSelect(element.id);
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    setInteraction({
      type: 'drag',
      startPos: { x: e.clientX, y: e.clientY },
      startEl: { 
        x: element.position.x, 
        y: element.position.y, 
        w: element.size.width, 
        h: element.size.height 
      }
    });
  };

  // --- Resize Handler ---
  const handleResizeStart = (e: React.PointerEvent, handle: string) => {
    if (mode === 'view') return;
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    setInteraction({
      type: 'resize',
      handle,
      startPos: { x: e.clientX, y: e.clientY },
      startEl: { 
        x: element.position.x, 
        y: element.position.y, 
        w: element.size.width, 
        h: element.size.height 
      }
    });
  };

  // --- Unified Move Handler ---
  const handlePointerMove = (e: React.PointerEvent) => {
    if (interaction.type === 'idle' || mode === 'view') return;

    e.preventDefault();
    e.stopPropagation();

    const deltaX = (e.clientX - interaction.startPos.x) / scale;
    const deltaY = (e.clientY - interaction.startPos.y) / scale;

    if (interaction.type === 'drag') {
      setTempState({
        x: interaction.startEl.x + deltaX,
        y: interaction.startEl.y + deltaY,
        w: interaction.startEl.w,
        h: interaction.startEl.h
      });
    } else if (interaction.type === 'resize' && interaction.handle) {
      const { x, y, w, h } = interaction.startEl;
      let newX = x;
      let newY = y;
      let newW = w;
      let newH = h;

      // Calculate resizing based on handle direction
      if (interaction.handle.includes('n')) {
        newY = y + deltaY;
        newH = h - deltaY;
      }
      if (interaction.handle.includes('s')) {
        newH = h + deltaY;
      }
      if (interaction.handle.includes('w')) {
        newX = x + deltaX;
        newW = w - deltaX;
      }
      if (interaction.handle.includes('e')) {
        newW = w + deltaX;
      }

      // REMOVED LIMIT: Allow element to be resized very small for clipping/cropping effects
      if (newW < 5) {
          newW = 5; // Minimal safeguard only
          if(interaction.handle.includes('w')) newX = x + w - 5;
      }
      if (newH < 5) {
          newH = 5; // Minimal safeguard only
          if(interaction.handle.includes('n')) newY = y + h - 5;
      }

      setTempState({ x: newX, y: newY, w: newW, h: newH });
    }
  };

  // --- Unified Up Handler ---
  const handlePointerUp = (e: React.PointerEvent) => {
    if (interaction.type === 'idle' || mode === 'view') return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);

    // Commit changes if we have temp state
    if (tempState) {
      onElementUpdate({
        ...element,
        position: { x: tempState.x, y: tempState.y },
        size: { width: tempState.w, height: tempState.h }
      });
    }

    setInteraction({ type: 'idle', startPos: { x:0, y:0 }, startEl: { x:0, y:0, w:0, h:0 } });
    setTempState(null);
  };


  // --- Render Props ---
  const { backgroundColor, background, border, borderColor, borderWidth, borderStyle, borderRadius, zIndex, boxShadow, opacity, ...otherStyles } = element.style;

  // Use temp state during interaction, otherwise source of truth
  const displayX = tempState ? tempState.x : element.position.x;
  const displayY = tempState ? tempState.y : element.position.y;
  const displayW = tempState ? tempState.w : element.size.width;
  const displayH = tempState ? tempState.h : element.size.height;

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: displayX * scale,
    top: displayY * scale,
    width: displayW * scale,
    height: displayH * scale,
    zIndex: zIndex,
    cursor: mode === 'view' ? (element.type === 'button' && element.link ? 'pointer' : 'default') : (isEditing ? 'text' : (interaction.type === 'drag' ? 'grabbing' : 'grab')),
    userSelect: 'none',
    touchAction: 'none'
  };

  const getClipPath = (shape?: string) => {
      switch (shape) {
          case 'circle': return 'circle(50% at 50% 50%)';
          case 'triangle': return 'polygon(50% 0%, 0% 100%, 100% 100%)';
          case 'diamond': return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
          case 'arrow': return 'polygon(0% 40%, 60% 40%, 60% 20%, 100% 50%, 60% 80%, 60% 60%, 0% 60%)';
          case 'star': return 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
          default: return undefined;
      }
  };
  
  const clipPath = element.type === 'shape' ? getClipPath(element.shapeType) : undefined;
  
  // Construct the border string or use default
  const computedBorder = (borderWidth && borderWidth > 0) 
      ? `${borderWidth * scale}px ${borderStyle || 'solid'} ${borderColor || '#000'}`
      : border;

  // Always show outline if selected or dragging/resizing
  const showOutline = isSelected && !isEditing;
  
  const visualStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    ...otherStyles,
    backgroundColor: backgroundColor,
    background: background || backgroundColor,
    fontSize: (element.style.fontSize || 16) * scale,
    border: showOutline ? '2px solid #3b82f6' : computedBorder, // Force outline when held/selected
    clipPath: clipPath,
    WebkitClipPath: clipPath,
    borderRadius: (borderRadius || (element.shapeType === 'rounded' || element.type === 'button' ? 20 : 0)) * scale,
    boxShadow: boxShadow ? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)' : undefined,
    opacity: opacity !== undefined ? opacity : 1,
    overflow: 'hidden', // Critical for clipping content
    display: element.type === 'button' ? 'flex' : undefined,
    alignItems: element.type === 'button' ? 'center' : undefined,
    justifyContent: element.type === 'button' ? 'center' : undefined,
    cursor: mode === 'view' && element.type === 'button' ? 'pointer' : element.type === 'button' ? 'pointer' : undefined
  };

  const initial = element.animation ? { opacity: 0, scale: 0.8 } : {};
  const animate = element.animation ? { opacity: element.style.opacity || 1, scale: 1 } : {};

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (mode === 'view') return;
    if (element.type === 'text' || element.type === 'button') {
      e.stopPropagation();
      setIsEditing(true);
    }
  };

  return (
    <div 
      style={containerStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      // Capture events that might bubble up from handles
      onPointerLeave={interaction.type !== 'idle' ? undefined : handlePointerUp}
      onClick={(e) => { 
          if(mode === 'view' && element.type === 'button' && element.link) {
              e.stopPropagation();
              onNavigate?.(element.link);
          } else {
              e.stopPropagation();
          }
      }} 
      onDoubleClick={handleDoubleClick}
    >
      <motion.div
        style={visualStyle}
        initial={initial}
        animate={animate}
        transition={{ duration: 0.5 }}
      >
        {(element.type === 'text' || element.type === 'button') && (
          isEditing ? (
            <textarea
              ref={textareaRef}
              className="w-full h-full bg-transparent resize-none outline-none p-0 m-0 border-none overflow-hidden"
              style={{ fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', lineHeight: 'inherit', fontFamily: 'inherit', textAlign: element.style.textAlign || 'center' }}
              value={element.content}
              onChange={(e) => onElementUpdate({ ...element, content: e.target.value })}
              onBlur={() => setIsEditing(false)}
              onPointerDown={(e) => e.stopPropagation()} 
            />
          ) : (
            <div 
                className="w-full h-full whitespace-pre-wrap select-none flex items-center justify-center"
                style={{ 
                    textAlign: element.style.textAlign || (element.type === 'button' ? 'center' : 'left'),
                    alignItems: element.type === 'button' ? 'center' : 'flex-start',
                    display: 'flex',
                    justifyContent: element.style.textAlign === 'center' || element.type === 'button' ? 'center' : (element.style.textAlign === 'right' ? 'flex-end' : 'flex-start')
                }}
            >
                {element.content}
            </div>
          )
        )}
        {element.type === 'image' && (
          <img src={element.content} alt="" crossOrigin="anonymous" className="w-full h-full object-cover pointer-events-none rounded-sm" />
        )}
        {element.type === 'video' && (
            <div className="w-full h-full bg-black flex items-center justify-center relative">
                 <video 
                    src={element.content} 
                    className="w-full h-full object-cover pointer-events-none" 
                    controls={false} // Hide controls in editor
                 />
                 <div className="absolute inset-0 bg-transparent" /> {/* Overlay to prevent interacting with native video controls in editor */}
            </div>
        )}
      </motion.div>

      {/* Resize Handles - Only in Edit Mode */}
      {mode === 'edit' && isSelected && !isEditing && HANDLES.map(handle => (
        <div
          key={handle}
          onPointerDown={(e) => handleResizeStart(e, handle)}
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            backgroundColor: 'white',
            border: '1px solid #3b82f6',
            borderRadius: '50%',
            zIndex: 50,
            cursor: CURSORS[handle],
            ...getHandlePosition(handle, displayW * scale, displayH * scale)
          }}
        />
      ))}
    </div>
  );
};

// Helper to position handles
function getHandlePosition(handle: string, w: number, h: number): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (handle.includes('n')) style.top = -5;
  if (handle.includes('s')) style.bottom = -5;
  if (handle.includes('w')) style.left = -5;
  if (handle.includes('e')) style.right = -5;
  
  if (!handle.includes('n') && !handle.includes('s')) style.top = h / 2 - 5;
  if (!handle.includes('w') && !handle.includes('e')) style.left = w / 2 - 5;
  
  return style;
}