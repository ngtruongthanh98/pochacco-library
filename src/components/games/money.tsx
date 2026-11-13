// Xu và kim cương hiển thị bằng hình trong bộ asset (dùng chung cho Tiệm mì cay và Nông trại).
import { nAsset } from './noodle'

/** Số xu kèm hình đồng xu. */
export const Xu = ({ n, sign = '' }: { n: number; sign?: string }) => (
  <span className="ns-money">
    {sign}
    {n.toLocaleString('vi-VN')}
    <img src={nAsset('coin')} alt=" xu" />
  </span>
)
/** Số kim cương kèm hình viên kim cương của tiệm. */
export const KimCuong = ({ n, sign = '' }: { n: number; sign?: string }) => (
  <span className="ns-money">
    {sign}
    {n}
    <img src={nAsset('gem')} alt=" kim cương" />
  </span>
)
/** Thông báo có chèn hình: {xu:123} và {kc:1} được thay bằng số kèm hình. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\{(?:xu|kc):[^}]+\})/)
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\{(xu|kc):([^}]+)\}$/)
        if (!m) return p
        const n = Number(m[2])
        return m[1] === 'xu' ? <Xu key={i} n={n} /> : <KimCuong key={i} n={n} />
      })}
    </>
  )
}

