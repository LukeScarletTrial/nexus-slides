import { GoogleGenAI, Type } from "@google/genai";
import { Slide, SlideElement } from "../types";

// Helper to get client
const getClient = (apiKey?: string) => new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY });

export async function generateSlideContent(topic: string, apiKey?: string, modelId: string = "gemini-3-flash-preview"): Promise<any> {
  const ai = getClient(apiKey);
  
  const response = await ai.models.generateContent({
    model: modelId,
    contents: `You are an expert presentation and website designer.
    Request: "${topic}".
    
    Instructions:
    1. If the user asks for a "full presentation", "full website", or a broad topic, generate 3 to 5 distinct slides/pages.
    2. If the user asks for a specific slide, generate 1 slide.
    3. DESIGN RULES:
       - **Transitions**: Apply appropriate transitions ('fade', 'slide', 'zoom', 'cover') between slides.
       - **Fonts**: You MUST select an appropriate font family for text elements (Inter, Roboto, Playfair Display, etc.).
       - **Backgrounds**: You can specify a 'backgroundColor' OR a 'backgroundImagePrompt' (description for AI image generator) if the slide needs a photo background.
       - **Images**: Place images creatively. Scale them using 'width' and 'height'. You can make them fill half the screen or act as hero images.
       - **Layout**: Use the coordinate system (960x540). 
         - Center: x=480, y=270. 
         - Left Half: x=0, y=0, w=480, h=540.
         - Text is usually readable on solid colors or dark overlays.
    
    Return the response in JSON format matching the schema.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          slides: {
            type: Type.ARRAY,
            description: "List of generated slides/pages",
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Name of the slide (e.g. 'Home', 'Services')" },
                backgroundColor: { type: Type.STRING, description: "Hex color code" },
                backgroundImagePrompt: { type: Type.STRING, description: "Optional: Prompt to generate a full slide background image" },
                transition: { type: Type.STRING, enum: ['fade', 'slide', 'cover', 'zoom', 'push', 'none'] },
                elements: { 
                  type: Type.ARRAY, 
                  items: { 
                      type: Type.OBJECT,
                      properties: {
                          type: { type: Type.STRING, enum: ["text", "button", "image"] },
                          content: { type: Type.STRING, description: "Text content or Image Description Prompt" },
                          link: { type: Type.STRING, description: "Link destination for buttons" },
                          fontSize: { type: Type.NUMBER },
                          fontFamily: { type: Type.STRING, description: "One of the allowed fonts" },
                          width: { type: Type.NUMBER },
                          height: { type: Type.NUMBER },
                          x: { type: Type.NUMBER },
                          y: { type: Type.NUMBER },
                          textColor: { type: Type.STRING, description: "Hex color for text" },
                          bgColor: { type: Type.STRING, description: "Hex color for button background" }
                      },
                      required: ["type", "content", "x", "y", "width", "height"]
                  } 
                }
              },
              required: ["elements", "backgroundColor"]
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function generateImage(prompt: string, apiKey?: string): Promise<string | null> {
  try {
    const ai = getClient(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1", // Default to square, but often presentation backgrounds are 16:9. API limit might be 1:1 for now on free/flash tier.
        }
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed", error);
    return null;
  }
}

export async function enhanceText(text: string, apiKey?: string): Promise<string> {
  const ai = getClient(apiKey);
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Make this text more professional and concise for a presentation slide: "${text}"`,
  });
  return response.text?.trim() || text;
}