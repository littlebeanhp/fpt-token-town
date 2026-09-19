'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Box,
  Braces,
  Check,
  ChevronRight,
  Cpu,
  Layers3,
  Moon,
  Network,
  RotateCcw,
  Sun,
  Terminal,
  Zap,
} from 'lucide-react';
import { models } from '@/data/models';
import type { FactoryId } from '@/types/factory';
import type { Experience } from '@/experience/core/Experience';
import { ApiDialog } from './ApiDialog';

const icons = [Zap, Braces, Box, Layers3, Network, Cpu];

export function TokenTown() {
  const host = useRef<HTMLDivElement>(null),
    labels = useRef<HTMLDivElement>(null),
    experience = useRef<Experience | null>(null);
  const [selected, setSelected] = useState<FactoryId | null>(null);
  const [night, setNight] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const [api, setApi] = useState(false),
    [retry, setRetry] = useState(0);
  const model = models.find((item) => item.id === selected);
  useEffect(() => {
    let cancelled = false;
    let instance: Experience | undefined;
    setReady(false);
    setSelected(null);
    setError('');
    import('@/experience/core/Experience')
      .then(({ Experience }) => {
        if (cancelled || !host.current || !labels.current) return;
        instance = new Experience(host.current, labels.current, {
          onSelect: setSelected,
          onReady: () => setReady(true),
          onError: (message) => {
            setReady(false);
            setError(message);
          },
        });
        experience.current = instance;
        void instance.init();
      })
      .catch(() => {
        if (!cancelled) setError('The city could not load. Please try again.');
      });
    return () => {
      cancelled = true;
      instance?.dispose();
      experience.current = null;
    };
  }, [retry]);
  useEffect(() => {
    experience.current?.setNight(night);
  }, [night, ready]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !api) experience.current?.select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);
  const select = (id: FactoryId | null) => experience.current?.select(id);

  return (
    <main className={`town ${night ? 'night' : ''} ${selected ? 'is-focused' : ''}`}>
      <header className="topbar">
        <a href="/" className="brand" aria-label="FPT AI Token Factory home">
          <span className="fpt-logo">
            <i>F</i>
            <i>P</i>
            <i>T</i>
          </span>
          <span className="brand-divider" />
          <span>AI TOKEN FACTORY</span>
        </a>
        <div className="topbar-right">
          <span className="preview-badge">
            <span className="status-dot" /> FACTORY PREVIEW
          </span>
          <button className="api-link" onClick={() => setApi(true)}>
            Get API access <ArrowUpRight size={16} />
          </button>
        </div>
      </header>

      <section className="city-stage" aria-label="AI factory city">
        <div className="scene-host" ref={host} />
        <div className="scene-labels" ref={labels} aria-hidden={!!selected || !ready}>
          <span className="core-label" data-core>
            FPT CORE <span>/ TOKEN ROUTER</span>
          </span>
          {models.map((item, index) => (
            <button
              key={item.id}
              data-model={item.id}
              className="factory-label"
              onClick={() => select(item.id)}
              tabIndex={selected || !ready ? -1 : 0}
              style={{ '--model-color': item.color } as React.CSSProperties}
            >
              <span className="label-dot" />
              {item.name}
              <ChevronRight size={11} />
              <small>0{index + 1}</small>
            </button>
          ))}
        </div>

        {!selected && (
          <div className="intro">
            <div className="eyebrow">
              <span className="tiny-cross">+</span> INTELLIGENCE, IN MOTION
            </div>
            <h1>
              FPT AI
              <br />
              Token Factory<span>.</span>
            </h1>
            <p>
              A city of models.
              <br />
              One powerful connection.
            </p>
            <div className="intro-rule" />
            <span className="intro-foot">Built for what comes next.</span>
          </div>
        )}

        <div className="scene-controls">
          <div className="day-toggle" aria-label="City lighting">
            <button
              className={!night ? 'active' : ''}
              aria-label="Day mode"
              aria-pressed={!night}
              title="Day mode"
              onClick={() => setNight(false)}
            >
              <Sun size={17} />
            </button>
            <button
              className={night ? 'active' : ''}
              aria-label="Night mode"
              aria-pressed={night}
              title="Night mode"
              onClick={() => setNight(true)}
            >
              <Moon size={16} />
            </button>
          </div>
          <button
            className="icon-button reset-button"
            title="Reset view"
            aria-label="Reset view"
            disabled={!ready}
            onClick={() => select(null)}
          >
            <RotateCcw size={17} />
          </button>
        </div>

        {model && (
          <aside className="model-panel" key={model.id} aria-label={`${model.name} details`}>
            <button className="back-button" onClick={() => select(null)}>
              <ArrowLeft size={15} /> All factories
            </button>
            <div className="model-category" style={{ color: model.color }}>
              <span className="status-dot" />
              {model.category}
            </div>
            <h2>{model.name}</h2>
            <p className="model-description">{model.description}</p>
            <dl>
              <div>
                <dt>Context length</dt>
                <dd>{model.context}</dd>
              </div>
              <div>
                <dt>Token usage</dt>
                <dd>
                  -- <span>tokens</span>
                </dd>
              </div>
              <div>
                <dt>Route status</dt>
                <dd className="route-status">
                  <Check size={13} /> Simulation active
                </dd>
              </div>
            </dl>
            <button className="primary-button" onClick={() => setApi(true)}>
              <Terminal size={16} /> Explore API <ArrowUpRight size={16} />
            </button>
            <span className="panel-note">Model district / 0{models.indexOf(model) + 1}</span>
          </aside>
        )}

        {!ready && (
          <div className="loading-screen" role="status">
            {error ? (
              <>
                <Cpu size={28} />
                <h2>City temporarily offline</h2>
                <p>{error}</p>
                <button className="primary-button" onClick={() => setRetry((value) => value + 1)}>
                  Retry connection
                </button>
              </>
            ) : (
              <>
                <div className="loading-cube" />
                <span>Bringing the city online</span>
                <small>FPT AI TOKEN FACTORY</small>
              </>
            )}
          </div>
        )}

        <div className="scene-bottom">
          <div className="city-status">
            <span className="status-dot" />
            <span>{ready ? 'CITY ONLINE' : 'CONNECTING'}</span>
            <span className="status-separator">/</span>
            <span>06 MODEL DISTRICTS</span>
          </div>
          <span className="simulation-label">
            <span className="flow-mark" /> SIMULATED TOKEN TRAFFIC
          </span>
        </div>
      </section>

      <section className="model-dock" aria-label="Model navigator">
        <div className="dock-heading">
          <span>THE MODEL DISTRICTS</span>
          <span>
            Six specialists. One ecosystem. <ArrowDownLeft size={14} />
          </span>
        </div>
        <nav className="model-list" aria-label="Select a model factory">
          {models.map((item, index) => {
            const Icon = icons[index];
            return (
              <button
                className={`model-nav ${selected === item.id ? 'selected' : ''}`}
                key={item.id}
                aria-pressed={selected === item.id}
                disabled={!ready}
                onClick={() => select(item.id)}
                style={{ '--model-color': item.color } as React.CSSProperties}
              >
                <div className="nav-top">
                  <Icon size={19} strokeWidth={1.7} />
                  <span>0{index + 1}</span>
                  <ArrowUpRight className="nav-arrow" size={15} />
                </div>
                <strong>{item.name}</strong>
                <span className="nav-category">{item.category}</span>
              </button>
            );
          })}
        </nav>
      </section>
      <footer>
        <span>
          FPT<span className="footer-ai"> AI</span> <span className="footer-divider">/</span>{' '}
          Possibilities, connected.
        </span>
        <span>
          A little city. A bigger future.
          <span className="footer-square" />
        </span>
      </footer>
      <div className="sr-only" aria-live="polite">
        {model ? `${model.name} selected` : 'City overview'}
      </div>
      {api && <ApiDialog model={model} onClose={() => setApi(false)} />}
    </main>
  );
}
