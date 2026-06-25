export function createAbortController() {
  const controller = new AbortController()
  return controller
}

export function getAbortSignal(controllerRef) {
  if (controllerRef?.current) {
    controllerRef.current.abort()
  }
  const controller = createAbortController()
  if (controllerRef) {
    controllerRef.current = controller
  }
  return controller.signal
}
