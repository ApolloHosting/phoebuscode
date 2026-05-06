import React from 'react';
import { Sparkles, Code2 } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

export function Auth() {
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="flex h-screen bg-[#242424] text-gray-100 font-sans items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1e1e1e] rounded-3xl border border-[#333] shadow-2xl p-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-[#2f2f2f] rounded-2xl flex items-center justify-center mb-6 border border-[#3a3a3a] shadow-inner">
          <Sparkles className="text-orange-400" size={32} />
        </div>
        
        <h1 className="text-3xl font-serif text-gray-200 tracking-tight mb-2">Welcome to Phoebus</h1>
        <p className="text-gray-400 text-[15px] mb-8 leading-relaxed">
          Your advanced AI coding assistant by CloverAIStudios. Sign in to continue your development journey.
        </p>

        <button 
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 hover:bg-gray-100 font-medium py-3 px-4 rounded-xl transition-colors duration-200 shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>
        
        <div className="mt-8 text-xs text-gray-500">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </div>
      </div>
    </div>
  );
}
