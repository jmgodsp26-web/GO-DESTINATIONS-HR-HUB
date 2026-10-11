import React from 'react';

/** Generic, decorative objects only. No employee data is fetched or displayed. */
export const LoginHRScene: React.FC = () => (
  <div className="go-hr-scene">
    <svg viewBox="0 0 600 270" role="img" aria-labelledby="go-hr-scene-title" focusable="false">
      <title id="go-hr-scene-title">Leave planning, your team, and documents, connected in one workplace.</title>
      <defs>
        <linearGradient id="hr-pearl" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" /><stop offset=".5" stopColor="#DDE6EF" /><stop offset="1" stopColor="#8EA7BE" /></linearGradient>
        <linearGradient id="hr-blue" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#8EACC7" /><stop offset=".45" stopColor="#3A5D83" /><stop offset="1" stopColor="#182E3F" /></linearGradient>
        <linearGradient id="hr-orange" x1="0" y1="0" x2=".9" y2="1"><stop stopColor="#FFE2B9" /><stop offset=".45" stopColor="#ED9027" /><stop offset="1" stopColor="#A95312" /></linearGradient>
        <linearGradient id="hr-platform" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#7087A3" stopOpacity=".65" /><stop offset="1" stopColor="#203C51" /></linearGradient>
        <radialGradient id="hr-sphere" cx=".3" cy=".2" r=".8"><stop stopColor="#FFF2DE" /><stop offset=".45" stopColor="#F1C48E" /><stop offset="1" stopColor="#B76A2B" /></radialGradient>
        <radialGradient id="hr-silver-sphere" cx=".28" cy=".2" r=".8"><stop stopColor="#fff" /><stop offset=".45" stopColor="#CFD7E1" /><stop offset="1" stopColor="#7087A3" /></radialGradient>
        <radialGradient id="hr-halo"><stop stopColor="#7087A3" stopOpacity=".22" /><stop offset="1" stopColor="#7087A3" stopOpacity="0" /></radialGradient>
        <filter id="hr-shadow" x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="0" dy="12" stdDeviation="8" floodColor="#081721" floodOpacity=".35" /></filter>
      </defs>

      <ellipse cx="300" cy="134" rx="292" ry="125" fill="url(#hr-halo)" />
      <path className="go-hr-orbit" d="M76 176 C158 230 411 237 523 174 M86 160 C190 103 425 106 518 160" fill="none" stroke="#9EAFC1" strokeOpacity=".24" strokeDasharray="3 7" />
      <path className="go-hr-energy" d="M112 192 C216 236 393 227 494 188" fill="none" stroke="#ED9027" strokeWidth="2" strokeLinecap="round" pathLength="1" />

      {[112,300,488].map((x,i) => (
        <g key={x}>
          <ellipse cx={x} cy="205" rx="70" ry="16" fill="#081721" opacity=".2" />
          <path d={`M${x-73} 173 Q${x} 142 ${x+73} 173 V184 Q${x} 225 ${x-73} 184 Z`} fill="url(#hr-blue)" />
          <ellipse cx={x} cy="173" rx="73" ry="26" fill="url(#hr-platform)" stroke="#9EAFC1" strokeOpacity=".5" />
          <ellipse cx={x} cy="173" rx="55" ry="18" fill="none" stroke="#CFD7E1" strokeOpacity=".16" />
          <text x={x} y="244" textAnchor="middle" className="go-hr-feature-title">{['Plan your leave','Your team','Your documents'][i]}</text>
        </g>
      ))}

      {/* Calendar: a thick, tilted object with separate cover, pages and rings. */}
      <g className="go-hr-float go-hr-float-leave">
        <g filter="url(#hr-shadow)">
          <g transform="translate(56 54) rotate(-9 55 54) skewY(5)">
            <rect x="7" y="8" width="110" height="109" rx="13" fill="#7087A3" />
            <rect x="3" y="4" width="110" height="109" rx="13" fill="#B6C6D6" />
            <rect width="110" height="109" rx="13" fill="url(#hr-pearl)" stroke="#fff" strokeOpacity=".7" />
            <path d="M13 0 H97 Q110 0 110 13 V31 H0 V13 Q0 0 13 0" fill="url(#hr-orange)" />
            {[25,85].map(x => <g key={x}><ellipse cx={x} cy="13" rx="5" ry="3" fill="#8E4D1C" /><path d={`M${x} 12 V-6`} stroke="#CFD7E1" strokeWidth="6" strokeLinecap="round" /><path d={`M${x-1} 10 V-6`} stroke="#fff" strokeWidth="2" strokeLinecap="round" /></g>)}
            {Array.from({length:12},(_,i) => <rect key={i} x={17+(i%4)*21} y={45+Math.floor(i/4)*18} width="12" height="10" rx="3" fill={i===5 || i===6 ? '#ED9027' : '#7087A3'} opacity={i===5 || i===6 ? 1 : .3} className={i===5 || i===6 ? 'go-hr-date-selected' : undefined} />)}
          </g>
          <g className="go-hr-badge" transform="translate(156 147)">
            <circle r="19" fill="#A95312" cy="4" /><circle r="19" fill="url(#hr-orange)" stroke="#FFE2B9" strokeOpacity=".65" />
            <path d="M-8 0 L-2 6 L9-7" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      </g>

      {/* Sculptural team: spherical heads and rounded bodies on a shared stage. */}
      <g className="go-hr-float go-hr-float-team" filter="url(#hr-shadow)">
        {[{x:263,y:99,s:.78},{x:339,y:100,s:.78},{x:300,y:77,s:1}].map((p,i) => <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.s})`}>
          <path d="M-25 61 V41 C-25 11 25 11 25 41 V61 Q0 77-25 61" fill={i===2 ? 'url(#hr-orange)' : 'url(#hr-blue)'} stroke="#CFD7E1" strokeOpacity=".2" />
          <path d="M-17 43 C-17 26-10 24-7 23" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round" />
          <circle cy="-2" r="20" fill={i===2 ? 'url(#hr-sphere)' : 'url(#hr-silver-sphere)'} />
          <ellipse cx="-7" cy="-10" rx="6" ry="3" fill="#fff" opacity=".25" transform="rotate(-30 -7 -10)" />
        </g>)}
        <g className="go-hr-spark"><path d="M352 50 V64 M345 57 H359" stroke="#F1C48E" strokeWidth="2" strokeLinecap="round" /><circle cx="245" cy="66" r="3" fill="#CFD7E1" opacity=".7" /></g>
      </g>

      {/* Folder: inset sheets, a dimensional side wall and a curved front lip. */}
      <g className="go-hr-float go-hr-float-docs" filter="url(#hr-shadow)">
        <g transform="translate(432 52) rotate(8 54 58)">
          <path d="M0 35 Q0 25 10 25 H39 L49 35 H111 V117 H0 Z" fill="url(#hr-blue)" stroke="#9EAFC1" strokeOpacity=".55" />
          <g className="go-hr-paper">
            <rect x="24" y="0" width="72" height="90" rx="8" fill="#9EAFC1" transform="rotate(7 60 50)" />
            <rect x="17" y="-4" width="72" height="90" rx="8" fill="url(#hr-pearl)" stroke="#fff" strokeOpacity=".7" />
            <rect x="29" y="10" width="22" height="6" rx="3" fill="#ED9027" />
            <path d="M29 30 H76 M29 41 H69 M29 52 H73" stroke="#7087A3" strokeOpacity=".6" strokeWidth="4" strokeLinecap="round" />
          </g>
          <path d="M-5 66 H105 L111 117 H0 Z" fill="#182E3F" />
          <path d="M-9 62 Q-10 57-4 57 H99 Q105 57 106 63 L111 117 H0 Z" fill="url(#hr-blue)" stroke="#9EAFC1" strokeOpacity=".7" />
          <path d="M-3 61 H99" stroke="#CFD7E1" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round" />
          <rect x="35" y="79" width="33" height="20" rx="6" fill="url(#hr-orange)" />
          <path d="M45 89 H58" stroke="#FFF2DE" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  </div>
);
