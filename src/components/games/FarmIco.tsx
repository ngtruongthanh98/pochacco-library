/** Hình vẽ cho vật phẩm nông trại; món nào chưa có hình thì dùng emoji. */
const ART = new Set(['lua', 'carot', 'bap', 'cachua', 'bingo', 'duahau', 'dau', 'ot', 'huongduong', 'mia', 'caphe', 'nam', 'sen', 'ladong', 'dauxanh'])

export function Ico({ id, e }: { id: string; e: string }) {
  if (!ART.has(id)) return <>{e}</>
  return <img className="farm-ico" src={`${import.meta.env.BASE_URL}assets/farm/${id}.webp`} alt={e} draggable={false} />
}
