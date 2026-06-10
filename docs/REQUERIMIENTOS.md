### Requerimientos Funcionales (RF)
| ID | Nombre | Descripción | Prioridad | Issue |
| :--- | :--- | :--- | :--- | :--- |
| **RF-01** | Registro de usuario | El sistema debe permitir registrar nuevos usuarios mediante correo electrónico y contraseña, o mediante proveedor OAuth (Google/GitHub). | Alta | #8 |
| **RF-02** | Inicio de sesión | El sistema debe autenticar usuarios registrados y mantener la sesión activa mediante tokens JWT o equivalente. | Alta | #8 |
| **RF-03** | Cierre de sesión | El usuario debe poder cerrar sesión en cualquier momento, invalidando el token activo. | Media | #8 |
| **RF-04** | Perfil de usuario | El sistema debe mostrar al usuario su nombre, avatar, nivel actual, XP acumulado y logros obtenidos. | Media | #8 |
| **RF-05** | Guardado de progreso | El progreso del usuario (niveles completados, XP, logros) debe persistir en base de datos y sincronizarse entre dispositivos. | Alta | #8 |
| **RF-06** | Editor integrado | El sistema debe incluir un editor de código con resaltado de sintaxis, autocompletado básico e indentación automática para Python y PHP. | Alta | #3 |
| **RF-07** | Ejecución en sandbox | El usuario debe poder ejecutar su código mediante una API segura (Piston o Judge0), sin afectar el servidor principal. | Alta | #4 |
| **RF-08** | Visualización de resultados | El sistema debe mostrar la salida estándar (stdout) y los errores (stderr) del código ejecutado en un panel de resultados. | Alta | #4 |
| **RF-09** | Límite de ejecución | Cada ejecución no debe superar los 10 segundos de cómputo ni 256 MB de memoria para evitar abuso del sandbox. | Alta | #4 |
| **RF-10** | Soporte multiformato | El editor debe soportar al menos Python 3.x y PHP 8.x como lenguajes de ejecución. | Alta | #3, #4 |
| **RF-11** | Ruta Python | El sistema debe ofrecer al menos 10 niveles iniciales para Python: variables, tipos de datos, condicionales, bucles, funciones y listas. | Alta | #6 |
| **RF-12** | Ruta PHP | El sistema debe ofrecer al menos 10 niveles iniciales para PHP: sintaxis básica, variables, arrays, funciones y formularios. | Alta | #7 |
| **RF-13** | Tipos de ejercicio | Cada nivel debe incluir al menos un tipo: completar código, corregir errores, escribir desde cero u opción múltiple. | Alta | #6, #7 |
| **RF-14** | Instrucciones de nivel | Cada nivel debe mostrar descripción del objetivo, ejemplos y resultado esperado antes del ejercicio. | Media | #6, #7 |
| **RF-15** | Progresión bloqueada | Los niveles deben desbloquearse secuencialmente; el usuario no puede acceder a un nivel sin completar el anterior. | Alta | #5 |
| **RF-16** | Validación automática | El sistema debe comparar la salida del usuario con la salida esperada para determinar si el nivel fue completado. | Alta | #5 |
| **RF-17** | Retroalimentación inmediata | Al fallar un ejercicio, el sistema debe indicar qué parte es incorrecta y ofrecer una pista o mensaje de error descriptivo. | Alta | #5 |
| **RF-18** | Sistema de XP y niveles | El usuario debe ganar XP al completar niveles; al acumular suficiente XP sube de nivel de perfil. | Alta | #6, #7 |
| **RF-19** | Sistema de logros | El sistema debe otorgar insignias por hitos: primer nivel completado, completar una ruta entera, racha de 7 días, etc. | Media | #8 |
| **RF-20** | Diseño responsivo | La interfaz debe adaptarse a escritorio (1024px+) y dispositivos móviles Android (360px+). | Alta | #2, #9 |
| **RF-21** | Mapa de progreso | Debe existir una pantalla visual con el mapa de niveles disponibles, completados y bloqueados para cada ruta. | Alta | #2 |
| **RF-22** | Navegación táctil | Los controles clave (ejecutar, avanzar nivel, ver pistas) deben ser accesibles con tap sin necesidad de hover. | Alta | #9 |

