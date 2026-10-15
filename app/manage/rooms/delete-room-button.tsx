"use client";

import { useActionState } from "react";
import { deleteRoom } from "./actions";
import { Button } from "@/components/ui/button";

export function DeleteRoomButton({
  roomId,
  roomName,
}: {
  roomId: string;
  roomName: string;
}) {
  const [state, formAction, pending] = useActionState(deleteRoom, null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Delete "${roomName}"? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="room_id" value={roomId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Deleting..." : "Delete"}
      </Button>
      {state?.error && (
        <p className="mt-1 text-xs text-red-600">{state.error}</p>
      )}
    </form>
  );
}