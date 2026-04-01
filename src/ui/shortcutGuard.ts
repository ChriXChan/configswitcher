export function createExclusiveShortcutHandler(
  handler: () => void | Promise<void>,
): () => Promise<void> {
  let isRunning = false;

  return async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      await handler();
    } finally {
      isRunning = false;
    }
  };
}
