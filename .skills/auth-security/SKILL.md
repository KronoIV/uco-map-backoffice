---
name: auth-security
description: Autenticación y seguridad del panel admin de UCO MAP (login JWT, cookie ucomap_token, rutas protegidas, cierre de sesión, restablecer contraseña, variables públicas). Úsala al tocar login, AuthContext, ProtectedRoute, api.ts o al manejar datos sensibles en el frontend.
---

# Admin UCO MAP: autenticación y seguridad

## Flujo de sesión

1. `LoginPage` → `AuthContext.login(email, password)` → `authService.login` → `POST /api/auth/login`.
2. La respuesta `{ token, email, role }` se guarda con `saveToken()` en la cookie **`ucomap_token`**:
   `SameSite=Strict`, `Secure` solo si la página está en HTTPS, `Max-Age` 24 h, `Path=/`. La escribe JavaScript (no
   es `HttpOnly`).
3. `src/services/api.ts` agrega `Authorization: Bearer <token>` a cada petición.
4. `AuthContext` decodifica el JWT en el cliente (`decodeToken`, sin verificar la firma: solo para leer `sub`, `role`,
   `exp`) y revisa la expiración cada 30 s y al volver a la pestaña (`visibilitychange`).
5. Cualquier 401 del backend dispara `logout()` (registrado con `registerOn401Handler`).
6. `components/ProtectedRoute.tsx` redirige a `/login` si no hay usuario. **No comprueba el rol**: el backend solo
   emite tokens con rol `ADMIN` y es quien autoriza cada operación.

La seguridad real está en el backend (`SecurityConfig`). El frontend solo oculta pantallas; nunca confíes en él para
proteger datos.

## Restablecer contraseña

- `/forgot-password` → `POST /api/auth/forgot-password` (respuesta genérica, no revela si el correo existe).
- El correo trae `https://<frontend-url>/reset-password?token=...`; `ResetPasswordPage` lee `token` de la URL y llama
  `POST /api/auth/reset-password`. El hosting debe servir la SPA en esa ruta (`public/_redirects`).
- En local el enlace del correo apunta al admin de producción (valor fijo en el backend) y además el SMTP necesita
  credenciales reales: para probar el flujo, copia el `token` del enlace a `http://localhost:5173/reset-password?token=…`.

## Variables y datos sensibles

- `VITE_BACKEND_URL` es la única variable y es **pública** (Vite la incrusta en el bundle). Nunca agregues secretos
  con prefijo `VITE_`; si algo necesita un secreto, debe resolverse en el backend.
- `.env`, `.env.local` y `*.local` están en `.gitignore`. Versiona solo `.env.example`.
- No guardes el token en `localStorage` ni lo imprimas en consola.
- `dangerouslySetInnerHTML` solo se usa en `MapPage.tsx` (`TypeSwatch`) con HTML generado a partir del catálogo
  estático de POI y colores fijos. No lo uses con datos que vengan del backend o del usuario.

## Riesgos conocidos

- Cookie legible por JavaScript: un XSS permitiría robar el token. Mitigación posible (requiere cambiar backend y
  admin): cookie `HttpOnly` emitida por el servidor.
- Token válido 24 h; no hay refresh token.
- El usuario sembrado `admin@admin.com` tiene contraseña conocida en el código del backend: no lo uses en entornos
  compartidos sin cambiarla.
