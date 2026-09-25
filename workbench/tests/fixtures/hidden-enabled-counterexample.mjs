// Isolated engineering counterexample. The frozen source page is never written.
// Only the retry button's hidden/enabled state changes after its retry handler.
export function hiddenEnabledCounterexample(originalHtml) {
  const patch = `<script>
(() => {
  const button = document.getElementById('tRetry');
  const native = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled');
  const original = button.onclick;
  let locked = false;
  Object.defineProperty(button, 'disabled', {
    get() { return locked ? false : native.get.call(this); },
    set(value) { if (!locked) native.set.call(this, value); }
  });
  button.onclick = function(event) {
    original.call(this, event);
    locked = true;
    this.style.display = 'none';
    native.set.call(this, false);
  };
})();
</script>`;
  return originalHtml + patch;
}
