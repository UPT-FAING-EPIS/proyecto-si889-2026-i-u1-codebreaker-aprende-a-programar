export type Language = 'python' | 'php';

export type ValidatorKey = 'python-greeting' | 'php-greeting';

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
        goal: 'Próxima lección de la ruta Python.',
        story: 'Se desbloquea cuando completes la primera prueba.',
        expectedOutput: '80',
        starterCode: 'energia = 80\n',
        hints: ['Próxima etapa.'],
        concepts: ['variables', 'números'],
        validator: 'python-greeting',
      },
      {
        id: 'python-3',
        order: 3,
        title: 'Radar de decisiones',
        subtitle: 'Condicionales y control.',
        xp: 20,
        duration: '5 min',
        difficulty: 'beginner',
        goal: 'Próxima lección de la ruta Python.',
        story: 'Se desbloquea después de dominar la base.',
        expectedOutput: 'Acceso concedido',
        starterCode: 'energia = 80\n',
        hints: ['Próxima etapa.'],
        concepts: ['if', 'comparaciones'],
        validator: 'python-greeting',
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
        goal: 'Próxima lección de la ruta PHP.',
        story: 'Se desbloquea cuando superes la lección de bienvenida.',
        expectedOutput: '3',
        starterCode: '$modulos = ["motor", "radar", "escudo"];\n',
        hints: ['Próxima etapa.'],
        concepts: ['arrays'],
        validator: 'php-greeting',
      },
      {
        id: 'php-3',
        order: 3,
        title: 'Control de formularios',
        subtitle: 'Nodo futuro de la ruta PHP.',
        xp: 20,
        duration: '5 min',
        difficulty: 'intermediate',
        goal: 'Próxima lección de la ruta PHP.',
        story: 'Se desbloquea más adelante en el mapa.',
        expectedOutput: 'Misión enviada',
        starterCode: '$estado = "listo";\n',
        hints: ['Próxima etapa.'],
        concepts: ['forms', 'request'],
        validator: 'php-greeting',
      },
    ],
  },
];
