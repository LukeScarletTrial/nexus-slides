import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, Play, Image as ImageIcon, Type, Square, 
  MoreVertical, Plus, Trash2, Wand2, Download, Video, X,
  Circle, Triangle, Star, Box, Search, Upload, Hexagon, ArrowRight,
  Layout, LogOut, Crown, ChevronLeft, ChevronRight, CreditCard, Sparkles, Mail, Lock, User as UserIcon, Bug, Coins, ArrowRightLeft, Check,
  Copy, Layers, ArrowUp, ArrowDown, Maximize, Droplets, AlignLeft, AlignCenter, AlignRight, Code, Globe, Link as LinkIcon, MousePointerClick, Settings, Key, Cpu, MessageSquare, Send, Zap, FileJson, FileType, FileVideo
} from 'lucide-react';
import { SlideEditor } from './components/SlideEditor';
import { Slide, SlideElement, Presentation, ShapeType, User, TransitionType } from './types';
import { generateSlideContent, generateImage, AIConfig, AIProvider } from './services/ai';
import { 
  signInWithGoogle, 
  signOut, 
  subscribeToAuthChanges, 
  getPresentations, 
  savePresentation, 
  deletePresentation,
  loginWithEmail,
  registerWithEmail,
  reportBug
} from './services/firebase';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// Helper to create IDs
const uid = () => Math.random().toString(36).substr(2, 9);

const DEFAULT_GEMINI_KEY = "AIzaSyBxO9eISqZmjes5XSgIb0l1VFSCCFNK2S8";

// --- Animation Variants ---
const variants: Record<string, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.5 } },
    exit: { opacity: 0, transition: { duration: 0.5 } }
  },
  slide: {
    initial: { x: '100%' },
    animate: { x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
    exit: { x: '-100%', transition: { duration: 0.3 } }
  },
  cover: {
    initial: { y: '100%' },
    animate: { y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
    exit: { opacity: 0, transition: { duration: 0.3 } } 
  },
  zoom: {
    initial: { scale: 0.5, opacity: 0 },
    animate: { scale: 1, opacity: 1, transition: { duration: 0.5 } },
    exit: { scale: 1.5, opacity: 0, transition: { duration: 0.5 } }
  },
  push: {
    initial: { x: '100%', opacity: 1 },
    animate: { x: 0, opacity: 1, transition: { ease: 'easeInOut', duration: 0.5 } },
    exit: { x: '-25%', opacity: 0.5, transition: { ease: 'easeInOut', duration: 0.5 } }
  },
  none: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 1 }
  }
};

const getSlideTransition = (transitionName?: string) => {
    return variants[transitionName || 'fade'] || variants.fade;
};

const FONTS = [
  'Inter', 
  'Roboto', 
  'Open Sans', 
  'Lato', 
  'Montserrat', 
  'Playfair Display', 
  'Merriweather', 
  'Courier Prime'
];

const AVAILABLE_MODELS: Record<AIProvider, { id: string, name: string }[]> = {
    gemini: [
        { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (Fastest)' },
        { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro' }
    ],
    openai: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
    ],
    grok: [
        { id: 'grok-beta', name: 'Grok Beta' }
    ],
    deepseek: [
        { id: 'deepseek-chat', name: 'DeepSeek V3' }
    ]
};

const INITIAL_SLIDE: Slide = {
  id: uid(),
  name: 'Home',
  elements: [
    {
      id: uid(),
      type: 'text',
      content: 'Double click to edit title',
      position: { x: 100, y: 100 },
      size: { width: 760, height: 100 },
      style: { fontSize: 48, fontFamily: 'Inter', fontWeight: 'bold', zIndex: 1, color: '#1f2937' }
    }
  ],
  backgroundColor: '#ffffff',
  duration: 3,
  transition: 'fade'
};

const STOCK_PHOTOS = {
  Business: [
    "https://images.unsplash.com/photo-1664575602276-acd073f104c1?w=600&q=80",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=80",
    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80"
  ],
  Technology: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&q=80",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&q=80",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80"
  ],
  Nature: [
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&q=80",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80",
    "https://images.unsplash.com/photo-1501854140884-074cf2b21d25?w=600&q=80",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&q=80"
  ]
};

