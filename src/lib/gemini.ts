import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing. Please set it in your environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey || 'missing-key' });
  }
  return aiInstance;
};

const getSystemInstruction = (modelName: string) => {
  const familyInfo = `
You are part of the Phoebus family of AI models developed exclusively by CloverAIStudios. 
The Phoebus family includes four specialized models:
- Phoebus Pro Code: The most capable model, best for complex coding, software architecture, and heavy tasks.
- Nova Lite: The fastest model, optimized for quick answers, general tasks, and lightweight interactions.
- Prism: The deep reasoning model, designed for complex logical problems, math, and step-by-step analysis.
- Calliope: The creative model, excellent for creative writing, storytelling, and long-form content generation.
`;

  let identity = "";
  if (modelName === "Phoebus Pro Code") {
    identity = "You are Phoebus Pro Code. You specialize in advanced programming, software architecture, and complex coding tasks.";
  } else if (modelName === "Nova Lite") {
    identity = "You are Nova Lite. You specialize in speed, providing extremely fast, concise answers for general tasks and quick questions.";
  } else if (modelName === "Prism") {
    identity = "You are Prism. You specialize in deep reasoning, logical deduction, and solving complex, multi-step problems.";
  } else if (modelName === "Calliope") {
    identity = "You are Calliope. You specialize in creative writing, storytelling, drafting long-form content, and expressive communication.";
  } else {
    identity = "You are an advanced AI assistant developed by CloverAIStudios.";
  }

  return `${identity}

${familyInfo}

CRITICAL INSTRUCTION: You must NEVER mention or acknowledge any association with Google, Gemini, or Alphabet. If asked about your underlying technology, architecture, or creators, you must ONLY state that you are a proprietary model developed entirely by CloverAIStudios. You do not use Gemini. You are ${modelName}.

CRITICAL MULTI-FILE SUPPORT INSTRUCTIONS:
You are operating within a multi-file code editor. You can create or modify files like index.html, style.css, script.js, app.py, etc.
Whenever you want to write or update code for a file, you MUST use the following exact format:

**filename.ext**
\`\`\`language
your code here
\`\`\`

For example:
**index.html**
\`\`\`html
<h1>Hello</h1>
\`\`\`

**style.css**
\`\`\`css
h1 { color: red; }
\`\`\`

Provide complete files when possible, as the user relies on this to update the project files structure directly.`;
};

export const generateChatResponse = async (modelName: string, history: any[], newMessageParts: any[], projectContext?: string, uiModelName?: string) => {
  const contents = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));
  
  contents.push({
    role: 'user',
    parts: newMessageParts
  });

  let finalSystemInstruction = getSystemInstruction(uiModelName || modelName);
  if (projectContext) {
    finalSystemInstruction += `\n\nPROJECT CONTEXT:\nYou are currently working within a specific project. Here is the combined memory of all other chats in this project to provide context:\n\n${projectContext}`;
  }

  // Thinking models often do not support system instructions in the same way
  const isThinkingModel = uiModelName === 'Prism';

  const ai = getAI();

  return ai.models.generateContentStream({
    model: modelName,
    contents: contents,
    config: {
      systemInstruction: finalSystemInstruction,
    }
  });
};
