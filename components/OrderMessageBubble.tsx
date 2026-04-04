import type { BLOrderMessage } from "@/utils/types.ts";
import { humanTime } from "@/utils/format.ts";
import { decodeHtml } from "@/utils/html.ts";

function MessageHeader({ msg, direction }: { msg: BLOrderMessage; direction: "start" | "end" }) {
  return (
    <div class="chat-header">
      {direction === "start" ? msg.from : "You"}
      {msg.subject && <span class="text-xs opacity-60 ml-2">{decodeHtml(msg.subject)}</span>}
      <time class="text-xs opacity-50 ml-2">{humanTime(new Date(msg.dateSent))}</time>
    </div>
  );
}

export function OrderMessageBubble({ msg, direction }: { msg: BLOrderMessage; direction: "start" | "end" }) {
  if (direction === "end") {
    return (
      <div class="chat chat-end">
        <MessageHeader msg={msg} direction="end" />
        <div class="chat-bubble chat-bubble-secondary whitespace-pre-wrap">{decodeHtml(msg.body)}</div>
      </div>
    );
  }
  return (
    <div class="chat chat-start">
      <MessageHeader msg={msg} direction="start" />
      <div class="chat-bubble chat-bubble-primary whitespace-pre-wrap">{decodeHtml(msg.body)}</div>
    </div>
  );
}
