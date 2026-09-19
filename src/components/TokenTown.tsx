'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Box,
  Braces,
  Check,
  ChevronRight,
  Cpu,
  House,
  Layers3,
  Moon,
  Network,
  Pause,
  Play,
  Sun,
  Sunrise,
  Sunset,
  Terminal,
  Waypoints,
  Zap,
} from 'lucide-react';
import { models, stops } from '@/data/models';
import { DEFAULT_SPEED, START_HOURS, formatClock, nextSpeed, phaseAt } from '@/data/clock';
import type { ClockState, DayPhase, DayPreset, StopId } from '@/types/factory';
import type { Experience } from '@/experience/core/Experience';
import { ApiDialog } from './ApiDialog';

const icons = {
  core: Waypoints,
  deepseek: Zap,
  glm: Braces,
  qwen: Box,
  minimax: Layers3,
  llama: Network,
  'gpt-oss': Cpu,
};
const phaseIcons: Record<DayPhase, typeof Sun> = {
  dawn: Sunrise,
  day: Sun,
  dusk: Sunset,
  night: Moon,
};
const presets: { id: DayPreset; label: string; Icon: typeof Sun }[] = [
  { id: 'day', label: 'Day mode', Icon: Sun },
  { id: 'dusk', label: 'Dusk mode', Icon: Sunset },
  { id: 'night', label: 'Night mode', Icon: Moon },
];
const initialClock: ClockState = {
  hours: START_HOURS,
  phase: phaseAt(START_HOURS),
  night: false,
  paused: false,
  speed: DEFAULT_SPEED,
};
const pad = (value: number) => String(value).padStart(2, '0');

