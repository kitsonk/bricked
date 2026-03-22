import { AppFrame } from "@/components/AppFrame.tsx";
import { define } from "@/utils/fresh.ts";

export default define.page(function Index() {
  return (
    <AppFrame>
      <div>Hello world!</div>
    </AppFrame>
  );
});
