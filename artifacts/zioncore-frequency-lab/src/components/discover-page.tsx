import { useState } from 'react';
import { ArrowDown, ArrowRight, BookOpen, ChevronDown, Compass, Headphones, Mic, ShieldCheck, Waves } from 'lucide-react';
import { Link } from 'wouter';
import { guideArticles, guideFaq } from '@/lib/guide-content';
import { trackGuideArticleOpen, trackGuideCtaClick } from '@/lib/project-analytics';
import DiscoveryStudio from '@/components/discovery-studio';

export default function DiscoverPage() {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('');
  const query = filter.trim().toLowerCase();
  const articles = guideArticles.filter(article => `${article.title} ${article.summary} ${article.text}`.toLowerCase().includes(query));
  const faqs = guideFaq.filter(([question, answer]) => `${question} ${answer}`.toLowerCase().includes(query));

  return <main className="page-wrap zc-guide" data-testid="page-discover">
    <header className="zg-hero">
      <div className="zg-hero-copy">
        <div className="eyebrow"><span className="zc-eyebrow-mark" aria-hidden="true" /> ZionCore field guide / 03</div>
        <h1 className="zg-title">Start with the signal.<br /><em>Stay open to meaning.</em></h1>
        <p className="zg-lead">I’m ZionCore: an attentive guide for curious listening. I begin with what your device measured, explore the pattern through the context you choose, and leave the meaning in your hands.</p>
        <div className="zg-actions"><Link href="/" className="btn btn-primary" onClick={() => trackGuideCtaClick('hero', 'live_lab')} data-testid="link-guide-live"><Mic size={15} /> Open the live lab <ArrowRight size={14} /></Link><a href="#guide-index" className="btn btn-subtle" onClick={() => trackGuideCtaClick('hero', 'guide_index')} data-testid="link-guide-index">Browse the field notes <ArrowDown size={14} /></a></div>
        <p className="zg-boundary"><ShieldCheck size={14} /> Evidence first. Reflection by choice. No promised supernatural, safety, animal-language or health outcomes.</p>
      </div>
      <aside className="zg-hero-art" aria-label="Field guide orientation">
        <div className="zg-orbit zg-orbit-one" /><div className="zg-orbit zg-orbit-two" />
        <div className="zg-art-center"><Waves size={31} /><span>OBSERVE<br />THEN EXPLORE</span></div>
        <div className="zg-art-note">SIGNAL / CONTEXT / YOUR MEANING</div>
      </aside>
    </header>

    <section className="zg-routebar" aria-label="Quick routes">
      <a href="#how-it-works"><span>01</span><strong>Understand</strong><small>How a reading works</small></a>
      <a href="#fft-resolution"><span>02</span><strong>Measure</strong><small>Frequency and limits</small></a>
      <a href="#faith-context"><span>03</span><strong>Reflect</strong><small>Your chosen context</small></a>
      <a href="#privacy"><span>04</span><strong>Choose</strong><small>Privacy and records</small></a>
    </section>

    <DiscoveryStudio />

    <section className="zg-index" id="guide-index" aria-labelledby="zg-index-title">
      <div className="zg-index-heading">
        <div><span className="zg-kicker">A living field notebook</span><h2 id="zg-index-title">Find the question you brought.</h2><p>Short summaries keep the page easy to scan. Open a note when you want its full method, nuance and practical boundaries.</p></div>
        <div className="zg-index-tools">
          <label className="zg-search"><span className="sr-only">Search the field guide</span><input type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Find a topic…" data-testid="input-guide-search" /></label>
          <button className="btn btn-subtle" type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} data-testid="button-guide-toggle">{expanded ? 'Close all notes' : 'Open all notes'} <ChevronDown size={14} /></button>
        </div>
      </div>

      <div className="zg-topic-chips" aria-label="Guide chapters">
        {articles.map((article, index) => <a href={`#${article.id}`} key={article.id}><span>{String(index + 1).padStart(2, '0')}</span>{article.title}</a>)}
      </div>
      <div className="zg-articles">
        {articles.map((article, index) => <details className="zg-article" id={article.id} key={article.id} open={expanded} onToggle={event => {
          if (event.currentTarget.open) trackGuideArticleOpen(article.id);
        }}>
          <summary data-testid={`summary-guide-${article.id}`}><span className="zg-article-index">{String(index + 1).padStart(2, '0')}</span><span className="zg-article-title"><strong>{article.title}</strong><small>{article.summary}</small></span><ChevronDown className="zg-chevron" size={17} aria-hidden="true" /></summary>
          <div className="zg-article-body">{article.text.split(/\n\n+/).map((paragraph, paragraphIndex) => <p key={`${article.id}-${paragraphIndex}`}>{paragraph}</p>)}</div>
        </details>)}
        {articles.length === 0 && <div className="zg-empty"><BookOpen size={19} /><strong>No field note matches that search.</strong><p>Try a broader word such as sound, privacy, faith, FFT or wildlife.</p><button className="btn btn-subtle" onClick={() => setFilter('')} type="button">Clear search</button></div>}
      </div>
    </section>

    {faqs.length > 0 && <section className="zg-faq" id="guide-faq" aria-labelledby="zg-faq-title">
      <div className="zg-faq-intro"><span className="zg-kicker">Quick answers / honest limits</span><h2 id="zg-faq-title">A few questions listeners ask.</h2><p>Each answer is intentionally direct. If a question matters for safety, health, faith or another high-stakes choice, use the relevant trusted source as well.</p></div>
      <div className="zg-faq-list">{faqs.map(([question, answer], index) => <details className="zg-faq-item" open={expanded} key={question}><summary><span>{String(index + 1).padStart(2, '0')}</span><strong>{question}</strong><ChevronDown size={15} /></summary><p>{answer}</p></details>)}</div>
    </section>}

    <section className="zg-close">
      <div><span className="zg-kicker">Your next listen</span><h2>Wonder is welcome.<br /><em>Evidence stays in view.</em></h2><p>Bring a sound, choose a question, and decide what you want to keep. ZionCore will begin with the measurement.</p></div>
      <div className="zg-close-actions"><Link href="/" className="btn btn-primary" onClick={() => trackGuideCtaClick('closing', 'live_lab')} data-testid="link-guide-capture"><Headphones size={15} /> Start a free capture <ArrowRight size={14} /></Link><Link href="/history" className="btn btn-subtle" onClick={() => trackGuideCtaClick('closing', 'signup')} data-testid="link-guide-signup">Create a free account <ArrowRight size={14} /></Link><Link href="/wallet" className="btn btn-subtle" onClick={() => trackGuideCtaClick('closing', 'plans')} data-testid="link-guide-plans">Explore plans <ArrowRight size={14} /></Link><small>See current Stripe prices and availability on the Plans page. Premium is monthly; interpretation credits are separate.</small></div>
    </section>
    <p className="zg-foot"><Compass size={13} /> This guide describes current ZionCore behavior. It is not a substitute for calibrated instrumentation, specialist advice, community guidance or emergency services.</p>
  </main>;
}
