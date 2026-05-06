import React, { useState, useRef, useEffect } from 'react';
import { Plus, MessageSquare, ChevronDown, ChevronRight, Sparkles, X, File as FileIcon, FileText, Image as ImageIcon, LogOut, PanelLeftClose, PanelLeftOpen, Search, Settings, Folder, FolderOpen, Code2, Download, ChevronUp, Edit3, GraduationCap, Coffee, Trash2, Pencil, FileCode2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { generateChatResponse } from '../lib/gemini';
import { User } from 'firebase/auth';
import { logout, db } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import Editor from '@monaco-editor/react';

interface Attachment {
  name: string;
  type: string;
  url?: string;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  attachments?: Attachment[];
}

const MODELS = [
  { id: 'gemini-2.5-pro', name: 'Phoebus Pro Code', description: 'Best for Coding and heavy tasks' },
  { id: 'gemini-2.5-flash', name: 'Nova Lite', description: 'Extremely fast best for quick answers and general tasks' },
  { id: 'gemini-2.5-pro', name: 'Prism', description: 'Deep reasoning model for complex logical problems' },
  { id: 'gemini-2.5-pro', name: 'Calliope', description: 'Excellent for creative writing and long-form content' }
];

interface ChatInterfaceProps {
  user: User;
}

export function ChatInterface({ user }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[1]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(window.innerWidth >= 768);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const isDragging = useRef(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  
  const [chats, setChats] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [creatingChatInProject, setCreatingChatInProject] = useState<string | null>(null);
  const [newChatName, setNewChatName] = useState('');
  const [projectMode, setProjectMode] = useState<'chat' | 'preview' | 'code'>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatName, setEditingChatName] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: 'project' | 'chat', id: string } | null>(null);
  const [activeFile, setActiveFile] = useState<string>('index.html');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && isSidebarExpanded) {
        setIsSidebarExpanded(false);
      } else if (!mobile && !isSidebarExpanded) {
        setIsSidebarExpanded(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarExpanded]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      let newWidth = e.clientX;
      if (newWidth < 150) {
        setIsSidebarExpanded(false);
        setSidebarWidth(260);
      } else {
        setIsSidebarExpanded(true);
        setSidebarWidth(Math.min(Math.max(newWidth, 200), 600));
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizing = (e: React.MouseEvent) => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'chats'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChats(chatData);
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'projects'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjects(projectData);
    });
    return () => unsubscribe();
  }, [user.uid]);

  const handleDeleteProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmation({ type: 'project', id: projectId });
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmation({ type: 'chat', id: chatId });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    
    if (deleteConfirmation.type === 'project') {
      try {
        await deleteDoc(doc(db, 'projects', deleteConfirmation.id));
        const projectChats = chats.filter(c => c.projectId === deleteConfirmation.id);
        for (const chat of projectChats) {
          await deleteDoc(doc(db, 'chats', chat.id));
        }
        if (currentProjectId === deleteConfirmation.id) {
          setCurrentProjectId(null);
          setCurrentChatId(null);
          setMessages([]);
        }
      } catch (error) {
        console.error("Error deleting project:", error);
      }
    } else {
      try {
        await deleteDoc(doc(db, 'chats', deleteConfirmation.id));
        if (currentChatId === deleteConfirmation.id) {
          setCurrentChatId(null);
          setMessages([]);
        }
      } catch (error) {
        console.error("Error deleting chat:", error);
      }
    }
    setDeleteConfirmation(null);
  };

  const handleRenameChat = async (chatId: string) => {
    if (!editingChatName.trim()) {
      setEditingChatId(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        title: editingChatName.trim()
      });
      setEditingChatId(null);
    } catch (error) {
      console.error("Error renaming chat:", error);
    }
  };

  const handleSaveEditedCode = async () => {
    if (currentProjectId) {
      const newFiles = { ...getProjectFiles() };
      const ext = activeFile.split('.').pop() || 'text';
      const languageMap: Record<string, string> = { js: 'javascript', ts: 'typescript', html: 'html', css: 'css', py: 'python', json: 'json', md: 'markdown' };
      const resolvedLang = languageMap[ext] || ext;

      newFiles[activeFile] = { content: editedCode, language: resolvedLang };
      await updateProjectFiles(newFiles);
      setIsEditingCode(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setIsCreatingProject(false);
      return;
    }
    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        userId: user.uid,
        name: newProjectName.trim(),
        createdAt: serverTimestamp(),
        files: {
          'index.html': {
            content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>New Project</title>\n</head>\n<body>\n  <h1>Welcome to your new multi-file project!</h1>\n</body>\n</html>',
            language: 'html'
          }
        }
      });
      setNewProjectName('');
      setIsCreatingProject(false);
      setExpandedProjects(prev => [...prev, docRef.id]);
      setCreatingChatInProject(docRef.id);
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  const handleCreateProjectChat = async (projectId: string) => {
    if (!newChatName.trim()) {
      setCreatingChatInProject(null);
      return;
    }
    try {
      const docRef = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        projectId: projectId,
        title: newChatName.trim(),
        messages: [],
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      setNewChatName('');
      setCreatingChatInProject(null);
      setCurrentProjectId(projectId);
      setCurrentChatId(docRef.id);
      setMessages([]);
      if (!expandedProjects.includes(projectId)) {
        setExpandedProjects(prev => [...prev, projectId]);
      }
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => 
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  const loadChat = (chat: any) => {
    setCurrentChatId(chat.id);
    setMessages(chat.messages || []);
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setCurrentProjectId(null);
    setMessages([]);
  };

  const scrollToBottom = (force = false) => {
    if (force || autoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 150;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    setProjectMode('chat');
  }, [currentProjectId]);

  const getProjectFiles = () => {
    if (!currentProjectId) return {};
    const currentProject = projects.find(p => p.id === currentProjectId);
    if (currentProject?.files && Object.keys(currentProject.files).length > 0) {
      return currentProject.files as Record<string, { content: string, language: string }>;
    }
    
    // Legacy fallback: Extract from chat
    let latestCode = '';
    const projectChats = chats.filter(c => c.projectId === currentProjectId && c.id !== currentChatId);
    
    // Include current chat messages if any
    const allChats = [...projectChats];
    if (messages.length > 0) {
       allChats.push({ messages, updatedAt: { toMillis: () => Date.now() } } as any);
    }
    
    const sortedChats = allChats.sort((a, b) => {
      const timeA = a.updatedAt?.toMillis?.() || 0;
      const timeB = b.updatedAt?.toMillis?.() || 0;
      return timeB - timeA;
    });
    
    outerLoop:
    for (const chat of sortedChats) {
      const chatMsgs = chat.messages || [];
      for (let i = chatMsgs.length - 1; i >= 0; i--) {
        const msg = chatMsgs[i];
        if (msg.role === 'model') {
          const htmlRegex = /```html\n([\s\S]*?)```/;
          const htmlMatch = htmlRegex.exec(msg.text);
          if (htmlMatch) { latestCode = htmlMatch[1]; break outerLoop; }

          const anyCodeRegex = /```(?:[a-z]*)\n([\s\S]*?)```/g;
          let match;
          while ((match = anyCodeRegex.exec(msg.text)) !== null) {
            latestCode = match[1];
          }
          if (latestCode) break outerLoop;
        }
      }
    }
    if (latestCode) {
      return { 'index.html': { content: latestCode, language: 'html' } };
    }
    return { 'index.html': { content: '<!-- New Project -->\n', language: 'html' } };
  };

  const getPreviewHtml = () => {
    const files = getProjectFiles();
    let html = files['index.html']?.content || '';
    
    const cssFiles = Object.entries(files).filter(([k]) => k.endsWith('.css')).map(([_, v]) => v.content);
    const jsFiles = Object.entries(files).filter(([k]) => k.endsWith('.js')).map(([_, v]) => v.content);
    
    if (html) {
      const styleTags = cssFiles.map(css => `<style>${css}</style>`).join('\n');
      const scriptTags = jsFiles.map(js => `<script>${js}</script>`).join('\n');
      
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${styleTags}\n</head>`);
      } else {
        html = `${styleTags}\n${html}`;
      }
      
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${scriptTags}\n</body>`);
      } else {
        html = `${html}\n${scriptTags}`;
      }
    }
    return html;
  };

  const updateProjectFiles = async (newFiles: Record<string, { content: string, language: string }>) => {
    if (!currentProjectId) return;
    try {
      await updateDoc(doc(db, 'projects', currentProjectId), {
        files: newFiles
      });
    } catch (err) {
      console.error("Failed to update project files:", err);
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      setIsCreatingFile(false);
      return;
    }
    const name = newFileName.trim();
    const ext = name.split('.').pop() || 'text';
    const languageMap: Record<string, string> = { js: 'javascript', ts: 'typescript', html: 'html', css: 'css', py: 'python', json: 'json', md: 'markdown' };
    const language = languageMap[ext] || ext;
    
    const newFiles = { ...getProjectFiles() };
    if (!newFiles[name]) {
      newFiles[name] = { content: '', language };
      await updateProjectFiles(newFiles);
    }
    setActiveFile(name);
    setNewFileName('');
    setIsCreatingFile(false);
  };

  const getLatestProjectCode = () => {
    if (!currentProjectId) return '';
    
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'model') {
        const htmlRegex = /```html\n([\s\S]*?)```/;
        const htmlMatch = htmlRegex.exec(msg.text);
        if (htmlMatch) return htmlMatch[1];

        const anyCodeRegex = /```(?:[a-z]*)\n([\s\S]*?)```/g;
        let match;
        let lastCode = '';
        while ((match = anyCodeRegex.exec(msg.text)) !== null) {
          lastCode = match[1];
        }
        if (lastCode) return lastCode;
      }
    }

    const projectChats = chats.filter(c => c.projectId === currentProjectId && c.id !== currentChatId);
    const sortedChats = [...projectChats].sort((a, b) => {
      const timeA = a.updatedAt?.toMillis?.() || 0;
      const timeB = b.updatedAt?.toMillis?.() || 0;
      return timeB - timeA;
    });
    
    for (const chat of sortedChats) {
      const chatMsgs = chat.messages || [];
      for (let i = chatMsgs.length - 1; i >= 0; i--) {
        const msg = chatMsgs[i];
        if (msg.role === 'model') {
          const htmlRegex = /```html\n([\s\S]*?)```/;
          const htmlMatch = htmlRegex.exec(msg.text);
          if (htmlMatch) return htmlMatch[1];

          const anyCodeRegex = /```(?:[a-z]*)\n([\s\S]*?)```/g;
          let match;
          let lastCode = '';
          while ((match = anyCodeRegex.exec(msg.text)) !== null) {
            lastCode = match[1];
          }
          if (lastCode) return lastCode;
        }
      }
    }
    return '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      setAttachments(prev => [...prev, ...Array.from(e.clipboardData.files)]);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Failed to convert to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    autoScrollRef.current = true;
    const userText = input.trim();
    const currentAttachments = [...attachments];
    
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    const newUserMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: userText,
      attachments: currentAttachments.map(f => ({ name: f.name, type: f.type, url: URL.createObjectURL(f) }))
    };
    
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const parts: any[] = [];
      let textContent = userText;
      
      for (const file of currentAttachments) {
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
          const base64Data = await fileToBase64(file);
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: file.type || 'application/octet-stream'
            }
          });
        } else {
          const text = await file.text();
          textContent += `\n\n--- File: ${file.name} ---\n\`\`\`\n${text}\n\`\`\`\n--- End of File ---`;
        }
      }

      if (textContent) {
        parts.unshift({ text: textContent });
      }

      let projectContext = "";
      if (currentProjectId) {
        const projectChats = chats.filter(c => c.projectId === currentProjectId && c.id !== currentChatId);
        projectContext = projectChats.map(c => `--- Chat: ${c.title} ---\n` + c.messages.map((m: any) => `${m.role}: ${m.text}`).join('\n')).join('\n\n');
      }

      const responseStream = await generateChatResponse(selectedModel.id, messages, parts, projectContext, selectedModel.name);
      
      const botMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: '' }]);

      let fullText = '';
      for await (const chunk of responseStream) {
        fullText += chunk.text;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === botMsgId ? { ...msg, text: fullText } : msg
          )
        );
      }

      const msgForDb = { ...newUserMsg, attachments: currentAttachments.map(f => ({ name: f.name, type: f.type })) };
      const finalMessages = [...messages, msgForDb, { id: botMsgId, role: 'model', text: fullText }];
      
      let title = "New Chat";
      if (!currentChatId && userText) {
        title = userText.length > 30 ? userText.substring(0, 30) + '...' : userText;
      } else if (currentChatId) {
        const existingChat = chats.find(c => c.id === currentChatId);
        if (existingChat) title = existingChat.title;
      }

      if (currentChatId) {
        await updateDoc(doc(db, 'chats', currentChatId), {
          messages: finalMessages,
          updatedAt: serverTimestamp()
        });
      } else {
        const docRef = await addDoc(collection(db, 'chats'), {
          userId: user.uid,
          projectId: currentProjectId || null,
          title: title,
          messages: finalMessages,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        setCurrentChatId(docRef.id);
      }

      // Apply any multi-file creations or updates from AI response
      if (currentProjectId) {
        const filePattern = /\*\*(.*?)\*\*\s*```([a-z0-9]*)\n([\s\S]*?)```/g;
        let match;
        const newFiles = { ...getProjectFiles() };
        let filesUpdated = false;
        while ((match = filePattern.exec(fullText)) !== null) {
          const filename = match[1].trim();
          const language = match[2].trim() || 'text';
          const content = match[3];
          newFiles[filename] = { content, language };
          filesUpdated = true;
        }
        
        if (!filesUpdated) {
          // Legacy/fallback extraction (single file)
          const htmlRegex = /```html\n([\s\S]*?)```/;
          const htmlMatch = htmlRegex.exec(fullText);
          if (htmlMatch) {
            newFiles['index.html'] = { content: htmlMatch[1], language: 'html' };
            filesUpdated = true;
          }
        }
        
        if (filesUpdated) {
          await updateProjectFiles(newFiles);
        }
      }

    } catch (error: any) {
      console.error("Error sending message:", error);
      setMessages(prev => [
        ...prev, 
        { id: Date.now().toString(), role: 'model', text: `Sorry, I encountered an error processing your request.\n\n\`\`\`\n${error.message || 'Unknown error'}\n\`\`\`` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="flex h-[100dvh] bg-[#242424] text-gray-100 font-sans overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
      {isMobile && isSidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-20"
          onClick={() => setIsSidebarExpanded(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        style={{ 
          width: isMobile ? 280 : (isSidebarExpanded ? sidebarWidth : 60),
          transform: isMobile && !isSidebarExpanded ? 'translateX(-100%)' : 'translateX(0)'
        }}
        className={`bg-[#1e1e1e] border-r border-[#333] flex flex-col h-full flex-shrink-0 z-30 transition-all duration-300 ease-in-out ${isMobile ? 'absolute left-0 top-0 bottom-0' : 'relative'}`}
      >
        {isSidebarExpanded && !isMobile && (
          <div 
            onMouseDown={startResizing}
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#007acc] transition-colors z-50"
          />
        )}

        {isSidebarExpanded ? (
          <div className="flex flex-col h-full w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-2">
              <span className="font-serif text-xl text-gray-200 ml-2">Phoebus</span>
              <button onClick={() => setIsSidebarExpanded(false)} className="text-gray-400 hover:text-gray-200 p-1.5 rounded-md hover:bg-[#2a2a2a] transition-colors" title="Close sidebar">
                <PanelLeftClose size={18} />
              </button>
            </div>

        <div className="flex-1 overflow-y-auto py-2 select-none">
          <div className="px-4 py-2 mb-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#2a2a2a] text-gray-200 text-sm rounded-md pl-8 pr-3 py-1.5 border border-[#333] focus:border-[#555] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Projects Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between px-4 py-1 group cursor-pointer" onClick={() => setIsCreatingProject(true)}>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Projects</span>
              <button className="text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" title="New Project">
                <Plus size={14} />
              </button>
            </div>
            
            {isCreatingProject && (
              <div className="px-4 py-1 flex items-center gap-1">
                <Folder size={14} className="text-gray-500" />
                <input 
                  autoFocus 
                  value={newProjectName} 
                  onChange={e => setNewProjectName(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateProject(); if (e.key === 'Escape') setIsCreatingProject(false); }}
                  onBlur={() => { if (!newProjectName.trim()) setIsCreatingProject(false); }}
                  className="flex-1 bg-[#37373d] text-[13px] text-gray-200 px-1.5 py-0.5 border border-[#007acc] focus:outline-none rounded-sm" 
                  placeholder="Project name..." 
                />
              </div>
            )}

            {projects.filter(p => 
              !searchQuery || 
              p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              chats.some(c => c.projectId === p.id && c.title.toLowerCase().includes(searchQuery.toLowerCase()))
            ).map(p => {
              const isExpanded = expandedProjects.includes(p.id) || !!searchQuery;
              const projectChats = chats.filter(c => c.projectId === p.id && (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.title.toLowerCase().includes(searchQuery.toLowerCase())));
              
              return (
                <div key={p.id} className="flex flex-col">
                  <div 
                    className={`flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-[#2a2d2e] group`}
                    onClick={() => toggleProject(p.id)}
                  >
                    <div className="flex items-center gap-1 overflow-hidden">
                      {isExpanded ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
                      {isExpanded ? <FolderOpen size={14} className="text-blue-400 flex-shrink-0" /> : <Folder size={14} className="text-blue-400 flex-shrink-0" />}
                      <span className="text-[13px] text-gray-300 truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center">
                      <button 
                        onClick={(e) => handleDeleteProject(p.id, e)}
                        className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                        title="Delete Project"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCreatingChatInProject(p.id); if (!isExpanded) toggleProject(p.id); }}
                        className="text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                        title="New Chat in Project"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="flex flex-col">
                      {creatingChatInProject === p.id && (
                        <div className="flex items-center gap-1 pl-8 pr-2 py-1">
                          <FileText size={14} className="text-gray-500 flex-shrink-0" />
                          <input 
                            autoFocus 
                            value={newChatName} 
                            onChange={e => setNewChatName(e.target.value)} 
                            onKeyDown={e => { if (e.key === 'Enter') handleCreateProjectChat(p.id); if (e.key === 'Escape') setCreatingChatInProject(null); }}
                            onBlur={() => { if (!newChatName.trim()) setCreatingChatInProject(null); }}
                            className="flex-1 bg-[#37373d] text-[13px] text-gray-200 px-1.5 py-0.5 border border-[#007acc] focus:outline-none rounded-sm" 
                            placeholder="Chat name..." 
                          />
                        </div>
                      )}
                      {projectChats.map(chat => (
                        editingChatId === chat.id ? (
                          <div key={chat.id} className="flex items-center gap-1 pl-8 pr-2 py-1">
                            <FileText size={14} className="text-gray-500 flex-shrink-0" />
                            <input 
                              autoFocus 
                              value={editingChatName} 
                              onChange={e => setEditingChatName(e.target.value)} 
                              onKeyDown={e => { if (e.key === 'Enter') handleRenameChat(chat.id); if (e.key === 'Escape') setEditingChatId(null); }}
                              onBlur={() => handleRenameChat(chat.id)}
                              className="flex-1 bg-[#37373d] text-[13px] text-gray-200 px-1.5 py-0.5 border border-[#007acc] focus:outline-none rounded-sm" 
                            />
                          </div>
                        ) : (
                          <div 
                            key={chat.id}
                            onClick={() => { loadChat(chat); setCurrentProjectId(p.id); if (isMobile) setIsSidebarExpanded(false); }}
                            className={`flex items-center justify-between pl-8 pr-2 py-1 cursor-pointer hover:bg-[#2a2d2e] group/chat ${currentChatId === chat.id ? 'bg-[#37373d] text-white' : 'text-gray-400'}`}
                          >
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <FileText size={14} className="flex-shrink-0" />
                              <span className="text-[13px] truncate">{chat.title}</span>
                            </div>
                            <div className="flex items-center">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setEditingChatId(chat.id); setEditingChatName(chat.title); }}
                                className="text-gray-500 hover:text-blue-400 opacity-0 group-hover/chat:opacity-100 transition-opacity px-1"
                                title="Rename Chat"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button 
                                onClick={(e) => handleDeleteChat(chat.id, e)}
                                className="text-gray-500 hover:text-red-400 opacity-0 group-hover/chat:opacity-100 transition-opacity px-1"
                                title="Delete Chat"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Standalone Chats Section */}
          <div>
            <div className="flex items-center justify-between px-4 py-1 group cursor-pointer" onClick={() => { setCurrentProjectId(null); startNewChat(); if (isMobile) setIsSidebarExpanded(false); }}>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Standalone Chats</span>
              <button className="text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" title="New Chat">
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-col">
              {chats.filter(c => !c.projectId && (!searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()))).map(chat => (
                editingChatId === chat.id ? (
                  <div key={chat.id} className="flex items-center gap-1.5 px-6 py-1">
                    <MessageSquare size={14} className="text-gray-500 flex-shrink-0" />
                    <input 
                      autoFocus 
                      value={editingChatName} 
                      onChange={e => setEditingChatName(e.target.value)} 
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameChat(chat.id); if (e.key === 'Escape') setEditingChatId(null); }}
                      onBlur={() => handleRenameChat(chat.id)}
                      className="flex-1 bg-[#37373d] text-[13px] text-gray-200 px-1.5 py-0.5 border border-[#007acc] focus:outline-none rounded-sm" 
                    />
                  </div>
                ) : (
                  <div 
                    key={chat.id}
                    onClick={() => { loadChat(chat); setCurrentProjectId(null); if (isMobile) setIsSidebarExpanded(false); }}
                    className={`flex items-center justify-between px-6 py-1 cursor-pointer hover:bg-[#2a2d2e] group/chat ${currentChatId === chat.id ? 'bg-[#37373d] text-white' : 'text-gray-400'}`}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <MessageSquare size={14} className="flex-shrink-0" />
                      <span className="text-[13px] truncate">{chat.title}</span>
                    </div>
                    <div className="flex items-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingChatId(chat.id); setEditingChatName(chat.title); }}
                        className="text-gray-500 hover:text-blue-400 opacity-0 group-hover/chat:opacity-100 transition-opacity px-1"
                        title="Rename Chat"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                        className="text-gray-500 hover:text-red-400 opacity-0 group-hover/chat:opacity-100 transition-opacity px-1"
                        title="Delete Chat"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-[#333] relative" ref={profileDropdownRef}>
          <button 
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#2a2a2a] transition-colors"
          >
            <div className="w-8 h-8 bg-[#333] rounded-full flex items-center justify-center text-gray-300 overflow-hidden border border-[#444] flex-shrink-0">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-xs font-semibold">{user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}</span>
              )}
            </div>
            <div className="flex-1 text-left truncate">
              <p className="text-sm text-gray-200 font-medium truncate">{user.displayName || 'User'}</p>
            </div>
          </button>

          {isProfileDropdownOpen && (
            <div className="absolute bottom-full left-4 mb-2 w-56 bg-[#2f2f2f] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-[#3a3a3a]">
                <p className="text-sm text-gray-200 font-medium truncate">{user.displayName || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <button
                onClick={() => {
                  setIsProfileDropdownOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-[#3a3a3a] transition-colors flex items-center gap-2"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
        </div>
        ) : (
          <div className="flex flex-col items-center h-full w-full py-3 gap-4">
            <button onClick={() => setIsSidebarExpanded(true)} className="text-gray-400 hover:text-gray-200 p-2 rounded-md hover:bg-[#2a2a2a] transition-colors" title="Expand sidebar">
              <PanelLeftOpen size={20} />
            </button>
            <button onClick={() => { setIsSidebarExpanded(true); startNewChat(); if (isMobile) setIsSidebarExpanded(false); }} className="text-gray-400 hover:text-gray-200 p-2 rounded-full bg-[#2a2a2a] hover:bg-[#333] transition-colors mt-2" title="New Chat">
              <Plus size={20} />
            </button>
            <button onClick={() => { setIsSidebarExpanded(true); setTimeout(() => document.querySelector<HTMLInputElement>('input[placeholder="Search chats..."]')?.focus(), 100); }} className="text-gray-400 hover:text-gray-200 p-2 rounded-md hover:bg-[#2a2a2a] transition-colors" title="Search">
              <Search size={20} />
            </button>
            <button onClick={() => setIsSidebarExpanded(true)} className="text-gray-400 hover:text-gray-200 p-2 rounded-md hover:bg-[#2a2a2a] transition-colors" title="Chats">
              <MessageSquare size={20} />
            </button>
            <button onClick={() => setIsSidebarExpanded(true)} className="text-gray-400 hover:text-gray-200 p-2 rounded-md hover:bg-[#2a2a2a] transition-colors" title="Projects">
              <Folder size={20} />
            </button>
            <div className="mt-auto relative flex justify-center w-full" ref={profileDropdownRef}>
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="w-8 h-8 bg-[#333] rounded-full flex items-center justify-center text-gray-300 overflow-hidden border border-[#444] flex-shrink-0 hover:ring-2 hover:ring-[#444] transition-all"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-xs font-semibold">{user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}</span>
                )}
              </button>
              {isProfileDropdownOpen && (
                <div className="absolute bottom-0 left-12 mb-2 w-56 bg-[#2f2f2f] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-[#3a3a3a]">
                    <p className="text-sm text-gray-200 font-medium truncate">{user.displayName || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-[#3a3a3a] transition-colors flex items-center gap-2"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative h-full min-w-0 w-full">
        {isMobile && (
          <div className="absolute top-4 left-4 z-10">
            <button 
              onClick={() => setIsSidebarExpanded(true)}
              className="p-2 bg-[#2f2f2f] rounded-md text-gray-400 hover:text-white border border-[#3a3a3a] shadow-md"
            >
              <PanelLeftOpen size={20} />
            </button>
          </div>
        )}
        
        {currentProjectId && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-[#1e1e1e] border border-[#333] p-1 rounded-lg flex items-center gap-1 shadow-sm">
            <button 
              onClick={() => setProjectMode('preview')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${projectMode === 'preview' ? 'bg-[#333] text-gray-100' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {projectMode === 'preview' && <div className="w-2 h-2 rounded-full bg-gray-400" />}
              Preview
            </button>
            <button 
              onClick={() => setProjectMode('code')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${projectMode === 'code' ? 'bg-[#333] text-gray-100' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Code
            </button>
            <button 
              onClick={() => setProjectMode('chat')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${projectMode === 'chat' ? 'bg-[#333] text-gray-100' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Chat
            </button>
          </div>
        )}

        {currentProjectId && !isMobile && (
          <div className="absolute top-4 left-4 z-30 bg-[#2f2f2f] border border-[#3a3a3a] px-3 py-1.5 rounded-full flex items-center gap-2 text-xs text-gray-300 shadow-sm">
            <Folder size={12} className="text-emerald-400" />
            <span className="max-w-[200px] truncate">{projects.find(p => p.id === currentProjectId)?.name}</span>
          </div>
        )}

        {projectMode === 'preview' && currentProjectId ? (
          <div className="flex-1 w-full h-full bg-white pt-16">
            <iframe 
              srcDoc={getPreviewHtml()} 
              className="w-full h-full border-none"
              sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
            />
          </div>
        ) : projectMode === 'code' && currentProjectId ? (
          <div className="flex-1 w-full h-full bg-[#1e1e1e] pt-16 flex flex-col relative">
            <div className="flex bg-[#1e1e1e] border-b border-[#333] overflow-x-auto">
              {Object.keys(getProjectFiles()).map(fileName => (
                <button
                  key={fileName}
                  onClick={() => {
                    setActiveFile(fileName);
                    if (isEditingCode) setIsEditingCode(false);
                  }}
                  className={`px-4 py-2 text-sm border-r border-[#333] whitespace-nowrap ${activeFile === fileName ? 'bg-[#2a2a2a] text-white border-t-2 border-t-emerald-500' : 'text-gray-400 hover:bg-[#252525]'}`}
                >
                  <FileCode2 size={14} className="inline-block mr-2 text-gray-500" />
                  {fileName}
                </button>
              ))}
              {isCreatingFile ? (
                <div className="flex items-center px-2 py-1 border-r border-[#333]">
                  <input 
                    autoFocus
                    type="text" 
                    className="bg-[#2a2a2a] text-white border border-[#444] rounded px-2 py-1 text-sm outline-none w-32"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFile();
                      if (e.key === 'Escape') setIsCreatingFile(false);
                    }}
                    onBlur={() => setIsCreatingFile(false)}
                    placeholder="filename.ext"
                  />
                </div>
              ) : (
                <button onClick={() => setIsCreatingFile(true)} className="px-4 py-2 text-gray-400 hover:text-white" title="New File">
                  <Plus size={16} />
                </button>
              )}
            </div>
            
            <div className="absolute top-20 right-4 z-40 flex items-center gap-2">
              {isEditingCode ? (
                <>
                  <button onClick={() => setIsEditingCode(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">Cancel</button>
                  <button onClick={handleSaveEditedCode} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors">Save Changes</button>
                </>
              ) : (
                <button onClick={() => { setEditedCode(getProjectFiles()[activeFile]?.content || ''); setIsEditingCode(true); }} className="p-2 bg-[#2f2f2f] border border-[#3a3a3a] rounded-md text-gray-400 hover:text-gray-200 transition-colors shadow-sm" title="Edit Code">
                  <Pencil size={16} />
                </button>
              )}
            </div>
            <div className="flex-1 w-full bg-[#1e1e1e]">
              <Editor
                height="100%"
                language={getProjectFiles()[activeFile]?.language || 'plaintext'}
                theme="vs-dark"
                value={isEditingCode ? editedCode : (getProjectFiles()[activeFile]?.content || '')}
                onChange={(value) => setEditedCode(value || '')}
                options={{
                  readOnly: !isEditingCode,
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  padding: { top: 24 }
                }}
              />
            </div>
          </div>
        ) : (
          <>
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
            <div className="mb-8 flex items-center gap-3">
              <Sparkles className="text-orange-400" size={32} />
              <h1 className="text-4xl md:text-5xl font-serif text-gray-200 tracking-tight">
                {getGreeting()}, {user.displayName ? user.displayName.split(' ')[0] : 'Developer'}
              </h1>
            </div>
            
            <div className="w-full max-w-3xl bg-[#2f2f2f] rounded-2xl border border-[#3a3a3a] shadow-lg flex flex-col overflow-visible relative">
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 pb-0">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#3a3a3a] px-3 py-1.5 rounded-lg text-sm border border-[#444]">
                      {file.type.startsWith('image/') ? <ImageIcon size={14} className="text-blue-400" /> : <FileIcon size={14} className="text-emerald-400" />}
                      <span className="max-w-[150px] truncate text-gray-300">{file.name}</span>
                      <button onClick={() => removeAttachment(i)} className="text-gray-500 hover:text-gray-200 ml-1">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="How can I help you today?"
                className="w-full bg-transparent text-gray-100 placeholder-gray-400 p-4 resize-none focus:outline-none min-h-[100px] text-[15px]"
                autoFocus
              />
              <div className="flex items-center justify-between p-3 pt-0">
                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    multiple 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                    accept="image/*,.pdf,.txt,.js,.ts,.py,.json,.md"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors rounded-md hover:bg-[#3a3a3a]"
                    title="Attach files"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-2 relative" ref={modelDropdownRef}>
                  <button 
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-1.5 rounded-md hover:bg-[#3a3a3a]"
                  >
                    {selectedModel.name} <ChevronDown size={14} />
                  </button>
                  
                  {isModelDropdownOpen && (
                    <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#2f2f2f] border border-[#3a3a3a] rounded-lg shadow-xl overflow-y-auto overflow-x-hidden max-h-[40vh] z-50 custom-scrollbar">
                      {MODELS.map(model => (
                        <button
                          key={model.name}
                          onClick={() => {
                            setSelectedModel(model);
                            setIsModelDropdownOpen(false);
                            setMessages([]);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm hover:bg-[#3a3a3a] transition-colors border-b border-[#3a3a3a] last:border-0 ${selectedModel.name === model.name ? 'bg-[#3a3a3a]' : ''}`}
                        >
                          <div className={`font-medium ${selectedModel.name === model.name ? 'text-white' : 'text-gray-200'}`}>{model.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{model.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              {[
                { label: "Write a React component", action: "Write a React component for a data table with sorting and filtering." },
                { label: "Explain Rust", action: "Explain how Rust's borrow checker works with simple examples." },
                { label: "Debug Code", action: "Help me debug a piece of code. I will provide it in the next message." },
                { label: "Architecture", action: "Design a scalable microservices architecture for an e-commerce platform." }
              ].map((item, i) => (
                <button 
                  key={i} 
                  onClick={() => handleSuggestionClick(item.action)}
                  className="px-4 py-2 rounded-full border border-[#3a3a3a] text-sm text-gray-300 hover:bg-[#2f2f2f] transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-6 md:px-8 scroll-smooth"
            >
              <div className="max-w-3xl mx-auto flex flex-col">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} role={msg.role} text={msg.text} attachments={msg.attachments} isProjectChat={!!currentProjectId} />
                ))}
                {isLoading && (
                  <div className="flex justify-start mb-8">
                    <div className="text-gray-400 text-sm animate-pulse">
                      {selectedModel.name.split(' ')[0]} is thinking...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-32" />
              </div>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#242424] via-[#242424] to-transparent pt-10 pb-6 px-4">
              <div className="max-w-3xl mx-auto">
                <div className="w-full bg-[#2f2f2f] rounded-2xl border border-[#3a3a3a] shadow-lg flex flex-col relative">
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 pb-0">
                      {attachments.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 bg-[#3a3a3a] px-3 py-1.5 rounded-lg text-sm border border-[#444]">
                          {file.type.startsWith('image/') ? <ImageIcon size={14} className="text-blue-400" /> : <FileIcon size={14} className="text-emerald-400" />}
                          <span className="max-w-[150px] truncate text-gray-300">{file.name}</span>
                          <button onClick={() => removeAttachment(i)} className="text-gray-500 hover:text-gray-200 ml-1">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="Reply..."
                    className="w-full bg-transparent text-gray-100 placeholder-gray-400 p-4 resize-none focus:outline-none min-h-[56px] max-h-[200px] text-[15px]"
                    rows={1}
                    autoFocus
                  />
                  <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileChange}
                        accept="image/*,.pdf,.txt,.js,.ts,.py,.json,.md"
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors rounded-md hover:bg-[#3a3a3a]"
                        title="Attach files"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 relative" ref={modelDropdownRef}>
                      <button 
                        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-1.5 rounded-md hover:bg-[#3a3a3a]"
                      >
                        {selectedModel.name} <ChevronDown size={14} />
                      </button>
                      
                      {isModelDropdownOpen && (
                        <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#2f2f2f] border border-[#3a3a3a] rounded-lg shadow-xl overflow-y-auto overflow-x-hidden max-h-[40vh] z-50 custom-scrollbar">
                          {MODELS.map(model => (
                            <button
                              key={model.name}
                              onClick={() => {
                                setSelectedModel(model);
                                setIsModelDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-3 text-sm hover:bg-[#3a3a3a] transition-colors border-b border-[#3a3a3a] last:border-0 ${selectedModel.name === model.name ? 'bg-[#3a3a3a]' : ''}`}
                            >
                              <div className={`font-medium ${selectedModel.name === model.name ? 'text-white' : 'text-gray-200'}`}>{model.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{model.description}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-center mt-2">
                  <p className="text-[11px] text-gray-500">
                    Phoebus is AI and can make mistakes. Please double-check responses.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
        </>
        )}
      </main>
      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#2f2f2f] border border-[#3a3a3a] rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">
              Delete {deleteConfirmation.type === 'project' ? 'Project' : 'Chat'}
            </h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete this {deleteConfirmation.type}? 
              {deleteConfirmation.type === 'project' && ' All chats within this project will also be deleted.'}
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-[#3a3a3a] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