---

### Requerimientos No Funcionales (RNF)
| ID | Nombre | Descripción | Categoría | Issue |
| :--- | :--- | :--- | :--- | :--- |
| **RNF-01** | Tiempo de carga inicial | La aplicación debe cargar su página principal en menos de 3 segundos en una conexión de 10 Mbps. | Rendimiento | #1, #2 |
| **RNF-02** | Latencia de ejecución | El resultado de la ejecución de código debe mostrarse en menos de 5 segundos en condiciones normales de red. | Rendimiento | #4 |
| **RNF-03** | Respuesta del editor | El editor no debe presentar retraso perceptible (>100 ms) al tipear en dispositivos de gama media-alta. | Rendimiento | #3 |
| **RNF-04** | Carga de niveles | La transición entre niveles debe completarse en menos de 1 segundo después de la validación. | Rendimiento | #5 |
| **RNF-05** | Soporte de concurrencia | El backend debe soportar al menos 50 usuarios concurrentes ejecutando código sin degradación del servicio. | Rendimiento | #4 |
| **RNF-06** | Aislamiento de ejecución | El código del usuario debe ejecutarse en sandbox aislado, sin acceso al sistema de archivos ni red del servidor. | Seguridad | #4 |
| **RNF-07** | Protección de contraseñas | Las contraseñas deben almacenarse con hash bcrypt (cost factor >= 10); nunca en texto plano. | Seguridad | #8 |
| **RNF-08** | Comunicación cifrada | Toda comunicación entre cliente y servidor debe realizarse sobre HTTPS/TLS 1.2+. | Seguridad | #1 |
| **RNF-09** | Validación de entradas | El sistema debe sanitizar todas las entradas del usuario para prevenir inyección SQL, XSS y ejecución maliciosa. | Seguridad | #4, #8 |
| **RNF-10** | Onboarding intuitivo | Un usuario sin experiencia debe poder iniciar su primer ejercicio en menos de 3 minutos desde el registro. | Usabilidad | #2 |
| **RNF-11** | Accesibilidad básica | La interfaz debe cumplir nivel AA de WCAG 2.1: contraste adecuado, textos alternativos y navegación por teclado. | Usabilidad | #2 |
| **RNF-12** | Mensajes de error claros | Los errores deben presentarse en lenguaje comprensible para principiantes, evitando jerga técnica interna. | Usabilidad | #5 |
| **RNF-13** | Consistencia visual | Los componentes de UI deben mantener un sistema de diseño coherente en todas las pantallas. | Usabilidad | #2 |
| **RNF-14** | Arquitectura modular | El backend debe separar responsabilidades en módulos independientes (auth, ejecución, progreso, contenido). | Mantenibilidad | #1 |
| **RNF-15** | Contenido configurable | Los niveles deben definirse en archivos de configuración o BD, permitiendo agregar contenido sin modificar el código. | Mantenibilidad | #6, #7 |
| **RNF-16** | Escalabilidad horizontal | La arquitectura debe permitir agregar instancias del servicio de ejecución de código para escalar ante mayor demanda. | Escalabilidad | #4 |
| **RNF-17** | Disponibilidad del servicio | La plataforma debe apuntar a 99% de disponibilidad durante el período académico. | Disponibilidad | #1 |
| **RNF-18** | Compatibilidad de navegadores | La app debe funcionar en Chrome 110+, Firefox 110+, Edge 110+ y Safari 15+ en escritorio y móvil. | Compatibilidad | #2, #9 |
| **RNF-19** | Compatibilidad Android | La experiencia móvil debe estar optimizada para Android 10+, desde 360x640px, con teclado virtual y gestos táctiles. | Compatibilidad | #9 |