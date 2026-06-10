export type Language = 'python' | 'php';

export type ValidatorKey =
  | 'python-greeting'
  | 'python-variable-output'
  | 'php-greeting'
  | 'php-array-count'
  | 'python-boss-strings'
  | 'php-boss-strings';

export type BossBattle = {
  bossName: string;
  bossTitle: string;
  bossTaunt: string;
  briefing: string;
  timeLimitSeconds: number;
  requests: string[];
};

export type Level = {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  xp: number;
  duration: string;
  difficulty: string;
  goal: string;
  story: string;
  expectedOutput: string;
  starterCode: string;
  hints: string[];
  concepts: string[];
  validator: ValidatorKey;
  kind?: 'standard' | 'boss';
  bossBattle?: BossBattle;
};

export type Track = {
  id: Language;
  name: string;
  tagline: string;
  summary: string;
  accent: string;
  glow: string;
  icon: string;
  levels: Level[];
};

export const tracks: Track[] = [
  {
    id: 'python',
    name: 'Python Orbit',
    tagline: 'Despega con sintaxis clara y feedback inmediato.',
    summary:
      'Ruta ideal para principiantes. Aprendes variables, funciones y lógica con misiones cortas de estilo arcade.',
    accent: '#45e0ff',
    glow: 'rgba(69, 224, 255, 0.24)',
    icon: 'PY',
    levels: [
      {
        id: 'python-1',
        order: 1,
        title: 'Hola, Python',
        subtitle: 'Activa la consola principal de la nave.',
        xp: 10,
        duration: '3 min',
        difficulty: 'beginner',
        goal: 'Muestra el mensaje Hola, Codebreaker en pantalla.',
        story:
          'La academia necesita verificar el canal de salida de la nave. Tu primera misión es emitir una señal visible desde Python.',
        expectedOutput: 'Hola, Codebreaker',
        starterCode: 'mensaje = "Hola, Codebreaker"\n\n# Haz que la nave imprima el mensaje\n',
        hints: [
          'Usa print(...) para mostrar texto en consola.',
          'Ya tienes una variable lista: mensaje.',
        ],
        concepts: ['print', 'variables', 'salida estándar'],
        validator: 'python-greeting',
      },
      {
        id: 'python-2',
        order: 2,
        title: 'Variables de energía',
        subtitle: 'Siguiente misión desbloqueable.',
        xp: 15,
        duration: '4 min',
        difficulty: 'beginner',
        goal: 'Imprime el valor de la variable energia en consola.',
        story:
          'El generador principal ya tiene energía cargada. Tu tarea es mostrar su valor exacto para estabilizar la nave.',
        expectedOutput: '80',
        starterCode: 'energia = 80\n\n# Imprime el valor almacenado en energia\n',
        hints: [
          'No necesitas escribir el número manualmente si ya lo tienes guardado en una variable.',
          'Usa print(energia) para mostrar el valor en consola.',
        ],
        concepts: ['variables', 'números'],
        validator: 'python-variable-output',
      },
      {
        id: 'python-3',
        order: 3,
        title: 'Jefe: Hydra de Cadenas',
        subtitle: 'Etapa de jefe con temporizador.',
        xp: 60,
        duration: '45 s',
        difficulty: 'advanced',
        goal: 'Imprime correctamente las tres cadenas del protocolo antes de que el escudo del jefe se recargue.',
        story:
          'Hydra de Cadenas bloquea la salida principal. Para romper su escudo debes responder rápido con varias salidas exactas en secuencia.',
        expectedOutput: 'canal estable\nescudo arriba\nreactor listo',
        starterCode:
          'mensajes = ["canal estable", "escudo arriba", "reactor listo"]\n\n# Recorre la lista e imprime cada mensaje\n',
        hints: [
          'Necesitas mostrar tres cadenas, no solo una.',
          'Puedes recorrer la lista mensajes con un for.',
        ],
        concepts: ['for', 'print', 'cadenas'],
        validator: 'python-boss-strings',
        kind: 'boss',
        bossBattle: {
          bossName: 'Hydra de Cadenas',
          bossTitle: 'Jefe del Sector 1',
          bossTaunt: 'Si dudas, el escudo se recarga. Escribe rápido y con precisión.',
          briefing:
            'Debes imprimir las tres respuestas exactas para romper el núcleo del jefe antes de que el tiempo llegue a cero.',
          timeLimitSeconds: 45,
          requests: ['canal estable', 'escudo arriba', 'reactor listo'],
        },
      },
    ],
  },
  {
    id: 'php',
    name: 'PHP Harbor',
    tagline: 'Backend clásico en formato de misión rápida.',
    summary:
      'Ruta pensada para aprender sintaxis, formularios y estructuras básicas de PHP desde una experiencia de navegador.',
    accent: '#ffb84d',
    glow: 'rgba(255, 184, 77, 0.24)',
    icon: 'PHP',
    levels: [
      {
        id: 'php-1',
        order: 1,
        title: 'Hola, PHP',
        subtitle: 'Enciende el puerto de mensajes del backend.',
        xp: 10,
        duration: '3 min',
        difficulty: 'beginner',
        goal: 'Muestra el mensaje Hola, Codebreaker con PHP.',
        story:
          'El puerto de datos necesita una respuesta simple. Usa la sintaxis básica de PHP para emitir el saludo inicial.',
        expectedOutput: 'Hola, Codebreaker',
        starterCode: '$mensaje = "Hola, Codebreaker";\n\n// Muestra el mensaje\n',
        hints: [
          'PHP suele mostrar salida con echo.',
          'También puedes imprimir directamente la variable $mensaje.',
        ],
        concepts: ['echo', 'variables', 'salida estándar'],
        validator: 'php-greeting',
      },
      {
        id: 'php-2',
        order: 2,
        title: 'Arrays del puerto',
        subtitle: 'Nodo futuro de la ruta PHP.',
        xp: 15,
        duration: '4 min',
        difficulty: 'beginner',
        goal: 'Muestra cuántos módulos hay dentro del arreglo.',
        story:
          'El puerto necesita contar cuántos módulos están activos para preparar la siguiente maniobra.',
        expectedOutput: '3',
        starterCode:
          '$modulos = ["motor", "radar", "escudo"];\n\n// Imprime la cantidad de elementos del arreglo\n',
        hints: [
          'PHP tiene una función para contar elementos de un arreglo.',
          'Puedes usar echo count($modulos);',
        ],
        concepts: ['arrays'],
        validator: 'php-array-count',
      },
      {
        id: 'php-3',
        order: 3,
        title: 'Jefe: Kraken de Formularios',
        subtitle: 'Etapa de jefe con respuesta rápida.',
        xp: 60,
        duration: '50 s',
        difficulty: 'intermediate',
        goal: 'Imprime las tres respuestas de control del servidor antes de que termine el contador.',
        story:
          'Kraken de Formularios está bloqueando el puerto backend. Necesitas responder con tres salidas exactas para derrotarlo.',
        expectedOutput: 'form listo\nrequest segura\ndatos guardados',
        starterCode:
          '$mensajes = ["form listo", "request segura", "datos guardados"];\n\n// Recorre el arreglo e imprime cada mensaje\n',
        hints: [
          'Puedes usar foreach para imprimir los mensajes.',
          'Recuerda usar echo dentro del recorrido.',
        ],
        concepts: ['foreach', 'echo', 'arrays'],
        validator: 'php-boss-strings',
        kind: 'boss',
        bossBattle: {
          bossName: 'Kraken de Formularios',
          bossTitle: 'Jefe del Puerto 1',
          bossTaunt: 'Cada segundo cuenta. El backend no espera entradas lentas.',
          briefing:
            'Imprime las tres cadenas del protocolo seguro para vaciar la barra de integridad del jefe.',
          timeLimitSeconds: 50,
          requests: ['form listo', 'request segura', 'datos guardados'],
        },
      },
    ],
  },
];