export function TokenTown() {
  const host = useRef<HTMLDivElement>(null),
    labels = useRef<HTMLDivElement>(null),
    experience = useRef<Experience | null>(null);
  const [selected, setSelected] = useState<StopId>('core');
  const [clock, setClock] = useState<ClockState>(initialClock);
  const [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const [api, setApi] = useState(false),
    [retry, setRetry] = useState(0);
  const stopIndex = Math.max(
    stops.findIndex((stop) => stop.id === selected),
    0,
  );
  const stop = stops[stopIndex];
  const model = models.find((item) => item.id === selected);
  const PhaseIcon = phaseIcons[clock.phase];

  useEffect(() => {
    let cancelled = false;
    let instance: Experience | undefined;
    setReady(false);
    setSelected('core');
    setError('');
    import('@/experience/core/Experience')
      .then(({ Experience }) => {
        if (cancelled || !host.current || !labels.current) return;
        instance = new Experience(host.current, labels.current, {
          onSelect: setSelected,
          onClock: setClock,
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
    const onKey = (event: KeyboardEvent) => {
      if (api || event.altKey || event.ctrlKey || event.metaKey) return;
      if (
        (event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')
      )
        return;
      if (event.key === 'ArrowRight') experience.current?.step(1);
      else if (event.key === 'ArrowLeft') experience.current?.step(-1);
      else if (event.key === 'Escape' || event.key === 'Home') experience.current?.select('core');
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);
  const select = (id: StopId) => experience.current?.select(id);
  const step = (direction: 1 | -1) => experience.current?.step(direction);

  return (
    <main className={`town ${clock.night ? 'night' : ''} ${model ? 'is-focused' : ''}`}>
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
        <div className="scene-scrim" aria-hidden />
        <div className="scene-labels" ref={labels} aria-hidden={!ready}>
          <button
            className="core-label"
            data-stop="core"
            onClick={() => select('core')}
            tabIndex={selected === 'core' || !ready ? -1 : 0}
          >
            FPT CORE <span>/ TOKEN ROUTER</span>
          </button>
          {models.map((item, index) => (
            <button
              key={item.id}
              data-stop={item.id}
              className="factory-label"
              onClick={() => select(item.id)}
              tabIndex={selected === item.id || !ready ? -1 : 0}
              style={{ '--model-color': item.color } as React.CSSProperties}
            >
              <span className="label-dot" />
              {item.name}
              <ChevronRight size={11} />
              <small>0{index + 1}</small>
            </button>
          ))}
        </div>

        {!model && (
          <div className="intro" data-overlay>
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
            <button className="tour-button" disabled={!ready} onClick={() => step(1)}>
              Tour the districts <ArrowRight size={14} />
            </button>
          </div>
        )}

        <nav className="tour-nav" aria-label="City tour" data-overlay>
          <button
            className="tour-step"
            aria-label="Previous stop"
            disabled={!ready}
            onClick={() => step(-1)}
          >
            <ArrowLeft size={16} /> <span>Previous</span>
          </button>
          <span className="tour-count" aria-label={`Stop ${stopIndex + 1} of ${stops.length}`}>
            <strong>{stopIndex + 1}</strong> / {stops.length}
          </span>
          <button
            className="tour-step"
            aria-label="Next stop"
            disabled={!ready}
            onClick={() => step(1)}
          >
            <span>Next</span> <ArrowRight size={16} />
          </button>
          <button
            className="home-button"
            title="Return to FPT Core"
            aria-label="Return to FPT Core"
            disabled={!ready || selected === 'core'}
            onClick={() => select('core')}
          >
            <House size={16} />
          </button>
        </nav>

        {model && (
          <aside
            className="model-panel"
            key={model.id}
            aria-label={`${model.name} details`}
            data-overlay
          >
            <button className="back-button" onClick={() => select('core')}>
              <ArrowLeft size={15} /> FPT Core
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

        <div className="clock" role="group" aria-label="City time-lapse" data-overlay>
          <span className="clock-readout" title="City time">
            <PhaseIcon size={15} />
            <strong>{formatClock(clock.hours)}</strong>
            <span className="clock-phase">{clock.phase}</span>
          </span>
          <span className="clock-divider" />
          <div className="clock-presets">
            {presets.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={clock.phase === id ? 'active' : ''}
                aria-label={label}
                aria-pressed={clock.phase === id}
                title={label}
                disabled={!ready}
                onClick={() => experience.current?.jumpTo(id)}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
          <span className="clock-divider" />
          <button
            className="clock-play"
            aria-label={clock.paused ? 'Play time-lapse' : 'Pause time-lapse'}
            title={clock.paused ? 'Play time-lapse' : 'Pause time-lapse'}
            disabled={!ready}
            onClick={() => experience.current?.setClockPaused(!clock.paused)}
          >
            {clock.paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            className="clock-speed"
            aria-label={`Time-lapse speed ${clock.speed}x`}
            title="Change time-lapse speed"
            disabled={!ready}
            onClick={() => experience.current?.setClockSpeed(nextSpeed(clock.speed))}
          >
            {clock.speed}x
          </button>
        </div>

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
          <div className="city-status" data-overlay>
            <span className="status-dot" />
            <span>{ready ? 'CITY ONLINE' : 'CONNECTING'}</span>
            <span className="status-separator">/</span>
            <span>06 MODEL DISTRICTS</span>
            <span className="status-separator">/</span>
            <span className="flow-mark" /> <span>SIMULATED TOKEN TRAFFIC</span>
          </div>
        </div>
      </section>

      <section className="model-dock" aria-label="Model navigator">
        <div className="dock-heading">
          <span>THE MODEL DISTRICTS</span>
          <span>
            Six specialists. One ecosystem. <ArrowDownLeft size={14} />
          </span>
        </div>
        <nav className="model-list" aria-label="Select a city stop">
          {stops.map((item) => {
            const Icon = icons[item.id];
            const number =
              item.id === 'core' ? 'HOME' : pad(models.findIndex((m) => m.id === item.id) + 1);
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
                  <span>{number}</span>
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
        {`${stop.name} in focus, stop ${stopIndex + 1} of ${stops.length}`}
      </div>
      {api && <ApiDialog model={model} onClose={() => setApi(false)} />}
    </main>
  );
}
