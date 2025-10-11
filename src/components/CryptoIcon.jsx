import React from 'react'
import btcIcon from 'cryptocurrency-icons/svg/color/btc.svg'
import ethIcon from 'cryptocurrency-icons/svg/color/eth.svg'
import adaIcon from 'cryptocurrency-icons/svg/color/ada.svg'
import xrpIcon from 'cryptocurrency-icons/svg/color/xrp.svg'
import ltcIcon from 'cryptocurrency-icons/svg/color/ltc.svg'
import dogeIcon from 'cryptocurrency-icons/svg/color/doge.svg'
import solIcon from 'cryptocurrency-icons/svg/color/sol.svg'
import linkIcon from 'cryptocurrency-icons/svg/color/link.svg'
import bnbIcon from 'cryptocurrency-icons/svg/color/bnb.svg'
import paxgIcon from 'cryptocurrency-icons/svg/color/paxg.svg'

const ICONS = {
  BTC: btcIcon,
  ETH: ethIcon,
  ADA: adaIcon,
  XRP: xrpIcon,
  LTC: ltcIcon,
  DOGE: dogeIcon,
  SOL: solIcon,
  LINK: linkIcon,
  BNB: bnbIcon,
  PAXG: paxgIcon,
}

function CryptoIcon({ simbolo, size = 40 }) {
  const src = ICONS[simbolo.toUpperCase()]
  if (!src) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
      >
        <circle cx="50" cy="50" r="48" stroke="#FFD700" strokeWidth="4" fill="#0A0A0A" />
        <text
          x="50%"
          y="55%"
          textAnchor="middle"
          fontSize="32"
          fontWeight="bold"
          fill="#FFFFFF"
          fontFamily="Arial, sans-serif"
        >
          {simbolo}
        </text>
      </svg>
    )
  }
  return <img src={src} alt={simbolo} width={size} height={size} />
}

export default CryptoIcon
