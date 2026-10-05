# Project RayCasting - V3

Try it out: https://rc.blanc.com.ar/

Juego FPS desarrollado con JavaScript, HTML y CSS, con un motor de raycasting y una aplicación de escritorio basada en Electron.

## Capturas del juego

Combate en primera persona, con minimapa e indicadores de salud, energía y munición.

![Combate contra enemigos en un pasillo del juego](docs/screenshots/gameplay-combate.png)

Exploración de los escenarios y vista de un enemigo derrotado.

![Vista en primera persona de los pasillos y un enemigo derrotado](docs/screenshots/gameplay-pasillos.png)

### Arte y sprites

Proyectiles de fuego y sus efectos de impacto.

![Sprites de proyectiles de fuego e impactos](docs/screenshots/sprites-proyectiles.png)

Enemigos y distintos estados de sus animaciones.

![Sprites de enemigos, ataques e impactos](docs/screenshots/sprites-enemigos.png)

## Descargar y jugar en Windows

La versión portable está disponible en [Releases](https://github.com/Marcosblancarg/Raycasting-Game/releases/latest). Descargá el archivo `Raycasting-Game-0.5.1-Windows-x64-Portable.exe` y abrilo con doble clic: no requiere instalar Node.js ni iniciar un servidor.

Requiere Windows de 64 bits. El primer arranque puede tardar unos segundos. El ejecutable no está firmado digitalmente, por lo que Windows puede mostrar un aviso de editor desconocido.

## Ejecutar desde el código fuente en Windows

Se requiere Node.js y npm.

### En el navegador

Desde la carpeta del proyecto, ejecutar:

```sh
node server.js
```

Abrir `http://localhost:8000`. También se incluye `Start_game.bat` para iniciar el servidor y abrir el navegador.

### Con Electron

```sh
npm ci
npm start
```

### Generar un instalador

```sh
npm run dist
```

La configuración de Electron Builder genera un instalador NSIS para Windows en `dist/`.

Para generar el ejecutable portable: `npm run dist:portable`. El workflow **Windows portable release** de GitHub Actions compila en Windows, prueba el ejecutable y publica la Release únicamente si la prueba pasa.

## Contenido

- `js/`: lógica del juego, raycasting, mapas, controles, audio y partículas.
- `css/`: estilos de la interfaz.
- `assets/`: imágenes, sonidos, música y video.
- `main.js`: punto de entrada de Electron.
- `server.js`: servidor HTTP para ejecución local.
- `tools/`: herramientas auxiliares del proyecto.

Esta copia conserva los archivos originales del proyecto. No incluye dependencias instaladas ni compilaciones generadas. La importación al repositorio no implica que se hayan ejecutado o probado el juego o su instalador.
