# AGENTS.md — Panel admin UCO MAP

Instrucciones para asistentes de IA (Claude Code, Cursor, Copilot, ChatGPT, etc.) que trabajen en este repositorio.

## Contexto obligatorio

Antes de editar, lee la Skill que corresponda en `.skills/` (cada una es un `SKILL.md` con `name` y `description`):

| Skill | Cuándo |
|---|---|
| [.skills/project-context](.skills/project-context/SKILL.md) | Siempre: qué es, comandos, configuración, qué no tocar |
| [.skills/ecosystem](.skills/ecosystem/SKILL.md) | Cambios que involucren al backend o a la app |
| [.skills/architecture](.skills/architecture/SKILL.md) | Rutas, layouts, React Query, carpetas, receta para páginas nuevas |
| [.skills/api-integration](.skills/api-integration/SKILL.md) | Cliente Axios, servicios, tipos, endpoints |
| [.skills/map-editors](.skills/map-editors/SKILL.md) | MapPage, interior AR, visor three.js, navmesh, archivos compartidos con la app |
| [.skills/auth-security](.skills/auth-security/SKILL.md) | Login, cookie del token, rutas protegidas, variables públicas |
| [.skills/quality-testing](.skills/quality-testing/SKILL.md) | Build, lint (línea base), verificaciones |

Documentación humana: `README.md`, `docs/ECOSISTEMA.md`, `docs/GUIA-ESTUDIANTES.md`.

## Reglas

1. Nada secreto en variables `VITE_*` ni en el código. No leas ni muestres `.env` / `.env.local`.
2. Usa `src/services/api.ts` para hablar con el backend; los servicios reciben el `data` ya desenvuelto.
3. Si cambias `src/utils/{campus-routing,campus-osm,poi-catalog,navmesh-input}.ts`, replica el cambio en
   `../uco-map-app` y ejecuta `npm run check:routing`.
4. No cambies la versión de `recast-navigation` (0.43.0) sin cambiarla también en la app.
5. Textos de UI y comentarios en español; identificadores en inglés. Componentes MUI y colores de `src/theme/brand.ts`.
6. Antes de terminar: `npm run build` y `npm run lint` (sin errores nuevos respecto a la línea base).
