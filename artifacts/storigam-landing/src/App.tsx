import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import InterestSignupForm from '@/components/interest-signup-form';
import {
  ArrowUpRight,
  ImagePlus,
  MessageCircleMore,
  Sparkles,
  Globe2,
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
import heroAdventure from './assets/hero-adventure.jpg';
import characterPortrait from './assets/character-portrait.jpg';
import dragonBattle from './assets/dragon-battle.jpg';
import friendsNight from './assets/friends-night.jpg';
import chaosParty from './assets/chaos-party.jpg';
import outfitStory from './assets/outfit-story.jpg';
import { languageNames, type LandingLanguage, useLandingLanguage } from './i18n';

const queryClient = new QueryClient();

function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, copy, chooseLanguage } = useLandingLanguage();
  const memorableMoments = [
    { id: 'boss-fight', label: copy.galleryBoss, image: dragonBattle, alt: copy.galleryBossAlt },
    { id: 'favorite-outfit', label: copy.galleryOutfit, image: outfitStory, alt: copy.galleryOutfitAlt },
    { id: 'new-friend', label: copy.galleryFriend, image: friendsNight, alt: copy.galleryFriendAlt },
    { id: 'unexpected-chaos', label: copy.galleryChaos, image: chaosParty, alt: copy.galleryChaosAlt },
  ];
  const gamerTypes = [
    { id: 'character-creators', title: copy.communityCreators, description: copy.communityCreatorsCopy },
    { id: 'collectors', title: copy.communityCollectors, description: copy.communityCollectorsCopy },
    { id: 'lore-lovers', title: copy.communityLore, description: copy.communityLoreCopy },
    { id: 'chaos-makers', title: copy.communityChaos, description: copy.communityChaosCopy },
  ];

  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;

    const target = document.getElementById(targetId);
    if (!target) return;

    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    target.scrollIntoView({ block: 'start' });
    root.style.scrollBehavior = previousScrollBehavior;
  }, []);
  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="storigam-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="nav-shell">
        <div className="container-wide nav">
          <a className="brand" href="#top" onClick={closeMenu} data-testid="link-brand">
            <img src={logoPath} alt="Storigam" />
          </a>
          <div className="nav-right">
            <nav className={`nav-links ${menuOpen ? 'open' : ''}`} aria-label={copy.navAria}>
              <a href="#how-it-works" onClick={closeMenu} data-testid="link-how-it-works">{copy.navHow}</a>
              <a href="#character-story" onClick={closeMenu} data-testid="link-character-stories">{copy.navCharacters}</a>
              <a href="#community" onClick={closeMenu} data-testid="link-community">{copy.navCommunity}</a>
              <a className="nav-cta" href="#waitlist" onClick={closeMenu} data-testid="link-start">{copy.formSubmit} <ArrowUpRight size={15} /></a>
            </nav>
            <label className="language-control">
              <Globe2 size={17} aria-hidden="true" />
              <span className="sr-only">{copy.languageLabel}</span>
              <select
                aria-label={copy.languageLabel}
                data-testid="select-language"
                value={language}
                onChange={(event) => chooseLanguage(event.target.value as LandingLanguage)}
              >
                {Object.entries(languageNames).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </label>
            <button
              className="menu-button"
              type="button"
              aria-label={menuOpen ? copy.navClose : copy.navOpen}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              data-testid="button-menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="container-wide hero-grid">
          <div className="reveal">
            <p className="eyebrow">{copy.heroEyebrow}</p>
            <h1 className="display">{copy.heroGame}<br />{copy.heroMoment}<br /><em>{copy.heroStory}</em></h1>
            <p className="hero-intro">
              {copy.heroIntro}
              <strong>{copy.heroStrong}</strong>
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#waitlist" data-testid="link-join-waitlist">{copy.formSubmit} <ArrowUpRight size={17} /></a>
              <a className="button button-quiet" href="#how-it-works" data-testid="link-how-it-works-hero">{copy.navHow}</a>
            </div>
            <InterestSignupForm copy={copy} />
          </div>
          <div className="hero-stage reveal delay-2" role="img" aria-label={copy.heroVisualAlt}>
            <div className="stage-backdrop" />
            <div className="story-card">
              <div className="story-card-art">
                <img src={heroAdventure} alt="" />
              </div>
              <div className="story-card-footer">
                <div>
                  <small>{copy.heroCardOverline}</small>
                  <strong>{copy.heroCardTitle}</strong>
                </div>
                <ArrowUpRight size={22} />
              </div>
            </div>
            <div className="speech">{copy.heroSpeech}</div>
            <div className="sticker">{copy.heroSticker}</div>
          </div>
        </div>
        <div className="container-wide scroll-note"><span /> {copy.heroGame} {copy.heroMoment} {copy.heroStory}</div>
      </section>

      <div className="marquee" aria-label={`${copy.heroGame} ${copy.heroMoment} ${copy.heroStory}`}>
        <div className="marquee-track">
          {[...Array(2)].flatMap((_, index) => [
            <span className="marquee-item" key={`${index}-game`}>{copy.marqueeGame}</span>,
            <span className="marquee-dot" key={`${index}-game-dot`}>•</span>,
            <span className="marquee-item" key={`${index}-moment`}>{copy.marqueeMoment}</span>,
            <span className="marquee-dot" key={`${index}-moment-dot`}>•</span>,
            <span className="marquee-item" key={`${index}-story`}>{copy.marqueeStory}</span>,
            <span className="marquee-dot" key={`${index}-story-dot`}>•</span>,
            <span className="marquee-item" key={`${index}-make`}>{copy.marqueeMake}</span>,
            <span className="marquee-dot" key={`${index}-make-dot`}>•</span>,
          ])}
        </div>
      </div>

      <section className="manifesto section-pad">
        <div className="container-wide manifesto-layout">
          <div className="manifesto-moments">
            <p className="eyebrow">{copy.manifestoEyebrow}</p>
            <ul className="moment-list" aria-label={copy.manifestoEyebrow}>
              <li>{copy.manifestoWin}</li>
              <li>{copy.manifestoFail}</li>
              <li>{copy.manifestoCharacter}</li>
              <li>{copy.manifestoAdventure}</li>
            </ul>
          </div>
          <div>
            <h2 className="display">{copy.heroGame}<br />{copy.heroMoment}<br /><span>{copy.heroStory}</span></h2>
            <p className="manifesto-copy">{copy.manifestoCopy}</p>
          </div>
        </div>
      </section>

      <section className="how section-pad" id="how-it-works">
        <div className="container-wide">
          <div className="how-head">
            <div>
              <p className="eyebrow">{copy.howEyebrow}</p>
              <h2 className="section-title display">{copy.howTitle}</h2>
            </div>
            <p className="section-copy">{copy.howCopy}</p>
          </div>
          <div className="steps">
            <article className="step reveal" data-testid="step-pick-a-moment">
              <img className="step-image" src={heroAdventure} alt={copy.stepOneAlt} loading="lazy" />
              <div className="step-info"><div className="step-number">01</div><div><h3>{copy.stepOneTitle}</h3><p>{copy.stepOneCopy}</p></div></div>
            </article>
            <article className="step reveal delay-1" data-testid="step-make-it-yours">
              <img className="step-image" src={characterPortrait} alt={copy.stepTwoAlt} loading="lazy" />
              <div className="step-info"><div className="step-number">02</div><div><h3>{copy.stepTwoTitle}</h3><p>{copy.stepTwoCopy}</p></div></div>
            </article>
            <article className="step reveal delay-2" data-testid="step-share-your-story">
              <img className="step-image" src={friendsNight} alt={copy.stepThreeAlt} loading="lazy" />
              <div className="step-info"><div className="step-number">03</div><div><h3>{copy.stepThreeTitle}</h3><p>{copy.stepThreeCopy}</p></div></div>
            </article>
          </div>
        </div>
      </section>

      <section className="character section-pad" id="character-story">
        <div className="container-wide character-layout">
          <div className="character-art reveal" role="img" aria-label={copy.characterVisualAlt}>
            <img className="character-main-image" src={characterPortrait} alt="" loading="lazy" />
            <img className="character-inset" src={friendsNight} alt="" loading="lazy" />
            <span className="character-tag character-tag-top">{copy.characterTagTop}</span>
            <span className="character-tag character-tag-bottom">{copy.characterTagBottom}</span>
          </div>
          <div>
            <p className="eyebrow">{copy.characterEyebrow}</p>
            <h2 className="feature-title display">{copy.characterTitleOne}<br />{copy.characterTitleTwo}</h2>
            <p className="section-copy">{copy.characterCopy}</p>
            <a className="button button-primary" href="#from-screenshot" style={{ marginTop: '28px' }} data-testid="link-create-character-story">{copy.characterCta} <ArrowUpRight size={16} /></a>
          </div>
        </div>
      </section>

      <section className="features section-pad" id="from-screenshot">
        <div className="container-wide feature-layout">
          <div className="feature-visual reveal" role="group" aria-label={copy.editorAria}>
            <div className="editor-top"><span>{copy.editorFrom}</span><span>{copy.editorTo}</span></div>
            <div className="editor-screen">
              <div className="editor-panels">
                <div className="panel large"><img src={heroAdventure} alt={copy.editorMomentAlt} loading="lazy" /><span className="caption">{copy.editorCaptionMoment}</span></div>
                <div className="panel scene-1"><img src={friendsNight} alt={copy.editorWordsAlt} loading="lazy" /><span className="caption">{copy.editorCaptionWords}</span></div>
                <div className="panel scene-2"><img src={outfitStory} alt={copy.editorStoryAlt} loading="lazy" /><span className="caption">{copy.editorCaptionStory}</span></div>
              </div>
              <div className="editor-tools">
                <div className="tool active"><ImagePlus aria-hidden="true" /> {copy.editorAddScreenshot}</div>
                <div className="tool"><MessageCircleMore aria-hidden="true" /> {copy.editorAddWords}</div>
                <div className="tool"><Sparkles aria-hidden="true" /> {copy.editorMakeStory}</div>
              </div>
            </div>
          </div>
          <div>
            <p className="eyebrow">{copy.editorEyebrow}</p>
            <h2 className="feature-title display">{copy.editorTitle}</h2>
            <p className="section-copy">{copy.editorCopy}</p>
            <ol className="creation-flow" aria-label={copy.editorMakeStory}>
              <li data-testid="flow-add-screenshot">{copy.editorAddScreenshot}</li>
              <li data-testid="flow-add-words">{copy.editorAddWords}</li>
              <li data-testid="flow-make-story">{copy.editorMakeStory}</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="gallery section-pad" id="stories">
        <div className="container-wide">
          <div className="gallery-head">
            <div>
              <p className="eyebrow">{copy.galleryEyebrow}</p>
              <h2 className="section-title display">{copy.galleryTitleOne}<br />{copy.galleryTitleTwo}</h2>
              <p className="gallery-lede">{copy.galleryLede}</p>
            </div>
          </div>
          <div className="gallery-grid" aria-label={copy.galleryAria}>
            {memorableMoments.map((moment, index) => (
              <article className="gallery-tile" key={moment.id} data-testid={`card-gaming-moment-${index + 1}`}>
                <img src={moment.image} alt={moment.alt} loading="lazy" />
                <span className="tile-tag">{moment.label}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="community section-pad" id="community">
        <div className="container-wide community-layout">
          <div>
            <p className="eyebrow">{copy.communityEyebrow}</p>
            <h2 className="display">{copy.communityTitleOne}<br />{copy.communityTitleTwo}<br /><span style={{ color: 'hsl(var(--secondary))' }}>{copy.communityTitleThree}</span></h2>
            <img className="community-image" src={chaosParty} alt={copy.communityImageAlt} loading="lazy" />
          </div>
          <div className="community-content">
            <ul className="community-list" aria-label={copy.communityAria}>
              {gamerTypes.map((type, index) => (
                <li className="community-row" key={type.id} data-testid={`community-style-${type.id}`}>
                  <span className="community-index">{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{type.title}</strong><p>{type.description}</p></div>
                </li>
              ))}
            </ul>
            <p className="community-outro">{copy.communityOutro}</p>
          </div>
        </div>
      </section>

      <section className="final-cta" id="start">
        <div className="container-wide">
          <p className="eyebrow">{copy.finalEyebrow}</p>
          <h2 className="display">{copy.finalOne}<br />{copy.finalTwo}<br />{copy.finalThree}</h2>
          <p className="final-lines">{copy.finalCopy}</p>
          <a className="button button-primary final-join" href="#waitlist" data-testid="link-join-waitlist-footer">
            {copy.formSubmit} <ArrowUpRight size={17} />
          </a>
        </div>
      </section>

      <footer className="footer">
        <div className="container-wide footer-inner">
          <a className="brand" href="#top" data-testid="link-footer-brand"><img src={logoPath} alt="Storigam" /></a>
          <small>{copy.footerTagline}</small>
          <div className="footer-links"><a href="#how-it-works" data-testid="link-footer-how">{copy.navHow}</a><a href="#community" data-testid="link-footer-community">{copy.footerMeet}</a></div>
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
  const isCanonicalDomainRoot =
    typeof window !== 'undefined' &&
    window.location.hostname.toLowerCase() === 'www.storigam.com' &&
    window.location.pathname === '/';
  const routerBase = isCanonicalDomainRoot
    ? ''
    : import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={routerBase}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
