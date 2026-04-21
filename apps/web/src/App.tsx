import { useState } from 'react';
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
  { label: 'Tiempo de mision', value: '3 a 5 min' },
  { label: 'Modo actual', value: 'Demo navegable' },
];

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
            'La consola respondio correctamente. La primera mision de Python queda completada.',
          stdout: 'Hola, Codebreaker',
        }
      : {
          success: false,
          title: 'Senal incompleta',
          detail:
            'Todavia falta enviar el mensaje a la salida estandar. Revisa print(...) y vuelve a ejecutar.',
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
          'La salida del backend respondio como se esperaba. La mision inicial de PHP queda completada.',
        stdout: 'Hola, Codebreaker',
      }
    : {
        success: false,
        title: 'Respuesta vacia',
        detail:
          'Todavia no se esta mostrando el mensaje. Usa echo para enviar la salida correcta.',
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

  const activeTrack = getTrack(selectedTrackId);
  const activeLesson = lessonCatalog[activeLessonId] ?? activeTrack.levels[0];
  const missionProgress = Math.round(
    (completedLessons.filter((lessonId) =>
      activeTrack.levels.some((level) => level.id === lessonId),
    ).length /
      activeTrack.levels.length) *
      100,
  );

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
              <small>Academia de codigo</small>
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
          </nav>
        </header>

        {screen === 'landing' && (
          <section className="screen landing-screen">
            <div className="hero-layout">
              <div className="hero-copy-block">
                <span className="eyebrow">Primera experiencia navegable</span>
                <h1>Aprende programacion como si fuera una mision espacial.</h1>
                <p className="hero-text">
                  Codebreaker combina rutas, niveles, practica guiada y progreso
                  visual en una interfaz pensada para escritorio y movil.
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
                <div className="mission-chip">Sesion demo</div>
                <h2>Ruta recomendada</h2>
                <p>
                  Python Orbit abre con una mision corta de salida en consola y
                  muestra el ciclo completo: elegir ruta, abrir nivel, escribir,
                  ejecutar y completar.
                </p>

                <div className="preview-stack">
                  {tracks.map((track) => (
                    <article
                      className="route-preview"
                      key={track.id}
                      style={{ '--track-accent': track.accent } as React.CSSProperties}
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
                <span className="eyebrow">Seleccion de ruta</span>
                <h2>Elige tu ruta de entrenamiento</h2>
                <p>
                  Cada ruta tiene su propio mapa, tono visual y primera mision
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
                    } as React.CSSProperties}
                  >
                    <div className="route-card-top">
                      <div className="route-icon">{track.icon}</div>
                      <span className="route-pill">{completedTrackLessons}/{track.levels.length} niveles</span>
                    </div>

                    <h3>{track.name}</h3>
                    <p className="route-summary">{track.summary}</p>

                    <ul className="route-meta">
                      <li>Primera mision jugable lista</li>
                      <li>Mapa secuencial de progreso</li>
                      <li>Disenado para movil y escritorio</li>
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
                  Abrir mision actual
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
                <div className="level-path">
                  {activeTrack.levels.map((level) => {
                    const state = getLevelState(activeTrack, level, completedLessons);
                    const isAccessible = state !== 'locked';

                    return (
                      <button
                        className={`level-node level-node-${state}`}
                        key={level.id}
                        onClick={() => isAccessible && handleOpenLesson(level.id)}
                        type="button"
                      >
                        <span className="level-order">0{level.order}</span>
                        <strong>{level.title}</strong>
                        <small>{level.subtitle}</small>
                        <em>{state === 'completed' ? 'Completado' : state === 'current' ? 'Actual' : 'Bloqueado'}</em>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {screen === 'lesson' && (
          <section className="screen lesson-screen">
            <div className="section-heading split-heading lesson-heading">
              <div>
                <span className="eyebrow">Primera leccion jugable</span>
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
                      <p>Aun no has usado pistas en esta mision.</p>
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
                    <strong>{runResult?.title ?? 'Esperando ejecucion'}</strong>
                  </div>

                  <p>{runResult?.detail ?? 'Ejecuta la prueba para validar tu solucion.'}</p>

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
