import React from 'react';
import { Cloud, Feather, Home, User, Users, ChevronRight, Plus } from 'lucide-react';

export function Minimal() {
  return (
    <div className="w-[390px] h-[844px] bg-[#F8F4EE] overflow-y-auto relative font-['Inter'] text-[#3A3541] flex flex-col">
      {/* Scrollable Content */}
      <div className="flex-1 px-5 pt-14 pb-32 flex flex-col gap-8">
        
        {/* Header */}
        <header className="flex flex-col gap-1">
          <h1 className="font-['Playfair_Display'] text-[22px] font-medium text-[#2C2833]">
            Good evening, piratebay <span className="text-[#6B5B95] opacity-70 text-lg">✦</span>
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-[#7D768A]">Sunday, Oct 24</span>
            <div className="bg-[#EBE5F5] text-[#6B5B95] text-xs px-2.5 py-0.5 rounded-full font-medium tracking-wide">
              Soft
            </div>
          </div>
        </header>

        {/* Writing Prompt Card */}
        <section>
          <div className="relative rounded-2xl bg-gradient-to-br from-[#C8B8E8] to-transparent p-[1px]">
            <div className="bg-white rounded-[15px] p-5 flex flex-col gap-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <p className="font-['Playfair_Display'] italic text-lg text-[#4A4356] leading-relaxed">
                "What small detail brought you comfort today?"
              </p>
              <button className="self-start text-[#6B5B95] font-medium text-sm flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                Write today <ChevronRight size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </section>

        {/* Journal Entries Strip */}
        <section className="flex flex-col gap-3">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8E869D]">Recent Entries</h2>
          </div>
          
          <div className="bg-white rounded-xl p-4 flex flex-col gap-2.5 border border-[#E8E3DA]" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#8E869D] font-medium">Oct 23, 8:40 PM</span>
              <div className="w-2 h-2 rounded-full bg-[#C8B8E8]" />
            </div>
            <p className="text-[#4A4356] text-sm leading-relaxed">
              The sky was particularly quiet this morning. I took a moment to just sit by the window and watch the clouds shift.
            </p>
          </div>
          
          <div className="bg-white/60 rounded-xl p-4 flex flex-col gap-2.5 border border-[#E8E3DA]" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#8E869D] font-medium">Oct 21, 9:15 AM</span>
              <div className="w-2 h-2 rounded-full bg-[#E8E3DA]" />
            </div>
            <p className="text-[#7D768A] text-sm leading-relaxed italic">
              Empty entry...
            </p>
          </div>
        </section>

        {/* Stories Section */}
        <section className="flex flex-col gap-3">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8E869D]">My Stories</h2>
          </div>
          
          <div className="relative h-32 rounded-xl overflow-hidden group">
            {/* Gradient Placeholder */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#6B5B95]/20 via-[#C8B8E8]/40 to-[#F8F4EE] border border-[#E8E3DA] rounded-xl" />
            <div className="absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-white/80 to-transparent">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-medium bg-white/80 px-2 py-0.5 rounded-full text-[#6B5B95]">Chapter 1</span>
              </div>
              <h3 className="font-['Playfair_Display'] text-lg font-medium text-[#2C2833]">A Quiet Week</h3>
              <p className="text-xs text-[#7D768A] mt-0.5">3 witnesses</p>
            </div>
          </div>
        </section>

        {/* Friends / Discover Nudge */}
        <section>
          <button className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-black/5 hover:bg-black/10 transition-colors border border-black/5">
            <div className="flex items-center gap-2">
              <span className="text-[#6B5B95] opacity-80 text-sm">✦</span>
              <span className="text-sm text-[#4A4356] font-medium">Discover people</span>
              <span className="text-xs text-[#8E869D] ml-1">· 0 following</span>
            </div>
            <ChevronRight size={16} strokeWidth={1.5} className="text-[#8E869D]" />
          </button>
        </section>

      </div>

      {/* Floating Tab Bar */}
      <div className="absolute bottom-6 left-0 right-0 px-6 z-50">
        <div className="bg-white/85 backdrop-blur-md border border-[#E8E3DA] h-16 rounded-[24px] flex items-center justify-around px-2" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <button className="flex flex-col items-center gap-1 p-2 text-[#6B5B95]">
            <Home size={22} strokeWidth={1.5} />
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-[#A49EB3] hover:text-[#6B5B95] transition-colors">
            <Cloud size={22} strokeWidth={1.5} />
          </button>
          
          {/* Center FAB */}
          <div className="relative -top-3">
            <button className="w-14 h-14 bg-[#6B5B95] rounded-full flex items-center justify-center text-white shadow-lg shadow-[#6B5B95]/30 hover:scale-105 transition-transform">
              <Plus size={24} strokeWidth={2} />
            </button>
          </div>
          
          <button className="flex flex-col items-center gap-1 p-2 text-[#A49EB3] hover:text-[#6B5B95] transition-colors">
            <Users size={22} strokeWidth={1.5} />
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-[#A49EB3] hover:text-[#6B5B95] transition-colors">
            <User size={22} strokeWidth={1.5} />
          </button>
        </div>
      </div>

    </div>
  );
}
