import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { tracks, type Level, type Track, type ValidatorKey } from './gameData';

type Screen = 'landing' | 'routes' | 'map' | 'lesson';

type RunResult = {
  success: boolean;
  title: string;
  detail: string;
  stdout: string;
};

type UiToast = {
  tone: 'info' | 'warning' | 'success';
  message: string;
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

function validateLesson(
  lesson: Level,
  code: string,
  bossTimeLeft: number | null,
): RunResult {
  const normalizedCode = normalizeCode(code);
  const requests = lesson.bossBattle?.requests ?? [];

  if (validatorIsBoss(lesson.validator)) {
    if ((bossTimeLeft ?? 0) <= 0) {
      return {
        success: false,
        title: 'Tiempo agotado',
        detail:
          'El jefe recuperó su escudo. Vuelve a intentarlo y responde las cadenas más rápido.',
        stdout: '',
      };
    }

    const missingRequests = requests.filter(
      (request) => !normalizedCode.includes(request.toLowerCase()),
    );
    const hasOutputInstruction =
      lesson.validator === 'python-boss-strings'
        ? normalizedCode.includes('print')
        : normalizedCode.includes('echo');

    if (hasOutputInstruction && missingRequests.length === 0) {
      return {
        success: true,
        title: 'Jefe neutralizado',
        detail:
          'Respondiste todas las cadenas del protocolo antes de que el temporizador llegara a cero.',
        stdout: requests.join('\n'),
      };
    }

    return {
      success: false,
      title: 'Cadena incompleta',
      detail: missingRequests.length
        ? `Todavía faltan estas respuestas: ${missingRequests.join(', ')}.`
        : 'Tu código debe imprimir las cadenas del protocolo para romper el escudo.',
      stdout: '',
    };
  }

  if (lesson.validator === 'python-variable-output') {
    const passed =
      normalizedCode.includes('print(energia)') ||
      normalizedCode.includes('print(80)');

    return passed
      ? {
          success: true,
          title: 'Energía estabilizada',
          detail:
            'La consola mostró el valor correcto de la variable y la siguiente etapa quedó desbloqueada.',
          stdout: '80',
        }
      : {
          success: false,
          title: 'Salida incorrecta',
          detail:
            'Debes mostrar el valor almacenado en la variable energia para completar la misión.',
          stdout: '',
        };
  }

  if (lesson.validator === 'php-array-count') {
    const passed =
      normalizedCode.includes('count($modulos)') && normalizedCode.includes('echo');

    return passed
      ? {
          success: true,
          title: 'Conteo confirmado',
          detail:
            'El puerto ya conoce la cantidad de módulos activos y la etapa de jefe quedó disponible.',
          stdout: '3',
        }
      : {
          success: false,
          title: 'Conteo pendiente',
          detail:
            'Debes imprimir la cantidad de elementos del arreglo $modulos.',
          stdout: '',
        };
  }

  if (lesson.validator === 'python-greeting') {
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

function validatorIsBoss(validator: ValidatorKey) {
  return validator === 'python-boss-strings' || validator === 'php-boss-strings';
}

export default function App() {
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;
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
  const [bossTimeLeft, setBossTimeLeft] = useState<number | null>(null);
  const [uiToast, setUiToast] = useState<UiToast | null>(null);
  const mapScrollRef = useRef<HTMLDivElement | null>(null);

  const activeTrack = getTrack(selectedTrackId);
  const activeLesson = lessonCatalog[activeLessonId] ?? activeTrack.levels[0];
  const currentLesson = getCurrentLesson(activeTrack, completedLessons);
  const isBossLesson = activeLesson.kind === 'boss' && Boolean(activeLesson.bossBattle);
  const activeBossBattle = activeLesson.bossBattle ?? null;
  const activeCode = codeByLesson[activeLesson.id] ?? '';
  const normalizedActiveCode = normalizeCode(activeCode);
  const matchedBossRequests = (activeBossBattle?.requests ?? []).filter((request) =>
    normalizedActiveCode.includes(request.toLowerCase()),
  ).length;
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
  const bossProgress = activeBossBattle
    ? Math.round((matchedBossRequests / activeBossBattle.requests.length) * 100)
    : 0;

  function pushToast(message: string, tone: UiToast['tone']) {
    setUiToast({ message, tone });
  }

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

  useEffect(() => {
    if (!uiToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setUiToast(null);
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [uiToast]);

  useEffect(() => {
    if (screen !== 'lesson' || !isBossLesson || !activeBossBattle) {
      setBossTimeLeft(null);
      return;
    }

    setBossTimeLeft(activeBossBattle.timeLimitSeconds);
  }, [screen, activeLesson.id, isBossLesson, activeBossBattle]);

  useEffect(() => {
    if (
      screen !== 'lesson' ||
      !isBossLesson ||
      !activeBossBattle ||
      runResult?.success ||
      bossTimeLeft === null ||
      bossTimeLeft <= 0
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setBossTimeLeft((current) => {
        if (current === null) {
          return activeBossBattle.timeLimitSeconds;
        }

        return Math.max(current - 1, 0);
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [screen, isBossLesson, activeBossBattle, bossTimeLeft, runResult?.success]);

  useEffect(() => {
    if (
      screen === 'lesson' &&
      isBossLesson &&
      bossTimeLeft === 0 &&
      !runResult?.success
    ) {
      setRunResult({
        success: false,
        title: 'Tiempo agotado',
        detail:
          'El jefe recuperó su escudo. Reinicia el intento y responde más rápido.',
        stdout: '',
      });
      pushToast('El jefe restauró su escudo.', 'warning');
    }
  }, [screen, isBossLesson, bossTimeLeft, runResult?.success]);

  useEffect(() => {
    if (screen !== 'map' || !mapScrollRef.current) {
      return;
    }

    const container = mapScrollRef.current;
    const targetPercent = Number.parseFloat(mascotSlot.left) / 100;
    const maxScroll = Math.max(container.scrollWidth - container.clientWidth, 0);
    const nextScroll = Math.max(targetPercent * container.scrollWidth - container.clientWidth * 0.4, 0);

    container.scrollTo({
      left: Math.min(nextScroll, maxScroll),
      behavior: 'smooth',
    });
  }, [screen, selectedTrackId, currentLevelIndex, mascotSlot.left]);

  function handleTrackSelection(trackId: Track['id']) {
    const track = getTrack(trackId);
    const nextLesson = getCurrentLesson(track, completedLessons);

    setSelectedTrackId(trackId);
    setActiveLessonId(nextLesson.id);
    setRunResult(null);
    setRevealedHints([]);
    setScreen('map');
    pushToast(`Ruta ${track.name} lista para jugar.`, 'info');
  }

  function handleOpenLesson(levelId: string) {
    setActiveLessonId(levelId);
    setRunResult(null);
    setRevealedHints([]);
    setScreen('lesson');
    pushToast('Misión cargada.', 'info');
  }

  function handleCodeChange(nextCode: string) {
    setCodeByLesson((current) => ({
      ...current,
      [activeLesson.id]: nextCode,
    }));
  }

  function handleRunLesson() {
    const result = validateLesson(activeLesson, activeCode, bossTimeLeft);

    setRunResult(result);

    if (result.success && !completedLessons.includes(activeLesson.id)) {
      setCompletedLessons((current) => [...current, activeLesson.id]);
    }

    pushToast(
      result.success ? 'Respuesta validada.' : 'Todavía falta ajustar la solución.',
      result.success ? 'success' : 'warning',
    );
  }

  function handleRevealHint() {
    const nextHint = activeLesson.hints.find(
      (hint) => !revealedHints.includes(hint),
    );

    if (nextHint) {
      setRevealedHints((current) => [...current, nextHint]);
      pushToast('Pista desbloqueada.', 'info');
    }
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <button className="brand" onClick={() => setScreen('landing')} type="button">
            <img alt="Codebreaker" className="brand-logo" src={logoSrc} />
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
              onClick={() => {
                setSoundEnabled((current) => {
                  const nextValue = !current;
                  pushToast(
                    nextValue ? 'Sonido interactivo activado.' : 'Sonido interactivo desactivado.',
                    'info',
                  );
                  return nextValue;
                });
              }}
              type="button"
            >
              {soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
            </button>
          </nav>
        </header>

        {uiToast && (
          <div className={`ui-toast ui-toast-${uiToast.tone}`}>
            {uiToast.message}
          </div>
        )}

        {screen === 'landing' && (
          <section className="screen landing-screen">
            <div className="hero-layout">
              <div className="hero-copy-block">
                <span className="eyebrow">Primera experiencia navegable</span>
                <h1>Aprende programacion como si fuera una mision espacial.</h1>
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
                      <li>{track.levels.some((level) => level.kind === 'boss') ? 'Incluye jefe con temporizador' : 'Ruta estándar'}</li>
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
                    <strong>{currentLesson.title}</strong>
                  </article>
                  <article>
                    <span>Recompensa</span>
                    <strong>{currentLesson.xp} XP</strong>
                  </article>
                  <article>
                    <span>Tiempo</span>
                    <strong>{currentLesson.duration}</strong>
                  </article>
                  {currentLesson.kind === 'boss' && (
                    <article className="mission-list-boss">
                      <span>Alerta</span>
                      <strong>Etapa de jefe lista</strong>
                    </article>
                  )}
                </div>
              </aside>

              <div className="map-panel panel-surface">
                <div className="map-panel-scroll" ref={mapScrollRef}>
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

                    const isBossNode = level.kind === 'boss';

                    return (
                      <button
                        className={`floating-level floating-level-${state} ${isBossNode ? 'floating-level-boss' : ''}`}
                        key={level.id}
                        onClick={() => isAccessible && handleOpenLesson(level.id)}
                        style={slot as CSSProperties}
                        type="button"
                      >
                        <div className={`floating-badge floating-badge-${state}`}>
                          {isBossNode ? 'B' : level.order}
                        </div>
                        <div className={`floating-card floating-card-${state}`}>
                          <strong>{level.title}</strong>
                          <span>
                            {isBossNode
                              ? state === 'completed'
                                ? 'Jefe derrotado'
                                : state === 'current'
                                  ? 'Combate activo'
                                  : 'Jefe bloqueado'
                              : state === 'completed'
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

                {isBossLesson && activeBossBattle && (
                  <div className="boss-sidebar-card">
                    <span className="brief-label">Etapa de jefe</span>
                    <strong>{activeBossBattle.bossTitle}</strong>
                    <p>{activeBossBattle.bossTaunt}</p>
                  </div>
                )}

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

                {isBossLesson && activeBossBattle && (
                  <section className="boss-panel">
                    <div className="boss-panel-top">
                      <div className="boss-copy">
                        <span className="boss-kicker">Etapa de jefe</span>
                        <h3>{activeBossBattle.bossName}</h3>
                        <span className="boss-subtitle">{activeBossBattle.bossTitle}</span>
                      </div>

                      <div className={`boss-timer ${bossTimeLeft !== null && bossTimeLeft <= 10 ? 'boss-timer-danger' : ''}`}>
                        <span>Tiempo restante</span>
                        <strong>{bossTimeLeft ?? activeBossBattle.timeLimitSeconds}s</strong>
                      </div>
                    </div>

                    <div className="boss-stage">
                      <div className="boss-stage-aura boss-stage-aura-left" />
                      <div className="boss-stage-aura boss-stage-aura-right" />
                      <div className="boss-stage-grid" />

                      <div className={`boss-entity ${activeTrack.id === 'python' ? 'boss-entity-python' : 'boss-entity-php'}`}>
                        <div className="boss-crown">
                          <span />
                          <span />
                          <span />
                        </div>
                        <div className="boss-faceplate">
                          <div className="boss-eye" />
                          <div className="boss-eye" />
                          <div className="boss-mouth" />
                        </div>
                        <div className="boss-core">
                          <span className="boss-core-ring" />
                          <span className="boss-core-ring boss-core-ring-delayed" />
                        </div>
                        <div className="boss-tentacles">
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>

                      <div className="boss-stage-status">
                        <span className="boss-request-label">Integridad del enemigo</span>
                        <div className="boss-health-track">
                          <div
                            className="boss-health-fill"
                            style={{ width: `${Math.max(100 - bossProgress, 8)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="boss-briefing-card">
                      <span className="boss-request-label">Enunciado</span>
                      <p>{activeBossBattle.briefing}</p>
                      <strong>{activeBossBattle.bossTaunt}</strong>
                    </div>

                    <div className="boss-progress-track">
                      <div
                        className="boss-progress-fill"
                        style={{ width: `${bossProgress}%` }}
                      />
                    </div>

                    <div className="boss-requests">
                      {activeBossBattle.requests.map((request) => {
                        const completed = normalizedActiveCode.includes(request.toLowerCase());

                        return (
                          <article
                            className={`boss-request ${completed ? 'boss-request-complete' : ''}`}
                            key={request}
                          >
                            <span className="boss-request-label">Cadena requerida</span>
                            <strong>{request}</strong>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}

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
