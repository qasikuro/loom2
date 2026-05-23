import React from "react";
import { format } from "date-fns";
import { Compass, PenTool, User, BookOpen } from "lucide-react";

export function PaperCrane() {
  const today = new Date();

  return (
    <div 
      className="relative w-full h-full min-h-[100dvh] flex flex-col bg-[#FAFAF7] overflow-hidden selection:bg-[#E2DDD3] selection:text-[#3A352F]"
      style={{
        color: "#3A352F"
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:ital,wght@0,300;0,400;1,300&display=swap');
        
        .font-serif {
          font-family: 'Crimson Pro', serif;
        }
        .font-mono {
          font-family: 'DM Mono', monospace;
        }
        
        .paper-texture {
          box-shadow: 
            0 1px 2px rgba(0, 0, 0, 0.02),
            0 4px 16px rgba(0, 0, 0, 0.02),
            inset 0 0 0 1px rgba(0, 0, 0, 0.02);
          background-image: 
            radial-gradient(#e0ddd0 0.5px, transparent 0.5px),
            radial-gradient(#e0ddd0 0.5px, #fafaf7 0.5px);
          background-size: 20px 20px;
          background-position: 0 0, 10px 10px;
        }
        
        .ink-stroke {
          position: relative;
        }
        .ink-stroke::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 100%;
          height: 1px;
          background: #3A352F;
          border-radius: 50% 50% 0 0 / 100% 100% 0 0;
          opacity: 0.2;
        }
      `}</style>

      {/* Header */}
      <header className="px-6 pt-12 pb-6 flex justify-between items-end">
        <div>
          <h1 className="font-serif text-3xl font-light tracking-wide mb-1 text-[#2c2824]">
            Sky Journal
          </h1>
          <p className="font-mono text-[10px] tracking-widest uppercase text-[#8c8577]">
            {format(today, "MMMM do, yyyy")}
          </p>
        </div>
        
        {/* Paper crane decorative svg */}
        <div className="text-[#99A690] opacity-80 pb-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L4 12L12 22L20 12L12 2Z" />
            <path d="M4 12L20 12" />
            <path d="M12 2L12 22" />
            <path d="M4 12L12 17L20 12" />
          </svg>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 overflow-y-auto pb-24 space-y-12">
        
        {/* Prompt Section */}
        <section className="pt-8">
          <p className="font-mono text-[10px] text-[#99A690] tracking-widest uppercase mb-4 pl-1">
            Today's Prompt
          </p>
          <div className="ink-stroke pb-6">
            <h2 className="font-serif text-3xl italic font-light leading-snug text-[#2c2824]">
              "What moved you today?"
            </h2>
          </div>
        </section>

        {/* Entries */}
        <section className="space-y-6">
          <div className="flex items-center justify-between pl-1 mb-2">
            <span className="font-mono text-[10px] text-[#8c8577] tracking-widest uppercase">
              Recent entries
            </span>
            <div className="h-[1px] flex-1 bg-[#E2DDD3] ml-4" />
          </div>

          <div className="space-y-4">
            {/* Card 1 */}
            <div className="paper-texture bg-[#FDFDFB] p-5 rounded-sm relative group cursor-pointer hover:bg-white transition-colors">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#99A690] opacity-30 rounded-l-sm" />
              <div className="flex justify-between items-baseline mb-3">
                <span className="font-serif italic text-[#6b6559]">Morning</span>
                <span className="font-mono text-[10px] text-[#9a9284]">08:24</span>
              </div>
              <p className="font-serif text-lg leading-relaxed text-[#3A352F] line-clamp-3">
                The light coming through the blinds hit the kitchen table in a way that made me stop. I stood there for a long time watching the dust motes dance in the quiet morning air.
              </p>
            </div>

            {/* Card 2 */}
            <div className="paper-texture bg-[#FDFDFB] p-5 rounded-sm relative group cursor-pointer hover:bg-white transition-colors">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#B88673] opacity-30 rounded-l-sm" />
              <div className="flex justify-between items-baseline mb-3">
                <span className="font-serif italic text-[#6b6559]">Yesterday</span>
                <span className="font-mono text-[10px] text-[#9a9284]">19:42</span>
              </div>
              <p className="font-serif text-lg leading-relaxed text-[#3A352F] line-clamp-3">
                A brief moment of rain while the sun was still shining. The air smelled like wet asphalt and green leaves. I felt a strange sense of nostalgia for a place I've never been.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#FAFAF7]/90 backdrop-blur-md border-t border-[#E2DDD3]/50 pb-safe">
        <div className="flex justify-around items-center px-6 h-20">
          <button className="flex flex-col items-center gap-1 group">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#3A352F] group-hover:text-[#99A690] transition-colors">
              Journal
            </span>
            <div className="w-1 h-1 rounded-full bg-[#99A690] mt-1" />
          </button>
          
          <button className="flex flex-col items-center gap-1 group">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8c8577] group-hover:text-[#3A352F] transition-colors">
              Discover
            </span>
            <div className="w-1 h-1 rounded-full bg-transparent mt-1 group-hover:bg-[#E2DDD3] transition-colors" />
          </button>

          <button className="flex flex-col items-center gap-1 group">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8c8577] group-hover:text-[#3A352F] transition-colors">
              Profile
            </span>
            <div className="w-1 h-1 rounded-full bg-transparent mt-1 group-hover:bg-[#E2DDD3] transition-colors" />
          </button>
        </div>
      </nav>
    </div>
  );
}
