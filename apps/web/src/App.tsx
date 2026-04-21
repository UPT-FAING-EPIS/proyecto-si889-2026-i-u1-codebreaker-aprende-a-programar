import { useEffect, useState, type CSSProperties } from 'react';
import { tracks, type Level, type Track, type ValidatorKey } from './gameData';

type Screen = 'landing' | 'routes' | 'map' | 'lesson';

type RunResult = {
  success: boolean;
  title: string;
  detail: string;
  stdout: string;
};

const lessonCatalog = Object.fromEntries(
  tracks.flatMap((track) => track.levels.map((level) => [level.id, level])),
) as Record<string, Level>;

const initialCodeByLesson = Object.fromEntries(
  tracks.flatMap((track) =>
    track.levels.map((level) => [level.id, level.starterCode]),
  ),
) as Record<string, string>;

const statCards = [
  { label: 'Lecciones activas', value: '2 rutas' },
  { label: 'Tiempo de misión', value: '3 a 5 min' },
  { label: 'Modo actual', value: 'Demo navegable' },
];

const mapNodeSlots = [
  { left: '8%', top: '20%' },
  { left: '23%', top: '34%' },
  { left: '38%', top: '50%' },
  { left: '54%', top: '38%' },
  { left: '69%', top: '20%' },
  { left: '84%', top: '34%' },
  { left: '96%', top: '20%' },
];

let audioContextInstance: AudioContext | null = null;

function playUiTapSound() {
  if (typeof window === 'undefined') {
    return;
  }

  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  if (!audioContextInstance) {
    audioContextInstance = new AudioContextCtor();
  }

  if (audioContextInstance.state === 'suspended') {
    void audioContextInstance.resume();
  }

  const startAt = audioContextInstance.currentTime;
  const oscillator = audioContextInstance.createOscillator();
  const gain = audioContextInstance.createGain();
  const filter = audioContextInstance.createBiquadFilter();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(420, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(620, startAt + 0.04);
  oscillator.frequency.exponentialRampToValueAtTime(300, startAt + 0.12);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.018, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.14);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audioContextInstance.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + 0.14);
}

function getTrack(trackId: string): Track {
  return tracks.find((track) => track.id === trackId) ?? tracks[0];
}

function getCurrentLesson(track: Track, completedLessons: string[]): Level {
  const nextLesson = track.levels.find(
    (level) => !completedLessons.includes(level.id),
  );

  return nextLesson ?? track.levels[track.levels.length - 1];
}

function getLevelState(track: Track, level: Level, completedLessons: string[]) {
  if (completedLessons.includes(level.id)) {
    return 'completed';
  }

  const currentLesson = getCurrentLesson(track, completedLessons);

  if (currentLesson.id === level.id) {
    return 'current';
  }

  return 'locked';
}

function normalizeCode(code: string) {
  return code.replace(/\s+/g, ' ').trim().toLowerCase();
}

