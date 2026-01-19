export type ElementType = 'text' | 'image' | 'shape' | 'video' | 'button';
export type ShapeType = 'rectangle' | 'circle' | 'triangle' | 'star' | 'rounded' | 'diamond' | 'arrow';
export type TransitionType = 'none' | 'fade' | 'slide' | 'cover' | 'zoom' | 'push';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface SlideElement {
  id: string;
  type: ElementType;
  shapeType?: ShapeType; // Specific shape type
  content: string; // Text content, Image URL, or Video URL
  link?: string; // URL or Slide ID for navigation
  position: Position;
  size: Size;
  style: {
    backgroundColor?: string;
    background?: string; // For gradients
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    borderRadius?: number;
    opacity?: number;
    zIndex: number;
    border?: string; // Legacy simple border
    borderColor?: string;
    borderWidth?: number;
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
    boxShadow?: boolean;
    lineHeight?: string;
    textAlign?: 'left' | 'center' | 'right';
    padding?: string;
  };
  animation?: {
    type: 'fade' | 'slide' | 'scale' | 'none';
    duration: number;
    delay: number;
  };
}

export interface Slide {
  id: string;
  name?: string; // For website pages (e.g. "Home", "About")
  elements: SlideElement[];
  backgroundColor: string;
  backgroundImage?: string; // New: Support for background images
  duration: number; // For auto-play/video export
  transition?: TransitionType;
}

export interface Presentation {
  id: string;
  userId?: string;
  title: string;
  thumbnailUrl?: string;
  slides: Slide[];
  lastModified: number;
  type?: 'slide' | 'website'; // Added to distinguish modes
}

export type ToolType = 'select' | 'text' | 'image' | 'shape' | 'ai';