import React from 'react';
import { Home, BookOpen, PlusCircle, Compass, User } from "lucide-react";

export function StardustNight() {
  return (
    <div className="relative w-full h-[844px] max-w-[390px] mx-auto overflow-hidden bg-[#12102B] text-white flex flex-col font-sans" style={{ fontFamily: '"Inter", sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
        
        .font-playfair { font-family: 'Playfair Display', serif; }
        
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        
        .star {
          position: absolute;
          background-color: white;
          border-radius: 50%;
          animation: twinkle 4s infinite ease-in-out;
        }
        
        .star:nth-child(1) { top: 10%; left: 15%; width: 2px; height: 2px; animation-delay: 0s; }
        .star:nth-child(2) { top: 25%; left: 80%; width: 3px; height: 3px; animation-delay: 1s; }
        .star:nth-child(3) { top: 15%; left: 50%; width: 1.5px; height: 1.5px; animation-delay: 2s; }
        .star:nth-child(4) { top: 5%; left: 70%; width: 2.5px; height: 2.5px; animation-delay: 0.5s; }
        .star:nth-child(5) { top: 35%; left: 20%; width: 2px; height: 2px; animation-delay: 1.5s; }
        .star:nth-child(6) { top: 20%; left: 35%; width: 1px; height: 1px; animation-delay: 2.5s; }
        .star:nth-child(7) { top: 40%; left: 65%; width: 2px; height: 2px; animation-delay: 0.8s; }
        .star:nth-child(8) { top: 8%; left: 90%; width: 2px; height: 2px; animation-delay: 1.2s; }
        .star:nth-child(9) { top: 30%; left: 5%; width: 1.5px; height: 1.5px; animation-delay: 3s; }
        .star:nth-child(10) { top: 45%; left: 85%; width: 2px; height: 2px; animation-delay: 1.8s; }
        .star:nth-child(11) { top: 50%; left: 40%; width: 1px; height: 1px; animation-delay: 0.3s; }
        .star:nth-child(12) { top: 12%; left: 30%; width: 2.5px; height: 2.5px; animation-delay: 2.2s; }
      `}</style>

      {/* Background Gradient & Stars */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1C1645] to-[#12102B] pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none opacity-60">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="star" />
        ))}
      </div>

      {/* Main Content Scroll Area */}
      <div className="relative z-10 flex-1 overflow-y-auto pb-24 no-scrollbar">
        {/* Header */}
        <header className="pt-16 pb-8 px-6">
          <h1 className="text-4xl text-[#E8C87A] font-playfair tracking-wide mb-2">Sky Journal</h1>
          <p className="text-white/70 text-sm font-light tracking-wider uppercase">Record your dreams</p>
        </header>

        {/* Mood/Greeting Badge */}
        <div className="px-6 mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
            <span className="w-2 h-2 rounded-full bg-[#E8C87A] shadow-[0_0_8px_#E8C87A]"></span>
            <span className="text-sm font-medium text-white/90">Feeling peaceful tonight</span>
          </div>
        </div>

        {/* Journal Entries */}
        <div className="px-6 space-y-5">
          {/* Card 1 */}
          <div className="p-5 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.15)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs text-[#E8C87A] font-medium tracking-widest uppercase">Oct 24, 11:30 PM</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
              </div>
            </div>
            <h3 className="text-xl font-playfair text-white mb-2">The Quiet Rain</h3>
            <p className="text-white/70 text-sm leading-relaxed font-light line-clamp-3">
              I sat by the window for an hour just listening to the rain against the glass. The city feels so distant when it rains like this, wrapped in a blanket of grey and silver. It gave me time to finally process the thoughts from yesterday...
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-5 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.15)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs text-[#E8C87A] font-medium tracking-widest uppercase">Oct 22, 09:15 AM</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
              </div>
            </div>
            <h3 className="text-xl font-playfair text-white mb-2">Morning Coffee Reflections</h3>
            <p className="text-white/70 text-sm leading-relaxed font-light line-clamp-3">
              Woke up early before the alarm. The light was hitting the kitchen table just right. Decided to start the new book instead of checking my phone. A small victory, but it set the tone for the whole day.
            </p>
          </div>
          
          {/* Card 3 */}
          <div className="p-5 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.15)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs text-[#E8C87A] font-medium tracking-widest uppercase">Oct 20, 08:45 PM</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
              </div>
            </div>
            <h3 className="text-xl font-playfair text-white mb-2">Unexpected Call</h3>
            <p className="text-white/70 text-sm leading-relaxed font-light line-clamp-3">
              Sarah called out of nowhere. We hadn't spoken in months. It's strange how you can pick up exactly where you left off with some people, as if no time has passed at all.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 w-full px-6 pb-8 pt-4 bg-gradient-to-t from-[#12102B] via-[#12102B]/80 to-transparent z-20">
        <div className="flex justify-between items-center px-6 py-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <button className="flex flex-col items-center gap-1 text-[#E8C87A] relative">
            <div className="absolute -inset-2 bg-[#E8C87A]/20 rounded-full blur-md" />
            <Home size={22} className="relative z-10 drop-shadow-[0_0_8px_rgba(232,200,122,0.5)]" />
          </button>
          <button className="flex flex-col items-center gap-1 text-white/50 hover:text-white/80 transition-colors">
            <BookOpen size={22} />
          </button>
          <button className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#E8C87A] to-[#C5A352] text-[#12102B] shadow-[0_0_20px_rgba(232,200,122,0.4)] -mt-8 border-4 border-[#12102B]">
            <PlusCircle size={24} />
          </button>
          <button className="flex flex-col items-center gap-1 text-white/50 hover:text-white/80 transition-colors">
            <Compass size={22} />
          </button>
          <button className="flex flex-col items-center gap-1 text-white/50 hover:text-white/80 transition-colors">
            <User size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
