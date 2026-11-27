// Contenido de la sección Ayuda del panel.
// Sale del «Manual de usuario del panel UCO MAP» (nov. 2026).
// Si cambia el manual en Word, actualizar aquí también (y al revés).
//
// Marcas que se pueden usar dentro de cualquier texto:
//   `texto`           → se muestra como código (parámetros, direcciones)
//   [texto](#id)      → salta a otra sección o tema de esta misma página (id de sección, o "seccion-tema")
//   [texto](/ruta)    → abre otra pantalla del panel, por ejemplo /map?tab=ar
//   [texto](https://…) → abre un sitio externo en otra pestaña
//
// Las figuras usan imágenes de src/assets/help. Si el archivo no existe, la figura no se muestra.

export type HelpBlock =
  | { kind: 'p'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'note'; tone: 'info' | 'tip' | 'warning'; text: string }
  | { kind: 'figure'; file: string; caption: string };

export interface HelpShortcut {
  label: string;
  /** Ruta del panel (/campus, /map?tab=ar) o dirección externa (https://…) */
  to: string;
}

export interface HelpTopic {
  id: string;
  title: string;
  blocks: HelpBlock[];
}

export type HelpIcon =
  | 'login' | 'scan' | 'mapset' | 'tips' | 'building' | 'room'
  | 'indoor' | 'outdoor' | 'event' | 'insights' | 'problems';

export interface HelpSection {
  id: string;
  title: string;
  summary: string;
  icon: HelpIcon;
  shortcuts?: HelpShortcut[];
  intro?: HelpBlock[];
  topics: HelpTopic[];
}

export interface HelpTask {
  title: string;
  description: string;
  /** Pasos en orden; target es el id de una sección o "seccion-tema" */
  steps: { label: string; target: string }[];
}

export const HELP_SOURCE = {
  title: 'Manual de usuario del panel UCO MAP',
  date: 'noviembre de 2026',
  authors: 'Brahian Alexander Sanabria García y Brahian Rueda Gutiérrez',
};

export const HELP_TASKS: HelpTask[] = [
  {
    title: 'Agregar un salón',
    description: 'Cuando su piso ya está escaneado y publicado en el VPS propio.',
    steps: [
      { label: 'Registrar el lugar', target: 'lugares-registrar' },
      { label: 'Marcar el destino en 3D', target: 'lugares-destino' },
      { label: 'Probarlo en el campus', target: 'lugares-probar' },
    ],
  },
  {
    title: 'Sumar un piso o un edificio al AR',
    description: 'Desde el escaneo con el teléfono hasta que la app guía con la cámara.',
    steps: [
      { label: 'Escanear', target: 'escanear' },
      { label: 'Subir, alinear y publicar', target: 'vps' },
      { label: 'Regenerar la malla', target: 'navegacion' },
      { label: 'Edificio y entrada', target: 'edificios' },
      { label: 'Salones', target: 'lugares' },
    ],
  },
  {
    title: 'Publicar un evento',
    description: 'Sale como aviso en el inicio de la app mientras dure.',
    steps: [{ label: 'Crear el evento', target: 'gestion-eventos' }],
  },
  {
    title: 'Algo no funciona',
    description: 'Rutas que atraviesan paredes, salones que no aparecen, cámara que no abre.',
    steps: [{ label: 'Problemas frecuentes', target: 'problemas' }],
  },
];

