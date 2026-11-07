"use strict";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SUPPORTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/gif"
]);

const fileInput = document.querySelector("#fileInput");
const chooseButton = document.querySelector("#chooseButton");
const uploadPanel = document.querySelector("#uploadPanel");
const uploadContent = document.querySelector("#uploadContent");
const processingState = document.querySelector("#processingState");
const progressBar = document.querySelector("#progressBar");
const progressLabel = document.querySelector("#progressLabel");
const errorMessage = document.querySelector("#errorMessage");
const result = document.querySelector("#result");
const resultName = document.querySelector("#resultName");
const finishedFrameLabel = document.querySelector("#finishedFrameLabel");
const originalPreview = document.querySelector("#originalPreview");
const resultPreview = document.querySelector("#resultPreview");
const originalFrame = originalPreview.parentElement;
const resultFrame = resultPreview.parentElement;
const originalDimensions = document.querySelector("#originalDimensions");
const resultDimensions = document.querySelector("#resultDimensions");
const downloadButton = document.querySelector("#downloadButton");
const anotherButton = document.querySelector("#anotherButton");

let worker = null;
let currentJob = 0;
let originalUrl = null;
let resultUrl = null;
let resultBlob = null;
let resultFileName = "photo-bw-film.png";

chooseButton.addEventListener("click", openFilePicker);
fileInput.addEventListener("change", () => {
  if (fileInput.files && fileInput.files.length > 0) {
    processFile(fileInput.files[0]);
  }
});

anotherButton.addEventListener("click", openFilePicker);

function openFilePicker() {
  currentJob += 1;
  if (worker) {
    worker.terminate();
    worker = null;
  }
  setProcessing(false);
  clearError();
  clearResult();
  fileInput.value = "";
  fileInput.click();
}

downloadButton.addEventListener("click", downloadResult);

for (const eventName of ["dragenter", "dragover"]) {
  uploadPanel.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadPanel.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  uploadPanel.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadPanel.classList.remove("is-dragging");
  });
}

uploadPanel.addEventListener("drop", (event) => {
  const file = event.dataTransfer && event.dataTransfer.files[0];
  if (file) processFile(file);
});

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.hidden = true;
}

function setProcessing(isProcessing) {
  uploadContent.hidden = isProcessing;
  processingState.hidden = !isProcessing;
  if (isProcessing) {
    progressBar.style.width = "5%";
    progressLabel.textContent = "Preparing your image";
  }
}

function releasePreviewUrls() {
  if (originalUrl) URL.revokeObjectURL(originalUrl);
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  originalUrl = null;
  resultUrl = null;
  resultBlob = null;
}

function clearResult() {
  result.hidden = true;
  downloadButton.disabled = true;
  originalPreview.removeAttribute("src");
  resultPreview.removeAttribute("src");
  originalFrame.style.aspectRatio = "";
  resultFrame.style.aspectRatio = "";
  releasePreviewUrls();
}

function getWorker() {
  if (!worker) {
    worker = new Worker("processor.worker.js");
    worker.addEventListener("message", handleWorkerMessage);
    worker.addEventListener("error", (event) => {
      event.preventDefault();
      currentJob += 1;
      setProcessing(false);
      downloadButton.disabled = true;
      result.hidden = true;
      showError("We couldn't process this photo. Try a current browser or an image with a lower resolution.");
      if (worker) worker.terminate();
      worker = null;
    });
  }
  return worker;
}

async function processFile(file) {
  const wasProcessing = !processingState.hidden;
  const jobId = ++currentJob;
  if (wasProcessing && worker) {
    worker.terminate();
    worker = null;
  }
  clearError();
  clearResult();

  if (file.size > MAX_FILE_SIZE) {
    setProcessing(false);
    showError("This file is larger than 20 MB. Choose a smaller photo.");
    return;
  }

  if (!SUPPORTED_TYPES.has(file.type)) {
    setProcessing(false);
    showError("This format isn't supported. Choose a JPEG, PNG, WEBP, AVIF, BMP, or GIF image.");
    return;
  }

  setProcessing(true);

  try {
    if (typeof createImageBitmap !== "function" || typeof Worker !== "function") {
      throw new Error("Your browser doesn't support the image-processing features this app needs.");
    }

    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (jobId !== currentJob) {
      bitmap.close();
      return;
    }

    originalUrl = URL.createObjectURL(file);
    originalPreview.src = originalUrl;
    const frameAspectRatio = `${bitmap.width} / ${bitmap.height}`;
    originalFrame.style.aspectRatio = frameAspectRatio;
    resultFrame.style.aspectRatio = frameAspectRatio;
    resultName.textContent = "Your photo";
    finishedFrameLabel.dataset.filename = file.name;
    finishedFrameLabel.title = file.name;
    finishedFrameLabel.setAttribute("aria-label", `Your finished frame. File name: ${file.name}`);
    originalDimensions.textContent = `${bitmap.width} × ${bitmap.height}`;
    resultDimensions.textContent = `${bitmap.width} × ${bitmap.height}`;
    resultPreview.removeAttribute("src");
    resultPreview.alt = "Processing photo";
    progressLabel.textContent = "Shaping a soft tonal curve";

    getWorker().postMessage({ type: "process", jobId, bitmap }, [bitmap]);
  } catch (error) {
    if (jobId !== currentJob) return;
    setProcessing(false);
    showError(error instanceof Error ? error.message : "We couldn't open this file as an image.");
  }
}

function handleWorkerMessage(event) {
  const message = event.data;
  if (!message || message.jobId !== currentJob) return;

  if (message.type === "progress") {
    progressBar.style.width = `${Math.max(5, Math.min(95, Math.round(message.progress * 100)))}%`;
    progressLabel.textContent = message.label;
    return;
  }

  if (message.type === "error") {
    setProcessing(false);
    clearResult();
    showError(message.message);
    return;
  }

  if (message.type === "complete") {
    setProcessing(false);
    progressBar.style.width = "100%";
    resultBlob = message.blob;
    resultFileName = `${safeBaseName(resultName.textContent)}-bw-film.png`;
    resultUrl = URL.createObjectURL(resultBlob);
    resultPreview.src = resultUrl;
    resultPreview.alt = `${resultName.textContent} in the style of 35 mm black-and-white film`;
    result.hidden = false;
    downloadButton.disabled = false;
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function safeBaseName(fileName) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const cleaned = withoutExtension.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
  return (cleaned || "photo").slice(0, 100);
}

function downloadResult() {
  if (!resultBlob || !resultUrl) return;
  const link = document.createElement("a");
  link.href = resultUrl;
  link.download = resultFileName;
  document.body.append(link);
  link.click();
  link.remove();
}
