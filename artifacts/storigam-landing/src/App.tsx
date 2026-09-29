import { type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowDownRight,
  ArrowUpRight,
  Menu,
  Play,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import logoPath from '@assets/file_00000000d71081f58b9fe910cff5e1d6_1790643309592.png';

const queryClient = new QueryClient();

function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="storigam-page">
      <header className="nav-shell">
        <div className="container-wide nav">
          <a className="brand" href="#top" onClick={closeMenu} data-testid="link-brand">
            <img src={logoPath} alt="Storigam" />
          </a>
          <button
            className="menu-button"
            type="button"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            data-testid="button-menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <nav className={`nav-links ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
            <a href="#how-it-works" onClick={closeMenu} data-testid="link-how-it-works">How it works</a>
            <a href="#features" onClick={closeMenu} data-testid="link-features">Make a story</a>
            <a href="#community" onClick={closeMenu} data-testid="link-community">Community</a>
            <a className="nav-cta" href="#start" onClick={closeMenu} data-testid="link-start">Start making <ArrowUpRight size={15} /></a>
          </nav>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="container-wide hero-grid">
          <div className="reveal">
            <p className="eyebrow">Stories made by gamers</p>
            <h1 className="display">Make the<br /><em>moment</em><br />matter.</h1>
            <p className="hero-intro">Your gaming moments deserve a story. Turn the screenshot you nearly forgot into something your party will quote forever.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#features" data-testid="link-create-story">See the story maker <ArrowDownRight size={17} /></a>
              <a className="button button-quiet" href="#community" data-testid="link-browse-stories">Browse the worlds <Play size={15} /></a>
            </div>
          </div>
          <div className="hero-stage reveal delay-2" aria-label="Example visual story">
            <div className="stage-backdrop" />
            <div className="story-card">
              <div className="story-card-art">
                <div className="pixel-sun" />
              </div>
              <div className="story-card-footer">
                <div>
                  <small>Issue 001 · after the boss fight</small>
                  <strong>The last hit</strong>
                </div>
                <ArrowUpRight size={22} />
              </div>
            </div>
            <div className="speech">“wait... did we actually do that?”</div>
            <div className="sticker">co-op memory / saved</div>
          </div>
        </div>
        <div className="container-wide scroll-note"><span /> scroll to replay the night</div>
      </section>

      <div className="marquee" aria-label="Storigam highlights">
        <div className="marquee-track">
          <span className="marquee-item">screenshots into stories</span><span className="marquee-dot">•</span>
          <span className="marquee-item">captions with a point of view</span><span className="marquee-dot">•</span>
          <span className="marquee-item">your worlds, your canon</span><span className="marquee-dot">•</span>
          <span className="marquee-item">screenshots into stories</span><span className="marquee-dot">•</span>
          <span className="marquee-item">captions with a point of view</span><span className="marquee-dot">•</span>
          <span className="marquee-item">your worlds, your canon</span><span className="marquee-dot">•</span>
        </div>
      </div>

      <section className="manifesto section-pad">
        <div className="container-wide manifesto-layout">
          <div>
            <p className="eyebrow">A new kind of highlight reel</p>
            <img className="manifesto-mark" src={logoPath} alt="" />
          </div>
          <div>
            <h2 className="display">Gaming doesn't<br />end when the<br /><span>game ends.</span></h2>
            <p className="manifesto-copy">The clutch save. The accidental betrayal. The one-liner that made everyone drop their controller. Storigam gives those tiny legends somewhere to live — and a way to find the people who get it.</p>
          </div>
        </div>
      </section>

      <section className="how section-pad" id="how-it-works">
        <div className="container-wide">
          <div className="how-head">
            <div>
              <p className="eyebrow">From replay to keepsake</p>
              <h2 className="section-title display">Three moves.<br />One good story.</h2>
            </div>
            <p className="section-copy">No lore bible required. Bring the moment, add your voice, and let the scene do the talking.</p>
          </div>
          <div className="steps">
            <article className="step reveal">
              <div className="step-number">01</div>
              <h3>Drop in the moment</h3>
              <p>Pick the screenshots that still make you grin. A single frame or the whole chaotic sequence.</p>
            </article>
            <article className="step reveal delay-1">
              <div className="step-number">02</div>
              <h3>Give it a voice</h3>
              <p>Build panels, captions, and speech bubbles that sound like your squad — not a press release.</p>
            </article>
            <article className="step reveal delay-2">
              <div className="step-number">03</div>
              <h3>Send it into the world</h3>
              <p>Share a finished page with the people who know the map, the meta, and exactly what went wrong.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="features section-pad" id="features">
        <div className="container-wide feature-layout">
          <div className="feature-visual reveal" aria-label="Story editor preview">
            <div className="editor-top"><span>new story / untitled run</span><span>autosaved just now</span></div>
            <div className="editor-screen">
              <div className="editor-panels">
                <div className="panel large"><span className="caption">caption: “that was intentional.”</span></div>
                <div className="panel scene-1"><span className="caption">panel 02</span></div>
                <div className="panel scene-2"><span className="caption">panel 03</span></div>
              </div>
              <div className="editor-tools">
                <div className="tool active">panel layout</div>
                <div className="tool">add caption</div>
                <div className="tool">speech bubble</div>
                <div className="tool">share page</div>
              </div>
            </div>
          </div>
          <div>
            <p className="eyebrow">Make it yours</p>
            <h2 className="feature-title display">Your voice is the special effect.</h2>
            <p className="section-copy">Compose a clean three-panel gag or a sprawling manga chapter. Move fast, get weird, and keep the parts that make your friends say, “I was there.”</p>
            <a className="button button-primary" href="#start" style={{ marginTop: '28px' }} data-testid="link-open-maker">Explore the canvas <WandSparkles size={16} /></a>
          </div>
        </div>
      </section>

      <section className="gallery section-pad" id="stories">
        <div className="container-wide">
          <div className="gallery-head">
            <div>
              <p className="eyebrow">Made in the lobby, posted everywhere</p>
              <h2 className="section-title display">Every party has<br />a point of view.</h2>
            </div>
            <p className="section-copy">A peek at the kinds of moments that become legendary after midnight.</p>
          </div>
          <div className="gallery-grid" aria-label="Community story examples">
            <div className="gallery-tile"><span className="tile-tag">the impossible parry</span></div>
            <div className="gallery-tile"><span className="tile-tag">two health, no plan</span></div>
            <div className="gallery-tile"><span className="tile-tag">local co-op lore</span></div>
            <div className="gallery-tile"><span className="tile-tag">new game plus</span></div>
            <div className="gallery-tile"><span className="tile-tag">we said one more</span></div>
          </div>
        </div>
      </section>

      <section className="community section-pad" id="community">
        <div className="container-wide community-layout">
          <div>
            <p className="eyebrow">Find your kind of player</p>
            <h2 className="display">Same worlds.<br />Different<br /><span style={{ color: 'hsl(var(--secondary))' }}>stories.</span></h2>
            <p className="section-copy">Follow the artists, lore nerds, speedrunners, and chaos agents turning their game nights into something worth revisiting.</p>
          </div>
          <div className="community-list">
            <div className="community-row">
              <div className="avatar">N</div>
              <div><strong>NightshiftNia</strong><p>“The quiet before the final wave.”</p></div>
              <span className="row-count">18 panels</span>
            </div>
            <div className="community-row">
              <div className="avatar">K</div>
              <div><strong>koji.exe</strong><p>“A completely reasonable amount of loot.”</p></div>
              <span className="row-count">06 panels</span>
            </div>
            <div className="community-row">
              <div className="avatar">R</div>
              <div><strong>RookAndRoll</strong><p>“We were told this was a stealth mission.”</p></div>
              <span className="row-count">11 panels</span>
            </div>
          </div>
        </div>
      </section>

      <section className="final-cta" id="start">
        <div className="container-wide">
          <p className="eyebrow">The next story is already waiting</p>
          <h2 className="display">Make your<br /><em>moment</em> canon.</h2>
          <p>Bring the screenshot. We’ll bring the blank page.</p>
          <a className="button button-primary" href="#features" data-testid="link-start-making">Start with a screenshot <ArrowUpRight size={17} /></a>
        </div>
      </section>

      <footer className="footer">
        <div className="container-wide footer-inner">
          <a className="brand" href="#top" data-testid="link-footer-brand"><img src={logoPath} alt="Storigam" /></a>
          <small>stories made by gamers · keep the good runs</small>
          <div className="footer-links"><a href="#how-it-works" data-testid="link-footer-how">How it works</a><a href="#community" data-testid="link-footer-community">Community</a></div>
        </div>
      </footer>
    </main>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
