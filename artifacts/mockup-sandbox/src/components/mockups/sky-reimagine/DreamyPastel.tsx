import React from 'react';
import { Home, Book, Plus, Compass, User, Star, Cloud, Moon } from 'lucide-react';

export function DreamyPastel() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&display=swap');
        
        .font-header { font-family: 'Fraunces', serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        
        .dreamy-gradient {
          background: linear-gradient(135deg, #fce4ec 0%, #f3e5f5 50%, #e0f7fa 100%);
        }
        
        .pastel-shadow {
          box-shadow: 0 10px 40px -10px rgba(236, 190, 230, 0.4);
        }
        
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Mobile Device Container */}
      <div 
        className="relative w-full overflow-hidden bg-[#fdfbfd] font-body shadow-2xl"
        style={{ 
          maxWidth: '390px', 
          height: '844px',
          borderRadius: '40px',
          border: '8px solid #ffffff'
        }}
      >
        
        {/* Decorative background clouds/stars */}
        <div className="absolute top-10 left-4 text-white/50 animate-pulse">
          <Star size={16} fill="currentColor" />
        </div>
        <div className="absolute top-24 right-8 text-pink-200/40">
          <Cloud size={48} fill="currentColor" />
        </div>
        <div className="absolute top-40 left-12 text-purple-200/40">
          <Star size={24} fill="currentColor" />
        </div>
        <div className="absolute top-16 right-16 text-white/60 animate-pulse">
          <Star size={12} fill="currentColor" />
        </div>

        {/* Header Section */}
        <div className="relative h-1/3 dreamy-gradient rounded-b-[48px] px-8 pt-20 pb-8 flex flex-col justify-between z-10">
          <div>
            <p className="text-sm font-medium text-pink-400/80 tracking-wider uppercase mb-1 flex items-center gap-1">
              <Star size={10} fill="currentColor" /> good morning
            </p>
            <h1 className="text-4xl font-header font-medium text-gray-800">
              Sky Journal
            </h1>
          </div>
          
          {/* Floating Mood Badge */}
          <div className="absolute -bottom-6 right-8 bg-white/80 backdrop-blur-md px-5 py-3 rounded-full flex items-center gap-2 pastel-shadow border border-white">
            <Moon size={16} className="text-purple-400" fill="currentColor" />
            <span className="text-sm font-medium text-gray-700">peaceful</span>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-6 pt-12 pb-24 h-2/3 overflow-y-auto hide-scrollbar">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-header font-medium text-gray-800">Recent entries</h2>
            <button className="text-xs font-medium text-pink-400 bg-pink-50 px-3 py-1.5 rounded-full">
              View all
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {/* Journal Card 1 */}
            <div className="bg-[#fff0f3] p-5 rounded-[28px] border border-white pastel-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="bg-white/60 px-3 py-1 rounded-full text-xs font-medium text-pink-400">
                  Today, 9:41 AM
                </div>
                <div className="text-xl">🌸</div>
              </div>
              <h3 className="font-header text-lg font-medium text-gray-800 mb-2">Morning reflections</h3>
              <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
                Woke up to the sound of rain. Made some jasmine tea and watched the clouds roll by for a while...
              </p>
            </div>

            {/* Journal Card 2 */}
            <div className="bg-[#f3e5f5] p-5 rounded-[28px] border border-white pastel-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="bg-white/60 px-3 py-1 rounded-full text-xs font-medium text-purple-400">
                  Yesterday
                </div>
                <div className="text-xl">✨</div>
              </div>
              <h3 className="font-header text-lg font-medium text-gray-800 mb-2">Stargazing</h3>
              <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
                The sky was so clear tonight. I could see all my favorite constellations from the balcony.
              </p>
            </div>
            
            {/* Journal Card 3 */}
            <div className="bg-[#e0f7fa] p-5 rounded-[28px] border border-white pastel-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="bg-white/60 px-3 py-1 rounded-full text-xs font-medium text-cyan-500">
                  Oct 12
                </div>
                <div className="text-xl">☁️</div>
              </div>
              <h3 className="font-header text-lg font-medium text-gray-800 mb-2">A soft afternoon</h3>
              <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
                Spent the whole afternoon reading at the cafe. The sunlight through the window was perfect.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Tab Bar */}
        <div className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur-xl rounded-full p-2 flex justify-between items-center pastel-shadow border border-white/50">
          <button className="p-3 text-pink-400 bg-pink-50 rounded-full">
            <Home size={22} strokeWidth={2.5} />
          </button>
          <button className="p-3 text-gray-400 hover:text-pink-400 transition-colors">
            <Book size={22} strokeWidth={2.5} />
          </button>
          <button className="p-4 bg-gradient-to-tr from-pink-300 to-purple-300 text-white rounded-full shadow-lg transform -translate-y-4">
            <Plus size={24} strokeWidth={3} />
          </button>
          <button className="p-3 text-gray-400 hover:text-pink-400 transition-colors">
            <Compass size={22} strokeWidth={2.5} />
          </button>
          <button className="p-3 text-gray-400 hover:text-pink-400 transition-colors">
            <User size={22} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
