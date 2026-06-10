# 🚀 Codebreaker - Aprende a programar

**Codebreaker** es una plataforma web gamificada diseñada para convertir el aprendizaje de la programación en una aventura. Olvídate de los tutoriales aburridos; aquí, el código es tu herramienta para superar niveles y desbloquear desafíos.

---

## 👥 Integrantes

- **Jefferson Rosas Chambilla**
- **Roberto Huaman Rivera**

## 🎯 El Proyecto

### ❓ La Problemática
Aprender a programar suele sentirse como leer un manual de instrucciones infinito. La falta de interactividad y de resultados visuales inmediatos hace que muchos principiantes abandonen antes de escribir su primera función útil.

### ✅ La Solución
**Codebreaker** rompe esa barrera ofreciendo un entorno donde la teoría se aplica al instante en un contexto de juego. Está optimizado para ser **100% responsivo**, permitiendo que los usuarios practiquen desde su PC o desde su dispositivo Android sin fricciones.

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
| :--- | :--- |
| **Frontend** | React + Vite |
| **Backend** | Node.js + Fastify |
| **Autenticación** | Google OAuth |
| **Base de Datos** | Azure Database for MySQL Flexible Server |
| **Despliegue** | Azure Static Web Apps + Azure App Service |

---

## ✨ Características Principales

* 🐍 **Ruta Python:** Desde la lógica básica hasta estructuras de datos.
* 🐘 **Ruta PHP:** Domina la gestión de datos y el backend clásico.
* 🎮 **Gamificación:** Sistema de niveles, experiencia (XP) y logros.
* 💻 **Editor Integrado:** Escribe y ejecuta código directamente en el navegador.
* 📱 **Mobile Friendly:** Interfaz diseñada para programar cómodamente en pantallas táctiles.

---

## 📈 Hoja de Ruta (Roadmap)

1.  **Fase 1:** Configuración del entorno y arquitectura base.
2.  **Fase 2:** Implementación del editor de código y motor de ejecución segura.
3.  **Fase 3:** Diseño de niveles iniciales para Python y PHP.
4.  **Fase 4:** Sistema de usuarios y guardado de progreso.
5.  **Fase 5:** Pulido de UI/UX para dispositivos móviles.

---

## ⚙️ Variables de entorno

Crear archivo `.env` en la raíz del proyecto:

```env
MYSQL_HOST=codebreaker-mysql-prod.mysql.database.azure.com
MYSQL_PORT=3306
MYSQL_DATABASE=codebreaker
MYSQL_USER=app_codebreaker
MYSQL_PASSWORD=change_me
MYSQL_SSL=true

API_PORT=4000
APP_JWT_SECRET=change_me_super_secret
CORS_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=change_me.apps.googleusercontent.com
ADMIN_EMAILS=tu-correo-admin@gmail.com

VITE_API_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=change_me.apps.googleusercontent.com
```

---

## ▶️ Ejecución local

```bash
npm install
npm run dev:api
npm run dev:web
```

Endpoints clave:

- API health: `/health`
- Login Google: `/api/auth/google`
- Progreso usuario: `/api/progress/me`
- Completar nivel: `/api/progress/complete`
- Admin métricas: `/api/admin/metrics`

---

## ☁️ Deploy rápido en Azure

1. **Base de datos:** usar Azure MySQL Flexible Server (ya creado).
2. **API:** desplegar `apps/api` en Azure App Service y configurar las variables anteriores.
3. **Web:** desplegar `apps/web` en Azure Static Web Apps con `VITE_API_URL` y `VITE_GOOGLE_CLIENT_ID`.
4. **Google OAuth:** en Google Cloud Console agregar los dominios de producción en Authorized JavaScript origins.
5. **Admin:** agregar correo administrador en `ADMIN_EMAILS`.

---

## 👥 Público Objetivo

- Estudiantes de informática principiantes.
- Entusiastas de la tecnología que buscan una introducción práctica.
- Cualquier persona que quiera aprender lógica de programación jugando.
