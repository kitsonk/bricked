export default function PrintButton() {
  return (
    <button
      type="button"
      class="btn btn-primary btn-lg shadow-lg"
      onClick={() => globalThis.print()}
    >
      <span class="iconify lucide--printer size-5"></span>
      Print
    </button>
  );
}
