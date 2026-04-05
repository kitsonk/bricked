import { useEffect } from "preact/hooks";

const KEY = "layout-sidebar-hover-trigger";

export default function SidebarPersist() {
  useEffect(() => {
    const checkbox = document.getElementById(KEY) as HTMLInputElement | null;
    if (!checkbox) return;

    const stored = localStorage.getItem(KEY);
    if (stored !== null) {
      checkbox.checked = stored === "true";
    }

    const handler = () => localStorage.setItem(KEY, String(checkbox.checked));
    checkbox.addEventListener("change", handler);
    return () => checkbox.removeEventListener("change", handler);
  }, []);

  return null;
}
