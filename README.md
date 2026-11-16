# Micros Santa Cruz – Rutas y Tránsito 🚌🗺️

Aplicación web interactiva y de alto rendimiento para consultar las líneas y recorridos de micros de **Santa Cruz de la Sierra, Bolivia**. Permite inspeccionar rutas de ida y vuelta, calcular trayectos óptimos entre dos puntos (directos o con transbordos), explorar puntos de interés urbanos, activar alertas sonoras/vibratorias de bajada por geocerca GPS y consultar un Copiloto Agéntico.

La aplicación procesa un archivo GeoJSON de forma fluida en el navegador mediante tiles vectoriales al vuelo (`geojson-vt`), un Web Worker dedicado y un árbol espacial R-Tree (`rbush`).

---

## Características y Features

### 1. 🤖 Copiloto Agéntico con IA
- **Asistente conversacional de tránsito**: responde dudas y solicitudes en lenguaje natural adaptado a la jerga y referencias de Santa Cruz (ej. *"¿Qué micro me lleva de la Gabriel al Ventura Mall?"*, *"Mostrame la 72"* o *"Avísame cuando esté a 2 cuadras del Parque Urbano"*).
- **Function Calling en tiempo real**: el modelo de IA invoca herramientas de software en backend que interactúan directamente con el mapa:
  - `planRoute`: calcula la ruta entre origen y destino y dibuja el itinerario.
  - `searchNearbyMicros`: busca los micros que pasan cerca de un punto o lugar de referencia.
  - `highlightLine`: aísla e ilumina el recorrido oficial de ida y vuelta de cualquier línea.
  - `setGeofenceAlarm`: configura automáticamente una alarma geocercada para bajarse del micro.
  - `explorePlaces`: filtra puntos de interés urbanos por categoría o nombre.
- **Entrada y salida por voz**:
  - **Dictado por voz (STT)** usando la Web Speech Recognition API en español.
  - **Lectura en voz alta (TTS)** para escuchar instrucciones mientras estás en el micro.
- **Tarjetas de acción interactiva**: botones directos para ejecutar o inspeccionar las acciones generadas por la IA.
- **Respaldo heurístico de alta disponibilidad**: si el servicio de IA experimenta congestión temporal o falta de clave, un motor de reglas local responde de forma instantánea sin interrumpir al usuario.

### 2. 🗺️ Mapa Vectorial de Alto Rendimiento
- **Renderizado MapLibre GL JS**: mapa fluido con aceleración WebGL y capas vectoriales optimizadas.
- **Indexación y Vector Tiling al Vuelo**: procesa datasets pesados usando `geojson-vt` ejecutado en un Web Worker para mantener la interfaz a 60 FPS sin bloquear el hilo principal.
- **Árbol Espacial R-Tree (`rbush`)**: indexa decenas de miles de segmentos de ruta para consultas geométricas y de proximidad en milisegundos.

### 3. 🔍 Explorador y Filtrado de Líneas de Micro
- Buscador reactivo por número o nombre de línea (ej. 72, 8, 11, 121, etc.).
- Filtrado por sentido: **Ida (Sentido 1)**, **Vuelta (Sentido 2)** o ambos.
- Paleta de colores distintiva para cada línea, cálculo de distancia total en kilómetros y centrado automático en el recorrido.

### 4. 📍 Detección de Rutas Cercanas ("¿Qué micro pasa por aquí?")
- Selección de cualquier coordenada en el mapa con un clic o pulsación móvil.
- Radio de búsqueda configurable (100 m, 200 m, 300 m, 500 m).
- Listado ordenado por distancia exacta al punto marcado y proyección del punto más cercano sobre la calzada.

### 5. 🔀 Calculador de Rutas A → B (Rutas Directas y con Transbordo)
- Fijación de puntos de origen (A) y destino (B) mediante clics en el mapa, coordenadas GPS o selección de puntos de interés (POIs).
- **Rutas directas**: identifica micros que cubren ambos puntos sin bajarse, indicando distancia caminada, tramo en micro y tiempo estimado.
- **Rutas con 1 transbordo**: calcula transferencias viables entre dos líneas diferentes, especificando el punto de intersección óptimo y las instrucciones paso a paso.
- Visualización gráfica del tramo a pie de inicio, trayecto en micro 1, caminata de conexión, micro 2 y llegada a destino.

