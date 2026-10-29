// Bound concurrent read-only disk work; preserve directory order and read errors.
// No result cache: callers always observe fresh records, including active runs.
export async function readList(items, read, concurrency = 8) {
  const result = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
    while(next < items.length){const index=next++;result[index]=await read(items[index]);}
  }));
  return result;
}
