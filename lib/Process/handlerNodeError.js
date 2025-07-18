// max retry loading before changing the status to definitiveError
const MAX_RETRY = 4;
export default function handlingError(err, node, layer, targetLevel, view) {
  // Cancel error handling if the layer was removed between command scheduling and its execution
  if (!node.layerUpdateState[layer.id]) {
    return;
  }
  if (err.isCancelledCommandException) {
    node.layerUpdateState[layer.id].success();
  } else if (err instanceof SyntaxError) {
    node.layerUpdateState[layer.id].failure(0, true);
  } else {
    const definitiveError = node.layerUpdateState[layer.id].errorCount > MAX_RETRY;
    node.layerUpdateState[layer.id].failure(Date.now(), definitiveError, {
      targetLevel
    });
    if (!definitiveError) {
      window.setTimeout(() => {
        view.notifyChange(node, false);
      }, node.layerUpdateState[layer.id].secondsUntilNextTry() * 1000);
    }
  }
}