### 6. 🔔 Alertas de Bajada por GPS (Geocercas Sonoras y Vibración)
- *"Avísame cuando esté cerca"*: geocerca reactiva con distancias configurables (100 m, 200 m, 300 m).
- Monitoreo de ubicación en tiempo real mediante `navigator.geolocation.watchPosition` con alta precisión (`enableHighAccuracy`).
- Alarma con sonido sintetizado (Web Audio API) y patrón de vibración en celulares (`navigator.vibrate`), ideal para quienes viajan de noche o desconocen la zona.
- Barra de estado flotante que muestra la distancia restante en tiempo real y la precisión del GPS.

### 7. 🏛️ Lugares de Interés de Santa Cruz (POIs)
- Catálogo de sitios clave categorizados: Universidades, Hospitales, Mercados, Terminales y Centros Comerciales.
- Botones de acción directa: *"Fijar como Origen A"*, *"Fijar como Destino B"* y *"Ver micros cercanos"*.

### 8. 📱 Diseño Adaptable (Mobile-First)
- Drawer deslizable inferior en dispositivos móviles con gestos suaves.
- Barra lateral expandible en pantallas de escritorio.
- Modo pantalla completa, geolocalización del usuario y controles de navegación.

### 9. 🎬 Animación 3D de Navegación del Recorrido (Video Exportable)
- **Cámara 3D Dinámica con Seguimiento**: animación cinematográfica que sigue el avance del recorrido con inclinación de cámara (*pitch* a 56°) y rotación continua (*bearing*) a través del trazado real de las calles de Santa Cruz.
- **Microbús 3D Cruceño Procedural**: modelo 3D detallado con ventanas panorámicas oscuras, parachoques cromados, ruedas y sombra en el asfalto.
- **Peatón 3D Caminando**: avatar estilizado con mochila, gorra y zancada activa para los tramos de caminata iniciales, finales y de transbordo.
- **Puntos de Inicio (A) y Destino (B) Nativos en WebGL**: insignias y anillos de luz pulsantes en la calzada visibles en el mapa y grabados en el video.
- **Estudio Multi-Formato**: selector instantáneo entre formato vertical **9:16** (TikTok, Instagram Reels, Shorts) y horizontal **16:9** (pantalla ancha).
- **Exportación Directa a Video MP4/WebM**: motor de captura cuadro a cuadro con lienzo compuesto 2D que incrusta la marca de agua oficial y la píldora informativa de navegación directamente en el archivo de video descargable, listo para importar y editar en **CapCut**.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS, Lucide React, Motion |
| **Mapas y GIS** | MapLibre GL JS, GeoJSON-VT, RBush, Turf.js |
| **Gráficos 3D & Render** | Three.js (WebGL CustomLayer Interface), Luces PBR, Proyección Mercator |
| **Grabación de Video** | MediaRecorder API, Canvas 2D Composite Pipeline (MP4/WebM) |
| **Backend** | Node.js, Express, PostgreSQL, Drizzle ORM |
| **Inteligencia Artificial** | Google GenAI SDK (`@google/genai`), Gemini 3.8 Flash, Function Calling |
| **APIs Web Nativas** | Web Speech API (STT & TTS), Geolocation API, Web Audio API, Vibration API |

---

## 💻 Ejecución en un Entorno Local

### Prerrequisitos
- **Node.js**: versión 20.19 o superior.
- **npm**, **pnpm** o **bun** instalado.

### Pasos de Instalación

1. Instala y configura cada proyecto por separado. En `micros_scz_back`, copia `.env.example` a `.env` solo si aún no tienes un `.env`; configura allí PostgreSQL, Google OAuth y Gemini.
2. En `micros_scz_front`, copia `.env.example` a `.env` solo si aún no tienes un `.env`; define `VITE_API_BASE_URL` y `VITE_GOOGLE_CLIENT_ID`. No pongas secretos del servidor en variables `VITE_*`.
3. Abre dos terminales desde la carpeta que contiene ambos proyectos:

   ```bash
   cd micros_scz_back
   npm install
   npm run dev
   ```

   ```bash
   cd micros_scz_front
   npm install
   npm run dev
   ```

La API queda en `http://localhost:4000` y la aplicación estática en `http://localhost:3000`. El frontend continúa sirviendo los datos offline desde `public/data/`.

### Scripts disponibles
- Frontend: `npm run dev`, `npm run build`, `npm run preview` y `npm run lint`.
- Backend: `npm run dev`, `npm run build && npm start` (producción), `npm run typecheck`, `npm test`, `npm run db:generate`, `npm run db:migrate` (migraciones versionadas, incluido producción) y `npm run db:push` (desarrollo).

