export function capturePointer(element, pointerId) {
  try {
    element.setPointerCapture(pointerId);
    return true;
  } catch {
    return false;
  }
}

export function vibrate(duration) {
  try {
    return navigator.vibrate?.(duration) ?? false;
  } catch {
    return false;
  }
}
