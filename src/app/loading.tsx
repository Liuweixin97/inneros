export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1060px] px-4 py-8 md:px-8" aria-busy="true" aria-label="正在加载">
      <div className="skeleton h-9 w-40 rounded-lg" />
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.45fr_0.75fr]">
        <div className="skeleton h-[370px] rounded-[28px]" />
        <div className="skeleton h-[370px] rounded-[28px]" />
      </div>
    </main>
  );
}
