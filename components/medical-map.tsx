'use client';
import {useState} from 'react';
import geometry from '../lib/korea-map.json';
import islands from '../lib/korea-islands.json';
type Group={label:string,total:number,pharmacy:number,hospital:number};
const labels:Record<string,[string,number,number]>={
 '서울특별시':['서울',127,37.56],'부산광역시':['부산',129.08,35.17],'대구광역시':['대구',128.60,35.88],'인천광역시':['인천',126.35,37.42],
 '광주광역시':['광주',126.84,35.15],'대전광역시':['대전',127.40,36.31],'울산광역시':['울산',129.38,35.56],'세종특별자치시':['세종',127.26,36.60],
 '경기도':['경기',127.23,37.93],'강원특별자치도':['강원',128.43,37.84],'충청북도':['충북',127.90,36.91],'충청남도':['충남',126.74,36.64],
 '전북특별자치도':['전북',127.19,35.78],'전라남도':['전남',127.02,34.77],'경상북도':['경북',128.79,36.63],'경상남도':['경남',128.18,35.30],'제주특별자치도':['제주',126.57,33.38]
};
const count=(v:number)=>Number(v||0).toLocaleString('ko-KR');
const scale=[{min:10000,color:'#b91c1c',label:'10,000 이상'},{min:5000,color:'#ef7c22',label:'5,000–9,999'},{min:3000,color:'#f2cf53',label:'3,000–4,999'},{min:1000,color:'#60bdad',label:'1,000–2,999'},{min:0,color:'#88b9eb',label:'1,000 미만'}];
export default function MedicalMap({groups,selected,ready,onSelect}:{groups:Group[],selected:string,ready:boolean,onSelect:(name:string)=>void}){
 const [hover,setHover]=useState('');
 const active=hover||selected;
 const item=groups.find(g=>g.label===active);
 const color=(name:string)=>{const g=groups.find(x=>x.label===name);if(!ready||!g)return '#dce8f3';return scale.find(s=>g.total>=s.min)?.color||'#dce8f3';};
 return <div className="map-content"><div className="maplegend"><b>의료기관 수</b>{scale.map(s=><span key={s.label}><i style={{background:s.color}}/>{s.label}</span>)}<span><i style={{background:'#dce8f3'}}/>현재 조건에서 수치 미표시</span></div><div className="mapcanvas"><svg viewBox="0 0 565 535" aria-label="대한민국 17개 시·도 및 울릉도·독도 의료기관 분포 지도" className="korea-map">
  <defs><filter id="map-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#36628f" floodOpacity=".10"/></filter></defs>
  <g filter="url(#map-shadow)">{geometry.map(r=><path key={r.name} d={r.path} fill={color(r.name)} fillRule="evenodd" stroke={active===r.name?'#0b436c':'#fff'} strokeWidth={active===r.name?2.3:1.1} role="button" tabIndex={0} aria-label={r.name+(ready&&groups.find(g=>g.label===r.name)?' '+count(groups.find(g=>g.label===r.name)!.total)+'개 기관':' 선택')} aria-pressed={selected===r.name} onClick={()=>onSelect(r.name)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(r.name);}}} onMouseEnter={()=>setHover(r.name)} onMouseLeave={()=>setHover('')} onFocus={()=>setHover(r.name)} onBlur={()=>setHover('')}><title>{r.name}</title></path>)}</g>
  <rect x="118" y="447" width="95" height="62" fill="transparent" className="jeju-hitarea" aria-hidden="true" onClick={()=>onSelect('제주특별자치도')} onMouseEnter={()=>setHover('제주특별자치도')} onMouseLeave={()=>setHover('')}/>
  {Object.entries(labels).map(([name,[short,lon,lat]])=>{const x=(lon-124.5)*75+8,y=(38.8-lat)*85+15;return <g key={name} className="maplabel" onClick={()=>onSelect(name)} aria-hidden="true"><text x={x} y={y} textAnchor="middle" fill={color(name)==='#b91c1c'?'#fff':'#173e67'}>{short}</text></g>;})}
  {islands.map(island=><path className="map-island" key={island.name} d={island.path} fill={color('경상북도')} fillRule="evenodd" aria-hidden="true" pointerEvents="none"/>)}
 </svg>
 {selected&&<button className="mapreset" onClick={()=>onSelect('')}>전국 보기</button>}
 </div>
 <div className="mapselection" aria-live="polite"><span>{active||'전국 17개 시·도'}</span>{item&&ready?<><strong>{count(item.total)}<small>개 기관</small></strong><p>약국 {count(item.pharmacy)} · 병·의원 {count(item.hospital)}</p></>:<><strong>{selected?'지역 선택':'지역별 분포'}</strong><p>{ready?'지도에서 지역을 선택해 자세히 확인하세요.':'공공 데이터 연결 후 기관 수가 표시됩니다.'}</p></>}</div>
 </div>;
}
