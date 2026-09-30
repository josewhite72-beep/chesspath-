const STORAGE_KEY = "chesspath_progress";

export function loadProgress() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.warn("No se pudo guardar el progreso", e);
  }
}

export function getChapterProgress(chapterId) {
  const all = loadProgress();
  return all[chapterId] || null;
}

export function saveChapterProgress(chapterId, data) {
  const all = loadProgress();
  all[chapterId] = data;
  saveProgress(all);
}
