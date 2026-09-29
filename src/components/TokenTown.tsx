'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Cpu,
  House,
  Layers3,
  Moon,
  Pause,
  Play,
  Sun,
  Sunrise,
  Sunset,
} from 'lucide-react';
import { models, stops } from '@/data/models';
import { DEFAULT_SPEED, START_HOURS, formatClock, nextSpeed, phaseAt } from '@/data/clock';
import type { ClockState, DayPhase, DayPreset, StopId } from '@/types/factory';
import type { Experience } from '@/experience/core/Experience';
import { ApiDialog } from './ApiDialog';

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

export function TokenTown() {
  const host = useRef<HTMLDivElement>(null),
    labels = useRef<HTMLDivElement>(null),
    experience = useRef<Experience | null>(null);
  const [selected, setSelected] = useState<StopId>('core');
  const [clock, setClock] = useState<ClockState>(initialClock);
  const [preview, setPreview] = useState(false);
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
    setPreview(false);
    setSelected('core');
    setError('');
    import('@/experience/core/Experience')
      .then(({ Experience }) => {
        if (cancelled || !host.current || !labels.current) return;
        instance = new Experience(host.current, labels.current, {
          onPreview: () => setPreview(true),
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

        <div className="town-brand" data-overlay>
          <span className="town-emblem">✦</span>
          <div>
            <h1>Token Town</h1>
            <p>A city of models. One connection.</p>
          </div>
        </div>
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

        <aside
          className="model-panel"
          key={stop.id}
          aria-label={`${stop.name} details`}
          data-overlay
        >
          <div className="panel-heading">
            <span className="model-emblem" style={{ color: stop.color }}>
              <Layers3 size={24} />
            </span>
            <div>
              <span className="model-category">{stop.category}</span>
              <h2>{stop.name}</h2>
            </div>
            <span className="simulation-badge">Simulation</span>
          </div>
          <div className="usage-summary">
            <strong>—</strong>
            <span>tokens this week</span>
            <span className="data-pending">Usage data coming soon</span>
          </div>
          <dl className="model-stats">
            <div>
              <dt>Context</dt>
              <dd>
                {model?.context.startsWith('Pending')
                  ? 'Not available'
                  : (model?.context ?? 'Token router')}
              </dd>
            </div>
            <div>
              <dt>Input / output · 1M</dt>
              <dd>Not available</dd>
            </div>
            <div>
              <dt>Capabilities</dt>
              <dd>{model ? 'Not available' : 'Model routing'}</dd>
            </div>
          </dl>
          <div className="panel-footer">
            <span>
              <span className="status-dot" /> {ready ? 'City online' : 'Connecting'}
            </span>
            <button onClick={() => setApi(true)} aria-label="Get API access">
              Explore API <ArrowUpRight size={14} />
            </button>
          </div>
        </aside>
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

        {(!preview || error) && (
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

        <div className="orbit-hint">Drag to look around · ← → to change buildings</div>
      </section>
      <div className="sr-only" aria-live="polite">
        {`${stop.name} in focus, stop ${stopIndex + 1} of ${stops.length}`}
      </div>
      {api && <ApiDialog model={model} onClose={() => setApi(false)} />}
    </main>
  );
}
