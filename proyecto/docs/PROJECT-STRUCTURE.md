# Estructura Base

## Capas iniciales

- apps/web: aplicacion React para la experiencia del jugador en navegador.
- apps/api: API para progreso, autenticacion, contenido y ejecucion futura.
- database/mysql: scripts de inicializacion y evolucion del modelo MySQL.
- docs: decisiones de arquitectura y plan funcional.

## Decision actual

La primera iteracion se enfocara en una vertical navegable del frontend y una API minima de soporte.
La base de datos definitiva se redefinira sobre MySQL tomando como referencia conceptual el script PostgreSQL existente.