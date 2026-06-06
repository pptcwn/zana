export function WorkflowConnector({ active = false }: { active?: boolean }) {
  return (
    <span
      aria-hidden
      className={`absolute top-1/2 -right-1 size-2 -translate-y-1/2 rounded-full transition-[transform,background-color,box-shadow] duration-200 ease-out ${
        active
          ? "scale-150 bg-primary shadow-[0_0_14px_rgba(197,107,122,0.65)]"
          : "bg-pink-200"
      }`}
    />
  );
}
