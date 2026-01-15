let currentContext: Record<string, unknown> = {};

export function setToolContext(context: Record<string, unknown>) {
  currentContext = context;
}

export function getToolContext<T = Record<string, unknown>>(): T {
  return currentContext as T;
}

export function clearToolContext() {
  currentContext = {};
}
