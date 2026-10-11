import React from 'react';

/** Decorative examples only: no employee records or account data are loaded. */
export const LoginHRScene: React.FC = () => (
  <div className="go-hr-scene">
    <svg viewBox="0 0 560 240" role="img" aria-labelledby="go-hr-scene-title" focusable="false">
      <title id="go-hr-scene-title">Plan your leave, stay connected, and keep your documents in one place.</title>
      <path className="go-hr-route-guide" d="M84 196 C155 196 180 180 280 180 S405 196 476 196" />
      <path className="go-hr-route" pathLength="1" d="M84 196 C155 196 180 180 280 180 S405 196 476 196" />
      <circle className="go-hr-traveler" r="4" fill="#ED9027" />
      <g className="go-hr-card go-hr-card-leave">
        <rect x="4" y="22" width="166" height="157" rx="18" className="go-hr-card-surface" />
        <rect x="48" y="42" width="78" height="65" rx="9" fill="#182E3F" stroke="#7087A3" strokeOpacity=".5" />
        <path d="M48 60 H126 M67 38 V47 M107 38 V47" stroke="#CFD7E1" strokeWidth="3" strokeLinecap="round" />
        {[0,1,2,3,4,5,6,7].map(i => <rect key={i} x={59+(i%4)*16} y={70+Math.floor(i/4)*17} width="9" height="9" rx="3" className={i===2 || i===3 ? 'go-hr-date-selected' : 'go-hr-date'} />)}
        <text x="87" y="133" textAnchor="middle" className="go-hr-feature-title">Plan your leave</text>
        <text x="87" y="153" textAnchor="middle" className="go-hr-feature-copy">Make time for you</text>
      </g>
      <g className="go-hr-card go-hr-card-team">
        <rect x="197" y="4" width="166" height="157" rx="18" className="go-hr-card-surface" />
        {[{x:247,y:65,fill:'#9EAFC1'},{x:313,y:65,fill:'#CFD7E1'},{x:280,y:51,fill:'#F1C48E'}].map((person,i) => <g key={i} className={`go-hr-person go-hr-person-${i}`}>
          <circle cx={person.x} cy={person.y} r="12" fill={person.fill} />
          <path d={`M${person.x-19} ${person.y+37} Q${person.x-19} ${person.y+16} ${person.x} ${person.y+16} Q${person.x+19} ${person.y+16} ${person.x+19} ${person.y+37} Z`} fill={person.fill} fillOpacity=".6" />
        </g>)}
        <text x="280" y="120" textAnchor="middle" className="go-hr-feature-title">Stay connected</text>
        <text x="280" y="140" textAnchor="middle" className="go-hr-feature-copy">One GO team</text>
      </g>
      <g className="go-hr-card go-hr-card-docs">
        <rect x="390" y="22" width="166" height="157" rx="18" className="go-hr-card-surface" />
        <path d="M433 72 V55 Q433 49 439 49 H461 L469 57 H508 V103 H433 Z" fill="#7087A3" />
        <g className="go-hr-paper"><rect x="450" y="39" width="44" height="54" rx="5" fill="#F4F6F9" /><path d="M459 52 H484 M459 61 H480 M459 70 H475" stroke="#7087A3" strokeWidth="3" strokeLinecap="round" /></g>
        <path d="M433 71 H510 L504 104 H439 Z" fill="#3A5D83" stroke="#9EAFC1" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M465 87 L470 92 L480 81" stroke="#F1C48E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text x="473" y="133" textAnchor="middle" className="go-hr-feature-title">Your documents</text>
        <text x="473" y="153" textAnchor="middle" className="go-hr-feature-copy">Together in one place</text>
      </g>
      <text x="280" y="230" textAnchor="middle" className="go-hr-scene-caption">YOUR EVERYDAY HR, CONNECTED.</text>
    </svg>
  </div>
);
