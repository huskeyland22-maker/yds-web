import HomeV5DeskLead from "../home-v5/HomeV5DeskLead.jsx"

/**
 * 홈 v5 UI 미리보기 (/preview/home-v5)
 * @param {{ panicData?: object | null }} props
 */
export default function HomeV5Preview({ panicData = null }) {
  return <HomeV5DeskLead panicData={panicData} className="panic-v2-desk panic-v2-desk--terminal" />
}
