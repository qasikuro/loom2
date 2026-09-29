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
  X,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import logoPath from '@assets/storigam-logo-transparent.png';

const queryClient = new QueryClient();

const memorableMoments = [
  { id: 'boss-fight', label: 'That ridiculous boss fight.' },
  { id: 'favorite-outfit', label: 'The outfit you spent hours making.' },
  { id: 'new-friend', label: 'The friend you met by accident.' },
  { id: 'unexpected-chaos', label: 'The time everything went completely wrong.' },
];

const gamerTypes = [
  { id: 'character-creators', title: 'Character creators', description: 'Some make beautiful characters.' },
  { id: 'collectors', title: 'Collectors', description: 'Some collect everything.' },
  { id: 'lore-lovers', title: 'Lore lovers', description: 'Some love the lore.' },
  { id: 'chaos-makers', title: 'Chaos makers', description: 'Some just cause chaos.' },
];

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
            <a href="#character-story" onClick={closeMenu} data-testid="link-character-stories">Character stories</a>
            <a href="#community" onClick={closeMenu} data-testid="link-community">Community</a>
            <a className="nav-cta" href="#start" onClick={closeMenu} data-testid="link-start">Start making <ArrowUpRight size={15} /></a>
          </nav>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="container-wide hero-grid">
          <div className="reveal">
            <p className="eyebrow">Stories made by gamers.</p>
            <h1 className="display">Turn your<br />gaming<br /><em>moments</em><br />into stories.</h1>
            <p className="hero-intro">
              That screenshot you saved for a reason?<br />
              The funny moment your friends still talk about?<br />
              The character you spent way too much time creating?
              <strong>Make it a story. Keep it forever.</strong>
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#from-screenshot" data-testid="link-create-story">Make a story <ArrowDownRight size={17} /></a>
              <a className="button button-quiet" href="#how-it-works" data-testid="link-how-it-works-hero">How it works</a>
            </div>
          </div>
          <div className="hero-stage reveal delay-2" role="img" aria-label="An example gaming moment turned into a story">
            <div className="stage-backdrop" />
            <div className="story-card">
              <div className="story-card-art">
                <div className="pixel-sun" />
              </div>
              <div className="story-card-footer">
                <div>
                  <small>your game · your moment</small>
                  <strong>A story to keep</strong>
                </div>
                <ArrowUpRight size={22} />
              </div>
            </div>
            <div className="speech">“we still talk about it.”</div>
            <div className="sticker">story saved</div>
          </div>
        </div>
        <div className="container-wide scroll-note"><span /> Your game. Your moment. Your story.</div>
      </section>

      <div className="marquee" aria-label="Your game, your moment, your story">
        <div className="marquee-track">
          <span className="marquee-item">your game</span><span className="marquee-dot">•</span>
          <span className="marquee-item">your moment</span><span className="marquee-dot">•</span>
          <span className="marquee-item">your story</span><span className="marquee-dot">•</span>
          <span className="marquee-item">make it a story</span><span className="marquee-dot">•</span>
          <span className="marquee-item">your game</span><span className="marquee-dot">•</span>
          <span className="marquee-item">your moment</span><span className="marquee-dot">•</span>
          <span className="marquee-item">your story</span><span className="marquee-dot">•</span>
          <span className="marquee-item">make it a story</span><span className="marquee-dot">•</span>
        </div>
      </div>

      <section className="manifesto section-pad">
        <div className="container-wide manifesto-layout">
          <div className="manifesto-moments">
            <p className="eyebrow">Gaming is full of little moments</p>
            <ul className="moment-list" aria-label="Gaming moments worth remembering">
              <li>A crazy win.</li>
              <li>A funny fail.</li>
              <li>A beautiful character.</li>
              <li>A random adventure with friends.</li>
            </ul>
          </div>
          <div>
            <h2 className="display">Your game.<br />Your moment.<br /><span>Your story.</span></h2>
            <p className="manifesto-copy">Gaming is full of little moments worth remembering. Storigam gives those moments a place to live.</p>
          </div>
        </div>
      </section>

      <section className="how section-pad" id="how-it-works">
        <div className="container-wide">
          <div className="how-head">
            <div>
              <p className="eyebrow">How it works</p>
              <h2 className="section-title display">Make your moment a story.</h2>
            </div>
            <p className="section-copy">Choose a screenshot from your game, make it yours, and share it with friends.</p>
          </div>
          <div className="steps">
            <article className="step reveal" data-testid="step-pick-a-moment">
              <div className="step-number">01</div>
              <h3>Pick a moment</h3>
              <p>Choose a screenshot from your game.</p>
            </article>
            <article className="step reveal delay-1" data-testid="step-make-it-yours">
              <div className="step-number">02</div>
              <h3>Make it yours</h3>
              <p>Add captions, dialogue, characters, and your own little details.</p>
            </article>
            <article className="step reveal delay-2" data-testid="step-share-your-story">
              <div className="step-number">03</div>
              <h3>Share your story</h3>
              <p>Turn your gaming moment into something you can share with friends.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="features section-pad" id="from-screenshot">
        <div className="container-wide feature-layout">
          <div className="feature-visual reveal" role="group" aria-label="From screenshot to story preview">
            <div className="editor-top"><span>from screenshot</span><span>to story</span></div>
            <div className="editor-screen">
              <div className="editor-panels">
                <div className="panel large"><span className="caption">your moment</span></div>
                <div className="panel scene-1"><span className="caption">add your words</span></div>
                <div className="panel scene-2"><span className="caption">your story</span></div>
              </div>
              <div className="editor-tools">
                <div className="tool active">Add a screenshot</div>
                <div className="tool">Add your words</div>
                <div className="tool">Make your story</div>
              </div>
            </div>
          </div>
          <div>
            <p className="eyebrow">From screenshot to story</p>
            <h2 className="feature-title display">You don't need to be an artist.</h2>
            <p className="section-copy">Just bring your moment.</p>
            <ol className="creation-flow" aria-label="How to make your story">
              <li data-testid="flow-add-screenshot">Add a screenshot</li>
              <li data-testid="flow-add-words">Add your words</li>
              <li data-testid="flow-make-story">Make your story</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="character section-pad" id="character-story">
        <div className="container-wide character-layout">
          <div className="character-art reveal" role="img" aria-label="A colorful character illustration with story labels">
            <div className="character-orbit" />
            <div className="character-person">
              <span className="character-head" />
              <span className="character-body" />
              <span className="character-cape" />
            </div>
            <span className="character-tag character-tag-top">your character</span>
            <span className="character-tag character-tag-bottom">their little story</span>
          </div>
          <div>
            <p className="eyebrow">Make your character yours.</p>
            <h2 className="feature-title display">Love your character?<br />Show them off.</h2>
            <p className="section-copy">Share your character, describe their personality, give them a little story — and let other gamers meet the character behind the screen.</p>
            <a className="button button-primary" href="#from-screenshot" style={{ marginTop: '28px' }} data-testid="link-create-character-story">Create your character story <ArrowUpRight size={16} /></a>
          </div>
        </div>
      </section>

      <section className="gallery section-pad" id="stories">
        <div className="container-wide">
          <div className="gallery-head">
            <div>
              <p className="eyebrow">Some moments are too good to forget.</p>
              <h2 className="section-title display">These are your<br />gaming stories.</h2>
            </div>
          </div>
          <div className="gallery-grid" aria-label="Community story examples">
            {memorableMoments.map((moment, index) => (
              <article className="gallery-tile" key={moment.id} data-testid={`card-gaming-moment-${index + 1}`}>
                <span className="tile-tag">{moment.label}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="community section-pad" id="community">
        <div className="container-wide community-layout">
          <div>
            <p className="eyebrow">Meet gamers who get it.</p>
            <h2 className="display">Every gamer<br />has their own way<br /><span style={{ color: 'hsl(var(--secondary))' }}>of playing.</span></h2>
          </div>
          <div className="community-content">
            <ul className="community-list" aria-label="Different kinds of gamers">
              {gamerTypes.map((type, index) => (
                <li className="community-row" key={type.id} data-testid={`community-style-${type.id}`}>
                  <span className="community-index">{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{type.title}</strong><p>{type.description}</p></div>
                </li>
              ))}
            </ul>
            <p className="community-outro">Find stories from people who play like you.</p>
          </div>
        </div>
      </section>

      <section className="final-cta" id="start">
        <div className="container-wide">
          <p className="eyebrow">Storigam · Stories made by gamers.</p>
          <h2 className="display">Your gaming<br />moments deserve<br />a story.</h2>
          <p className="final-lines">Bring the screenshot.<br />Make the story.<br />Share the moment.</p>
          <a className="button button-primary" href="#from-screenshot" data-testid="link-start-making">Start making <ArrowUpRight size={17} /></a>
        </div>
      </section>

      <footer className="footer">
        <div className="container-wide footer-inner">
          <a className="brand" href="#top" data-testid="link-footer-brand"><img src={logoPath} alt="Storigam" /></a>
          <small>Stories made by gamers.</small>
          <div className="footer-links"><a href="#how-it-works" data-testid="link-footer-how">How it works</a><a href="#community" data-testid="link-footer-community">Meet gamers</a></div>
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