export const HELP_SECTIONS: HelpSection[] = [
  // ─── Entrar ────────────────────────────────────────────────────────────────
  {
    id: 'entrar',
    title: 'Entrar al panel',
    summary: 'Ingreso, recuperación de contraseña y para qué sirve cada parte del menú.',
    icon: 'login',
    topics: [
      {
        id: 'ingreso',
        title: 'Iniciar sesión',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Abrir la dirección del panel en el navegador del computador (Chrome o Edge).',
              'Escribir el correo y la contraseña de administrador y pulsar Ingresar.',
            ],
          },
          { kind: 'p', text: 'La sesión dura un día. Pasado ese tiempo el panel vuelve a pedir el ingreso.' },
          {
            kind: 'note',
            tone: 'info',
            text: 'Si olvidaste la contraseña, pulsa «¿Olvidaste tu contraseña?» en la pantalla de ingreso, escribe tu correo y abre el enlace que llega. El enlace sirve una sola vez y vence en una hora. Si pides otro, espera al menos un minuto.',
          },
        ],
      },
      {
        id: 'menu',
        title: 'Menú del panel',
        blocks: [
          {
            kind: 'table',
            head: ['Menú', 'Para qué sirve'],
            rows: [
              ['[Dashboard](/)', 'Ver cuánta gente usa la app y cuántos recorridos llegan a su destino'],
              ['[Mapa](/map)', 'Dibujar caminos exteriores, ubicar destinos en 3D y preparar la navegación interior'],
              ['[Campus](/campus)', 'Crear y editar edificios y salones'],
              ['[VPS propio](/vps)', 'Subir escaneos, alinearlos al campus, procesarlos y publicar el servicio propio que ubica la cámara'],
              ['[Eventos](/events)', 'Publicar eventos que la app muestra en su inicio'],
              ['[Actividad](/sessions)', 'Ver los teléfonos que han usado la app y cada recorrido'],
              ['[Usuarios](/users)', 'Crear o desactivar administradores'],
              ['[Configuración](/settings)', 'Prender o apagar funciones de la app sin publicar una versión nueva'],
              ['Ayuda', 'Esta guía'],
            ],
          },
        ],
      },
    ],
  },

  // ─── Escanear ──────────────────────────────────────────────────────────────
  {
    id: 'escanear',
    title: 'Escanear un espacio',
    summary: 'Cómo capturar un piso o un ala con el teléfono para que la app pueda guiar con la cámara.',
    icon: 'scan',
    shortcuts: [{ label: 'Abrir VPS propio', to: '/vps' }],
    intro: [
      {
        kind: 'p',
        text: 'Para que la app guíe con la cámara dentro de un edificio, ese espacio tiene que estar escaneado en 3D. Cada escaneo se sube como un «mapa» del [VPS propio](#vps), que lo ubica en el espacio general del campus.',
      },
    ],
    topics: [
      {
        id: 'antes',
        title: 'Antes de salir a escanear',
        blocks: [
          {
            kind: 'list',
            items: [
              'Usar una app de escaneo 3D que exporte el modelo en .glb con textura y en metros. Si el teléfono tiene LiDAR (iPhone o iPad Pro), el resultado sale más preciso.',
              'Cargar el teléfono y apagar el bloqueo automático de pantalla.',
              'Escanear un piso o un ala por vez, en sesiones de unos 5 minutos.',
              'Ir en un horario con poca gente y con la luz normal del edificio.',
              'Ponerle a cada mapa un nombre que diga qué es, por ejemplo `CO-P2-ALA-NORTE` o `EDC-P1`. Ese nombre es el que luego se ve en el panel.',
            ],
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Antes de escanear conviene leer las [recomendaciones](#recomendaciones) para planear el recorrido.',
          },
        ],
      },
      {
        id: 'durante',
        title: 'Durante el escaneo',
        blocks: [
          {
            kind: 'steps',
            items: [
              'En la app de escaneo, crear un escaneo nuevo e iniciarlo.',
              'Mantener el teléfono a 1–5 m de paredes y objetos.',
              'Caminar despacio y sin parar. Si la malla sale con huecos, bajar el ritmo y volver a apuntar a lo que ya se escaneó.',
              'Apuntar a cada zona desde varios ángulos.',
              'Hacer una pasada mirando hacia el techo y otra mirando al piso. El piso es lo que más importa: de ahí sale el camino que dibuja la app. Un piso con huecos obliga a ponerle [parches](#navegacion-parches) después.',
              'Recorrer cada pasillo de ida y de vuelta.',
              'En escaleras, escanear todos los escalones, el descanso y la llegada en los dos pisos.',
              'Frente a cada ascensor, escanear bien el piso de la puerta en cada nivel. El interior de la cabina no hace falta.',
              'Evitar que en el centro de la imagen queden espejos, vidrios, paredes lisas o gente caminando. Las carteleras, columnas y muebles fijos ayudan.',
              'Terminar el escaneo y exportarlo en .glb con textura.',
            ],
          },
          {
            kind: 'note',
            tone: 'info',
            text: 'Si el mapa nuevo es parte de un edificio que ya está escaneado, debe compartir con él unos 5 a 10 m de recorrido, por ejemplo una puerta o una escalera. Eso facilita alinearlo en el paso siguiente.',
          },
        ],
      },
      {
        id: 'subir',
        title: 'Subirlo al VPS propio',
        blocks: [
          {
            kind: 'steps',
            items: [
              'En [VPS propio → Mapas](/vps), crear el mapa con «Nuevo mapa» o elegir el que se volvió a escanear.',
              'Pulsar «Subir escaneo» y elegir el .glb con textura. Ver [Mapas y escaneos](#vps-mapas).',
              'Seguir con [Alinear](#vps-alinear), [Procesar](#vps-procesar) y [Publicar](#vps-publicar).',
            ],
          },
        ],
      },
    ],
  },

  // ─── Recomendaciones ───────────────────────────────────────────────────────
  {
    id: 'recomendaciones',
    title: 'Recomendaciones para escanear',
    summary: 'Lo que nos ha funcionado escaneando el campus.',
    icon: 'tips',
    topics: [
      {
        id: 'planear',
        title: 'Planear el escaneo',
        blocks: [
          {
            kind: 'list',
            items: [
              'Un piso o un ala por mapa, no un edificio entero.',
              'Hacer un recorrido en círculo por el borde del espacio y terminar cerca de donde se empezó, para no escanear dos veces la misma zona.',
              'No hace falta escanear rincones a los que nadie llega, como detrás o debajo de muebles.',
              'Un salón vacío da muy poca información para que la app se ubique. Si se puede, escanearlo con sus mesas, tablero y carteleras en su lugar.',
              'Decidir antes por dónde va a quedar el traslape con el mapa vecino (una puerta, una escalera) y pasar bien por ahí.',
            ],
          },
        ],
      },
      {
        id: 'captura',
        title: 'Durante la captura',
        blocks: [
          {
            kind: 'table',
            head: ['Técnica', 'Regla'],
            rows: [
              ['Distancia', 'Entre 1 y 5 m de la superficie. En espacios pequeños se puede bajar hasta unos 0,5 m'],
              ['Ángulos', 'Variar ángulos y distancias. Repetir el mismo punto de vista no mejora el mapa'],
              ['Velocidad', 'Lento y continuo, sin paradas ni giros bruscos'],
              ['Orientación', 'Inclinar hacia arriba o abajo para el techo y el piso, en pasadas aparte si hace falta'],
              ['Pasillos', 'Siempre en los dos sentidos. Desde un solo extremo todo se ve igual y cuesta ubicarse'],
              ['Traslape entre sesiones', 'Cada sesión debe compartir zonas visibles con la anterior, sobre todo en puertas y transiciones. Sin eso los mapas no se pueden alinear'],
              ['Superficies a evitar', 'Espejos, vidrio, paredes lisas y cosas en movimiento, al menos fuera del centro de la imagen'],
            ],
          },
          {
            kind: 'p',
            text: 'Lo que mejor sirve como referencia: paredes con pintura, cuadros o carteleras, muebles y estanterías, columnas, pisos con diseño y equipos fijos. Las mesas y superficies planas se escanean desde un solo lado, y las plantas casi nunca quedan bien capturadas.',
          },
          {
            kind: 'p',
            text: 'Lo que se mueve durante la captura queda como ruido en el modelo: el mapa sale más limpio si se escanea con poca gente.',
          },
        ],
      },
      {
        id: 'mapa-o-escaneo',
        title: '¿Mapa nuevo o escaneo nuevo?',
        blocks: [
          {
            kind: 'table',
            head: ['Situación', 'Qué usar'],
            rows: [
              ['Se escaneó una zona que todavía no estaba cubierta', '«Nuevo mapa» en [Mapas y escaneos](#vps-mapas)'],
              ['Se volvió a escanear una zona que ya tiene mapa (cambiaron muebles, salió mal, remodelación)', '«Subir escaneo» sobre ese mismo mapa y [alinearlo](#vps-alinear) encima del anterior'],
            ],
          },
          {
            kind: 'p',
            text: 'Así el mapa conserva su nombre, y los destinos guardados en el panel siguen en su sitio si el escaneo nuevo queda alineado sobre el anterior.',
          },
        ],
      },
      {
        id: 'exteriores',
        title: 'Exteriores',
        blocks: [
          {
            kind: 'p',
            text: 'Solo se escanean interiores. En UCO MAP los recorridos de afuera van por GPS sobre los caminos del [mapa exterior](#mapa-exterior), así que no hace falta escanearlos.',
          },
        ],
      },
    ],
  },

  // ─── VPS propio ────────────────────────────────────────────────────────────
  {
    id: 'vps',
    title: 'VPS propio',
    summary: 'Pasar un escaneo al servicio propio que ubica la cámara, alinearlo al campus, procesarlo y publicarlo.',
    icon: 'mapset',
    shortcuts: [{ label: 'VPS propio', to: '/vps' }],
    intro: [
      {
        kind: 'p',
        text: 'El VPS propio es el servicio del proyecto que ubica la cámara del teléfono en el campus. Todos los mapas comparten el espacio del campus: los destinos 3D, la malla de navegación, los parches, las conexiones y los ascensores se guardan en ese mismo espacio.',
      },
      {
        kind: 'note',
        tone: 'warning',
        text: 'El servidor del VPS se instala aparte (Manual técnico). Si la página dice que no se pudo conectar, revisar `VPS_BASE_URL`, `VPS_TOKEN_KID` y `VPS_TOKEN_SECRET` en el backend.',
      },
    ],
    topics: [
      {
        id: 'mapas',
        title: 'Mapas y escaneos',
        blocks: [
          {
            kind: 'list',
            items: [
              'Cada mapa es un piso o un ala con un código.',
              'Subir escaneo: el modelo .glb con textura que exporta la app de escaneo y, si existe, el .glb sin textura. Un escaneo nuevo no cambia nada hasta que entra en una revisión.',
              'Renombrar un mapa o cambiarle el escaneo hace que dejen de aplicarse las limpiezas del modelo 3D hechas en el editor AR, porque se guardan con el nombre y la forma de la malla.',
            ],
          },
        ],
      },
      {
        id: 'alinear',
        title: 'Alinear un escaneo al campus',
        blocks: [
          {
            kind: 'steps',
            items: [
              'En «Alineación», elegir el mapa y su escaneo. El visor muestra el resto del campus como referencia.',
              'Acercarlo con X, Y, Z y Giro, o con «Alinear por puntos»: marcar un punto en el escaneo y el mismo punto en el campus, al menos 2 pares (3 en 6 GdL).',
              'Cuando ya esté cerca, afinar con «Refinar con ICP».',
              'Pulsar «Crear revisión» con una nota de lo que cambió.',
            ],
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Un mapa que ya está en la revisión solo se mueve si su escaneo quedó corrido: moverlo cambia dónde ve la app ese piso respecto a los destinos ya guardados.',
          },
        ],
      },
      {
        id: 'procesar',
        title: 'Procesar y evaluar',
        blocks: [
          {
            kind: 'p',
            text: 'En «Procesamiento», «Procesar revisión» arma el paquete con el que el servidor ubica las fotos. Tarda varios minutos por mapa y lo hace el worker del servidor.',
          },
          {
            kind: 'p',
            text: 'Al terminar se evalúa con vistas del propio escaneo. El mínimo sugerido para publicar es 85 % de vistas ubicadas a menos de 0,5 m y 5°, sin falsos positivos.',
          },
        ],
      },
      {
        id: 'publicar',
        title: 'Publicar y volver atrás',
        blocks: [
          {
            kind: 'steps',
            items: [
              'En «Publicación», elegir el build listo y pulsar Publicar. La app lo usa desde la próxima localización.',
              'Probarlo con fotos del campus en «Probar» y luego con la app.',
            ],
          },
          {
            kind: 'note',
            tone: 'info',
            text: 'Si algo sale mal, «Volver a este build» en la tarjeta Anterior restaura el build previo sin publicar una versión de la app.',
          },
        ],
      },
      {
        id: 'despues',
        title: 'Después de agregar o cambiar un mapa',
        blocks: [
          {
            kind: 'p',
            text: 'La app no puede trazar rutas sobre el mapa nuevo hasta que se rehaga la malla de navegación. Hay que seguir [Navegación interior](#navegacion): Regenerar, revisar parches, escaleras y ascensores de la zona, y Publicar.',
          },
          {
            kind: 'p',
            text: 'Si el mapa nuevo quedó corrido respecto a los demás, se corrige en [Alineación](#vps-alinear) con una revisión nueva, que luego se procesa y se publica.',
          },
        ],
      },
    ],
  },

  // ─── Edificios ─────────────────────────────────────────────────────────────
  {
    id: 'edificios',
    title: 'Edificios',
    summary: 'Crear, editar y ubicar en el mapa los edificios. Van antes que los salones.',
    icon: 'building',
    shortcuts: [
      { label: 'Abrir Campus', to: '/campus' },
      { label: 'Abrir Mapa → Caminos', to: '/map?tab=editor' },
    ],
    intro: [
      {
        kind: 'p',
        text: 'Cada salón pertenece a un edificio, así que el edificio se crea primero. Un edificio es a la vez una fila en Campus → Edificios y un punto verde en Mapa → Caminos: lo que se cambia en un lado se refleja en el otro.',
      },
    ],
    topics: [
      {
        id: 'crear-campus',
        title: 'Crear un edificio desde Campus',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Ir a [Campus](/campus) → Edificios y pulsar Nuevo edificio.',
              'Llenar el formulario. ID del edificio: un código corto y único, por ejemplo `BIBLIOTECA`; no se puede cambiar después. Nombre: cómo lo verá el estudiante. Categoría: el código que llevarán sus salones, por ejemplo `CO` o `EDC`; no puede repetirse entre edificios. Color: opcional, en formato `#D84315`. Latitud y longitud: la ubicación del edificio, se pueden copiar de Google Maps.',
              'Pulsar Crear edificio.',
              'Ir a [Mapa → Caminos](/map?tab=editor) y unir el edificio a los senderos con al menos una [entrada](#mapa-exterior-entrada). Mientras no tenga entrada, la app no traza rutas hasta él.',
            ],
          },
        ],
      },
      {
        id: 'crear-mapa',
        title: 'Crear un edificio desde el mapa',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Ir a [Mapa → Caminos](/map?tab=editor) y pulsar Dibujar camino.',
              'Tocar el mapa para crear el punto (y el tramo que lo une a un sendero) y pulsar Terminar camino.',
              'Seleccionar el punto. Se abre una casilla para el nombre, que será también el ID del edificio, y la lista del tipo de punto.',
              'Elegir Edificio. Aparece solo en Campus → Edificios; ahí se ajustan nombre, categoría y color.',
            ],
          },
        ],
      },
      {
        id: 'editar',
        title: 'Editar, desactivar, eliminar y mover',
        blocks: [
          { kind: 'p', text: 'En Campus → Edificios, en la fila de cada edificio:' },
          {
            kind: 'list',
            items: [
              'Editar (lápiz): cambia nombre, color, categoría, ubicación y estado. Si se cambia la categoría, hay que cambiarla también en sus salones o dejarán de verse en la app.',
              'Inactivo: el edificio deja de aparecer en la app, pero no se borra.',
              'Eliminar (papelera): lo borra para siempre y la app deja de trazar rutas hasta él.',
            ],
          },
          { kind: 'p', text: 'En Mapa → Caminos, para mover un edificio basta con arrastrar su punto. Su ubicación en Campus se actualiza sola.' },
          {
            kind: 'note',
            tone: 'info',
            text: 'Si en la tabla un edificio aparece como «Sin ubicar», no tiene punto en el mapa: hay que editarlo y ponerle latitud y longitud.',
          },
        ],
      },
    ],
  },

  // ─── Lugares ───────────────────────────────────────────────────────────────
  {
    id: 'lugares',
    title: 'Salones y lugares',
    summary: 'Registrar un salón y marcar su destino sobre el modelo 3D para que la app guíe hasta la puerta.',
    icon: 'room',
    shortcuts: [
      { label: 'Abrir Campus', to: '/campus' },
      { label: 'Abrir Interior AR', to: '/map?tab=ar' },
      { label: 'Ver recorridos', to: '/sessions?tab=trips' },
    ],
    intro: [
      {
        kind: 'p',
        text: 'Un salón queda listo en dos pasos: se registra en Campus → Lugares y se le marca el destino sobre el modelo 3D en Mapa → Interior AR. Con solo el primer paso, la app ya lo muestra y guía hasta la entrada de su edificio; con los dos, guía con la cámara hasta la puerta.',
      },
      {
        kind: 'note',
        tone: 'info',
        text: 'Antes de empezar, revisar que el [edificio](#edificios) exista y que la zona esté [escaneada](#escanear) y [publicada en el VPS propio](#vps-publicar).',
      },
    ],
    topics: [
      {
        id: 'registrar',
        title: 'Paso 1: registrar el lugar',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Ir a [Campus](/campus) → Lugares y pulsar Nuevo lugar.',
              'ID del lugar: corto y único en todo el campus, por ejemplo `205` o `L2`. No se puede cambiar después. Si dos edificios tienen un «101», agregar una letra (`M101`).',
              'Edificio: elegirlo de la lista.',
              'Piso: número del piso (1 = primer piso, negativo = sótano). Es importante para que la app sepa si hay que subir o bajar.',
              'Nombre del lugar: lo que verá el estudiante, por ejemplo «Sala de sistemas».',
              'Pulsar Crear lugar. Si sale un error de duplicado, ese ID ya existe.',
            ],
          },
        ],
      },
      {
        id: 'destino',
        title: 'Paso 2: marcar el destino en 3D',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Ir a [Mapa → Interior AR](/map?tab=ar) y esperar a que carguen los modelos.',
              'En la pestaña Lugares de la izquierda, buscar el salón. El círculo junto al nombre indica su estado: verde con check si ya tiene destino guardado, naranja si hay un punto sugerido sin guardar, gris si no tiene punto.',
              'Seleccionar el salón.',
              'Mover el control Corte de altura para ocultar los pisos de arriba y ver desde arriba el piso del salón. Si otros edificios estorban, ocultarlos con sus botones en la barra superior.',
              'Hacer clic sobre el piso del modelo, justo frente a la puerta del salón, del lado del pasillo. Ahí la app pondrá el marcador y terminará la ruta.',
              'Si hace falta, ajustar con los campos X, Y, Z. El punto debe quedar sobre el piso, no en el techo ni dentro de una pared.',
              'Pulsar Guardar.',
            ],
          },
          {
            kind: 'p',
            text: 'Otros botones: Usar punto sugerido toma la sugerencia naranja, Descartar deshace el cambio sin guardar y Quitar punto borra el destino guardado.',
          },
        ],
      },
      {
        id: 'probar',
        title: 'Probarlo en el campus',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Abrir la app en un teléfono, buscar el salón y empezar desde fuera del edificio.',
              'Comprobar que la ruta exterior termina en una entrada, que la app abre la cámara y que la flecha llega al marcador frente a la puerta.',
              'Si la app no ofrece la cámara en ese teléfono, abrirla agregando `?arDevice=report` al final de la dirección para ver por qué.',
              'Revisar el recorrido en [Actividad → Recorridos](/sessions?tab=trips). Debe quedar como Llegó.',
            ],
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Si el mismo salón acumula recorridos en «Abandonó», el destino puede estar mal ubicado o el piso tener un hueco.',
          },
        ],
      },
      {
        id: 'editar',
        title: 'Editar, desactivar y eliminar',
        blocks: [
          {
            kind: 'list',
            items: [
              'Editar (lápiz): nombre, edificio y piso. El ID no cambia.',
              'Activar o desactivar (interruptor): un lugar desactivado no se muestra en la app, pero conserva su destino. Sirve para salones cerrados por un tiempo.',
              'Eliminar (papelera): lo borra para siempre, con su destino.',
            ],
          },
        ],
      },
    ],
  },

  // ─── Navegación interior ───────────────────────────────────────────────────
  {
    id: 'navegacion',
    title: 'Navegación interior',
    summary: 'La malla por donde la app traza rutas dentro de los edificios: regenerar, parches, escaleras, ascensores y correcciones.',
    icon: 'indoor',
    shortcuts: [{ label: 'Abrir Interior AR', to: '/map?tab=ar' }],
    intro: [
      {
        kind: 'p',
        text: 'Dentro de los edificios, la app calcula la ruta sobre una «malla de navegación» (navmesh): el mapa de las zonas por donde se puede caminar, sacado del piso escaneado. Todo se maneja en Mapa → Interior AR, pestañas Navegación y Corregir.',
      },
    ],
    topics: [
      {
        id: 'orden',
        title: 'Cuándo y en qué orden',
        blocks: [
          { kind: 'p', text: 'Hay que pasar por aquí cada vez que se agrega o se actualiza un mapa en el VPS propio. El orden recomendado es:' },
          {
            kind: 'steps',
            items: [
              'Si el escaneo trae personas, muebles sueltos o restos flotantes, quitarlos primero en la pestaña [Corregir](#navegacion-corregir).',
              'Regenerar y revisar la malla verde sobre el modelo.',
              'Tapar los huecos del piso con parches y unir las escaleras mal escaneadas.',
              'Crear conexiones para las escaleras que no se arreglen con parches.',
              'Regenerar de nuevo, y repetir hasta que no queden zonas sueltas.',
              'Publicar.',
              'Crear o revisar los ascensores (no hace falta regenerar para esto).',
            ],
          },
        ],
      },
      {
        id: 'regenerar',
        title: 'Regenerar y publicar',
        blocks: [
          {
            kind: 'list',
            items: [
              'Regenerar: arma la malla con los escaneos, los parches y las conexiones. Puede tardar hasta un minuto. Activa Mostrar navmesh en verde para verla sobre el modelo.',
              'Después de regenerar, el panel lista las zonas problemáticas con un botón Ver que lleva la cámara a cada una.',
              'Publicar: envía la malla a la app. Hasta que no se publique, los estudiantes siguen con la anterior.',
              'Descartar: borra lo que se generó sin publicarlo.',
            ],
          },
          {
            kind: 'note',
            tone: 'warning',
            text: 'Si aparece el aviso «Las conexiones o los parches cambiaron», hay que regenerar y publicar otra vez.',
          },
        ],
      },
      {
        id: 'parches',
        title: 'Parches de suelo',
        blocks: [
          {
            kind: 'p',
            text: 'Tapan partes del piso que el escaneo no capturó. Los huecos pequeños, de hasta cerca de 1 m, se cierran solos al regenerar; los demás necesitan parche.',
          },
          { kind: 'p', text: 'Escalera mal escaneada (botón Escalera):' },
          {
            kind: 'steps',
            items: [
              'Pulsar Escalera.',
              'Clic en el piso de abajo, al pie del primer escalón, junto a un costado.',
              'Clic junto al otro costado, también al pie.',
              'Clic en el piso de arriba, donde termina el último escalón, en un costado.',
              'Clic en el otro costado arriba. La rampa se arma sola.',
              'Ponerle nombre y Guardar.',
            ],
          },
          { kind: 'p', text: 'Hueco en el piso (botón Nuevo):' },
          {
            kind: 'steps',
            items: [
              'Pulsar Nuevo y luego Agregar puntos.',
              'Hacer clic alrededor del hueco, sobre el piso escaneado de los bordes, montando el contorno un poco sobre ese piso.',
              'Pulsar Terminar (mínimo 3 puntos), ponerle nombre y Guardar. Con Deshacer se quita el último punto.',
            ],
          },
          {
            kind: 'note',
            tone: 'info',
            text: 'Después de regenerar, los bordes del parche unidos al piso se ven en verde y los que faltan, en rojo. Si el panel avisa que casi no quedó suelo, el parche es muy angosto (menos de unos 50 cm). Si avisa que quedó aislado, hay que montar sus bordes sobre el piso de alrededor.',
          },
        ],
      },
      {
        id: 'conexiones',
        title: 'Conexiones',
        blocks: [
          {
            kind: 'p',
            text: 'Unen dos puntos que no tienen piso continuo entre ellos, por ejemplo los extremos de una escalera que no se pudo arreglar con un parche.',
          },
          {
            kind: 'steps',
            items: [
              'Pulsar Nueva y escribir un nombre.',
              'Con Inicio seleccionado, hacer clic en el piso de un extremo; con Final, en el otro.',
              'Dejar marcado En ambos sentidos, salvo que sea de un solo sentido.',
              'Guardar y regenerar.',
            ],
          },
        ],
      },
      {
        id: 'ascensores',
        title: 'Ascensores',
        blocks: [
          {
            kind: 'p',
            text: 'El interior del ascensor no se escanea. La app guía hasta la puerta, le dice al estudiante qué botón presionar y lo vuelve a ubicar cuando sale.',
          },
          {
            kind: 'steps',
            items: [
              'En el bloque Ascensores, pulsar Nuevo.',
              'Escribir el nombre y elegir el Edificio.',
              'Pulsar Marcar pisos y, con el corte de altura, hacer clic en el piso frente a la puerta del ascensor en cada nivel.',
              'Revisar en cada parada el Piso (con la misma numeración de los salones) y el Botón si en la cabina no es el número, por ejemplo `PB` o `S1`.',
              'Pulsar Terminar y Guardar. Se necesitan al menos dos pisos, uno encima del otro.',
            ],
          },
        ],
      },
      {
        id: 'corregir',
        title: 'Corregir el modelo y bloquear zonas',
        blocks: [
          {
            kind: 'p',
            text: 'La pestaña Corregir tiene dos modos. Modelo 3D quita del escaneo lo que no es parte del edificio (personas, muebles, restos flotantes, escaleras o paredes deformadas): lo quitado deja de verse y de contar al generar la malla. Malla bloquea zonas, corta pasos o desactiva escaleras para que las rutas no pasen por ahí, y se conserva en cada regeneración.',
          },
          {
            kind: 'table',
            head: ['Herramienta', 'Modo', 'Para qué'],
            rows: [
              ['Fragmento', 'Modelo 3D', 'Clic sobre un objeto para seleccionar el trozo conectado. Sirve para restos flotantes, personas o muebles'],
              ['Pincel', 'Modelo 3D', 'Mantener el clic y pintar sobre lo que se quiere quitar'],
              ['Área', 'Los dos', 'Arrastrar un rectángulo para seleccionar muchos elementos a la vez'],
              ['Polígono', 'Malla', 'Clic sobre la malla verde, una escalera, una conexión o un bloqueo existente'],
              ['Corte', 'Malla', 'Clics sobre el piso para trazar una línea que las rutas no pueden cruzar. Enter termina, Retroceso deshace el último punto, Esc cancela'],
            ],
          },
          {
            kind: 'steps',
            items: [
              'Elegir el modo (Modelo 3D o Malla) y la herramienta.',
              'Seleccionar. Alt+clic quita de la selección y el botón derecho gira la cámara.',
              'Pulsar Eliminar (en Modelo 3D) o Bloquear (en Malla).',
              'Pulsar Guardar.',
              'Ir a regenerar y publicar en la pestaña Navegación. Sin eso, la app no ve los cambios.',
            ],
          },
          {
            kind: 'note',
            tone: 'info',
            text: 'Ctrl+Z deshace y Ctrl+Shift+Z rehace. Lo quitado se puede ver y restaurar desde la lista «Limpiezas del modelo». Si una limpieza dice que no se aplica porque el mapa cambió, es que el mapa se actualizó en el VPS propio: restaurarla y volver a limpiar.',
          },
        ],
      },
    ],
  },

  // ─── Mapa exterior ─────────────────────────────────────────────────────────
  {
    id: 'mapa-exterior',
    title: 'Mapa exterior: caminos, entradas y puntos de interés',
    summary: 'Los senderos por donde la app guía con GPS hasta la entrada de cada edificio.',
    icon: 'outdoor',
    shortcuts: [
      { label: 'Abrir Mapa → Caminos', to: '/map?tab=editor' },
      { label: 'Abrir Vista usuario', to: '/map?tab=preview' },
    ],
    intro: [
      {
        kind: 'p',
        text: 'Afuera de los edificios, la app guía con GPS por los senderos dibujados en Mapa → Caminos. La ruta termina en una entrada del edificio y desde ahí empieza la guía con cámara.',
      },
    ],
    topics: [
      {
        id: 'tipos',
        title: 'Tipos de punto',
        blocks: [
          {
            kind: 'table',
            head: ['Tipo', 'Color en el mapa', 'Para qué sirve'],
            rows: [
              ['Edificio', 'Verde', 'Destino de la ruta'],
              ['Entrada de edificio', 'Morado', 'Va sobre la fachada; ahí termina la ruta exterior'],
              ['Entrada al campus', 'Azul', 'Portería o acceso desde la calle'],
              ['Punto de camino', 'Gris', 'Curva o cruce de un sendero'],
              ['Punto de interés', 'Café', 'Lugar que la app lista aparte, como el auditorio'],
            ],
          },
        ],
      },
      {
        id: 'caminos',
        title: 'Dibujar y editar caminos',
        blocks: [
          {
            kind: 'list',
            items: [
              'Dibujar camino: pulsar el botón, tocar el mapa para ir dejando puntos y tocar un punto o camino existente para unirlo. Terminar camino cierra el trazo.',
              'Mover un punto: arrastrarlo.',
              'Tocar un punto abre su panel: nombre, tipo, piso, «Dibujar camino desde aquí» y «Eliminar punto».',
              'Tocar un camino ofrece «Poner entrada aquí», «Agregar punto aquí» (para seguir una curva) y «Eliminar camino».',
              'Punto de interés: pulsar el botón, tocar un camino (si está al aire libre) o el mapa dentro de un edificio, y ponerle nombre, clase y piso.',
            ],
          },
        ],
      },
      {
        id: 'entrada',
        title: 'Ponerle entrada a un edificio',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Dibujar un camino desde el sendero más cercano hasta el punto del edificio.',
              'Tocar ese camino justo donde cruza la fachada y elegir Poner entrada aquí.',
              'En el panel de la entrada, escribir el nombre (por ejemplo «Entrada principal») y el Piso de esta salida.',
              'Revisar en el panel derecho, en «Entradas por edificio», que el edificio diga «1 entrada» y no «Sin entradas» ni «sin unir».',
              'Revisar «Caminos y edificios»: debe decir «Ningún camino atraviesa un edificio». Si algún camino cruza un edificio, la ruta se vería pasando por dentro; se corrige moviendo puntos.',
            ],
          },
        ],
      },
      {
        id: 'vista-usuario',
        title: 'Vista usuario',
        blocks: [
          {
            kind: 'p',
            text: 'La pestaña [Vista usuario](/map?tab=preview) simula la ruta que verá el estudiante, con una posición de prueba o con «Usar mi ubicación real». Muestra distancia y tiempo a pie.',
          },
        ],
      },
    ],
  },

  // ─── Eventos, usuarios, configuración ──────────────────────────────────────
  {
    id: 'gestion',
    title: 'Eventos, usuarios y configuración',
    summary: 'Avisos en la app, cuentas de administrador y parámetros.',
    icon: 'event',
    shortcuts: [
      { label: 'Abrir Eventos', to: '/events' },
      { label: 'Abrir Usuarios', to: '/users' },
      { label: 'Abrir Configuración', to: '/settings' },
    ],
    topics: [
      {
        id: 'eventos',
        title: 'Eventos',
        blocks: [
          {
            kind: 'p',
            text: 'Los eventos salen como aviso en el inicio de la app, con un botón que lleva al lugar. Solo se ven dentro de su horario.',
          },
          {
            kind: 'steps',
            items: [
              'Ir a [Eventos](/events) y pulsar Nuevo evento.',
              'Escribir el Nombre del evento y, si se quiere, una Descripción.',
              'En Lugar, buscar el edificio, salón, oficina o punto de interés donde será.',
              'Si ayuda, agregar una Indicación extra, por ejemplo «Segundo piso, al fondo».',
              'Elegir Desde y Hasta, o usar los atajos de duración (15 min, 30 min, 1 h, 2 h). Un evento puede durar máximo 90 días.',
              'Dejar activado Publicado. Si se apaga, el evento no se muestra aunque esté en su horario.',
              'Guardar.',
            ],
          },
        ],
      },
      {
        id: 'usuarios',
        title: 'Usuarios',
        blocks: [
          { kind: 'p', text: 'Solo los administradores del panel tienen usuario; los estudiantes usan la app sin cuenta.' },
          {
            kind: 'list',
            items: [
              'Crear: pulsar el botón de nuevo usuario, escribir el correo y una contraseña.',
              'Editar: cambiar el correo o la contraseña con el lápiz.',
              'Desactivar o reactivar: un usuario desactivado no puede entrar al panel, pero no se borra.',
            ],
          },
          {
            kind: 'note',
            tone: 'warning',
            text: 'El sistema trae un usuario inicial (`admin@admin.com` / `1234`). Cambiar esa contraseña o desactivarlo apenas existan las cuentas reales.',
          },
        ],
      },
      {
        id: 'configuracion',
        title: 'Parámetros de la aplicación',
        blocks: [
          {
            kind: 'p',
            text: 'Permiten prender o apagar funciones de la app sin publicar una versión nueva. Los cambios se ven la próxima vez que el estudiante abre la app.',
          },
          {
            kind: 'table',
            head: ['Parámetro', 'Qué hace'],
            rows: [
              ['`enableIndoorARNavigation`', 'Si está en false, al llegar al edificio la app muestra una pantalla de llegada en vez de abrir la cámara'],
              ['`arOnLimitedDevices`', 'Si está en false, los teléfonos de gama media solo usan el mapa, sin cámara'],
            ],
          },
          {
            kind: 'note',
            tone: 'warning',
            text: 'Para cambiar uno, pulsar el lápiz, escribir true o false y guardar. No borrar estos parámetros ni cambiarles el nombre: la app los busca por esa clave exacta.',
          },
        ],
      },
    ],
  },

  // ─── Dashboard y actividad ─────────────────────────────────────────────────
  {
    id: 'dashboard-actividad',
    title: 'Dashboard y actividad',
    summary: 'Cómo se está usando la app y si los estudiantes llegan a donde buscan.',
    icon: 'insights',
    shortcuts: [
      { label: 'Abrir Dashboard', to: '/' },
      { label: 'Ver dispositivos', to: '/sessions?tab=devices' },
      { label: 'Ver recorridos', to: '/sessions?tab=trips' },
    ],
    intro: [
      {
        kind: 'p',
        text: 'La app registra cada uso de forma anónima, sin cuentas ni nombres. Con esos datos el panel muestra si los estudiantes realmente llegan a donde buscan.',
      },
    ],
    topics: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        blocks: [
          {
            kind: 'p',
            text: 'Muestra usuarios activos, visitas, tiempo típico por visita y el porcentaje de recorridos que llegaron al destino, comparados con el periodo anterior. Más abajo hay usuarios nuevos y recurrentes, qué permisos dieron (cámara, ubicación y movimiento), qué teléfonos pueden usar la cámara y a qué horas se usa más la app. Arriba se elige el periodo.',
          },
        ],
      },
      {
        id: 'actividad',
        title: 'Actividad',
        blocks: [
          {
            kind: 'list',
            items: [
              '[Dispositivos](/sessions?tab=devices): los teléfonos que han abierto la app, con su modelo, sistema y cuándo se conectaron por última vez. Al tocar uno se ve su detalle.',
              '[Recorridos](/sessions?tab=trips): cada navegación con su destino y su estado (Llegó, Abandonó o En curso). Se puede filtrar por fechas y por edificio. Arriba están los totales: recorridos, porcentaje que llegó, tiempo típico, abandonados y cuántos usaron la cámara.',
              'Exportar: descarga los recorridos filtrados en un archivo que se abre en Excel.',
            ],
          },
        ],
      },
    ],
  },

  // ─── Problemas frecuentes ──────────────────────────────────────────────────
  {
    id: 'problemas',
    title: 'Problemas frecuentes',
    summary: 'Qué revisar cuando algo no sale como se espera.',
    icon: 'problems',
    topics: [
      {
        id: 'tabla',
        title: 'Síntomas y soluciones',
        blocks: [
          {
            kind: 'table',
            head: ['Qué pasa', 'Por qué suele pasar', 'Qué hacer'],
            rows: [
              ['Interior AR dice que no se pudieron obtener los modelos 3D', 'El VPS propio no responde o no tiene un build publicado', 'Revisar la página [VPS propio](/vps); si no conecta, avisar al equipo técnico (Manual técnico, sección de problemas)'],
              ['El mapa nuevo no aparece en Interior AR', 'Todavía no está en el build publicado', 'Procesarlo y [publicarlo](#vps-publicar)'],
              ['El mapa nuevo aparece corrido respecto a los demás', 'Quedó mal alineado', 'Corregirlo en [Alineación](#vps-alinear), procesar y publicar'],
              ['La flecha atraviesa paredes o no encuentra ruta', 'La malla no está al día o tiene zonas sueltas', 'Regenerar, revisar con «Ver», poner parches o conexiones y publicar ([Navegación interior](#navegacion))'],
              ['La ruta pasa por donde no debe (un salón cerrado, un mueble)', 'La malla incluye una zona que no se debe usar', 'Bloquearla con [Corregir](#navegacion-corregir), regenerar y publicar'],
              ['La ruta interior no sube de piso', 'Falta la escalera o el ascensor de esa zona', 'Crearlos en la pestaña Navegación ([parches](#navegacion-parches), [conexiones](#navegacion-conexiones), [ascensores](#navegacion-ascensores))'],
              ['La app lleva al piso equivocado', 'El piso del salón no coincide con el de las paradas del ascensor', 'Corregir el piso del salón o de la parada'],
              ['El salón no aparece en la app', 'Está desactivado o su edificio está inactivo', 'Activarlo en [Campus](/campus)'],
              ['La ruta exterior sale en línea recta', 'El edificio no tiene camino ni entrada', 'Dibujar el camino y [poner la entrada](#mapa-exterior-entrada)'],
              ['La ruta exterior pasa por dentro de un edificio', 'Un camino cruza el edificio en el mapa', 'Revisar «Caminos y edificios» y mover puntos'],
              ['Un edificio dice «Sin ubicar»', 'No tiene ubicación en el mapa', 'Editarlo y ponerle latitud y longitud'],
              ['Error de duplicado al crear un salón o edificio', 'El ID o la categoría ya existen', 'Usar otro ID; revisar edificios inactivos'],
              ['El panel saca al usuario', 'La sesión vence después de un día', 'Volver a entrar'],
              ['No llega el correo para recuperar la contraseña', 'Problema con la cuenta de correo del sistema', 'Avisar al equipo técnico'],
              ['Un teléfono no ofrece la cámara', 'El teléfono no es compatible o la función está apagada en Configuración', 'Abrir la app con `?arDevice=report` al final de la dirección para ver el motivo; revisar los [parámetros](#gestion-configuracion)'],
              ['La cámara se cierra sola y la app sigue con letreros', 'El teléfono no da el rendimiento necesario', 'Es el comportamiento esperado; probar con otro teléfono'],
            ],
          },
        ],
      },
    ],
  },
];