function validateLesson(validator: ValidatorKey, code: string): RunResult {
  const normalizedCode = normalizeCode(code);

  if (validator === 'python-greeting') {
    const passed =
      normalizedCode.includes('print(mensaje)') ||
      normalizedCode.includes('print("hola, codebreaker")') ||
      normalizedCode.includes("print('hola, codebreaker')");

    return passed
      ? {
          success: true,
          title: 'Canal estable',
          detail:
            'La consola respondió correctamente. La primera misión de Python queda completada.',
          stdout: 'Hola, Codebreaker',
        }
      : {
          success: false,
          title: 'Señal incompleta',
          detail:
            'Todavía falta enviar el mensaje a la salida estándar. Revisa print(...) y vuelve a ejecutar.',
          stdout: '',
        };
  }

  const passed =
    normalizedCode.includes('echo $mensaje;') ||
    normalizedCode.includes('echo "hola, codebreaker";') ||
    normalizedCode.includes("echo 'hola, codebreaker';");

  return passed
    ? {
        success: true,
        title: 'Puerto conectado',
        detail:
          'La salida del backend respondió como se esperaba. La misión inicial de PHP queda completada.',
        stdout: 'Hola, Codebreaker',
      }
    : {
        success: false,
        title: 'Respuesta vacía',
        detail:
          'Todavía no se está mostrando el mensaje. Usa echo para enviar la salida correcta.',
        stdout: '',
      };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [selectedTrackId, setSelectedTrackId] = useState<Track['id']>('python');
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string>('python-1');
  const [codeByLesson, setCodeByLesson] = useState<Record<string, string>>(
    initialCodeByLesson,
  );
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [revealedHints, setRevealedHints] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const activeTrack = getTrack(selectedTrackId);
  const activeLesson = lessonCatalog[activeLessonId] ?? activeTrack.levels[0];
  const currentLesson = getCurrentLesson(activeTrack, completedLessons);
  const currentLevelIndex = Math.max(
    activeTrack.levels.findIndex((level) => level.id === currentLesson.id),
    0,
  );
  const mascotSlot = mapNodeSlots[currentLevelIndex] ?? mapNodeSlots[0];
  const mascotStyle = {
    left: mascotSlot.left,
    top: `calc(${mascotSlot.top} + 86px)`,
  } as CSSProperties;
  const missionProgress = Math.round(
    (completedLessons.filter((lessonId) =>
      activeTrack.levels.some((level) => level.id === lessonId),
    ).length /
      activeTrack.levels.length) *
      100,
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!soundEnabled) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest('button')) {
        playUiTapSound();
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [soundEnabled]);

  function handleTrackSelection(trackId: Track['id']) {
    const track = getTrack(trackId);
    const nextLesson = getCurrentLesson(track, completedLessons);

    setSelectedTrackId(trackId);
    setActiveLessonId(nextLesson.id);
    setRunResult(null);
    setRevealedHints([]);
    setScreen('map');
  }

  function handleOpenLesson(levelId: string) {
    setActiveLessonId(levelId);
    setRunResult(null);
    setRevealedHints([]);
    setScreen('lesson');
  }

  function handleCodeChange(nextCode: string) {
    setCodeByLesson((current) => ({
      ...current,
      [activeLesson.id]: nextCode,
    }));
  }

  function handleRunLesson() {
    const result = validateLesson(
      activeLesson.validator,
      codeByLesson[activeLesson.id] ?? '',
    );

    setRunResult(result);

    if (result.success && !completedLessons.includes(activeLesson.id)) {
      setCompletedLessons((current) => [...current, activeLesson.id]);
    }
  }

  function handleRevealHint() {
    const nextHint = activeLesson.hints.find(
      (hint) => !revealedHints.includes(hint),
    );

    if (nextHint) {
      setRevealedHints((current) => [...current, nextHint]);
    }
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <button className="brand" onClick={() => setScreen('landing')} type="button">
            <img alt="Codebreaker" className="brand-logo" src="/logo.png" />
            <span>
              <strong>Codebreaker</strong>
              <small>Academia de código</small>
            </span>
          </button>

          <nav className="topbar-nav">
            <button onClick={() => setScreen('landing')} type="button">
              Landing
            </button>
            <button onClick={() => setScreen('routes')} type="button">
              Rutas
            </button>
            <button onClick={() => handleTrackSelection(selectedTrackId)} type="button">
              Mapa
            </button>
            <button
              className="sound-toggle"
              onClick={() => setSoundEnabled((current) => !current)}
              type="button"
            >
              {soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
            </button>
          </nav>
        </header>

        {screen === 'landing' && (
          <section className="screen landing-screen">
            <div className="hero-layout">
              <div className="hero-copy-block">
                <span className="eyebrow">Primera experiencia navegable</span>
                <h1>Aprende programación como si fuera una misión espacial.</h1>
                <p className="hero-text">
                  Codebreaker combina rutas, niveles, práctica guiada y progreso
                  visual en una interfaz pensada para escritorio y móvil.
                </p>

                <div className="hero-actions">
                  <button
                    className="primary-button"
                    onClick={() => setScreen('routes')}
                    type="button"
                  >
                    Entrar a la academia
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => handleTrackSelection('python')}
                    type="button"
                  >
                    Ir directo a Python
                  </button>
                </div>

                <div className="stat-grid">
                  {statCards.map((card) => (
                    <article className="stat-card" key={card.label}>
                      <strong>{card.value}</strong>
                      <span>{card.label}</span>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="hero-panel">
                <div className="mission-chip">Sesión demo</div>
                <h2>Ruta recomendada</h2>
                <p>
                  Python Orbit abre con una misión corta de salida en consola y
                  muestra el ciclo completo: elegir ruta, abrir nivel, escribir,
                  ejecutar y completar.
                </p>

                <div className="preview-stack">
                  {tracks.map((track) => (
                    <article
                      className="route-preview"
                      key={track.id}
                      style={{ '--track-accent': track.accent } as CSSProperties}
                    >
                      <div className="route-mark">{track.icon}</div>
                      <div>
                        <strong>{track.name}</strong>
                        <p>{track.tagline}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </aside>
            </div>
          </section>
        )}

        {screen === 'routes' && (
          <section className="screen">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Selección de ruta</span>
                <h2>Elige tu ruta de entrenamiento</h2>
                <p>
                  Cada ruta tiene su propio mapa, tono visual y primera misión
                  interactiva.
                </p>
              </div>
            </div>

            <div className="route-grid">
              {tracks.map((track) => {
                const completedTrackLessons = track.levels.filter((level) =>
                  completedLessons.includes(level.id),
                ).length;

                return (
                  <article
                    className="route-card"
                    key={track.id}
                    style={{
                      '--track-accent': track.accent,
                      '--track-glow': track.glow,
                    } as CSSProperties}
                  >
                    <div className="route-card-top">
                      <div className="route-icon">{track.icon}</div>
                      <span className="route-pill">{completedTrackLessons}/{track.levels.length} niveles</span>
                    </div>

                    <h3>{track.name}</h3>
                    <p className="route-summary">{track.summary}</p>

                    <ul className="route-meta">
                      <li>Primera misión jugable lista</li>
                      <li>Mapa secuencial de progreso</li>
                      <li>Diseñado para móvil y escritorio</li>
                    </ul>

                    <button
                      className="primary-button route-button"
                      onClick={() => handleTrackSelection(track.id)}
                      type="button"
                    >
                      Explorar {track.name}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {screen === 'map' && (
          <section className="screen">
            <div className="section-heading split-heading">
              <div>
                <span className="eyebrow">Mapa de niveles</span>
                <h2>{activeTrack.name}</h2>
                <p>{activeTrack.summary}</p>
              </div>

              <div className="map-actions">
                <button className="ghost-button" onClick={() => setScreen('routes')} type="button">
                  Cambiar ruta
                </button>
                <button
                  className="primary-button"
                  onClick={() => handleOpenLesson(getCurrentLesson(activeTrack, completedLessons).id)}
                  type="button"
                >
                  Abrir misión actual
                </button>
              </div>
            </div>

            <div className="map-layout">
              <aside className="map-sidebar panel-surface">
                <div className="progress-ring">
                  <strong>{missionProgress}%</strong>
                  <span>ruta completada</span>
                </div>

                <div className="mission-brief">
                  <h3>Estado de la ruta</h3>
                  <p>{activeTrack.tagline}</p>
                </div>

                <div className="mission-list">
                  <article>
                    <span>Meta actual</span>
                    <strong>{getCurrentLesson(activeTrack, completedLessons).title}</strong>
                  </article>
                  <article>
                    <span>Recompensa</span>
                    <strong>
                      {getCurrentLesson(activeTrack, completedLessons).xp} XP
                    </strong>
                  </article>
                  <article>
                    <span>Tiempo</span>
                    <strong>
                      {getCurrentLesson(activeTrack, completedLessons).duration}
                    </strong>
                  </article>
                </div>
              </aside>

              <div className="map-panel panel-surface">
                <div className="map-panel-scroll">
                  <div className="orbit-map">
                  <div className="orbit-glow orbit-glow-a" />
                  <div className="orbit-glow orbit-glow-b" />
                  <div className="orbit-planet" />
                  <div className="orbit-stars" />

                  <svg
                    aria-hidden="true"
                    className="orbit-path-svg"
                    viewBox="0 0 1400 540"
                  >
                    <path
                      d="M110 165 C245 78, 300 255, 458 220 S 612 358, 770 274 S 935 84, 1084 150 S 1238 276, 1342 164"
                      pathLength="100"
                    />
                  </svg>

                  <div className="orbit-ridge orbit-ridge-back" />
                  <div className="orbit-ridge orbit-ridge-mid" />
                  <div className="orbit-ridge orbit-ridge-front" />

                  <div className="map-mascot" style={mascotStyle}>
                    <div className="map-mascot-antenna" />
                    <div className="map-mascot-head">
                      <div className="map-mascot-screen">
                        <span className="map-mascot-eye" />
                        <span className="map-mascot-eye" />
                      </div>
                    </div>
                    <div className="map-mascot-neck" />
                    <div className="map-mascot-body">
                      <span className="map-mascot-core" />
                    </div>
                    <div className="map-mascot-legs">
                      <span />
                      <span />
                    </div>
                    <div className="map-mascot-shadow" />
                  </div>

                  {mapNodeSlots.map((slot, index) => {
                    const level = activeTrack.levels[index];

                    if (!level) {
                      return (
                        <div
                          className="floating-level floating-level-future"
                          key={`future-${slot.left}-${slot.top}`}
                          style={slot as CSSProperties}
                        >
                          <div className="floating-badge floating-badge-locked">?</div>
                          <div className="floating-card floating-card-locked">
                            <span>Sector futuro</span>
                          </div>
                          <div className="floating-platform" />
                        </div>
                      );
                    }

                    const state = getLevelState(activeTrack, level, completedLessons);
                    const isAccessible = state !== 'locked';

                    return (
                      <button
                        className={`floating-level floating-level-${state}`}
                        key={level.id}
                        onClick={() => isAccessible && handleOpenLesson(level.id)}
                        style={slot as CSSProperties}
                        type="button"
                      >
                        <div className={`floating-badge floating-badge-${state}`}>
                          {level.order}
                        </div>
                        <div className={`floating-card floating-card-${state}`}>
                          <strong>{level.title}</strong>
                          <span>
                            {state === 'completed'
                              ? 'Listo'
                              : state === 'current'
                                ? 'Jugar ahora'
                                : 'Bloqueado'}
                          </span>
                        </div>
                        <div className="floating-platform" />
                      </button>
                    );
                  })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {screen === 'lesson' && (
          <section className="screen lesson-screen">
            <div className="section-heading split-heading lesson-heading">
              <div>
                <span className="eyebrow">Primera lección jugable</span>
                <h2>{activeLesson.title}</h2>
                <p>{activeLesson.story}</p>
              </div>

              <div className="map-actions">
                <button
                  className="ghost-button"
                  onClick={() => handleTrackSelection(activeTrack.id)}
                  type="button"
                >
                  Volver al mapa
                </button>
                <button className="primary-button" onClick={handleRunLesson} type="button">
                  Ejecutar prueba
                </button>
              </div>
            </div>

            <div className="lesson-layout">
              <aside className="lesson-sidebar panel-surface">
                <div className="brief-card">
                  <span className="brief-label">Objetivo</span>
                  <strong>{activeLesson.goal}</strong>
                </div>

                <div className="brief-card">
                  <span className="brief-label">Salida esperada</span>
                  <code>{activeLesson.expectedOutput}</code>
                </div>

                <div className="concept-list">
                  {activeLesson.concepts.map((concept) => (
                    <span className="concept-chip" key={concept}>
                      {concept}
                    </span>
                  ))}
                </div>

                <div className="hint-block">
                  <button className="ghost-button full-width" onClick={handleRevealHint} type="button">
                    Mostrar pista
                  </button>

                  <div className="hint-list">
                    {revealedHints.length === 0 && (
                      <p>Aún no has usado pistas en esta misión.</p>
                    )}
                    {revealedHints.map((hint) => (
                      <article className="hint-item" key={hint}>
                        {hint}
                      </article>
                    ))}
                  </div>
                </div>
              </aside>

              <div className="editor-panel panel-surface">
                <div className="editor-header">
                  <div>
                    <strong>{activeTrack.name}</strong>
                    <span>
                      {activeLesson.duration} · {activeLesson.xp} XP
                    </span>
                  </div>
                  <span className="editor-language">{activeTrack.id}</span>
                </div>

                <textarea
                  className="code-editor"
                  onChange={(event) => handleCodeChange(event.target.value)}
                  spellCheck={false}
                  value={codeByLesson[activeLesson.id] ?? ''}
                />

                <div className="result-panel">
                  <div>
                    <span className="brief-label">Resultado</span>
                    <strong>{runResult?.title ?? 'Esperando ejecución'}</strong>
                  </div>

                  <p>{runResult?.detail ?? 'Ejecuta la prueba para validar tu solución.'}</p>

                  <div className={`stdout-box ${runResult?.success ? 'stdout-success' : ''}`}>
                    <span>stdout</span>
                    <pre>{runResult?.stdout || 'sin salida'}</pre>
                  </div>

                  {runResult?.success && (
                    <button
                      className="primary-button"
                      onClick={() => handleTrackSelection(activeTrack.id)}
                      type="button"
                    >
                      Volver al mapa con progreso guardado
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
