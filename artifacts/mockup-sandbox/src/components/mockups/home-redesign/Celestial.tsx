import React from 'react';
import { Sparkles, Users, BookHeart, Plus, Home, Book, Compass, User, PenLine, Star } from 'lucide-react';

export function Celestial() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#05040a] p-4 font-sans text-white">
      {/* Phone container */}
      <div 
        className="relative w-[390px] h-[844px] rounded-[40px] border-[8px] border-[#14102A] bg-[#0A0818] overflow-hidden shadow-2xl"
        style={{ fontFamily: 'Inter, Satoshi, sans-serif' }}
      >
        <div className="h-full overflow-y-auto pb-[100px] scrollbar-hide">
          {/* Hero */}
          <div className="relative h-[240px] flex flex-col items-center justify-end pb-6 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-[#2A1650] via-[#1E0F3A] to-[#0A0818]" />
            <div className="absolute top-10 left-10 w-24 h-24 bg-[#8B6FD4] rounded-full blur-[64px] opacity-20" />
            <div className="absolute top-20 right-12 w-32 h-32 bg-[#8B6FD4] rounded-full blur-[80px] opacity-10" />
            <Sparkles className="absolute top-12 right-16 w-5 h-5 text-[#8B6FD4] opacity-80" />
            
            <div className="relative z-10 flex flex-col items-center mt-8">
              <div className="w-[88px] h-[88px] rounded-full p-[2px] bg-gradient-to-br from-[#8B6FD4] to-transparent mb-3 shadow-[0_0_24px_rgba(139,111,212,0.2)]">
                <div className="w-full h-full rounded-full bg-[#14102A] overflow-hidden border border-white/10 flex items-center justify-center">
                  <User className="w-10 h-10 text-[#8B6FD4]" />
                </div>
              </div>
              
              <h1 className="text-[28px] font-bold text-white tracking-tight leading-none mb-1">piratebay</h1>
              <p className="text-[14px] text-white/60 mb-3">@piratebay</p>
              
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#14102A]/80 border border-white/10 backdrop-blur-[12px]">
                <Star className="w-3.5 h-3.5 text-[#8B6FD4]" fill="currentColor" />
                <span className="text-[11px] text-white/80 font-medium">Soft</span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center justify-center gap-6 py-5 mx-6 border-b border-white/5">
            <div className="flex flex-col items-center">
              <span className="text-[16px] font-semibold text-white">1</span>
              <span className="text-[11px] text-white/40 uppercase tracking-wider mt-0.5">Entries</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-[16px] font-semibold text-white">1</span>
              <span className="text-[11px] text-white/40 uppercase tracking-wider mt-0.5">Stories</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-[16px] font-semibold text-white">May 23</span>
              <span className="text-[11px] text-white/40 uppercase tracking-wider mt-0.5">Last</span>
            </div>
          </div>

          <div className="p-4 space-y-6">
            {/* Journal quick entry */}
            <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#14102A] to-[#0A0818] border border-white/[0.08] p-5 group cursor-pointer transition-all duration-250 ease-out active:scale-[0.98]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#8B6FD4] rounded-full blur-[60px] opacity-10 transition-opacity duration-300 group-hover:opacity-20 pointer-events-none" />
              <div className="relative z-10 flex flex-col">
                <div className="flex items-center gap-2 mb-3 text-[#8B6FD4]">
                  <PenLine className="w-4 h-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Today's Prompt</span>
                </div>
                <p className="text-[16px] font-medium text-white/90 italic mb-4 leading-relaxed">"What made you feel like you were floating today?"</p>
                <div className="inline-flex items-center gap-2 text-[14px] text-white/60 group-hover:text-white/80 transition-colors">
                  Tap to write <BookHeart className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Friends */}
            <section>
              <h2 className="text-[16px] font-semibold text-white mb-3 px-1">Friends</h2>
              <div className="flex flex-col items-center justify-center py-8 rounded-[24px] bg-[#14102A]/40 border border-white/[0.06] backdrop-blur-[12px]">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-white/40" />
                </div>
                <p className="text-[14px] text-white/60 mb-2">No friends yet</p>
                <button className="text-[14px] text-[#8B6FD4] font-medium hover:text-white transition-colors">Discover · travelers</button>
              </div>
            </section>

            {/* Recent Stories */}
            <section>
              <h2 className="text-[16px] font-semibold text-white mb-3 px-1">Recent Stories</h2>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                {/* Card 1 */}
                <div className="relative min-w-[150px] h-[200px] rounded-[20px] overflow-hidden group cursor-pointer border border-white/[0.08]">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0818] via-[#0A0818]/40 to-transparent z-10" />
                  <div className="absolute inset-0 bg-[#1E0F3A]" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
                    <div className="inline-block px-2 py-1 rounded-full text-[10px] uppercase font-semibold tracking-wider bg-[#14102A]/80 text-[#8B6FD4] backdrop-blur-md mb-2 border border-white/10">Dreamy</div>
                    <h3 className="text-[14px] font-medium text-white/90 leading-tight">Midnight Whispers</h3>
                  </div>
                </div>
                {/* Card 2 */}
                <div className="relative min-w-[150px] h-[200px] rounded-[20px] overflow-hidden group cursor-pointer border border-white/[0.08]">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0818] via-[#0A0818]/40 to-transparent z-10" />
                  <div className="absolute inset-0 bg-[#2A1650]" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
                     <div className="inline-block px-2 py-1 rounded-full text-[10px] uppercase font-semibold tracking-wider bg-[#14102A]/80 text-[#8B6FD4] backdrop-blur-md mb-2 border border-white/10">Starlight</div>
                     <h3 className="text-[14px] font-medium text-white/90 leading-tight">A Walk Among Stars</h3>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Bottom Nav */}
        <div className="absolute bottom-6 left-4 right-4 flex items-center justify-between px-6 py-4 rounded-[28px] bg-[#14102A]/80 backdrop-blur-[16px] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <button className="flex flex-col items-center text-[#8B6FD4]">
            <Home className="w-6 h-6" strokeWidth={1.5} />
          </button>
          <button className="flex flex-col items-center text-white/40 hover:text-white transition-colors">
            <Book className="w-6 h-6" strokeWidth={1.5} />
          </button>
          <div className="relative -top-7">
            <button className="w-[52px] h-[52px] rounded-full bg-gradient-to-br from-[#8B6FD4] to-[#6042A6] flex items-center justify-center shadow-[0_8px_24px_rgba(139,111,212,0.3)] border border-white/20 transition-transform duration-250 ease-out active:scale-[0.92]">
              <Plus className="w-6 h-6 text-white" />
            </button>
          </div>
          <button className="flex flex-col items-center text-white/40 hover:text-white transition-colors">
            <Compass className="w-6 h-6" strokeWidth={1.5} />
          </button>
          <button className="flex flex-col items-center text-white/40 hover:text-white transition-colors">
            <User className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