---

## 🛠️ Guía para Desarrolladores: Animación 3D de Navegación y Exportación de Video

Esta funcionalidad permite transformar cualquier ruta calculada de A $\to$ B en una animación 3D cinematográfica con vista aérea inclinada que sigue el recorrido de las calles reales de Santa Cruz, exportable directamente como video para CapCut, TikTok, Instagram Reels o YouTube Shorts.

### 📐 Arquitectura de la Feature

```text
               ┌───────────────────────────────┐
               │    TripOption (Ruta A -> B)   │
               └───────────────┬───────────────┘
                               │
               ┌───────────────▼───────────────┐
               │   animation-trajectory.ts     │
               │ (Trayectoria continua, tiempo │
               │  t in [0, 1], rumbos y giros) │
               └───────────────┬───────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│       ThreeBusLayer.ts        │ │     NavigationMapCanvas       │
│  (Capa CustomLayer Three.js,  │ │  (Cámara 3D pitch/bearing,    │
│   microbús 3D procedural,     │ │   capas WebGL de origen A,    │
│   persona 3D, letrero L-72)   │ │   destino B y baliza viva)    │
└───────────────┬───────────────┘ └──────────────┬────────────────┘
                │                                │
                └──────────────┬─────────────────┘
                               │
               ┌───────────────▼───────────────┐
               │  navigation-video-recorder.ts │
               │ (Lienzo compuesto 2D con HUD, │
               │  marca de agua y MP4/WebM)    │
               └───────────────────────────────┘
```

---

### ⏱️ 1. Dónde cambiar la duración del tiempo del video

La duración de la animación se controla en dos lugares específicos del código:

1. **Duración por defecto en la clase de trayectoria**:
   - **Archivo**: `src/utils/animation-trajectory.ts`
   - **Líneas ~68 y ~70**:
     ```ts
     export class RouteAnimationTrajectory {
       public waypoints: TrajectoryWaypoint[] = [];
       public totalDistanceMeters = 0;
       // Cambiar aquí el valor por defecto en segundos (ej. 10, 15, 20):
       public totalDurationSeconds = 14; 

       constructor(trip: TripOption, desiredDurationSeconds = 14) {
         this.totalDurationSeconds = desiredDurationSeconds;
         this.buildTrajectory(trip);
       }
     ```

2. **Instanciación en el Modal de Animación**:
   - **Archivo**: `src/components/NavigationAnimationModal.tsx`
   - **Línea ~76**:
     ```ts
     const trajectory = useMemo(() => {
       if (!trip) return null;
       // Cambiar el segundo argumento (14) por la duración deseada en segundos:
       return new RouteAnimationTrajectory(trip, 14); 
     }, [trip]);
     ```

> **Nota técnica**: Al exportar a video a 30 FPS, un video de 14 segundos genera exactamente `14 * 30 = 420` fotogramas grabados cuadro a cuadro. Si cambias el tiempo a 20 segundos, el grabador capturará automáticamente 600 fotogramas manteniendo la fluidez constante.

---

### 🚌 2. Cómo cambiar o personalizar el modelo del microbús

El modelo 3D del microbús se encuentra en `src/utils/three-bus-layer.ts`. Puedes personalizarlo modificando sus proporciones procedurales o reemplazándolo por un archivo 3D externo:

#### A. Modificar dimensiones y piezas del modelo procedural actual

En el método `buildBusModel()` de `src/utils/three-bus-layer.ts`:

- **Dimensiones base del chasis (en metros)**:
  ```ts
  const width = 3.2;   // Ancho del vehículo (eje X)
  const length = 8.6;  // Largo del vehículo (eje Y, hacia adelante)
  const height = 3.2;  // Alto del vehículo (eje Z, hacia arriba)
  ```
- **Escala de visualización sobre el mapa**:
  En el método `render()` de `ThreeBusLayer`:
  ```ts
  // Modificar el multiplicador (2.8x) para hacer el bus más grande o más pequeño:
  const modelScale = scale * 2.8; 
  ```
- **Componentes modulares disponibles**:
  - `lowerBody`: Carrocería blanca con brillo.
  - `busStripeMesh`: Franja lateral reactiva que toma automáticamente el color de la línea (`this.currentLineColor`).
  - `windows`: Caja de lunas tintadas panorámicas (`#0f172a`).
  - `acUnit`: Unidad de climatización superior con ventiladores dobles.
  - `wheelPositions`: Posición y dimensiones de las 4 ruedas con neumáticos y aros plateados.
  - `leftHeadlight / rightHeadlight`: Faros frontales con brillo cálido autoemisivo.
  - `roofSignCanvas`: Textura 2D dinámica que genera el letrero iluminado de ruta con el número de línea (ej. `L-72`).

