# Capturas de la sección Ayuda

Las figuras de la página Ayuda (`src/pages/help/helpContent.ts`) buscan su imagen en esta carpeta por nombre de archivo. Si la imagen no está, la figura no se muestra, así que se pueden ir agregando de a una.

Formatos aceptados: `.webp`, `.png`, `.jpg`. Mejor `.webp` y de máximo unos 1600 px de ancho para no inflar el panel.

| Archivo (sin extensión) | Qué debe mostrar |
| --- | --- |
| `multiset-app-nuevo-mapa` | App MultiSet: pantalla de nuevo mapa con el nombre asignado |
| `multiset-app-escaneo` | App MultiSet durante el escaneo, con la malla del piso capturándose |
| `multiset-portal-maps` | Developer Portal, sección Maps, con el mapa recién subido y su estado |
| `multiset-mapset-add-map` | MapSet del campus con el botón Add map |
| `multiset-tipo-alineacion` | Ventana para elegir Auto alignment o Manual alignment |
| `multiset-select-map` | Select map con el mapa nuevo elegido y el botón Continue |
| `multiset-alineacion-manual` | Alineación manual, con el mapa junto a su edificio o aparte |
| `multiset-view-maps` | View maps con el resultado y el botón Save changes |
| `multiset-create-map-version` | Mapa seleccionado dentro del MapSet, con el botón Create map version |

Para agregar otra figura: poner la imagen aquí y añadir en `helpContent.ts` un bloque `{ kind: 'figure', file: 'nombre-sin-extension', caption: '…' }`.
