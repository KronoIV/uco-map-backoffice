# Capturas de la sección Ayuda

Las figuras de la página Ayuda (`src/pages/help/helpContent.ts`) buscan su imagen en esta carpeta por nombre de archivo. Si la imagen no está, la figura no se muestra, así que se pueden ir agregando de a una.

Formatos aceptados: `.webp`, `.png`, `.jpg`. Mejor `.webp` y de máximo unos 1600 px de ancho para no inflar el panel.

Por ahora ninguna sección usa figuras.

Para agregar una figura: poner la imagen aquí y añadir en `helpContent.ts` un bloque `{ kind: 'figure', file: 'nombre-sin-extension', caption: '…' }`.