#### B. Reemplazar el modelo por un archivo 3D externo (.GLTF o .GLB)

Si deseas utilizar un modelo 3D descargado (por ejemplo un archivo `micro.glb` en `public/models/micro.glb`):

1. **Importar el cargador GLTF**:
   ```ts
   import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
   ```

2. **Cargar el modelo en `onAdd` o `setupScene`**:
   ```ts
   const loader = new GLTFLoader();
   loader.load('/models/micro.glb', (gltf) => {
     const model = gltf.scene;
     // Ajustar escala y orientación si el modelo viene con +Z hacia adelante
     model.rotation.x = Math.PI / 2; 
     model.scale.set(1.5, 1.5, 1.5);
     
     this.busGroup.clear(); // Reemplaza el modelo procedural
     this.busGroup.add(model);
     if (this.map) this.map.triggerRepaint();
   });
   ```
   *Al estar agregado dentro de `this.busGroup`, el modelo heredará automáticamente las coordenadas geográficas de la calle, el rumbo de giro y la cámara inclinada sin tener que recalcular nada.*

#### C. Personalizar el avatar de la persona caminando

- **Archivo**: `src/utils/three-bus-layer.ts` $\to$ método `buildPedestrianModel()`.
- Contiene los sub-componentes: `legGeo` (piernas en zancada), `jacketMat` (chamarra reactiva al color de la ruta), `head` (cabeza y gorra estilizada), `pack` (mochila trasera) y `ring` (aura brillante en el asfalto).

---

### 💧 3. Dónde personalizar la marca de agua y los textos del video

- **Texto por defecto de la marca de agua**:
  - En `src/components/NavigationAnimationModal.tsx`:
    ```ts
    watermarkText="Micros Santa Cruz · Recorrido Oficial"
    ```
- **Renderizado del HUD en el video exportado**:
  - En `src/utils/navigation-video-recorder.ts`: función `renderHUDOnCanvas()`. Aquí se define la tipografía, el logo badge `SCZ`, los colores del fondo traslúcido y la píldora superior con el nombre de la línea e instrucciones de viaje.

---

### 📲 4. Compatibilidad Universal y Calidad Gráfica (1080p)

- **Codificación MP4 H.264 Real (Fast-Start)**:
  - En `src/utils/navigation-video-recorder.ts`, la grabación utiliza la API nativa de **WebCodecs (`VideoEncoder`)** combinada con **`mp4-muxer`**.
  - Empaqueta el video con el códec H.264 (`avc1.4d002a`) y ubica el átomo de índice `moov` al principio del archivo (`fastStart: 'in-memory'`).
  - Esto elimina por completo el error *"formato de archivo no compatible"* en **WhatsApp**, permitiendo reproducir y compartir el video directamente en chats individuales, grupos y estados, además de importarlo en **CapCut**, **TikTok** e **Instagram**.
- **Super-Sampling Full HD (1080p)**:
  - Selector en el modal entre **1080p** (1080×1920 en vertical, 1920×1080 en horizontal a 14 Mbps) y **720p**.
- **Edificios 3D Volumétricos**:
  - Capa de extrusión 3D en `NavigationMapCanvas.tsx` que levanta los edificios de la ciudad según su altura real de OpenStreetMap.
- **Sombras Suaves y Haz de Luz**:
  - Three.js configurado con `THREE.PCFSoftShadowMap` y luz direccional con proyección de sombras sobre la calzada, además de un haz cálido proyectado por los faros delanteros.

---

Plan para MicroBot: reconocer localmente las cinco acciones actuales con respuesta inmediata cuando la intención sea clara; reservar Gemini para consultas ambiguas y recurrir a heurísticas locales si falla la API. La experiencia sin internet cubrirá el chat guiado y los datos estáticos de rutas/lugares después de una primera carga online, no Google, datos comunitarios ni mapas base externos. También verificaré y ajustaré la caché PWA si hace falta

---

## 📄 Licencia

Este proyecto está disponible bajo la licencia Apache-2.0. Desarrollado para la comunidad de pasajeros y el transporte público de Santa Cruz de la Sierra.
