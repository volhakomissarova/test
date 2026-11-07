# Quiet Light

An adaptive web app for a subtle black-and-white film treatment, processed entirely in the browser. Photos are never uploaded to a server or stored by the app.

## Run locally

Open this folder in an editor and start any static HTTP server from it. For example, with Python installed:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000` in a current browser. The HTTP server lets the browser load the Web Worker; it does not receive image files.

## Features

- Responsive layout for desktop and mobile, with drag-and-drop or file-picker upload.
- 20 MB input file limit; supported formats also depend on browser decoding support.
- Image processing in a separate browser thread, with no server upload.
- Monochrome tonal curve, preserved alpha channel, moderate film grain, and barely visible vignette.
- Original/result preview frames match the uploaded photo's aspect ratio so subjects near the edges are not cropped out.
- Downloads retain the complete original composition and source dimensions as PNG; preview framing never crops the downloaded image.

The app does not crop, generate content, or move objects. It changes pixel values to create monochrome tones, grain, and vignette. Original file metadata is not copied into the PNG.

## Background photograph

The cinematic background photo is “Endless Fog” by Mattos Berger, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Endless_Fog_(135115907).jpeg), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The page applies a monochrome treatment to the image.