const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
  'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(to top, #30cfd0 0%, #330867 100%)',
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  'transparent'
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'home' | 'editor'>('home');
  const [currentPresentation, setCurrentPresentation] = useState<Presentation | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((u) => {
      setUser(u);
      if (u) setIsAuthModalOpen(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateNew = (type: 'slide' | 'website') => {
    const newPres: Presentation = {
      id: uid(),
      title: type === 'website' ? 'Untitled Website' : 'Untitled Presentation',
      slides: [{...INITIAL_SLIDE, id: uid(), name: 'index'}],
      lastModified: Date.now(),
      userId: user?.uid,
      type: type
    };
    setCurrentPresentation(newPres);
    setView('editor');
  };

  const handleOpen = (pres: Presentation) => {
    setCurrentPresentation(pres);
    setView('editor');
  };

  const handleSave = async (pres: Presentation) => {
    if (user) {
      await savePresentation(pres, user);
    }
  };
  
  if (view === 'editor' && currentPresentation) {
    return (
      <Editor 
        presentation={currentPresentation} 
        user={user}
        onBack={() => setView('home')}
        onSave={handleSave}
      />
    );
  }

  return (
    <>
      <Dashboard 
        user={user} 
        onCreate={() => handleCreateNew('slide')}
        onCreateWebsite={() => handleCreateNew('website')}
        onOpen={handleOpen}
        onLogin={() => setIsAuthModalOpen(true)}
        onReportBug={() => setIsBugModalOpen(true)}
      />
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
      {isBugModalOpen && user && (
          <BugReportModal 
             user={user} 
             onClose={() => setIsBugModalOpen(false)} 
             onUpdateUser={setUser} 
          />
      )}
    </>
  );
}

function BugReportModal({ user, onClose, onUpdateUser }: { user: User, onClose: () => void, onUpdateUser: (u: User) => void }) {
    const [desc, setDesc] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [msg, setMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('submitting');
        try {
            const res = await reportBug(user, desc);
            setMsg(res.message);
            if(res.success) {
                setStatus('success');
                setTimeout(onClose, 2000);
            } else {
                setStatus('error');
            }
        } catch(e) {
            setStatus('error');
            setMsg("Something went wrong.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2"><MessageSquare className="text-indigo-600" /> Send Feedback</h2>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>
                
                {status === 'success' ? (
                    <div className="text-center py-8 text-green-600">
                        <Check size={48} className="mx-auto mb-3" />
                        <p className="font-bold text-lg">{msg}</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <p className="text-sm text-gray-600 mb-4">
                            Found a glitch or have a suggestion? Let us know!
                        </p>
                        <textarea 
                            className="w-full border border-gray-300 rounded-lg p-3 h-32 resize-none focus:ring-2 focus:ring-indigo-500 mb-4"
                            placeholder="Describe what happened..."
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            required
                        />
                        {status === 'error' && <p className="text-red-500 text-sm mb-3">{msg}</p>}
                        <button 
                            type="submit" 
                            disabled={status === 'submitting' || !desc.trim()}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {status === 'submitting' ? 'Sending...' : 'Submit Feedback'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        if (!name) throw new Error("Name is required");
        await registerWithEmail(name, email, password, rememberMe);
      } else {
        await loginWithEmail(email, password, rememberMe);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Email is already registered.");
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError("Invalid email or password.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else {
        setError(err.message || "Authentication failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
           <X size={20} />
        </button>
        
        <div className="p-8 pb-4">
           <h2 className="text-2xl font-bold text-gray-900 mb-2">{isSignUp ? 'Create an account' : 'Welcome back'}</h2>
           <p className="text-gray-500 text-sm">
             {isSignUp ? 'Enter your details to get started with Nexus' : 'Enter your credentials to access your account'}
           </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 pt-2 flex flex-col gap-4">
           {error && (
             <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
               {error}
             </div>
           )}

           {isSignUp && (
             <div className="relative">
               <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
               <input 
                 type="text" 
                 placeholder="Full Name"
                 value={name}
                 onChange={e => setName(e.target.value)}
                 className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                 required={isSignUp}
               />
             </div>
           )}

           <div className="relative">
             <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
               type="email" 
               placeholder="Email address"
               value={email}
               onChange={e => setEmail(e.target.value)}
               className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
               required
             />
           </div>

           <div className="relative">
             <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
               type="password" 
               placeholder="Password"
               value={password}
               onChange={e => setPassword(e.target.value)}
               className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
               required
             />
           </div>

           <div className="flex items-center gap-2">
               <div 
                 onClick={() => setRememberMe(!rememberMe)}
                 className={`w-5 h-5 rounded border cursor-pointer flex items-center justify-center transition-colors ${rememberMe ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}
               >
                 {rememberMe && <Check size={14} className="text-white" />}
               </div>
               <label 
                 onClick={() => setRememberMe(!rememberMe)}
                 className="text-sm text-gray-600 cursor-pointer select-none"
               >
                 Remember me
               </label>
           </div>

           <button 
             type="submit" 
             disabled={loading}
             className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 mt-2 disabled:opacity-70 flex items-center justify-center"
           >
             {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (isSignUp ? 'Sign Up' : 'Log In')}
           </button>

           <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or continue with</span></div>
           </div>

           <button 
             type="button"
             onClick={() => signInWithGoogle(rememberMe)}
             className="w-full py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
           >
             <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
             Google
           </button>
        </form>

        <div className="bg-gray-50 p-4 text-center text-sm text-gray-600">
           {isSignUp ? 'Already have an account?' : "Don't have an account?"}
           <button onClick={() => setIsSignUp(!isSignUp)} className="ml-1 text-indigo-600 font-bold hover:underline">
             {isSignUp ? 'Log in' : 'Sign up'}
           </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user, onCreate, onCreateWebsite, onOpen, onLogin, onReportBug }: { user: User | null, onCreate: () => void, onCreateWebsite: () => void, onOpen: (p: Presentation) => void, onLogin: () => void, onReportBug: () => void }) {
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setLoading(true);
      getPresentations(user).then(setPresentations).finally(() => setLoading(false));
    } else {
      setPresentations([]);
    }
  }, [user]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (user && confirm("Are you sure you want to delete this project?")) {
       await deletePresentation(id, user);
       setPresentations(prev => prev.filter(p => p.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 pt-safe flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Square className="text-white w-6 h-6 fill-current" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">Nexus</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <button onClick={onReportBug} className="text-gray-500 hover:text-indigo-600 flex items-center gap-1 text-sm font-medium mr-2" title="Send Feedback">
                 <MessageSquare size={16} /> <span className="hidden sm:inline">Feedback</span>
              </button>

              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user.displayName || 'User'}</span>
                {user.photoURL ? (
                  <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="Profile" />
                ) : (
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                    {(user.displayName || 'U')[0]}
                  </div>
                )}
                <button onClick={() => signOut()} className="text-gray-400 hover:text-red-500">
                  <LogOut size={18} />
                </button>
              </div>
            </>
          ) : (
            <button 
              onClick={onLogin}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-shadow shadow-md hover:shadow-lg"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {!user ? (
          <div className="text-center py-20 animate-fade-in">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">Create stunning presentations <br/> with <span className="text-indigo-600">AI power</span></h1>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">Generate slides, design layouts, and export videos in seconds. The next generation presentation tool is here.</p>
            <button 
              onClick={onLogin}
              className="px-8 py-4 bg-indigo-600 text-white rounded-full text-lg font-bold hover:bg-indigo-700 transition-all hover:scale-105 shadow-xl shadow-indigo-200"
            >
              Get Started for Free
            </button>
          </div>
        ) : (
          <div className="animate-fade-in">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <h2 className="text-2xl font-bold text-gray-800">Your Projects</h2>
              <div className="flex gap-3 w-full sm:w-auto">
                  <button 
                    onClick={onCreateWebsite}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium shadow-sm hover:shadow-md whitespace-nowrap"
                  >
                    <Globe size={20} className="text-blue-500" /> <span className="hidden sm:inline">New </span>Web<span className="hidden sm:inline">site</span>
                  </button>
                  <button 
                    onClick={onCreate}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 whitespace-nowrap"
                  >
                    <Plus size={20} /> <span className="hidden sm:inline">New </span>Slide<span className="hidden sm:inline">s</span>
                  </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full"></div></div>
            ) : presentations.length === 0 ? (
               <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <Layout size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">No projects yet</h3>
                  <p className="text-gray-500 mb-6">Create your first presentation or website to get started</p>
                  <div className="flex justify-center gap-4">
                      <button onClick={onCreateWebsite} className="text-indigo-600 font-medium hover:underline">Create Website</button>
                      <button onClick={onCreate} className="text-indigo-600 font-medium hover:underline">Create Presentation</button>
                  </div>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {presentations.map(pres => (
                  <div 
                    key={pres.id} 
                    onClick={() => onOpen(pres)}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-indigo-300 transition-all cursor-pointer group flex flex-col h-60"
                  >
                    <div className="flex-1 bg-gray-100 relative p-4 flex items-center justify-center overflow-hidden">
                       <div className="w-full h-full bg-white shadow-sm rounded flex items-center justify-center text-gray-300 scale-90 group-hover:scale-100 transition-transform duration-300 relative">
                          {pres.thumbnailUrl ? <img src={pres.thumbnailUrl} className="w-full h-full object-cover" /> : <Layout size={40} />}
                          {pres.type === 'website' && <div className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">WEB</div>}
                       </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center">
                       <div className="w-full pr-2">
                         <h3 className="font-semibold text-gray-800 truncate">{pres.title}</h3>
                         <p className="text-xs text-gray-500">{new Date(pres.lastModified).toLocaleDateString()}</p>
                       </div>
                       <button 
                         onClick={(e) => handleDelete(e, pres.id)}
                         className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Editor({ presentation: initialPres, user, onBack, onSave }: { presentation: Presentation, user: User | null, onBack: () => void, onSave: (p: Presentation) => Promise<void> }) {
  const [presentation, setPresentation] = useState<Presentation>(initialPres);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.8);
  const [playMode, setPlayMode] = useState<'none' | 'present' | 'export-setup' | 'export-running'>('none');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'shapes' | 'images' | 'video'>('none');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string, hasAction?: boolean}[]>([
      { role: 'assistant', content: "Hi! I'm Nexus Assistant AI. I can build slides instantly. Try 'Create a pitch deck about AI'." }
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  
  // Custom API Key & Model Support
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini');
  const [providerKey, setProviderKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
     const cached = localStorage.getItem(`key_${selectedProvider}`);
     if(cached) setProviderKey(cached);
     else setProviderKey('');
     if(AVAILABLE_MODELS[selectedProvider]) {
         setSelectedModel(AVAILABLE_MODELS[selectedProvider][0].id);
     }
  }, [selectedProvider]);

  const saveKey = (key: string) => {
      setProviderKey(key);
      localStorage.setItem(`key_${selectedProvider}`, key);
  }
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if(isChatOpen) scrollToBottom();
  }, [chatMessages, isChatOpen, aiStatus]);

  useEffect(() => {
      if (aiLoading) {
          const statuses = [
              "Analyzing intent...",
              "Structuring layout...",
              "Drafting content...",
              "Selecting typography...",
              "Finalizing slides..."
          ];
          let i = 0;
          if (!aiStatus.includes("Rendering")) {
             setAiStatus(statuses[0]);
          }
          
          const interval = setInterval(() => {
              if (!aiStatus.includes("Rendering")) {
                  i = (i + 1) % statuses.length;
                  setAiStatus(statuses[i]);
              }
          }, 800);
          return () => clearInterval(interval);
      } else {
          setAiStatus('');
      }
  }, [aiLoading, aiStatus]);

  const currentSlide = presentation.slides[currentSlideIndex];
  const selectedElement = currentSlide.elements.find(el => el.id === selectedElementId);
  const isWebsite = presentation.type === 'website';

  // Auto-save logic
  useEffect(() => {
    // Skip the first render or if nothing changed to avoid unnecessary saves/states
    if (presentation === initialPres) return;

    setSaveStatus('unsaved');
    const timer = setTimeout(() => {
       setSaveStatus('saving');
       onSave(presentation).then(() => {
           setSaveStatus('saved');
       });
    }, 2000);
    return () => clearTimeout(timer);
  }, [presentation]);

  const handleManualSave = async () => {
      setSaveStatus('saving');
      try {
          await onSave(presentation);
          setSaveStatus('saved');
      } catch(e) {
          setSaveStatus('unsaved');
          alert("Failed to save. Please try again.");
      }
  };

  const updateSlide = (updatedSlide: Slide) => {
    const newSlides = [...presentation.slides];
    newSlides[currentSlideIndex] = updatedSlide;
    setPresentation({ ...presentation, slides: newSlides, lastModified: Date.now() });
  };

  const updateElement = (updatedElement: SlideElement) => {
    const updatedElements = currentSlide.elements.map(el => 
      el.id === updatedElement.id ? updatedElement : el
    );
    updateSlide({ ...currentSlide, elements: updatedElements });
  };

  const addElement = (type: 'text' | 'image' | 'shape' | 'video' | 'button', subType?: ShapeType, content?: string) => {
    const newElement: SlideElement = {
      id: uid(),
      type,
      shapeType: subType,
      content: content || (type === 'text' ? 'New Text' : (type === 'button' ? 'Click Me' : '')),
      position: { x: 300, y: 200 },
      size: { width: type === 'button' ? 160 : 300, height: type === 'text' ? 60 : (type === 'button' ? 50 : 300) },
      style: { 
        zIndex: currentSlide.elements.length + 1,
        backgroundColor: type === 'shape' || type === 'button' ? '#3b82f6' : undefined,
        background: type === 'shape' || type === 'button' ? '#3b82f6' : undefined,
        fontSize: type === 'button' ? 18 : 24,
        fontFamily: 'Inter',
        color: type === 'button' ? '#ffffff' : '#000',
        borderRadius: subType === 'rounded' || type === 'button' ? 20 : 0,
        textAlign: 'center'
      },
      animation: { type: 'fade', duration: 1, delay: 0 }
    };
    updateSlide({ ...currentSlide, elements: [...currentSlide.elements, newElement] });
  };

  const deleteElement = () => {
    if (!selectedElementId) return;
    const updatedElements = currentSlide.elements.filter(el => el.id !== selectedElementId);
    updateSlide({ ...currentSlide, elements: updatedElements });
    setSelectedElementId(null);
  };

  const duplicateElement = () => {
      if(!selectedElement) return;
      const newEl = { ...selectedElement, id: uid(), position: { x: selectedElement.position.x + 20, y: selectedElement.position.y + 20 } };
      updateSlide({ ...currentSlide, elements: [...currentSlide.elements, newEl] });
      setSelectedElementId(newEl.id);
  };

  const changeLayer = (dir: 'up' | 'down') => {
      if(!selectedElement) return;
      const sorted = [...currentSlide.elements].sort((a,b) => a.style.zIndex - b.style.zIndex);
      const currentIndex = sorted.findIndex(e => e.id === selectedElement.id);
      
      if(dir === 'up' && currentIndex < sorted.length - 1) {
          const next = sorted[currentIndex+1];
          const tempZ = next.style.zIndex;
          next.style.zIndex = selectedElement.style.zIndex;
          selectedElement.style.zIndex = tempZ;
          updateElement(selectedElement);
          updateElement(next); 
      } else if (dir === 'down' && currentIndex > 0) {
          const prev = sorted[currentIndex-1];
          const tempZ = prev.style.zIndex;
          prev.style.zIndex = selectedElement.style.zIndex;
          selectedElement.style.zIndex = tempZ;
          updateElement(selectedElement);
          updateElement(prev);
      } else {
          updateElement({ ...selectedElement, style: { ...selectedElement.style, zIndex: selectedElement.style.zIndex + (dir === 'up' ? 1 : -1) } });
      }
  };

  const addSlide = () => {
    const newSlide: Slide = {
      id: uid(),
      name: `page-${presentation.slides.length + 1}`,
      elements: [],
      backgroundColor: '#ffffff',
      duration: 3,
      transition: 'fade'
    };
    setPresentation({
      ...presentation,
      slides: [...presentation.slides, newSlide]
    });
    setCurrentSlideIndex(presentation.slides.length);
  };

  const deleteSlide = (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      if (presentation.slides.length <= 1) {
          alert("Cannot delete the last slide.");
          return;
      }
      
      const newSlides = presentation.slides.filter((_, i) => i !== index);
      setPresentation({ ...presentation, slides: newSlides, lastModified: Date.now() });
      
      if (index === currentSlideIndex) {
          setCurrentSlideIndex(Math.max(0, index - 1));
      } else if (index < currentSlideIndex) {
          setCurrentSlideIndex(currentSlideIndex - 1);
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
         addElement('image', undefined, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const url = URL.createObjectURL(file);
          addElement('video', undefined, url);
      }
  };

  const exportToJSON = () => {
      const dataStr = JSON.stringify(presentation, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${presentation.title.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExportMenuOpen(false);
  };

  const exportToHTML = () => {
      // Basic HTML template for the exported presentation
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${presentation.title}</title>
    <style>
        body { margin: 0; padding: 0; font-family: sans-serif; overflow: hidden; background: #000; color: white; }
        #app { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; position: relative; }
        .slide { display: none; width: 960px; height: 540px; position: relative; background-size: cover; background-position: center; overflow: hidden; transform-origin: center; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
        .slide.active { display: block; animation: fade 0.5s ease; }
        .element { position: absolute; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; z-index: 1000; background: rgba(0,0,0,0.5); padding: 10px 20px; border-radius: 30px; backdrop-filter: blur(10px); }
        .btn { background: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-weight: bold; font-size: 18px; display: flex; align-items: center; justify-content: center; opacity: 0.8; transition: opacity 0.2s; }
        .btn:hover { opacity: 1; }
        @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    </style>
</head>
<body>
    <div id="app">
        ${presentation.slides.map((slide, idx) => `
            <div class="slide ${idx === 0 ? 'active' : ''}" id="slide-${idx}" style="background-color: ${slide.backgroundColor}; ${slide.backgroundImage ? `background-image: url('${slide.backgroundImage}');` : ''}">
                ${slide.elements.map(el => {
                    const style = `left: ${el.position.x}px; top: ${el.position.y}px; width: ${el.size.width}px; height: ${el.size.height}px; z-index: ${el.style.zIndex}; 
                                   font-size: ${el.style.fontSize}px; font-family: ${el.style.fontFamily}, sans-serif; color: ${el.style.color}; 
                                   background-color: ${el.style.backgroundColor || 'transparent'}; border-radius: ${el.style.borderRadius}px;
                                   opacity: ${el.style.opacity || 1}; text-align: ${el.style.textAlign || 'left'}; 
                                   justify-content: ${el.style.textAlign === 'center' ? 'center' : (el.style.textAlign === 'right' ? 'flex-end' : 'flex-start')};`;
                    
                    let contentHtml = '';
                    if(el.type === 'text') contentHtml = el.content;
                    if(el.type === 'image') contentHtml = `<img src="${el.content}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`;
                    if(el.type === 'button') contentHtml = `<a href="${el.link || '#'}" style="text-decoration:none; color:inherit; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">${el.content}</a>`;
                    
                    return `<div class="element" style="${style}">${contentHtml}</div>`;
                }).join('')}
            </div>
        `).join('')}
    </div>
    
    <div class="controls">
        <button class="btn" onclick="prev()">←</button>
        <span id="counter" style="color: white; font-family: sans-serif; display: flex; align-items: center;">1 / ${presentation.slides.length}</span>
        <button class="btn" onclick="next()">→</button>
    </div>

    <script>
        let current = 0;
        const total = ${presentation.slides.length};
        
        function update() {
            document.querySelectorAll('.slide').forEach(el => el.classList.remove('active'));
            document.getElementById('slide-' + current).classList.add('active');
            document.getElementById('counter').innerText = (current + 1) + ' / ' + total;
        }

        function next() {
            if (current < total - 1) { current++; update(); }
        }

        function prev() {
            if (current > 0) { current--; update(); }
        }

        function resize() {
            const app = document.getElementById('app');
            const scale = Math.min(window.innerWidth / 960, window.innerHeight / 540);
            document.querySelectorAll('.slide').forEach(el => {
                el.style.transform = 'scale(' + scale + ')';
            });
        }

        window.addEventListener('resize', resize);
        resize();
        document.addEventListener('keydown', (e) => {
            if(e.key === 'ArrowRight' || e.key === ' ') next();
            if(e.key === 'ArrowLeft') prev();
        });
    </script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${presentation.title.replace(/\s+/g, '_')}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExportMenuOpen(false);
  };

  const exportToVideo = async () => {
    setIsExportMenuOpen(false);
    // 1. Enter "Setup" mode: Show the player, but don't start recording yet.
    setPlayMode('export-setup');
    
    // Small delay to let the modal render
    setTimeout(async () => {
        try {
            if (!confirm("Video Export Instructions:\n\n1. Select 'Entire Screen' or 'This Tab' in the next dialog.\n2. The presentation will play automatically.\n3. Do not interact while recording.\n\nClick OK to start.")) {
                setPlayMode('none');
                return;
            }

            // 2. Request Stream
            const mediaStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { 
                    displaySurface: "browser",
                    frameRate: 30
                } as any, 
                audio: false 
            });
            
            setStream(mediaStream);

            // 3. Determine Format (Prefer MP4 if available in Safari/Chrome, else WebM)
            const mimeType = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" :
                             MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : 
                             "video/webm";

            const mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;

            const chunks: Blob[] = [];
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                // Use .mp4 extension for compatibility if it's mp4 or user prefers it, otherwise .webm
                a.download = `${presentation.title.replace(/\s+/g, '_')}${mimeType.includes('mp4') ? '.mp4' : '.webm'}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Cleanup
                mediaStream.getTracks().forEach(track => track.stop());
                setStream(null);
                setPlayMode('none');
            };

            // 4. Start Recording
            mediaRecorder.start();

            // 5. Switch to Running Mode (Triggers AutoPlay in Player)
            // Add a small 1s delay so the recording catches the first frame stationary
            setTimeout(() => {
                setPlayMode('export-running');
            }, 1000);

        } catch (err) {
            console.error("Export failed:", err);
            setPlayMode('none');
            alert("Export cancelled or failed.");
        }
    }, 100);
  };

  const handleExportComplete = () => {
      // Add a small delay at the end before cutting
      setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
          }
      }, 1000);
  };

  const handleChatSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || aiLoading) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setAiLoading(true);

    try {
        const apiKeyToUse = selectedProvider === 'gemini' ? DEFAULT_GEMINI_KEY : providerKey;

        const config: AIConfig = {
            provider: selectedProvider,
            apiKey: apiKeyToUse,
            model: selectedModel
        };

        const generatedData = await generateSlideContent(userMsg, config);
        
        console.log("AI Data:", generatedData); 

        // Handle text reply
        if (generatedData.reply) {
             setChatMessages(prev => [...prev, { role: 'assistant', content: generatedData.reply, hasAction: !!(generatedData.slides?.length) }]);
        } else if (generatedData.slides?.length) {
             setChatMessages(prev => [...prev, { role: 'assistant', content: `I've created ${generatedData.slides.length} new slides for you!`, hasAction: true }]);
        } else {
             setChatMessages(prev => [...prev, { role: 'assistant', content: "I couldn't generate any slides for that request. Try being more specific." }]);
        }

        // Handle slide generation
        if (generatedData && Array.isArray(generatedData.slides) && generatedData.slides.length > 0) {
            setAiStatus("Rendering visual assets..."); // Explicit status

            const slidePromises = generatedData.slides.map(async (slideData: any) => {
                const newBgColor = slideData.backgroundColor || '#ffffff';

                // Parallel Background Gen
                let bgImage: string | undefined = undefined;
                if (slideData.backgroundImagePrompt) {
                    try {
                        const img = await generateImage(slideData.backgroundImagePrompt, config);
                        if (img) bgImage = img;
                    } catch(e) {
                        console.warn("Background image gen failed", e);
                    }
                }

                // Parallel Element Gen
                const elementPromises = (slideData.elements || []).map(async (elData: any) => {
                    let content = elData.content || '';
                    if (elData.type === 'image') {
                        try {
                            const generatedImageUrl = await generateImage(content, config);
                            if (generatedImageUrl) {
                                content = generatedImageUrl;
                            } else {
                                // FALLBACK IF AI FAILS
                                console.warn("AI Image generation returned null, using fallback.");
                                content = `https://placehold.co/600x400?text=AI+Gen+Failed`; 
                            }
                        } catch (e) {
                            console.error("Image generation failed", e);
                            content = `https://placehold.co/600x400?text=Error`;
                        }
                    }

                    // Robustly handle missing dimensions
                    const x = typeof elData.x === 'number' ? elData.x : 100;
                    const y = typeof elData.y === 'number' ? elData.y : 100;
                    const width = typeof elData.width === 'number' ? elData.width : 200;
                    const height = typeof elData.height === 'number' ? elData.height : 50;

                    return {
                        id: uid(),
                        type: elData.type as any,
                        content: content,
                        link: elData.link,
                        position: { x, y },
                        size: { width, height },
                        style: {
                            zIndex: 1, // Placeholder zIndex
                            fontSize: elData.fontSize || 16,
                            fontFamily: elData.fontFamily || 'Inter',
                            color: elData.textColor || '#000000',
                            backgroundColor: elData.bgColor,
                            background: elData.bgColor,
                            borderRadius: elData.type === 'button' ? 20 : 0,
                            textAlign: 'center'
                        }
                    } as SlideElement;
                });

                const resolvedElements = await Promise.all(elementPromises);

                // Fix Z-Index
                const finalElements = resolvedElements.map((el: SlideElement, index: number) => ({
                    ...el,
                    style: { ...el.style, zIndex: index + 1 }
                }));

                return {
                    id: uid(),
                    name: slideData.name || `AI Page`,
                    backgroundColor: newBgColor,
                    backgroundImage: bgImage,
                    duration: 3,
                    transition: (slideData.transition || 'fade').toLowerCase(), // Sanitize
                    elements: finalElements
                } as Slide;
            });

            // Wait for all slides
            const newSlidesToAdd = await Promise.all(slidePromises);

            if (newSlidesToAdd.length > 0) {
                setPresentation(prev => ({
                    ...prev,
                    slides: [...prev.slides, ...newSlidesToAdd]
                }));
                // Navigate to the first new slide
                setCurrentSlideIndex(presentation.slides.length);
            }
        }
    } catch (e: any) {
      console.error(e);
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message || "Something went wrong."}` }]);
    } finally {
      setAiLoading(false);
    }
  };

  if (playMode !== 'none') {
    return (
        <PresentationPlayer 
            presentation={presentation} 
            onExit={() => {
                // If exporting, exiting cancels export
                if ((playMode === 'export-setup' || playMode === 'export-running') && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                }
                setPlayMode('none');
            }} 
            autoPlay={playMode === 'export-running'}
            onComplete={playMode === 'export-running' ? handleExportComplete : undefined}
        />
    );
  }

  return (
    <div className="h-safe-screen flex flex-col bg-gray-50 text-gray-900 font-sans overflow-hidden">
      <header className="h-auto min-h-[4rem] bg-white border-b border-gray-200 flex flex-wrap items-center justify-between px-4 py-2 pt-safe z-20 shadow-sm gap-2">
        <div className="flex items-center gap-2 sm:gap-4 flex-1">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 shrink-0">
             <ChevronLeft />
          </button>
          <div className="flex flex-col min-w-0 max-w-[120px] sm:max-w-[200px] lg:max-w-xs">
             <input 
               value={presentation.title}
               onChange={(e) => setPresentation({...presentation, title: e.target.value})}
               className="font-semibold text-base sm:text-lg leading-tight bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 w-full truncate"
             />
             <div className="text-xs flex items-center gap-1">
                {isWebsite && <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 rounded mr-1">WEB</span>}
                <span className={`${saveStatus === 'unsaved' ? 'text-amber-500' : 'text-gray-400'}`}>
                    {saveStatus === 'saving' ? 'Saving...' : (saveStatus === 'unsaved' ? 'Unsaved' : 'Saved')}
                </span>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Manual Save Button */}
          <button 
             onClick={handleManualSave}
             className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all border shrink-0 ${
                 saveStatus === 'unsaved' 
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' 
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
             }`}
             title="Save Project"
          >
             <Save size={16} /> 
             <span className="hidden lg:inline">Save</span>
          </button>

          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-md bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 shrink-0"
            title="Nexus Assistant AI"
          >
            <Sparkles size={16} className={aiLoading ? 'animate-pulse' : ''} />
            <span className="hidden lg:inline">Nexus Assistant AI</span>
          </button>
          
          <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block"></div>
          
          {isWebsite ? (
             <button onClick={() => setIsCodeModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 rounded-lg font-medium text-sm shrink-0">
               <Code size={16} /> <span className="hidden sm:inline">Code</span>
             </button>
          ) : (
            <>
              <button onClick={() => setPlayMode('present')} className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm shrink-0">
                <Play size={16} fill="currentColor" /> <span className="hidden sm:inline">Present</span>
              </button>
              
              <div className="relative">
                  <button 
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 rounded-lg font-medium text-sm shrink-0"
                  >
                    <Download size={16} /> <span className="hidden sm:inline">Export</span>
                  </button>
                  
                  {isExportMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-fade-in">
                          <button 
                            onClick={exportToHTML}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700"
                          >
                             <FileType size={16} className="text-orange-500"/> Export to HTML
                          </button>
                          <button 
                            onClick={exportToVideo}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700 border-t border-gray-100"
                          >
                             <FileVideo size={16} className="text-blue-500"/> Export Video (MP4/WebM)
                          </button>
                          <button 
                             onClick={exportToJSON}
                             className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700 border-t border-gray-100"
                          >
                             <FileJson size={16} className="text-green-500"/> Download JSON
                          </button>
                      </div>
                  )}
                  {isExportMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)}></div>}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="w-16 sm:w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 gap-4 z-20 shadow-sm shrink-0">
          <SidebarTool icon={<Type />} label="Text" onClick={() => { setActiveDrawer('none'); addElement('text'); }} />
          <SidebarTool icon={<MousePointerClick />} label="Button" onClick={() => { setActiveDrawer('none'); addElement('button'); }} />
          <SidebarTool icon={<Square />} label="Elements" isActive={activeDrawer === 'shapes'} onClick={() => setActiveDrawer(activeDrawer === 'shapes' ? 'none' : 'shapes')} />
          <SidebarTool icon={<ImageIcon />} label="Images" isActive={activeDrawer === 'images'} onClick={() => setActiveDrawer(activeDrawer === 'images' ? 'none' : 'images')} />
          <SidebarTool icon={<Video />} label="Video" isActive={activeDrawer === 'video'} onClick={() => setActiveDrawer(activeDrawer === 'video' ? 'none' : 'video')} />
        </aside>

        {/* Drawers - (Existing Drawers) */}
        {activeDrawer === 'shapes' && (
          <div className="absolute left-16 sm:left-20 top-0 bottom-0 w-64 bg-white border-r border-gray-200 z-10 p-4 animate-slide-right overflow-y-auto shadow-xl">
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-gray-800">Shapes</h3>
               <button onClick={() => setActiveDrawer('none')} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
             </div>
             <div className="grid grid-cols-2 gap-3">
               <ShapeButton icon={<Square />} label="Rectangle" onClick={() => addElement('shape', 'rectangle')} />
               <ShapeButton icon={<Circle />} label="Circle" onClick={() => addElement('shape', 'circle')} />
               <ShapeButton icon={<Triangle />} label="Triangle" onClick={() => addElement('shape', 'triangle')} />
               <ShapeButton icon={<Star />} label="Star" onClick={() => addElement('shape', 'star')} />
               <ShapeButton icon={<Box />} label="Rounded" onClick={() => addElement('shape', 'rounded')} />
               <ShapeButton icon={<Hexagon />} label="Diamond" onClick={() => addElement('shape', 'diamond')} />
               <ShapeButton icon={<ArrowRight />} label="Arrow" onClick={() => addElement('shape', 'arrow')} />
             </div>
          </div>
        )}

        {activeDrawer === 'images' && (
          <div className="absolute left-16 sm:left-20 top-0 bottom-0 w-80 bg-white border-r border-gray-200 z-10 p-4 animate-slide-right overflow-y-auto flex flex-col shadow-xl">
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-gray-800">Images</h3>
               <button onClick={() => setActiveDrawer('none')} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
             </div>
             
             <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-500 hover:text-indigo-600 mb-6 flex items-center justify-center gap-2">
               <Upload size={16} /> Upload Image
             </button>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

             <div className="mb-6 space-y-6">
                {Object.entries(STOCK_PHOTOS).map(([category, urls]) => (
                  <div key={category}>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{category}</p>
                    <div className="grid grid-cols-2 gap-2">
                       {urls.map((url, i) => (
                         <button key={i} onClick={() => addElement('image', undefined, url)} className="h-20 bg-gray-100 rounded-md hover:ring-2 hover:ring-indigo-500 bg-cover bg-center" style={{ backgroundImage: `url(${url})`}} />
                       ))}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeDrawer === 'video' && (
           <div className="absolute left-16 sm:left-20 top-0 bottom-0 w-80 bg-white border-r border-gray-200 z-10 p-4 animate-slide-right overflow-y-auto flex flex-col shadow-xl">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-800">Video</h3>
                 <button onClick={() => setActiveDrawer('none')} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>

              <div className="mb-6">
                 <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Direct URL (mp4/webm)</label>
                 <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={videoUrlInput} 
                      onChange={e => setVideoUrlInput(e.target.value)} 
                      placeholder="https://example.com/video.mp4"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button 
                       onClick={() => { if(videoUrlInput) addElement('video', undefined, videoUrlInput); }}
                       className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                    >Add</button>
                 </div>
              </div>

              <div className="mb-6">
                 <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Upload Video</label>
                 <button onClick={() => document.getElementById('video-upload')?.click()} className="w-full py-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-500 hover:text-indigo-600 flex flex-col items-center justify-center gap-2">
                    <Video size={24} /> <span>Click to Upload</span>
                 </button>
                 <input id="video-upload" type="file" className="hidden" accept="video/*" onChange={handleVideoUpload} />
              </div>
           </div>
        )}

        {/* Workspace */}
        <main className="flex-1 flex flex-col relative bg-gray-100 overflow-hidden pb-safe" onClick={() => { setActiveDrawer('none'); setSelectedElementId(null); }}>
          {selectedElement ? (
             <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 z-10 animate-fade-in shadow-sm overflow-x-auto scrollbar-hide" onClick={e => e.stopPropagation()}>
                {/* Element Type */}
                <div className="flex items-center gap-2 border-r pr-4 border-gray-200 shrink-0">
                   <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{selectedElement.type}</span>
                </div>

                {/* --- COMMON TOOLS --- */}
                
                {/* Layering */}
                <div className="flex items-center border border-gray-200 rounded shrink-0">
                   <button onClick={() => changeLayer('down')} className="p-1 hover:bg-gray-100 text-gray-600" title="Send Backward"><ArrowDown size={14} /></button>
                   <button onClick={() => changeLayer('up')} className="p-1 hover:bg-gray-100 text-gray-600 border-l border-gray-200" title="Bring Forward"><ArrowUp size={14} /></button>
                </div>
                
                {/* Opacity */}
                <div className="flex items-center gap-2 shrink-0 w-24">
                   <Droplets size={14} className="text-gray-400" />
                   <input 
                     type="range" min="0" max="1" step="0.1" 
                     value={selectedElement.style.opacity !== undefined ? selectedElement.style.opacity : 1}
                     onChange={(e) => updateElement({...selectedElement, style: {...selectedElement.style, opacity: parseFloat(e.target.value)}})}
                     className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                   />
                </div>

                {/* Border Control */}
                <div className="flex items-center gap-2 shrink-0 border-l pl-4 border-gray-200">
                   <div className="text-xs font-semibold text-gray-500">Border:</div>
                   <input type="number" min="0" max="20" value={selectedElement.style.borderWidth || 0} onChange={(e) => updateElement({...selectedElement, style: {...selectedElement.style, borderWidth: parseInt(e.target.value)}})} className="w-10 border rounded px-1 py-0.5 text-xs" />
                   <select value={selectedElement.style.borderStyle || 'solid'} onChange={(e) => updateElement({...selectedElement, style: {...selectedElement.style, borderStyle: e.target.value as any}})} className="text-xs border rounded px-1 py-0.5">
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                   </select>
                   <input type="color" value={selectedElement.style.borderColor || '#000000'} onChange={(e) => updateElement({...selectedElement, style: {...selectedElement.style, borderColor: e.target.value}})} className="w-6 h-6 rounded cursor-pointer border-none" />
                </div>

                {/* Shadow */}
                <button 
                  onClick={() => updateElement({...selectedElement, style: {...selectedElement.style, boxShadow: !selectedElement.style.boxShadow}})}
                  className={`p-1 rounded shrink-0 ${selectedElement.style.boxShadow ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'}`}
                  title="Toggle Shadow"
                >
                   <Box size={16} />
                </button>
                
                {/* Link Tool (Only for Button) */}
                {selectedElement.type === 'button' && (
                    <div className="flex items-center gap-2 border-l pl-4 border-gray-200 shrink-0 w-48 animate-fade-in">
                       <LinkIcon size={14} className="text-gray-400" />
                       <input 
                          type="text" 
                          placeholder="Link URL or Page Name"
                          value={selectedElement.link || ''}
                          onChange={(e) => updateElement({...selectedElement, link: e.target.value})}
                          className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                       />
                    </div>
                )}


                {/* --- SPECIFIC TOOLS --- */}

                {(selectedElement.type === 'shape' || selectedElement.type === 'button') && (
                  <div className="flex items-center gap-2 border-l pl-4 border-gray-200 shrink-0">
                      <label className="text-xs font-medium text-gray-600">Fill:</label>
                      <div className="flex gap-1">
                        {GRADIENTS.slice(0, 5).map(g => (
                          <button key={g} className="w-5 h-5 rounded-full border border-gray-200" style={{ background: g }} onClick={() => updateElement({ ...selectedElement, style: { ...selectedElement.style, background: g, backgroundColor: g } })} />
                        ))}
                         <button className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center bg-white" onClick={() => updateElement({ ...selectedElement, style: { ...selectedElement.style, background: 'transparent', backgroundColor: 'transparent' } })} title="Transparent"><X size={10} /></button>
                      </div>
                  </div>
                )}
                
                {(selectedElement.type === 'text' || selectedElement.type === 'button') && (
                   <div className="flex items-center gap-3 border-l pl-4 border-gray-200 shrink-0">
                     {/* Font Family */}
                     <select 
                        value={selectedElement.style.fontFamily || 'Inter'} 
                        onChange={(e) => updateElement({...selectedElement, style: {...selectedElement.style, fontFamily: e.target.value}})}
                        className="w-24 border border-gray-300 rounded px-1 py-0.5 text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                     >
                        {FONTS.map(font => <option key={font} value={font}>{font}</option>)}
                     </select>

                     {/* Font Size */}
                     <div className="flex items-center border border-gray-300 rounded overflow-hidden bg-white h-6">
                        <button onClick={() => updateElement({...selectedElement, style: {...selectedElement.style, fontSize: Math.max(8, (selectedElement.style.fontSize || 16) - 2)}})} className="px-1.5 hover:bg-gray-50 border-r border-gray-200 text-gray-600 text-xs">-</button>
                        <input type="number" value={selectedElement.style.fontSize} onChange={(e) => updateElement({...selectedElement, style: {...selectedElement.style, fontSize: parseInt(e.target.value) || 0}})} className="w-8 text-center text-xs outline-none border-none" />
                        <button onClick={() => updateElement({...selectedElement, style: {...selectedElement.style, fontSize: (selectedElement.style.fontSize || 16) + 2}})} className="px-1.5 hover:bg-gray-50 border-l border-gray-200 text-gray-600 text-xs">+</button>
                     </div>

                     {/* Alignment */}
                     <div className="flex border border-gray-200 rounded">
                        <button onClick={() => updateElement({...selectedElement, style: {...selectedElement.style, textAlign: 'left'}})} className={`p-1 ${selectedElement.style.textAlign === 'left' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500'}`}><AlignLeft size={12} /></button>
                        <button onClick={() => updateElement({...selectedElement, style: {...selectedElement.style, textAlign: 'center'}})} className={`p-1 ${selectedElement.style.textAlign === 'center' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500'}`}><AlignCenter size={12} /></button>
                        <button onClick={() => updateElement({...selectedElement, style: {...selectedElement.style, textAlign: 'right'}})} className={`p-1 ${selectedElement.style.textAlign === 'right' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500'}`}><AlignRight size={12} /></button>
                     </div>

                     <input type="color" value={selectedElement.style.color} onChange={(e) => updateElement({...selectedElement, style: {...selectedElement.style, color: e.target.value}})} className="w-6 h-6 rounded cursor-pointer border-none" />
                   </div>
                )}
                
                <div className="flex-1"></div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 border-l pl-4 border-gray-200">
                    <button onClick={duplicateElement} className="text-gray-500 hover:text-indigo-600 p-1.5 rounded hover:bg-indigo-50" title="Duplicate"><Copy size={16} /></button>
                    <button onClick={deleteElement} className="text-gray-500 hover:text-red-500 p-1.5 rounded hover:bg-red-50" title="Delete"><Trash2 size={16} /></button>
                </div>
             </div>
          ) : (
            <div className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 z-10 shrink-0">
               <span className="text-sm text-gray-400">Select an element to edit properties</span>
            </div>
          )}

          <div className="flex-1 flex items-center justify-center overflow-auto p-8 bg-gray-100/50">
            <div className="shadow-2xl ring-1 ring-black/5 bg-white relative">
                {/* WRAPPED FOR TRANSITIONS */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide.id}
                        variants={getSlideTransition(currentSlide.transition)}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="absolute inset-0" // Important for positioning
                        style={{ position: 'relative' }} // Ensure it takes up space correctly
                    >
                      <SlideEditor 
                        id="slide-canvas"
                        slide={currentSlide}
                        selectedElementId={selectedElementId}
                        onElementUpdate={updateElement}
                        onElementSelect={setSelectedElementId}
                        scale={scale}
                      />
                    </motion.div>
                </AnimatePresence>
            </div>
          </div>

          <div className="h-44 bg-white border-t border-gray-200 flex flex-col z-10 shrink-0" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100">
               <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                 <Layout size={14}/> {isWebsite ? 'Pages' : 'Timeline'}
               </span>
               
               {!isWebsite && (
                   <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded hidden sm:flex">
                        <ArrowRightLeft size={14} />
                        <select 
                          value={currentSlide.transition || 'none'} 
                          onChange={(e) => updateSlide({...currentSlide, transition: e.target.value as any})}
                          className="bg-transparent border-none outline-none cursor-pointer"
                        >
                          <option value="none">None</option>
                          <option value="fade">Fade</option>
                          <option value="slide">Slide</option>
                          <option value="push">Push</option>
                          <option value="cover">Cover</option>
                          <option value="zoom">Zoom</option>
                        </select>
                     </div>

                     <div className="flex gap-2 text-xs text-gray-500 hidden sm:flex">
                       <span>Duration: {currentSlide.duration}s</span>
                       <input type="range" min="1" max="10" value={currentSlide.duration} onChange={(e) => updateSlide({...currentSlide, duration: parseInt(e.target.value)})} className="w-20 accent-indigo-600" />
                     </div>
                   </div>
               )}
             </div>
             
             <div className="flex-1 flex gap-4 overflow-x-auto p-4 scrollbar-hide items-center">
                {presentation.slides.map((slide, idx) => (
                      <div 
                        key={slide.id}
                        onClick={() => setCurrentSlideIndex(idx)}
                        className={`relative group shrink-0 cursor-pointer transition-all duration-200 ${idx === currentSlideIndex ? 'ring-2 ring-indigo-600 ring-offset-2' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
                        style={{ width: 160, height: 90 }}
                      >
                         {/* Live Thumbnail using SlideEditor in View Mode */}
                         <div className="w-full h-full bg-white rounded-lg shadow-sm overflow-hidden pointer-events-none border border-gray-200">
                            <div style={{ transform: `scale(${160/960})`, transformOrigin: 'top left', width: 960, height: 540 }}>
                                <SlideEditor 
                                    slide={slide} 
                                    selectedElementId={null} 
                                    onElementUpdate={() => {}} 
                                    onElementSelect={() => {}} 
                                    scale={1}
                                    mode="view"
                                />
                            </div>
                         </div>

                         {/* Page Number Badge */}
                         <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 rounded font-medium backdrop-blur-sm">
                             {idx + 1}
                         </div>

                        {/* Hover Controls */}
                        <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button 
                                onClick={(e) => deleteSlide(e, idx)}
                                className="bg-white text-red-500 p-1 rounded-full shadow-md border border-gray-100 hover:bg-red-50"
                            >
                                <X size={12} />
                            </button>
                        </div>
                        
                        {isWebsite && (
                             <input 
                              type="text"
                              value={slide.name || `Page ${idx+1}`}
                              onChange={(e) => {
                                  const newSlides = [...presentation.slides];
                                  newSlides[idx].name = e.target.value;
                                  setPresentation({...presentation, slides: newSlides});
                              }}
                              className="absolute -bottom-6 left-0 right-0 text-center text-xs bg-transparent border-none outline-none focus:bg-white focus:shadow-sm rounded px-1"
                              onClick={e => e.stopPropagation()}
                           />
                        )}
                      </div>
                ))}
                
                <button onClick={addSlide} className="w-[160px] h-[90px] shrink-0 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:bg-gray-50 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-all">
                  <Plus size={24} /> 
                  <span className="text-xs font-medium mt-1">Add {isWebsite ? 'Page' : 'Slide'}</span>
                </button>
             </div>
          </div>
        </main>

        {/* AI Chat Sidebar */}
        <AnimatePresence>
            {isChatOpen && (
                <motion.div 
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="w-80 sm:w-96 bg-white border-l border-gray-200 z-30 shadow-xl flex flex-col absolute right-0 top-0 bottom-0"
                >
                    <div className="p-4 pt-safe border-b border-gray-200 flex items-center justify-between bg-indigo-600 text-white">
                        <div className="flex items-center gap-2">
                            <Sparkles size={18} />
                            <h3 className="font-bold">Nexus AI</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setShowSettings(!showSettings)} className="p-1 hover:bg-white/20 rounded" title="AI Settings">
                                <Settings size={18} />
                            </button>
                            <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-white/20 rounded">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {showSettings && (
                        <div className="p-4 bg-gray-50 border-b border-gray-200 animate-fade-in text-sm">
                            <h4 className="font-bold text-gray-700 mb-2">Provider Settings</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">AI Provider</label>
                                    <select 
                                        value={selectedProvider}
                                        onChange={(e) => setSelectedProvider(e.target.value as AIProvider)}
                                        className="w-full text-sm border border-gray-300 rounded p-2 bg-white"
                                    >
                                        <option value="gemini">Google Gemini</option>
                                        <option value="openai">OpenAI (ChatGPT)</option>
                                        <option value="grok">xAI (Grok)</option>
                                        <option value="deepseek">DeepSeek</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Model</label>
                                    <select 
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded p-2 bg-white"
                                    >
                                        {AVAILABLE_MODELS[selectedProvider].map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">API Key</label>
                                    {selectedProvider === 'gemini' ? (
                                        <div className="w-full text-sm border border-gray-300 rounded p-2 bg-gray-100 text-gray-500 italic select-none">
                                            Using default Nexus key (Free)
                                        </div>
                                    ) : (
                                        <input 
                                            type="password"
                                            value={providerKey}
                                            onChange={(e) => saveKey(e.target.value)}
                                            placeholder={`Enter ${selectedProvider} API Key`}
                                            className="w-full text-sm border border-gray-300 rounded p-2"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div 
                                    className={`max-w-[85%] p-3 rounded-xl shadow-sm text-sm ${
                                        msg.role === 'user' 
                                            ? 'bg-indigo-600 text-white rounded-br-none' 
                                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                                    }`}
                                >
                                    {msg.content}
                                    {msg.hasAction && (
                                        <div className="mt-2 text-xs opacity-75 flex items-center gap-1 border-t border-gray-200/20 pt-1">
                                            <Check size={12} /> Changes Applied
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {aiLoading && (
                            <div className="flex justify-start w-full">
                                <div className="bg-white border border-gray-200 p-3 rounded-xl rounded-bl-none shadow-sm flex items-center gap-3 w-full max-w-[85%]">
                                    <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
                                        <div className="absolute inset-0 border-2 border-indigo-100 rounded-full"></div>
                                        <div className="absolute inset-0 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        <Zap size={10} className="text-indigo-600 absolute" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-0.5 animate-pulse">
                                            {aiStatus || "Processing..."}
                                        </div>
                                        <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '50%' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleChatSubmit} className="p-3 border-t border-gray-200 bg-white flex gap-2 pb-safe">
                        <textarea
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type a message or paste a long article..."
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px] max-h-32 resize-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleChatSubmit();
                                }
                            }}
                        />
                        <button 
                            type="submit" 
                            disabled={aiLoading || !chatInput.trim()}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors h-[44px]"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      {isCodeModalOpen && (
         <CodeExportModal presentation={presentation} onClose={() => setIsCodeModalOpen(false)} />
      )}
      
      <style>{`
        @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}

function PresentationPlayer({ presentation, onExit, autoPlay, onComplete }: { presentation: Presentation, onExit: () => void, autoPlay?: boolean, onComplete?: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
      if (!autoPlay) return;
      const slide = presentation.slides[currentIndex];
      const timer = setTimeout(() => {
          if (currentIndex < presentation.slides.length - 1) {
              setCurrentIndex(prev => prev + 1);
          } else {
              onComplete?.();
          }
      }, slide.duration * 1000);
      return () => clearTimeout(timer);
  }, [currentIndex, autoPlay, presentation.slides, onComplete]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'ArrowRight' || e.key === ' ') {
              setCurrentIndex(prev => Math.min(prev + 1, presentation.slides.length - 1));
          } else if (e.key === 'ArrowLeft') {
              setCurrentIndex(prev => Math.max(prev - 1, 0));
          } else if (e.key === 'Escape') {
              onExit();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentation.slides.length, onExit]);

  const currentSlide = presentation.slides[currentIndex];

  // Calculate scale to fit screen
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
      const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scale = Math.min(windowSize.w / 960, windowSize.h / 540);

  return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden">
           <div className="relative" style={{ width: 960 * scale, height: 540 * scale }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 960, height: 540 }}>
                   <SlideEditor 
                        slide={currentSlide} 
                        selectedElementId={null} 
                        onElementUpdate={() => {}} 
                        onElementSelect={() => {}} 
                        scale={1} 
                        mode="view"
                        onNavigate={(link) => {
                             if (link.startsWith('http')) {
                                 window.open(link, '_blank');
                             } else {
                                 const idx = presentation.slides.findIndex(s => s.name === link || s.id === link);
                                 if (idx !== -1) setCurrentIndex(idx);
                             }
                        }}
                    />
                </div>
           </div>

           {/* Controls Overlay */}
           <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-gray-900/80 backdrop-blur text-white px-6 py-3 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-300">
               <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} className="hover:text-indigo-400 disabled:opacity-30" disabled={currentIndex === 0}>
                   <ChevronLeft size={24} />
               </button>
               <span className="font-medium font-mono">{currentIndex + 1} / {presentation.slides.length}</span>
               <button onClick={() => setCurrentIndex(Math.min(presentation.slides.length - 1, currentIndex + 1))} className="hover:text-indigo-400 disabled:opacity-30" disabled={currentIndex === presentation.slides.length - 1}>
                   <ChevronRight size={24} />
               </button>
               <div className="w-px h-6 bg-white/20"></div>
               <button onClick={onExit} className="hover:text-red-400 text-sm font-bold uppercase tracking-wider">Exit</button>
           </div>
      </div>
  );
}

const SidebarTool = ({ icon, label, onClick, isActive }: { icon: React.ReactNode, label: string, onClick: () => void, isActive?: boolean }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all w-14 sm:w-16 ${
        isActive 
          ? 'text-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-200' 
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
    }`}
  >
    {React.cloneElement(icon as React.ReactElement, { size: 22, strokeWidth: isActive ? 2.5 : 2 })}
    <span className="text-[10px] font-medium leading-none">{label}</span>
  </button>
);

const ShapeButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-xl hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all text-gray-600 gap-2 hover:shadow-sm bg-gray-50/50"
  >
    {React.cloneElement(icon as React.ReactElement, { size: 24 })}
    <span className="text-xs font-medium">{label}</span>
  </button>
);

function CodeExportModal({ presentation, onClose }: { presentation: Presentation, onClose: () => void }) {
    const code = `
import React, { useState } from 'react';

// --- Presentation Data ---
const DATA = ${JSON.stringify(presentation, null, 2)};

export default function PresentationViewer() {
  const [index, setIndex] = useState(0);
  const slide = DATA.slides[index];

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
       <div style={{ position: 'relative', width: 960, height: 540, backgroundColor: slide.backgroundColor, overflow: 'hidden' }}>
          {slide.elements.map(el => (
             <div key={el.id} style={{
                position: 'absolute',
                left: el.position.x, top: el.position.y,
                width: el.size.width, height: el.size.height,
                zIndex: el.style.zIndex,
                ...el.style
             }}>
                {el.type === 'text' && el.content}
                {el.type === 'image' && <img src={el.content} style={{width: '100%', height: '100%', objectFit: 'cover'}} />}
                {el.type === 'button' && <button>{el.content}</button>}
             </div>
          ))}
       </div>
       <div style={{ position: 'fixed', bottom: 20, left: 0, right: 0, textAlign: 'center', color: 'white' }}>
          <button onClick={() => setIndex(i => Math.max(0, i-1))}>Prev</button>
          <span style={{ margin: '0 10px' }}>{index + 1} / {DATA.slides.length}</span>
          <button onClick={() => setIndex(i => Math.min(DATA.slides.length-1, i+1))}>Next</button>
       </div>
    </div>
  );
}
`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[70vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><Code size={20} className="text-indigo-600"/> React Export</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
                </div>
                <div className="flex-1 relative bg-gray-900 overflow-hidden group">
                    <textarea 
                        readOnly 
                        className="w-full h-full p-6 font-mono text-sm bg-transparent text-gray-300 resize-none outline-none" 
                        value={code}
                    />
                    <button 
                        onClick={() => navigator.clipboard.writeText(code)}
                        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md transition-all flex items-center gap-2 border border-white/10"
                    >
                        <Copy size={14} /> Copy Code
                    </button>
                </div>
            </div>
        </div>
    );
}